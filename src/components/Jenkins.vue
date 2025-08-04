<template>
  <div>
    <el-container v-loading="loading">
      <el-header>
        <el-row :gutter="20">
          <el-col :span="16">
            <el-select v-model="state.currentJobName" placeholder="请选择 Job" @change="onJobChange" filterable>
              <el-option v-for="job in state.jobs" :key="job.name" :label="job.name" :value="job.name">
                <span style="float: left">{{ job.name }}</span>
                <span style="float: right; color: var(--el-text-color-secondary); font-size: 13px">
                  <el-tag :color="getJobColor(job.color)" style="margin-right: 8px;" size="small" />
                </span>
              </el-option>
            </el-select>
          </el-col>
          <el-col :span="8">
            <el-button type="primary" @click="buildJob" :disabled="!state.currentJobName">构建</el-button>
            <el-button @click="openInBrowser">在浏览器中打开</el-button>
          </el-col>
        </el-row>
      </el-header>
      <el-main>
        <el-table :data="state.builds" style="width: 100%" v-if="state.builds.length > 0">
          <el-table-column prop="number" label="#" width="80" />
          <el-table-column prop="result" label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="getBuildStatusType(row.result, row.building)">
                {{ getBuildStatusText(row.result, row.building) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="描述" />
          <el-table-column prop="duration" label="耗时" width="120">
            <template #default="{ row }">
              {{ formatDuration(row.duration) }}
            </template>
          </el-table-column>
          <el-table-column prop="timestamp" label="构建时间" width="180">
            <template #default="{ row }">
              {{ formatTimestamp(row.timestamp) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150">
            <template #default="{ row }">
              <el-button size="small" @click="openBuildInBrowser(row.url)">查看</el-button>
              <el-button size="small" type="danger" @click="stopBuild(row.number)" v-if="row.building">停止</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty description="暂无构建历史" v-else />
      </el-main>
    </el-container>

    <el-dialog v-model="buildWithParamsDialogVisible" title="带参数构建">
      <el-form :model="buildParams" label-width="120px">
        <el-form-item v-for="param in state.jobParameters" :key="param.name" :label="param.name">
          <el-input v-model="buildParams[param.name]" v-if="param.type === 'StringParameterDefinition'" />
          <el-select v-model="buildParams[param.name]" v-if="param.type === 'ChoiceParameterDefinition'" placeholder="请选择">
            <el-option v-for="choice in param.choices" :key="choice" :label="choice" :value="choice" />
          </el-select>
          <el-switch v-model="buildParams[param.name]" v-if="param.type === 'BooleanParameterDefinition'" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="buildWithParamsDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitBuildWithParams">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import moment from 'moment';
import { createJenkinsApi } from '../api/jenkins.js';

// 定义组件的 props
const props = defineProps({
  config: {
    type: Object,
    required: true
  }
});

// 响应式状态
const loading = ref(true);
const state = reactive({
  jobs: [],
  builds: [],
  currentJobName: null,
  jobParameters: [],
});
const buildParams = reactive({});
const buildWithParamsDialogVisible = ref(false);

let jenkinsApi = null;

// --- 生命周期钩子 ---
onMounted(() => {
  initJenkins();
});

// --- 方法 ---
async function initJenkins() {
  if (!props.config || !props.config.baseUrl) {
    ElMessage.error('Jenkins 配置无效，请先进行配置',props.config);
    loading.value = false;
    return;
  }

  try {
    loading.value = true;
    // 1. 创建 API 实例
    const api = createJenkinsApi(props.config);

    // 2. 获取 CSRF Crumb
    const crumbData = await api.getCrumb();
    if (crumbData) {
      props.config.crumb = crumbData.crumb;
      jenkinsApi = createJenkinsApi(props.config); // 使用包含 crumb 的新配置重新创建 api 实例
    } else {
      jenkinsApi = api;
    }

    // 3. 获取 Jobs
    const jobsData = await jenkinsApi.getJobs();
    state.jobs = jobsData.jobs;

  } catch (error) {
    console.error(error);
    ElMessage.error(`初始化失败: ${error.message}`);
  } finally {
    loading.value = false;
  }
}

async function onJobChange(jobName) {
  state.currentJobName = jobName;
  await getBuilds(jobName);
}

async function getBuilds(jobName) {
  if (!jenkinsApi) return;
  try {
    loading.value = true;
    const jobData = await jenkinsApi.getJob(jobName);
    state.builds = jobData.builds || [];
    // 提取参数定义
    const parameterDefinitionsAction = jobData.actions.find(a => a.parameterDefinitions);
    state.jobParameters = parameterDefinitionsAction ? parameterDefinitionsAction.parameterDefinitions : [];
  } catch (error) {
    console.error(error);
    ElMessage.error(`获取构建历史失败: ${error.message}`);
  } finally {
    loading.value = false;
  }
}

async function buildJob() {
  if (!state.currentJobName || !jenkinsApi) return;

  // 如果有参数，则弹出参数对话框
  if (state.jobParameters && state.jobParameters.length > 0) {
    // 初始化参数
    state.jobParameters.forEach(param => {
      buildParams[param.name] = param.defaultParameterValue?.value;
    });
    buildWithParamsDialogVisible.value = true;
  } else {
    // 直接构建
    try {
      loading.value = true;
      await jenkinsApi.buildJob(state.currentJobName);
      ElMessage.success('构建已触发');
      // 延迟一会再刷新，等待 Jenkins 创建好构建任务
      setTimeout(() => getBuilds(state.currentJobName), 2000);
    } catch (error) {
      console.error(error);
      ElMessage.error(`构建失败: ${error.message}`);
    } finally {
      loading.value = false;
    }
  }
}

async function submitBuildWithParams() {
  if (!state.currentJobName || !jenkinsApi) return;
  try {
    loading.value = true;
    await jenkinsApi.buildWithParams(state.currentJobName, buildParams);
    ElMessage.success('带参数构建已触发');
    buildWithParamsDialogVisible.value = false;
    setTimeout(() => getBuilds(state.currentJobName), 2000);
  } catch (error) {
    console.error(error);
    ElMessage.error(`构建失败: ${error.message}`);
  } finally {
    loading.value = false;
  }
}

async function stopBuild(buildNumber) {
  if (!state.currentJobName || !jenkinsApi) return;
  try {
    await ElMessageBox.confirm('确定要停止这个构建吗？', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });

    loading.value = true;
    await jenkinsApi.stopBuild(state.currentJobName, buildNumber);
    ElMessage.success('停止指令已发送');
    setTimeout(() => getBuilds(state.currentJobName), 2000);
  } catch (error) {
    // 如果用户点击取消，会进入 catch，但我们不需要显示错误信息
    if (error !== 'cancel') {
      console.error(error);
      ElMessage.error(`停止构建失败: ${error.message}`);
    }
  } finally {
    loading.value = false;
  }
}

function openInBrowser() {
  if (state.currentJobName) {
    const url = `${props.config.baseUrl}/job/${state.currentJobName}`;
    window.utools.shellOpenExternal(url);
  }
}

function openBuildInBrowser(buildUrl) {
  window.utools.shellOpenExternal(buildUrl);
}

// --- 辅助函数 ---
function getJobColor(color) {
  if (!color) return '#808080'; // 默认灰色
  if (color.includes('anime')) return '#f9d71c'; // 动画中，黄色
  if (color === 'blue') return '#67c23a'; // 成功，绿色
  if (color === 'red') return '#f56c6c'; // 失败，红色
  if (color === 'aborted') return '#909399'; // 中止，灰色
  return '#808080';
}

function getBuildStatusType(result, building) {
  if (building) return 'primary';
  if (result === 'SUCCESS') return 'success';
  if (result === 'FAILURE') return 'danger';
  if (result === 'ABORTED') return 'info';
  return 'warning';
}

function getBuildStatusText(result, building) {
  if (building) return '构建中';
  if (result === 'SUCCESS') return '成功';
  if (result === 'FAILURE') return '失败';
  if (result === 'ABORTED') return '已中止';
  return '未知';
}

function formatDuration(ms) {
  if (!ms) return '-';
  return moment.duration(ms).humanize();
}

function formatTimestamp(ts) {
  if (!ts) return '-';
  return moment(ts).format('YYYY-MM-DD HH:mm:ss');
}

</script>

<style scoped>
.el-header {
  padding-top: 20px;
}
</style>
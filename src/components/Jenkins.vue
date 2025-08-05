<template>
  <div>
    <el-container v-loading="loading">
      <el-header>
        <el-row :gutter="20">
          <el-col :span="16">
            <el-input
              v-model="searchQuery"
              placeholder="搜索 Job"
              clearable
              @input="debouncedFilterJobs"
            />
          </el-col>
          <el-col :span="8" style="text-align: right">
            <el-tooltip content="刷新列表" placement="top">
              <el-button circle @click="refreshAllJobs">
                <el-icon><Refresh /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="设置" placement="top">
              <el-button circle @click="goToConfig">
                <el-icon><Setting /></el-icon>
              </el-button>
            </el-tooltip>
          </el-col>
        </el-row>
      </el-header>
      <el-main>
        <el-table
          v-if="filteredJobs.length > 0"
          :data="filteredJobs"
          style="width: 100%"
          row-key="name"
          stripe
          border
        >
          <el-table-column
            prop="name"
            label="Name"
            sortable
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span v-html="highlightMatchedText(row.name, searchQuery)"></span>
            </template>
          </el-table-column>
          <el-table-column label="最近一次 Job" width="100">
            <template #default="{ row }">
              <el-tag
                v-if="row.latestBuild"
                :type="
                  getBuildStatusType(
                    row.latestBuild.result,
                    row.latestBuild.building
                  )
                "
              >
                {{
                  getBuildStatusText(
                    row.latestBuild.result,
                    row.latestBuild.building
                  )
                }}
              </el-tag>
              <span v-else>无构建历史</span>
            </template>
          </el-table-column>
          <el-table-column label="Change Message" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.latestBuild?.changeSet?.items[0]?.msg || "-" }}
            </template>
          </el-table-column>
          <el-table-column
            label="Build Time"
            sortable
            sort-by="latestBuild.timestamp"
            width="140"
          >
            <template #default="{ row }">
              {{ formatTimestamp(row.latestBuild?.timestamp) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-tooltip content="刷新" placement="top">
                <el-button
                  circle
                  @click="refreshJob(row.name)"
                  :loading="jobLoading[row.name]"
                >
                  <el-icon><Refresh /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="构建菜单" placement="top">
                <el-button circle @click="openBuildMenu(row)">
                  <el-icon><Menu /></el-icon>
                </el-button>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无 Job，请检查配置或刷新" />
      </el-main>
    </el-container>

    <el-dialog
      v-model="buildMenuVisible"
      :title="`构建菜单 - ${selectedJob?.name}`"
      width="80%"
      top="5vh"
      :lock-scroll="false"
      :destroy-on-close="true"
    >
      <div
        class="build-table-container"
        style="max-height: 60vh; overflow-y: auto"
      >
        <el-table :data="displayedBuilds" style="width: 100%" stripe border>
          <el-table-column prop="number" label="No" width="60" />
          <el-table-column prop="url" label="URL" show-overflow-tooltip>
            <template #default="{ row }">
              <el-link :href="row.url" target="_blank">{{ row.url }}</el-link>
            </template>
          </el-table-column>
          <el-table-column label="Progress" width="90">
            <template #default="{ row }">
              <el-progress
                v-if="row.building"
                :percentage="50"
                :indeterminate="true"
              />
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="result" label="Result" width="100" />
          <el-table-column prop="timestamp" label="Build Time" width="120">
            <template #default="{ row }">
              {{ formatTimestamp(row.timestamp) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80">
            <template #default="{ row }">
              <el-tooltip content="刷新" placement="top">
                <el-button
                  circle
                  @click="refreshBuild(selectedJob.name, row.number)"
                  :loading="buildLoading[`${selectedJob.name}-${row.number}`]"
                >
                  <el-icon><Refresh /></el-icon>
                </el-button>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
        <div class="build-table-footer">
          <el-button
            v-if="selectedJobBuilds.length > 10"
            text
            @click="showAllBuilds = !showAllBuilds"
          >
            {{ showAllBuilds ? "收起" : "展开全部" }}
          </el-button>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button type="primary" @click="buildJob">立即构建</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { ElMessage, ElIcon } from "element-plus";
import { Refresh, Menu, Setting } from "@element-plus/icons-vue";
import moment from "moment";
import { createJenkinsApi } from "../api/jenkins.js";
import { getBuildStatusType, getBuildStatusText } from "../js/jenkins-utils.js";
import utools_dev from "../js/utools_mock";

let utools = window.utools ? window.utools : utools_dev;

// --- 辅助函数 ---
function formatTimestamp(ts) {
  if (!ts) return "-";
  return moment(ts).fromNow();
}

function highlightMatchedText(text, query) {
  if (!query) return text;
  const keywords = query
    .toLowerCase()
    .split(" ")
    .filter((k) => k);
  let highlightedText = text;
  keywords.forEach((keyword) => {
    const regex = new RegExp(`(${keyword})`, "gi");
    highlightedText = highlightedText.replace(
      regex,
      '<span class="highlight">$1</span>'
    );
  });
  return highlightedText;
}

function debounce(func, delay) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}
// --- 响应式状态 ---
const loading = ref(true);
const jobLoading = ref({});
const buildLoading = ref({});
const currentJenkinsConfig = ref(null);
const allJobs = ref([]);
const searchQuery = ref("");
const buildMenuVisible = ref(false);
const selectedJob = ref(null);
const selectedJobBuilds = ref([]);
const showAllBuilds = ref(false);

const filteredJobs = computed(() => {
  if (!searchQuery.value) {
    return allJobs.value;
  }
  // Multi-keyword search (AND logic)
  const keywords = searchQuery.value
    .toLowerCase()
    .split(" ")
    .filter((k) => k);
  return allJobs.value.filter((job) => {
    const jobName = job.name.toLowerCase();
    return keywords.every((keyword) => jobName.includes(keyword));
  });
});

const displayedBuilds = computed(() => {
  if (showAllBuilds.value) {
    return selectedJobBuilds.value;
  }
  return selectedJobBuilds.value.slice(0, 10);
});

let jenkinsApi = null;

// --- 手动实现滚动锁定，目标为 <html> ---
watch(buildMenuVisible, (isVisible) => {
  const htmlElement = document.documentElement; // document.documentElement 就是 <html> 标签
  if (isVisible) {
    htmlElement.classList.add("html-no-scroll");
  } else {
    htmlElement.classList.remove("html-no-scroll");
  }
});

// --- 生命周期钩子 ---
onMounted(() => {
  const allConfigs = utools.db.allDocs("jenkins");
  if (allConfigs && allConfigs.length > 0) {
    currentJenkinsConfig.value = allConfigs[0].data;
    initJenkins();
  } else {
    loading.value = false;
    ElMessage({
      message: "未找到 Jenkins 配置，请先进行配置。",
      type: "error",
      duration: 0,
      showClose: true,
      onClose: () => utools.redirect("jenkins-set", ""),
    });
  }
});

// --- 方法 ---
function goToConfig() {
  utools.redirect("jenkins-set", "");
}

async function initJenkins() {
  if (!currentJenkinsConfig.value || !currentJenkinsConfig.value.url) {
    ElMessage.error("Jenkins 配置无效，请先进行配置");
    loading.value = false;
    return;
  }

  await withLoading(async () => {
    const api = createJenkinsApi(currentJenkinsConfig.value);
    const crumbData = await api.getCrumb();
    if (crumbData) {
      currentJenkinsConfig.value.crumb = crumbData.crumb;
      jenkinsApi = createJenkinsApi(currentJenkinsConfig.value);
    } else {
      jenkinsApi = api;
    }
    await refreshAllJobs();
  }, "初始化 Jenkins 失败");
}

async function refreshAllJobs() {
  await withLoading(async () => {
    const jobsData = await jenkinsApi.getJobsWithLatestBuild();
    allJobs.value = jobsData.jobs.sort(
      (a, b) =>
        (b.latestBuild?.timestamp || 0) - (a.latestBuild?.timestamp || 0)
    );
  }, "刷新 Job 列表失败");
}

async function refreshJob(jobName) {
  jobLoading.value[jobName] = true;
  try {
    const jobData = await jenkinsApi.getJob(jobName);
    const index = allJobs.value.findIndex((job) => job.name === jobName);
    if (index !== -1) {
      allJobs.value[index] = { ...allJobs.value[index], ...jobData };
    }
  } catch (error) {
    console.error(`刷新 Job ${jobName} 失败:`, error);
    ElMessage.error(`刷新 Job ${jobName} 失败: ${error.message || "未知错误"}`);
  } finally {
    jobLoading.value[jobName] = false;
  }
}

async function openBuildMenu(job) {
  selectedJob.value = job;
  buildMenuVisible.value = true;
  showAllBuilds.value = false; // 重置状态
  await withLoading(async () => {
    const jobData = await jenkinsApi.getJob(job.name);
    selectedJobBuilds.value = jobData.builds || [];
  }, `获取 Job ${job.name} 的构建历史失败`);
}

async function buildJob() {
  if (!selectedJob.value || !jenkinsApi) return;

  const jobData = await jenkinsApi.getJob(selectedJob.value.name);
  const parameterDefinitionsAction = jobData.actions.find(
    (a) => a.parameterDefinitions
  );
  const jobParameters = parameterDefinitionsAction
    ? parameterDefinitionsAction.parameterDefinitions
    : [];

  if (jobParameters.length > 0) {
    ElMessage.info("此 Job 包含参数，请在 Jenkins 页面手动构建。");
  } else {
    await withLoading(async () => {
      await jenkinsApi.buildJob(selectedJob.value.name);
      ElMessage.success(`构建已触发。`);
      await refreshJob(selectedJob.value.name);
    }, `构建 Job ${selectedJob.value.name} 失败`);
  }
}

async function refreshBuild(jobName, buildNumber) {
  buildLoading.value[`${jobName}-${buildNumber}`] = true;
  try {
    const buildData = await jenkinsApi.getBuild(jobName, buildNumber);
    const buildIndex = selectedJobBuilds.value.findIndex(
      (build) => build.number === buildNumber
    );
    if (buildIndex !== -1) {
      selectedJobBuilds.value[buildIndex] = {
        ...selectedJobBuilds.value[buildIndex],
        ...buildData,
      };
    }
  } catch (error) {
    console.error(`刷新构建 #${buildNumber} 失败:`, error);
    ElMessage.error(`刷新构建 #${buildNumber} 失败: ${error.message || "未知错误"}`);
  } finally {
    buildLoading.value[`${jobName}-${buildNumber}`] = false;
  }
}

async function withLoading(fn, errorMessage = "操作失败") {
  loading.value = true;
  try {
    await fn();
  } catch (error) {
    console.error(errorMessage + ":", error);
    ElMessage.error(`${errorMessage}: ${error.message || "未知错误"}`);
  } finally {
    loading.value = false;
  }
}

// Debounced filter function
const debouncedFilterJobs = debounce(() => {
  // The actual filtering logic is now in the computed property `filteredJobs`
  // This function just triggers the re-evaluation of `filteredJobs`
}, 300);
</script>

<style scoped>
.el-header {
  padding-top: 20px;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end; /* 让按钮靠右 */
  width: 100%;
}

.build-table-container::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}
.build-table-container {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}

.build-table-footer {
  text-align: center; /* 居中 */
  padding-top: 10px; /* 与表格的间距 */
}

.highlight {
  background-color: yellow;
  font-weight: bold;
}
</style>

<style>
/* 1. 始终为滚动条轨道预留空间，防止布局跳动 */
html {
  scrollbar-gutter: stable;
}

/* 2. 视觉上隐藏主滚动条 */
html::-webkit-scrollbar {
  display: none; /* Webkit 浏览器 (Chrome, Safari, Edge) */
}
html {
  -ms-overflow-style: none; /* IE */
  scrollbar-width: none; /* Firefox */
}

/* 3. 定义一个用于锁定滚动的类 */
html.html-no-scroll {
  overflow: hidden;
}
</style>

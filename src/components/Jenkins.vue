<template>
  <div>
    <el-container v-loading="loading">
      <el-header>
        <el-row :gutter="20" align="middle">
          <el-col :span="16">
            <el-input
              v-model="searchQuery"
              placeholder="搜索 Job"
              clearable
              @input="debouncedFilterJobs"
              class="input-with-select"
            >
              <template #prepend>
                <el-select
                  v-model="selectedConfigId"
                  placeholder="实例"
                  @change="handleConfigChange"
                  style="width: 130px"
                >
                  <el-option
                    v-for="config in allConfigs"
                    :key="config._id"
                    :label="config.data.url"
                    :value="config._id"
                  />
                </el-select>
              </template>
            </el-input>
          </el-col>
          <el-col :span="8" style="text-align: right">
            <!-- 4. 增加数据新鲜度指示 -->
            <span class="update-time-display">{{
              lastUpdateTimeFormatted
            }}</span>
            <el-tooltip content="刷新列表" placement="top">
              <el-button circle @click="refreshAllJobs"
                ><el-icon><Refresh /></el-icon
              ></el-button>
            </el-tooltip>
            <el-tooltip content="设置" placement="top">
              <el-button circle @click="goToConfig"
                ><el-icon><Setting /></el-icon
              ></el-button>
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
          <!-- 2. 增加行内状态指示器 -->
          <el-table-column
            prop="name"
            label="Name"
            min-width="150"
            sortable
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <div class="job-name-container">
                <span
                  class="status-dot"
                  :class="getJobStatusClass(row.color)"
                ></span>
                <span
                  class="link-style"
                  @click="openJenkinsJobUrl(row.name)"
                  v-html="highlightMatchedText(row.name, searchQuery)"
                ></span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="最近一次 Job" min-width="60">
            <template #default="{ row }">
              <el-tag
                v-if="row.lastBuild"
                :type="
                  getBuildStatusType(
                    row.lastBuild.result,
                    row.lastBuild.building
                  )
                "
                class="link-style"
                @click="openJenkinsBuildUrl(row.name, row.lastBuild.number)"
              >
                {{
                  getBuildStatusText(
                    row.lastBuild.result,
                    row.lastBuild.building
                  )
                }}
              </el-tag>
              <span v-else>无构建历史</span>
            </template>
          </el-table-column>
          <!-- 1. 优化 “Change Message” 列的视觉一致性 -->
          <el-table-column label="Change Message" min-width="220">
            <template #default="{ row }">
              <el-tooltip
                :raw-content="true"
                :content="getFullChangeSets(row.lastBuild?.changeSets)"
                placement="top"
                :disabled="
                  !row.lastBuild?.changeSets ||
                  row.lastBuild.changeSets.length === 0
                "
              >
                <span class="single-line-ellipsis">
                  {{ getFirstLineChangeSet(row.lastBuild?.changeSets) }}
                </span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column
            label="Time"
            sortable
            sort-by="lastBuild.timestamp"
            min-width="84"
          >
            <template #default="{ row }">
              {{ formatTimestamp(row.lastBuild?.timestamp) }}
            </template>
          </el-table-column>
          <!-- 3. 引入 “悬浮操作” -->
          <el-table-column
            label="Action"
            min-width="90"
            align="center"
            class-name="action-column"
          >
            <template #default="{ row }">
              <el-button
                circle
                @click="refreshJob(row.name)"
                :loading="jobLoading[row.name]"
              >
                <el-icon><Refresh /></el-icon>
              </el-button>
              <el-button circle @click="openBuildMenu(row)">
                <el-icon><Menu /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无 Job，请检查配置或刷新" />
      </el-main>
    </el-container>

    <el-drawer
      v-model="buildMenuVisible"
      v-loading="drawerLoading"
      direction="rtl"
      :show-close="false"
      size="80%"
      :destroy-on-close="true"
    >
      <template #header>
        <h4 class="drawer-title">
          构建菜单 -
          <span class="link-style" @click="openJenkinsJobUrl(selectedJob.name)">
            {{ selectedJob?.name }}</span
          >
        </h4>
      </template>
      <el-scrollbar max-height="60vh" class="build-table-container">
        <el-table :data="displayedBuilds" style="width: 100%" stripe border>
          <el-table-column prop="number" label="No" min-width="40">
            <template #default="{ row }">
              <span
                class="link-style"
                @click="openJenkinsBuildUrl(selectedJob.name, row.number)"
                >{{ row.number }}</span
              >
            </template>
          </el-table-column>
          <el-table-column
            prop="url"
            label="URL"
            min-width="150"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <el-link :href="row.url" target="_blank">{{ row.url }}</el-link>
            </template>
          </el-table-column>
          <el-table-column label="Progress" min-width="80">
            <template #default="{ row }">
              <div
                v-if="row.building"
                style="display: flex; align-items: center"
              >
                <el-progress
                  :indeterminate="true"
                  style="width: 60px; margin-right: 8px"
                />
                <span>进行中...</span>
              </div>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="Result" min-width="60" align="center">
            <template #default="{ row }">
              <el-tooltip
                :content="getBuildStatusText(row.result, row.building)"
                placement="top"
              >
                <span style="font-size: 1em">{{
                  getBuildStatusIcon(row.result, row.building)
                }}</span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column prop="timestamp" label="Build Time" min-width="120">
            <template #default="{ row }">
              {{ formatTimestamp(row.timestamp) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" min-width="70">
            <template #default="{ row }">
              <el-button
                circle
                @click="refreshBuild(selectedJob.name, row.number)"
                :loading="buildLoading[`${selectedJob.name}-${row.number}`]"
              >
                <el-icon><Refresh /></el-icon>
              </el-button>
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
      </el-scrollbar>
      <template #footer>
        <span class="dialog-footer">
          <el-button
            type="primary"
            @click="handleBuildClick"
            :loading="buildTriggerLoading"
            >立即构建</el-button
          >
        </span>
      </template>
    </el-drawer>

    <el-dialog
      v-model="buildParamsVisible"
      :title="`构建 Job - ${selectedJob?.name}`"
      width="40%"
      :lock-scroll="false"
      :destroy-on-close="true"
    >
      <el-form :model="buildParameters" label-width="auto">
        <el-form-item
          v-for="param in jobParameterDefinitions"
          :key="param.name"
          :label="param.name"
        >
          <template v-if="param.type === 'ChoiceParameterDefinition'">
            <el-select
              v-model="buildParameters[param.name]"
              placeholder="请选择"
            >
              <el-option
                v-for="choice in param.choices"
                :key="choice"
                :label="choice"
                :value="choice"
              />
            </el-select>
          </template>
          <template v-else>
            <el-input
              v-model="buildParameters[param.name]"
              :placeholder="`不支持的参数类型: ${param.type}`"
              disabled
            />
          </template>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="buildParamsVisible = false">取消</el-button>
          <el-button
            type="primary"
            @click="confirmBuildWithParams"
            :loading="buildTriggerLoading"
            >确定构建</el-button
          >
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, onUnmounted } from "vue";
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
  const now = moment();
  const target = moment(ts);

  const seconds = now.diff(target, "seconds");
  const minutes = now.diff(target, "minutes");
  const hours = now.diff(target, "hours");
  const days = now.diff(target, "days");

  if (seconds < 60) {
    return "刚刚";
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days < 30) {
    return `${days}d ago`;
  } else {
    return moment(ts).format("YYYY-MM-DD");
  }
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

function getBuildStatusIcon(result, building) {
  if (building) return "⏳";
  if (result === "SUCCESS") return "✅";
  if (result === "FAILURE") return "❌";
  if (result === "ABORTED") return "🛑";
  return "❔";
}

function getFullChangeSets(changeSets) {
  if (!changeSets || changeSets.length === 0) {
    return "无变更信息";
  }

  let messages = [];
  changeSets.forEach((changeSet) => {
    if (changeSet.items && changeSet.items.length > 0) {
      changeSet.items.forEach((item) => {
        const author = item.authorEmail ? `(${item.authorEmail})` : "";
        const msg = item.msg ? item.msg : "无提交信息";
        messages.push(`${author} ${msg}`);
      });
    }
  });

  if (messages.length === 0) {
    return "无变更信息";
  }

  return messages.join("<br />");
}

function getFirstLineChangeSet(changeSets) {
  if (!changeSets || changeSets.length === 0) {
    return "无变更信息";
  }

  let firstMsg = "无变更信息";
  // 查找第一个可用的提交信息
  for (const set of changeSets) {
    if (set.items && set.items.length > 0) {
      const firstItem = set.items.find((item) => item.msg);
      if (firstItem) {
        firstMsg = firstItem.msg;
        break; // 找到第一个消息，退出循环
      }
    }
  }
  // 仅返回消息的第一行
  return firstMsg.split("\n")[0];
}

function getJobStatusClass(color) {
  if (!color) return "status-grey";
  if (color.includes("anime")) return "status-yellow-anime";
  if (color.includes("blue")) return "status-blue";
  if (color.includes("red")) return "status-red";
  if (color.includes("aborted")) return "status-grey";
  if (color.includes("disabled")) return "status-grey";
  if (color.includes("notbuilt")) return "status-grey";
  return "status-grey";
}

function openJenkinsJobUrl(jobName) {
  if (currentJenkinsConfig.value && currentJenkinsConfig.value.url) {
    let baseUrl = currentJenkinsConfig.value.url;
    if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
      baseUrl = `http://${baseUrl}`;
    }
    baseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    // 修复：当 Job 名称包含特殊字符或位于文件夹中时，需要正确编码 URL
    // 例如 'folder/my job' -> 'job/folder/job/my%20job'
    const encodedJobPath = jobName
      .split("/")
      .map(encodeURIComponent)
      .join("/job/");
    const jobUrl = `${baseUrl}job/${encodedJobPath}/`;
    utools.shellOpenExternal(jobUrl);
  } else {
    ElMessage.error("Jenkins 配置无效，无法打开链接。");
  }
}

function openJenkinsBuildUrl(jobName, buildNumber) {
  if (currentJenkinsConfig.value && currentJenkinsConfig.value.url) {
    let baseUrl = currentJenkinsConfig.value.url;
    if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
      baseUrl = `http://${baseUrl}`;
    }
    baseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    // 修复：当 Job 名称包含特殊字符或位于文件夹中时，需要正确编码 URL
    const encodedJobPath = jobName
      .split("/")
      .map(encodeURIComponent)
      .join("/job/");
    const buildUrl = `${baseUrl}job/${encodedJobPath}/${buildNumber}/`;
    utools.shellOpenExternal(buildUrl);
  } else {
    ElMessage.error("Jenkins 配置无效，无法打开链接。");
  }
}

// --- 响应式状态 ---
const loading = ref(true);
const jobLoading = ref({});
const buildLoading = ref({});
const drawerLoading = ref(false);
const buildTriggerLoading = ref(false);
const allConfigs = ref([]);
const currentJenkinsConfig = ref(null);
const allJobs = ref([]);
const searchQuery = ref("");
const buildMenuVisible = ref(false);
const selectedJob = ref(null);
const selectedJobBuilds = ref([]);
const showAllBuilds = ref(false);
const lastUpdateTime = ref(null);

const selectedConfigId = ref(null);
const buildParamsVisible = ref(false);
const jobParameterDefinitions = ref([]);
const buildParameters = ref({});
const jobCompletionPollingSet = ref(new Set()); // 存储需要检查是否完成的 Job 名称
const buildListPollingBuilds = ref(new Set()); // 用于 Build 抽屉的进度轮询

const filteredJobs = computed(() => {
  if (!searchQuery.value) {
    return allJobs.value;
  }
  const keywords = searchQuery.value.toLowerCase().split(" ").filter(Boolean);
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

const lastUpdateTimeFormatted = computed(() => {
  if (!lastUpdateTime.value) return "";
  return `最后更新于: ${moment(lastUpdateTime.value).format("HH:mm:ss")}`;
});

// --- 辅助函数 (新增) ---
function parseBuildKey(buildKey) {
  const lastHyphenIndex = buildKey.lastIndexOf("-");
  if (lastHyphenIndex === -1) {
    console.error("轮询键格式错误，无法解析:", buildKey);
    return {};
  }
  const jobName = buildKey.substring(0, lastHyphenIndex);
  const buildNumberStr = buildKey.substring(lastHyphenIndex + 1);
  const buildNumber = parseInt(buildNumberStr, 10);

  if (isNaN(buildNumber)) {
    console.error("轮询键中的 build number 无效:", buildKey);
    return {};
  }
  return { jobName, buildNumber };
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

// --- 轮询相关函数 ---
let jobListPollingInterval = null;
let buildListPollingInterval = null;

function startJobListPolling() {
  if (jobListPollingInterval) return; // 防止重复启动
  console.log("启动 Job 完成状态轮询...");
  jobListPollingInterval = setInterval(async () => {
    if (jobCompletionPollingSet.value.size === 0) {
      stopJobListPolling();
      return;
    }

    // 复制 Set 以安全遍历，防止在异步操作中修改集合导致问题
    const jobsToPoll = new Set(jobCompletionPollingSet.value);
    for (const jobName of jobsToPoll) {
      try {
        // 1. 记录刷新前的状态
        const jobBefore = allJobs.value.find((j) => j.name === jobName);
        const wasBuilding = jobBefore?.color?.includes("anime");

        // 2. 刷新 Job 信息
        await refreshJob(jobName);

        // 3. 记录刷新后的状态
        const jobAfter = allJobs.value.find((j) => j.name === jobName);
        const isBuilding = jobAfter?.color?.includes("anime");

        // 4. 如果从“构建中”变为“已完成”，则发送通知并停止轮询此 Job
        if (wasBuilding && !isBuilding && jobAfter.lastBuild) {
          console.log(`Job ${jobName} 构建完成，发送通知。`);
          utools.showNotification(
            `Job: ${jobName} #${
              jobAfter.lastBuild.number
            } 构建完成，结果: ${getBuildStatusText(
              jobAfter.lastBuild.result,
              false
            )}`
          );
          jobCompletionPollingSet.value.delete(jobName);
        } else if (!isBuilding) {
          // 如果因为某种原因（例如，启动时 Job 已经完成），它仍在轮询列表中，则将其移除
          jobCompletionPollingSet.value.delete(jobName);
        }
      } catch (error) {
        console.error(`Job 列表轮询刷新 Job ${jobName} 失败:`, error);
        // 发生错误时也将其从轮询中移除，防止无限次失败
        jobCompletionPollingSet.value.delete(jobName);
      }
    }
  }, 10000); // Job 列表轮询频率 10 秒
}

function stopJobListPolling() {
  if (jobListPollingInterval) {
    clearInterval(jobListPollingInterval);
    jobListPollingInterval = null;
  }
  console.log("停止 Job 完成状态轮询。");
}

function startBuildListPolling() {
  if (buildListPollingInterval) return; // 防止重复启动
  buildListPollingInterval = setInterval(async () => {
    console.log("启动 Build 列表轮询...");
    if (buildListPollingBuilds.value.size === 0) {
      stopBuildListPolling();
      return;
    }
    try {
      const buildsToPoll = new Set(buildListPollingBuilds.value);
      for (const buildKey of buildsToPoll) {
        const { jobName, buildNumber } = parseBuildKey(buildKey);
        if (jobName && buildNumber) {
          try {
            await refreshBuild(jobName, buildNumber);
          } catch (error) {
            console.error(`Build 列表轮询刷新构建 ${buildKey} 失败:`, error);
            // 错误处理：可以考虑重试或从轮询队列中移除
          }
        }
      }
    } catch (error) {
      console.error("Build 列表轮询总任务失败:", error);
    }
  }, 3000); // Build 抽屉轮询频率 3 秒
}

function stopBuildListPolling() {
  console.log("停止 Build 列表轮询。");
  if (buildListPollingInterval) {
    clearInterval(buildListPollingInterval);
    buildListPollingInterval = null;
  }
}

// --- 轮询相关函数 end ---
let jenkinsApi = null;

// --- 生命周期钩子 ---
onMounted(() => {
  allConfigs.value = utools.db.allDocs("jenkins");
  if (allConfigs.value && allConfigs.value.length > 0) {
    // 默认选中第一个
    selectedConfigId.value = allConfigs.value[0]._id;
    currentJenkinsConfig.value = allConfigs.value.find(
      (c) => c._id === selectedConfigId.value
    )?.data;
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

// 新增：处理配置切换的函数
function handleConfigChange(configId) {
  const selectedConf = allConfigs.value.find((c) => c._id === configId);
  if (selectedConf) {
    currentJenkinsConfig.value = selectedConf.data;
    // 清空旧数据并重新初始化
    allJobs.value = [];
    jobCompletionPollingSet.value.clear(); // 切换实例时，清空轮询列表
    buildListPollingBuilds.value.clear();
    // 相关的 watcher 会自动调用 stopPolling 函数
    initJenkins();
  }
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
      (a, b) => (b.lastBuild?.timestamp || 0) - (a.lastBuild?.timestamp || 0)
    );
    lastUpdateTime.value = new Date(); // 1. 在数据成功获取后，更新时间戳

    jobCompletionPollingSet.value.clear();
    allJobs.value.forEach((job) => {
      if (job.color?.includes("anime") && job.lastBuild) {
        jobCompletionPollingSet.value.add(job.name);
      }
    });
    // 如果有正在构建的任务，启动轮询
    if (jobCompletionPollingSet.value.size > 0) {
      startJobListPolling();
    }
  }, "刷新 Job 列表失败");
}

async function refreshJob(jobName) {
  jobLoading.value[jobName] = true;
  try {
    // 使用指定的 tree 参数来获取更详细的 Job 信息，包括 changeSets 和 culprits
    const customTree =
      "name,url,color,lastBuild[changeSets[items[*]],culprits[fullName],displayName,number,url,result,building,duration,timestamp]";
    const jobData = await jenkinsApi.getJob(jobName, customTree);
    const index = allJobs.value.findIndex((job) => job.name === jobName);
    if (index !== -1) {
      // 找到对应的 Job 并更新其数据
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
  drawerLoading.value = true;
  try {
    const jobData = await jenkinsApi.getJob(job.name);
    selectedJobBuilds.value = jobData.builds || [];

    // 启动 Build 抽屉的进度轮询
    selectedJobBuilds.value.forEach((build) => {
      if (build.building)
        buildListPollingBuilds.value.add(`${job.name}-${build.number}`);
    });
    // 从 property 中获取参数定义
    const paramsProperty = jobData.property.find(
      (p) => p._class === "hudson.model.ParametersDefinitionProperty"
    );
    // 过滤只显示 ChoiceParameterDefinition 类型的参数
    jobParameterDefinitions.value = paramsProperty
      ? paramsProperty.parameterDefinitions.filter(
          (param) => param.type === "ChoiceParameterDefinition"
        )
      : [];

    // 初始化参数值
    buildParameters.value = {};
    jobParameterDefinitions.value.forEach((param) => {
      if (
        param.type === "ChoiceParameterDefinition" &&
        param.choices &&
        param.choices.length > 0
      ) {
        buildParameters.value[param.name] = param.choices[0]; // 默认选择第一个
      } else if (param.defaultParameterValue) {
        buildParameters.value[param.name] = param.defaultParameterValue.value;
      } else {
        buildParameters.value[param.name] = ""; // 默认空字符串
      }
    });
  } catch (error) {
    const errorMessage = `获取 Job ${job.name} 的构建历史和参数失败`;
    console.error(errorMessage + ":", error);
    ElMessage.error(`${errorMessage}: ${error.message || "未知错误"}`);
    buildMenuVisible.value = false; // 出现错误时关闭抽屉
  } finally {
    drawerLoading.value = false;
  }
}

// 新增一个处理“立即构建”按钮点击的方法
function handleBuildClick() {
  if (jobParameterDefinitions.value.length > 0) {
    buildParamsVisible.value = true; // 显示参数输入对话框
  } else {
    buildJob(); // 直接构建
  }
}

// 修改 buildJob 方法，使其接收参数
async function buildJob(params = {}) {
  if (!selectedJob.value || !jenkinsApi) return;

  buildTriggerLoading.value = true;
  try {
    // 触发构建，并获取 queueId
    const queueItem = await jenkinsApi.buildJob(selectedJob.value.name, params);
    ElMessage.success(`构建已触发，队列 ID: ${queueItem.queueId}`);

    // 立即刷新主列表的 Job 状态，确保 lastBuild 信息是最新的
    await refreshJob(selectedJob.value.name);

    // 轮询队列，直到获取到 buildNumber
    const newBuild = await pollQueueForBuild(
      queueItem.queueId,
      selectedJob.value.name
    );
    if (newBuild) {
      // 将新构建添加到构建菜单的顶部
      selectedJobBuilds.value.unshift(newBuild);
      // 如果新构建正在进行中，将其添加到相应的轮询列表
      if (newBuild.building) {
        jobCompletionPollingSet.value.add(selectedJob.value.name);
        startJobListPolling(); // 确保轮询已启动
      }
    }
  } catch (error) {
    const errorMessage = `构建 Job ${selectedJob.value.name} 失败`;
    console.error(errorMessage + ":", error);
    ElMessage.error(`${errorMessage}: ${error.message || "未知错误"}`);
  } finally {
    buildTriggerLoading.value = false;
  }
}

// 新增轮询队列的方法
async function pollQueueForBuild(queueId, jobName) {
  let buildNumber = null;
  let attempts = 0;
  const maxAttempts = 30; // 尝试 30 次，每次间隔 2 秒，总共 1 分钟
  const delay = 2000; // 2 秒

  while (attempts < maxAttempts && buildNumber === null) {
    try {
      const queueItem = await jenkinsApi.getQueueItem(queueId);
      if (queueItem && queueItem.executable && queueItem.executable.number) {
        buildNumber = queueItem.executable.number;
        // 获取到 buildNumber 后，立即获取该构建的详细信息
        const buildData = await jenkinsApi.getBuild(jobName, buildNumber);
        return buildData;
      }
    } catch (error) {
      console.error(`轮询队列 ${queueId} 失败:`, error);
      // 即使失败也继续尝试，可能是临时网络问题
    }
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return null;
}

// 新增一个确认带参数构建的方法
async function confirmBuildWithParams() {
  buildParamsVisible.value = false; // 关闭参数输入对话框

  const paramsToBuild = {};
  jobParameterDefinitions.value.forEach((paramDef) => {
    // 只有非 WHideParameterDefinition 类型的参数才会被传递
    if (paramDef.type !== "WHideParameterDefinition") {
      paramsToBuild[paramDef.name] = buildParameters.value[paramDef.name];
    }
  });

  await buildJob(paramsToBuild); // 调用 buildJob 并传入过滤后的参数
}

async function refreshBuild(jobName, buildNumber) {
  const buildKey = `${jobName}-${buildNumber}`;
  buildLoading.value[buildKey] = true;
  try {
    const buildData = await jenkinsApi.getBuild(jobName, buildNumber);

    // 更新抽屉中的构建列表 UI
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
    ElMessage.error(
      `刷新构建 #${buildNumber} 失败: ${error.message || "未知错误"}`
    );
  } finally {
    buildLoading.value[buildKey] = false;
  }
}
watch(buildMenuVisible, (isVisible) => {
  console.log("抽屉状态改变:", isVisible);

  if (!isVisible) {
    // 当抽屉关闭时，清空并停止所有 Build 列表的进度轮询
    buildListPollingBuilds.value.clear();
    stopBuildListPolling();
  } else {
    // 抽屉显示时，启动 Build 列表轮询
    if (selectedJob && selectedJob.value) {
      // 添加正在构建的任务到轮询
      selectedJobBuilds.value.forEach((build) => {
        if (build.building)
          buildListPollingBuilds.value.add(
            `${selectedJob.value.name}-${build.number}`
          );
      });
      startBuildListPolling();
    }
  }
});

// Debounced filter function
const debouncedFilterJobs = debounce(() => {
  // The actual filtering logic is now in the computed property `filteredJobs`
  // 2. 移除此处的更新逻辑，因为它只与过滤相关，不代表数据刷新
}, 300);

onUnmounted(() => {
  stopJobListPolling();
  stopBuildListPolling();
  console.log("Jenkins 组件卸载，停止所有轮询");
});
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

.el-drawer__body {
  padding: 5px;
}

.drawer-title {
  margin: 0; /* 移除 h4 的默认 margin */
  font-size: 1rem; /* 保持与默认标题大小一致 */
  color: var(--el-text-color-primary); /* 保持与默认标题颜色一致 */
}

/* 3. 为抽屉的 Header 添加下边框和内边距，提升视觉层次感 */
:deep(.el-drawer__header) {
  margin-bottom: 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.highlight {
  background-color: yellow;
  font-weight: bold;
}

.link-style:hover {
  text-decoration: underline;
}

.input-with-select :deep(.el-input-group__prepend) {
  background-color: var(--el-fill-color-blank);
}

/* 2. 增加行内状态指示器 */
.job-name-container {
  display: flex;
  align-items: center;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
  display: inline-block;
}

.status-blue {
  background-color: #42b983; /* 或您喜欢的成功颜色 */
}

.status-red {
  background-color: #cc0033; /* 或您喜欢的失败颜色 */
}

.status-yellow-anime {
  background-color: #ffba00; /* 或您喜欢的进行中颜色 */
  animation: pulse 2s infinite;
}

.status-grey {
  background-color: #999; /* 或您喜欢的灰色 */
}

/* 1. 优化 “Change Message” 列的视觉一致性 */
.single-line-ellipsis {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  width: 100%;
}

/* 3. 引入 “悬浮操作” */
.action-column .el-button {
  opacity: 0; /* 初始状态下隐藏按钮 */
  transition: opacity 0.3s ease; /* 添加一个过渡效果 */
}

.el-table__row:hover .action-column .el-button {
  opacity: 1; /* 鼠标悬浮时显示按钮 */
}

/* 4. 增加数据新鲜度指示 */
.update-time-display {
  margin-right: 10px;
  font-size: 0.8em;
  color: #999;
}
</style>

<style>
/* 1. 始终为滚动条轨道预留空间，防止布局跳动 */
html {
  scrollbar-gutter: stable;
  -ms-overflow-style: none; /* IE */
  scrollbar-width: none; /* Firefox */
}
/* 2. 视觉上隐藏主滚动条 */
body::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Edge */
}
</style>
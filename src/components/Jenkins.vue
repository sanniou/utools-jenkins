<template>
  <div>
    <!-- 优化：为容器增加一个统一的类名，便于整体样式控制 -->
    <el-container v-loading="loading" class="jenkins-container">
      <el-header>
        <el-row :gutter="20" align="middle">
          <el-col :span="16">
            <el-input
              v-model="searchQuery"
              placeholder="搜索 Job"
              clearable
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
            <span class="update-time-display">{{ lastUpdateTimeFormatted }}</span>
            <el-tooltip content="刷新列表" placement="top">
              <el-button circle @click="refreshAllJobs"><el-icon><Refresh /></el-icon></el-button>
            </el-tooltip>
            <el-tooltip content="设置" placement="top">
              <el-button circle @click="goToConfig"><el-icon><Setting /></el-icon></el-button>
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
            min-width="150"
            sortable
          >
            <template #default="{ row }">
              <!-- 优化1：整合状态点、Job名和最近构建状态 -->
              <div class="job-name-container">
                <span
                  class="status-dot"
                  :class="getJobStatusClass(row.color)"
                ></span>
                <div class="job-info">
                  <!-- 优化2：为长 Job 名称增加 Tooltip 展示 -->
                  <el-tooltip
                    :content="row.name"
                    placement="top-start"
                    :show-after="500"
                    :disabled="!isTextOverflow(row.name, 200)"
                  >
                    <span
                      class="job-name link-style"
                      @click="openJenkinsJobUrl(row.name)"
                      v-html="highlightMatchedText(row.name, searchQuery)"
                    ></span>
                  </el-tooltip>
                  <el-tag v-if="row.lastBuild" :type="getBuildStatusType(row.lastBuild.result, row.lastBuild.building)" size="small" class="build-status-tag" @click="openJenkinsBuildUrl(row.name, row.lastBuild.number)">
                    #{{ row.lastBuild.number }} - {{ getBuildStatusText(row.lastBuild.result, row.lastBuild.building) }}
                  </el-tag>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="变更信息" min-width="220">
            <template #default="{ row }">
              <!-- 优化2：使用 Popover 展示完整的变更信息 -->
              <el-popover
                v-if="row.lastBuild?.changeSets && row.lastBuild.changeSets.length > 0"
                placement="top-start"
                title="变更集"
                :width="400"
                trigger="click"
              >
                <template #reference>
                  <span class="single-line-ellipsis link-style">
                    {{ getFirstLineChangeSet(row.lastBuild?.changeSets) }}
                  </span>
                </template>
                <div class="changeset-popover-content" v-html="getFullChangeSets(row.lastBuild?.changeSets)"></div>
              </el-popover>
              <span v-else class="no-changes-text">无变更信息</span>
            </template>
          </el-table-column>
          <el-table-column
            label="构建耗时"
            sortable
            sort-by="lastBuild.duration"
            width="110"
          >
            <template #default="{ row }">
              <span v-if="row.lastBuild">{{ formatDuration(row.lastBuild.duration) }}</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column
            label="完成时间"
            sortable
            sort-by="lastBuild.timestamp"
            width="110"
          >
            <template #default="{ row }">
              {{ formatTimestamp(row.lastBuild?.timestamp) }}
            </template>
          </el-table-column>
          <!-- 3. 引入 “更多操作” -->
          <el-table-column
            label="操作"
            width="100"
            align="center"
            class-name="action-column"
          >
            <template #default="{ row }">
              <!-- 优化1：为操作按钮增加容器和间距 -->
              <div class="action-buttons">
                <el-button
                  circle
                  @click="refreshJob(row.name)"
                  :loading="jobLoading[row.name]"
                  title="刷新状态"
                >
                  <el-icon><Refresh /></el-icon>
                </el-button>
                <el-button
                  circle
                  @click="openBuildMenu(row)"
                  title="构建菜单"
                >
                  <el-icon><Menu /></el-icon>
                </el-button>

              </div>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无 Job，请检查配置或刷新" class="jenkins-empty-state" />
      </el-main>
    </el-container>

    <el-drawer
      v-model="buildMenuVisible"
      direction="rtl"
      :show-close="false"
      size="80%"
      :destroy-on-close="true"
    >
      <template #header>
        <!-- 优化1：简化头部，移除重复按钮，增加图标 -->
        <h4 class="drawer-title">
          <el-icon><Menu /></el-icon> 构建历史: <span class="link-style"
            @click="openJenkinsJobUrl(selectedJob.name)"
          >{{ selectedJob?.name }}</span>
        </h4>
      </template>
      <!-- 优化2：使用 Flexbox 布局管理抽屉主体高度 -->
      <div class="drawer-body-flex-container">
      <el-scrollbar
        v-loading="drawerLoading"
        class="build-table-container"
      >
        <el-table
          :data="displayedBuilds"
          style="width: 100%"
          stripe
          border
          row-key="number"
          @expand-change="handleBuildExpand"
        >
          <el-table-column type="expand">
            <template #default="{ row }">
              <div v-if="buildStages[row.number]" class="stage-details-container" v-loading="buildStages[row.number].loading">
                <!-- 优化2：移除 border，使内嵌表格更轻量 -->
                <el-table v-if="buildStages[row.number].stages && buildStages[row.number].stages.length > 0" :data="buildStages[row.number].stages" size="small" class="stage-table">
                  <!-- 1. 移除 Stage 的可展开功能 -->
                  <el-table-column label="Stage" prop="name" show-overflow-tooltip></el-table-column>
                  <el-table-column label="Status" width="100" align="center">
                    <template #default="{ row: stageRow }">
                      <!-- 优化1：使用 Tag 统一状态展示 -->
                      <el-tag :type="getStageStatusType(stageRow.status)" size="small">{{ getStageStatusText(stageRow.status) }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="Duration" width="120">
                    <template #default="{ row: stageRow }">
                      {{ formatDuration(stageRow.durationMillis) }}
                    </template>
                  </el-table-column>
                </el-table>
                <el-empty v-else-if="!buildStages[row.number].loading" description="无 Stage 数据或非 Pipeline Job" />
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="number" label="No" min-width="40">
            <template #default="{ row }">
              <span
                class="link-style"
                @click="openJenkinsBuildUrl(selectedJob.name, row.number)"
                >{{ row.number }}</span
              >
            </template>
          </el-table-column>
          <el-table-column label="Duration" min-width="100">
            <template #default="{ row }">
              {{ formatDuration(row.duration) }}
            </template>
          </el-table-column>
          <el-table-column prop="timestamp" label="Build Time" min-width="120">
            <template #default="{ row }">
              {{ formatTimestamp(row.timestamp) }}
            </template>
          </el-table-column>
          <el-table-column label="Result" min-width="60" align="center">
            <!-- 优化3.1：使用 Tag 展示构建结果，与主列表统一 -->
             <template #default="{ row }">
              <el-tag :type="getBuildStatusType(row.result, row.building)" size="small">
                {{ getBuildStatusText(row.result, row.building) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Progress" min-width="120">
            <template #default="{ row }">
              <el-progress
                :percentage="getBuildPercentage(row)"
                :status="getProgressStatus(row)"
              />
            </template>
          </el-table-column>
          <!-- 优化3.2：操作按钮悬浮显示 -->
          <el-table-column label="操作" min-width="70" class-name="action-column">
            <template #default="{ row }">
              <el-button
                circle
                @click="refreshBuild(selectedJob.name, row.number)"
                :loading="buildLoading[`${selectedJob.name}-${row.number}`]"
              >
                <el-icon><Refresh /></el-icon>
              </el-button>
              <el-button
                v-if="row.building"
                circle
                type="danger"
                @click="stopBuild(selectedJob.name, row.number)"
              >
                <el-icon><VideoPause /></el-icon>
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
      </div>
      <!-- 优化2：将参数表单和构建按钮集成到底部 -->
      <template #footer>
        <div class="drawer-footer-container">
          <!-- 优化：使用 Collapse 组件收纳参数表单，使其默认折叠 -->
          <el-collapse v-if="jobParameterDefinitions.length > 0" class="params-collapse">
            <el-collapse-item name="1">
              <template #title>
                构建参数 <span class="params-summary">({{ jobParameterDefinitions.length }} 个参数)</span>
              </template>
              <el-form :model="buildParameters" label-width="auto" class="build-params-form" size="small">
                <el-form-item
                  v-for="param in jobParameterDefinitions"
                  :key="param.name"
                  :label="param.name"
                >
                  <template v-if="param.type === 'ChoiceParameterDefinition'">
                    <el-select v-model="buildParameters[param.name]" placeholder="请选择" style="width: 100%;">
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
            </el-collapse-item>
          </el-collapse>
          <div class="footer-actions">
            <el-button type="primary" @click="confirmBuildWithParams" :loading="buildTriggerLoading">
              {{ jobParameterDefinitions.length > 0 ? '确定构建' : '立即构建' }}
            </el-button>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, onUnmounted } from "vue";
import { ElMessage, ElIcon, ElMessageBox, ElPopover, ElCollapse, ElCollapseItem, ElForm, ElFormItem, ElSelect, ElOption, ElInput } from "element-plus";
import { Refresh, Menu, Setting, VideoPause } from "@element-plus/icons-vue";
import moment from "moment";
import { createJenkinsApi } from "../api/jenkins.js";
import { getBuildStatusType, getBuildStatusText, getStageStatusType, getStageStatusText } from "../js/jenkins-utils.js";
import utools_dev from "../js/utools_mock";

// 优化2：判断文本是否溢出的辅助函数
function isTextOverflow(text, maxWidth, fontSize = 14) {
  const span = document.createElement('span');
  span.style.fontSize = `${fontSize}px`;
  span.style.visibility = 'hidden';
  span.style.position = 'absolute';
  span.innerText = text;
  document.body.appendChild(span);
  const textWidth = span.offsetWidth;
  document.body.removeChild(span);
  return textWidth > maxWidth;
}

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

function formatDuration(duration) {
  if (duration === null || duration === undefined || duration < 0) return "-";
  if (duration === 0) return "0ms";

  const seconds = Math.floor(duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else if (seconds > 0) {
    return `${seconds}s`;
  } else {
    return `${duration}ms`;
  }
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
  return firstMsg.split('\n')[0];
}

const colorClassMap = {
  anime: "status-yellow-anime",
  blue: "status-blue",
  red: "status-red",
  aborted: "status-grey",
  disabled: "status-grey",
  notbuilt: "status-grey",
};

function getJobStatusClass(color) {
  if (!color) return "status-grey"; // Job 没有颜色信息

  for (const key in colorClassMap) {
    if (color.includes(key)) return colorClassMap[key];
  }
  console.warn(`未知的 Jenkins color 状态: "${color}"，已回退到灰色。`);
  return "status-grey"; // 对于未知的颜色，回退到灰色
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
const buildStages = ref({});

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

function getBuildPercentage(build) {
  if (!build) return 0;
  if (!build.building) {
    return 100;
  }
  if (build.timestamp <= 0 || build.estimatedDuration <= 0) {
    return 0;
  }
  const elapsedTime = Date.now() - build.timestamp;
  const percentage = Math.floor((elapsedTime / build.estimatedDuration) * 100);
  return percentage;
}

function getProgressStatus(build) {
  if (build.building) {
    return undefined; // 使用主题色
  }
  switch (build.result) {
    case "SUCCESS":
      return "success";
    case "FAILURE":
      return "exception";
    case "ABORTED":
      return "warning";
    default:
      return undefined; // 其他情况（如 UNSTABLE）也使用主题色
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
          utools.shellBeep();
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
  console.log("启动 Build 列表轮询...");
  buildListPollingInterval = setInterval(async () => {
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
            // 错误处理：从轮询队列中移除，防止无限次失败
            buildListPollingBuilds.value.delete(buildKey);
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
    // 切换实例时，立即停止所有轮询并清空状态
    stopJobListPolling();
    stopBuildListPolling(); // 尽管抽屉可能已关闭，但为保险起见也调用
    allJobs.value = [];
    jobCompletionPollingSet.value.clear();
    buildListPollingBuilds.value.clear();
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
    // 1. 停止当前正在运行的轮询，确保我们从一个干净的状态开始
    stopJobListPolling();

    const jobsData = await jenkinsApi.getJobsWithLatestBuild();
    allJobs.value = jobsData.jobs.sort(
      (a, b) => (b.lastBuild?.timestamp || 0) - (a.lastBuild?.timestamp || 0)
    );
    lastUpdateTime.value = new Date();

    // 2. 清空旧的轮询任务集合
    jobCompletionPollingSet.value.clear();
    // 3. 重新检测需要轮询的 Job
    allJobs.value.forEach((job) => {
      if (job.color?.includes("anime") && job.lastBuild) {
        jobCompletionPollingSet.value.add(job.name);
      }
    });
    // 4. 如果有正在构建的任务，启动新的的轮询
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
  buildStages.value = {}; // 清空旧的 stage 数据
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

async function refreshBuildStages(jobName, buildNumber) {
  // 设置加载状态
  buildStages.value[buildNumber] = { loading: true, stages: [] };

  try {
    const data = await jenkinsApi.getBuildStages(jobName, buildNumber);
    // 检查返回的数据是否有效
    if (data && Array.isArray(data.stages)) {
      buildStages.value[buildNumber] = { loading: false, stages: data.stages };
    } else {
      // 如果数据无效（例如，不是 Pipeline Job），则设置为空状态
      buildStages.value[buildNumber] = { loading: false, stages: [] };
      console.warn(`构建 #${buildNumber} 没有有效的 stages 数据。`);
    }
  } catch (error) {
    console.error(`获取构建 #${buildNumber} 的 Stage 失败:`, error);
    ElMessage.error(`获取构建 #${buildNumber} 的 Stage 失败: ${error.message || '未知错误'}`);
    // 失败时也更新状态，以移除加载指示器
    buildStages.value[buildNumber] = { loading: false, stages: [], error: true };
  }
}

async function handleBuildExpand(row, expandedRows) {
  const isExpanding = expandedRows.some(expandedRow => expandedRow.number === row.number);
  if (!isExpanding) return; // 如果是收起，则不执行任何操作

  // 如果已经有数据（非错误状态），则不重复获取
  if (buildStages.value[row.number] && buildStages.value[row.number].stages.length > 0 && !buildStages.value[row.number].error) {
    return;
  }

  await refreshBuildStages(selectedJob.value.name, row.number);
}


// 修改 buildJob 方法，使其接收参数
async function buildJob(params = {}) {
  if (!selectedJob.value || !jenkinsApi) return;
  const jobToBuild = selectedJob.value; // 关键：捕获当前操作的 Job

  buildTriggerLoading.value = true;
  try {
    // 触发构建，并获取 queueId
    const queueItem = await jenkinsApi.buildJob(jobToBuild.name, params);
    ElMessage.success(`构建已触发，队列 ID: ${queueItem.queueId}`);

    // 立即刷新主列表的 Job 状态，确保 lastBuild 信息是最新的
    await refreshJob(jobToBuild.name);

    // 轮询队列，直到获取到 buildNumber
    const newBuild = await pollQueueForBuild(
      queueItem.queueId,
      jobToBuild.name
    );

    // 关键：在更新UI前，检查当前抽屉的 Job 是否还是我们触发构建的那个
    if (newBuild && selectedJob.value?.name === jobToBuild.name) {
      // 将新构建添加到构建菜单的顶部
      selectedJobBuilds.value.unshift(newBuild);
      // 如果新构建正在进行中，将其添加到相应的轮询列表
      if (newBuild.building) {
        const buildKey = `${jobToBuild.name}-${newBuild.number}`;

        // 1. 添加到主列表轮询（用于完成通知）
        jobCompletionPollingSet.value.add(jobToBuild.name);
        startJobListPolling();

        // 2. 添加到 Build 菜单轮询（用于更新进度条）
        buildListPollingBuilds.value.add(buildKey);
        startBuildListPolling();
      }
    } else {
      console.log(
        `构建 ${jobToBuild.name} 已完成，但用户已切换视图，取消UI更新。`
      );
    }
  } catch (error) {
    const errorMessage = `构建 Job ${jobToBuild.name} 失败`;
    console.error(errorMessage + ":", error);
    // 关键：只在当前 Job 的上下文下显示错误
    if (selectedJob.value?.name === jobToBuild.name) {
      ElMessage.error(`${errorMessage}: ${error.message || "未知错误"}`);
    }
  } finally {
    // 关键：只在当前 Job 的上下文下重置加载状态
    if (selectedJob.value?.name === jobToBuild.name) {
      buildTriggerLoading.value = false;
    }
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

    // 如果构建已完成，则将其从 Build 列表轮询中移除，不再继续刷新
    if (!buildData.building) {
      buildListPollingBuilds.value.delete(buildKey);
    }

    // 如果此构建的 stages 已展开，则刷新它们
    if (buildStages.value[buildNumber]) {
      await refreshBuildStages(jobName, buildNumber);
    }

  } catch (error) {
    console.error(`刷新构建 #${buildNumber} 失败:`, error);
    ElMessage.error(
      `刷新构建 #${buildNumber} 失败: ${error.message || "未知错误"}`
    );
    // 发生错误时也将其从轮询中移除，防止无限次失败
    buildListPollingBuilds.value.delete(buildKey);
  } finally {
    buildLoading.value[buildKey] = false;
  }
}

async function stopBuild(jobName, buildNumber) {
  const buildKey = `${jobName}-${buildNumber}`;
  buildLoading.value[buildKey] = true;
  try {
    await jenkinsApi.stopBuild(jobName, buildNumber);
    ElMessage.success(`已发送停止构建 #${buildNumber} 的请求`);
    // After sending the stop request, we should refresh the build status
    await refreshBuild(jobName, buildNumber);
  } catch (error) {
    console.error(`停止构建 #${buildNumber} 失败:`, error);
    ElMessage.error(
      `停止构建 #${buildNumber} 失败: ${error.message || "未知错误"}`
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
    buildTriggerLoading.value = false; // 修复：关闭时重置构建按钮状态
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

onUnmounted(() => {
  stopJobListPolling();
  stopBuildListPolling();
  console.log("Jenkins 组件卸载，停止所有轮询");
});
</script>

<style scoped>
.jenkins-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
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

.drawer-title {
  margin: 0; /* 移除 h4 的默认 margin */
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem; /* 保持与默认标题大小一致 */
  color: var(--el-text-color-primary); /* 保持与默认标题颜色一致 */
}

:deep(.el-drawer__header) {
  margin-bottom: 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

/* 优化1 & 2: 抽屉主体布局和边距优化 */
.drawer-body-flex-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.drawer-footer-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}


.job-name-container {
  display: flex;
  align-items: center;
  gap: 8px; /* 使用 gap 属性控制间距 */
}

.job-info {
  display: flex;
  flex-direction: column; /* 垂直排列 Job 名称和 Tag */
  gap: 4px;
  overflow: hidden; /* 防止内容溢出 */
}

.job-name {
  font-weight: 500; /* Job 名称加粗一些 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
  display: inline-block;
  flex-shrink: 0; /* 关键：防止圆点在空间不足时被压缩 */
}
.build-status-tag {
  width: fit-content; /* 让 Tag 宽度自适应内容 */
  cursor: pointer;
  border: none; /* 移除 Tag 边框，更简洁 */
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

.single-line-ellipsis {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.no-changes-text {
  color: var(--el-text-color-placeholder);
  font-style: italic;
}

.jenkins-empty-state {
  margin-top: 6px; /* 给空状态留点空间 */
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 8px;
}

/* 优化：恢复悬浮显示操作按钮 */
.action-column .el-button {
  opacity: 0;
  transition: opacity 0.3s ease;
}

.changeset-popover-content {
  max-height: 200px;
  overflow-y: auto;
}

.el-table__row:hover .action-column .el-button {
  opacity: 1;
}

/* 4. 增加数据新鲜度指示 */
.update-time-display {
  margin-right: 10px;
  font-size: 0.8em;
  color: #999;
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
}

.stage-details-container {
  padding-left: 10px;
  background-color: var(--el-fill-color-lighter);
}

</style>

<!-- 优化：将全局样式移到 App.vue 或主样式文件中，这里为了演示方便保留 -->
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
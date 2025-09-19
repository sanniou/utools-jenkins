<template>
  <!-- 1. 采用 el-container 构建标准布局 -->
  <el-container class="config-page-container">
    <!-- 2. 新增 el-header，提供一致的导航体验 -->
    <el-header class="config-header">
      <el-button text @click="returnBack">
        <el-icon><ArrowLeftBold /></el-icon>
        返回
      </el-button>
      <h4 class="header-title">Jenkins 实例配置</h4>
    </el-header>

    <!-- 3. el-main 作为主要内容区域 -->
    <el-main class="config-main">
      <el-form
        v-if="configList.length > 0"
        ref="form"
        label-width="auto"
        class="config-form"
      >
        <div v-for="(config, index) in configList" :key="config._id">
          <el-card class="box-card">
            <template #header>
              <div class="card-header">
                <span>实例 {{ index + 1 }}</span>
                <el-button
                  class="button"
                  type="danger"
                  text
                  @click="deleteConfig(config, index)"
                >
                  <el-icon><Delete /></el-icon>
                  删除
                </el-button>
              </div>
            </template>
            <el-form-item label="Schema">
              <el-input
                placeholder="http or https"
                name="jkSchema"
                v-model="config.data.schema"
                @input="debouncedSaveConfig(config)"
              ></el-input>
            </el-form-item>
            <el-form-item label="URL">
              <el-input
                placeholder="jenkins url"
                name="jkUrl"
                v-model="config.data.url"
                @input="debouncedSaveConfig(config)"
              ></el-input>
            </el-form-item>
            <el-form-item label="Username">
              <el-input
                placeholder="jenkins username(optional)"
                name="jkUsername"
                v-model="config.data.username"
                @input="debouncedSaveConfig(config)"
              ></el-input>
            </el-form-item>
            <el-form-item label="Password">
              <el-input
                placeholder="jenkins password(optional)"
                name="jkPassword"
                type="password"
                show-password
                v-model="config.data.password"
                @input="debouncedSaveConfig(config)"
              ></el-input>
            </el-form-item>
          </el-card>
        </div>
      </el-form>
      <el-empty
        v-else
        description="暂无配置，请点击增加配置按钮添加"
      ></el-empty>
    </el-main>

    <!-- 4. 保留 FAB 按钮用于添加操作 -->
    <el-button class="add-fab" type="primary" circle @click="addConf">
      <el-icon><Plus /></el-icon>
    </el-button>
  </el-container>
</template>

<script setup>
import { ref } from "vue";
import utools_dev from "../js/utools_mock";
import { ElIcon, ElMessageBox, ElMessage } from "element-plus";
import { Plus, Delete, ArrowLeftBold } from "@element-plus/icons-vue";

let utools = window.utools ? window.utools : utools_dev;

const configList = ref(getConfList());

function getConfList() {
  let allDocs = utools.db.allDocs("jenkins");
  if (allDocs.length === 0) {
    // If no existing configs, add one with a new UUID
    allDocs.push({
      _id: "jenkins-" + (utools.db.getUUID ? utools.db.getUUID() : Date.now().toString()), // Generate a unique ID with prefix
      data: {
        schema: null,
        url: null,
        username: null,
        password: null,
      },
    });
  }
  return allDocs;
}

function debounce(func, delay) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

function saveConfig(conf) {
  let data = {
    _id: conf._id,
    data: {
      schema: conf.data.schema,
      url: conf.data.url,
      username: conf.data.username,
      password: conf.data.password,
    },
  };
  // 获取最新的 _rev 以避免冲突
  const existingDoc = utools.db.get(conf._id);
  if (existingDoc) {
    data._rev = existingDoc._rev;
  }
  utools.db.put(data);
}

const debouncedSaveConfig = debounce(saveConfig, 500);

async function deleteConfig(conf, index) {
  try {
    await ElMessageBox.confirm(
      `确定要删除实例 ${index + 1} (${conf.data.url || "空配置"}) 吗？`,
      "警告",
      {
        confirmButtonText: "确定删除",
        cancelButtonText: "取消",
        type: "warning",
      }
    );
    // 用户确认删除
    utools.db.remove(conf._id);
    configList.value.splice(index, 1);
    ElMessage({
      type: "success",
      message: "删除成功",
    });
  } catch (error) {
    // 用户取消或发生错误
    if (error !== "cancel") {
      console.error("删除配置失败:", error);
      ElMessage({
        type: "error",
        message: "删除失败",
      });
    } else {
      ElMessage({
        type: "info",
        message: "已取消删除",
      });
    }
  }
}

function addConf() {
  configList.value.push({
    _id: "jenkins-" + (utools.db.getUUID ? utools.db.getUUID() : Date.now().toString()),
    data: {
      schema: null,
      url: null,
      username: null,
      password: null,
    },
  });
}

function returnBack() {
  utools.redirect("jenkins", "");
}
</script>

<style scoped>
.config-page-container {
  height: 100vh;
  background-color: #f7f8fa; /* 使用柔和的背景色，让卡片更突出 */
}

/* 5. 新增 header 样式 */
.config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--el-border-color-lighter);
  padding: 0 16px;
}

.header-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
  /* 通过 flex-grow 和 text-align 实现标题居中，同时不影响按钮位置 */
  flex-grow: 1;
  text-align: center;
  /* 减去按钮的大致宽度，以实现更精确的居中 */
  margin-right: 80px;
}

.config-main {
  /* 6. 调整 padding，移除旧的顶部间距 */
  padding: 20px 20px 100px 20px;
}

.add-fab {
  position: fixed; /* 使用 fixed 定位，使其在滚动时保持位置不变 */
  bottom: 24px;
  right: 24px;
  z-index: 10;
  width: 56px;
  height: 56px;
  font-size: 24px;
  box-shadow: var(--el-box-shadow);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.box-card {
  margin-bottom: 24px;
  border-radius: 12px; /* 增加圆角，使卡片更柔和 */
  border: none; /* 移除边框，完全依赖阴影 */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); /* 使用更柔和、自然的阴影 */
  transition: all 0.3s ease;
}

.box-card:hover {
  transform: translateY(-4px); /* 悬浮时轻微上移 */
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1); /* 悬浮时阴影更明显 */
}
</style>

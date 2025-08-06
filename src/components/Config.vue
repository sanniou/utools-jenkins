<template>
  <el-container>
    <el-header>
      <el-row :gutter="20" align="middle">
        <el-col :span="12">
          <h2>Jenkins 配置</h2>
        </el-col>
        <el-col :span="12" style="text-align: right;">
          <el-tooltip content="返回" placement="top">
            <el-button circle @click="returnBack">
              <el-icon><ArrowLeftBold /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip content="增加配置" placement="top">
            <el-button type="primary" circle @click="addConf">
              <el-icon><Plus /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip content="减少配置" placement="top">
            <el-button type="danger" circle @click="subConf">
              <el-icon><Minus /></el-icon>
            </el-button>
          </el-tooltip>
        </el-col>
      </el-row>
    </el-header>
    <el-main>
      <el-form
        v-if="configList.length > 0"
        ref="form"
        label-width="120px"
        class="config-form"
      >
        <div v-for="(config, index) in configList" :key="config._id">
          <el-card class="box-card">
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
          <el-divider v-if="index < configList.length - 1" />
        </div>
      </el-form>
      <el-empty
        v-else
        description="暂无配置，请点击增加配置按钮添加"
      ></el-empty>
    </el-main>
  </el-container>
</template>

<script setup>
import { ref } from "vue";
import utools_dev from "../js/utools_mock";
import { ElIcon } from "element-plus";
import { Plus, Minus, ArrowLeftBold } from "@element-plus/icons-vue";

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

function subConf() {
  if (configList.value.length > 0) {
    const lastConfig = configList.value[configList.value.length - 1];
    utools.db.remove(lastConfig._id);
    configList.value.pop();
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
.el-header {
  padding-top: 20px;
}
.box-card {
  margin-bottom: 20px;
}
.input-item {
  margin-bottom: 10px;
}
.input-item:last-child {
  margin-bottom: 0;
}
</style>

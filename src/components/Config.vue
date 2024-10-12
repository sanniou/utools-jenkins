<template>
  <div v-for="(config, index) in configList" :key="config.data.url">
    <el-card class="box-card">
      <el-input
        placeholder="jenkins schema"
        class="input"
        name="jkSchema"
        v-model="config.data.schema"
        v-on:input="onInput(config, index)"
      />
      <el-input
        placeholder="jenkins url"
        class="input"
        name="jkUrl"
        v-model="config.data.url"
        v-on:input="onInput(config, index)"
      />
      <el-input
        placeholder="jenkins username(optional)"
        class="input"
        name="jkUsername"
        v-model="config.data.username"
        v-on:input="onInput(config, index)"
      />
      <el-input
        placeholder="jenkins password(optional)"
        class="input"
        name="jkPassword"
        v-model="config.data.password"
        v-on:input="onInput(config, index)"
      />
    </el-card>

    <el-divider>-1-</el-divider>
  </div>
  <div>
    <a
      href="javascript:void(0)"
      id="sub"
      v-on:click="subConf"
      style="float: right; display: block; width: 70px"
      >减少配置</a
    >
    <a
      href="javascript:void(0)"
      id="add"
      v-on:click="addConf"
      style="float: right; display: block; width: 70px"
      >增加配置</a
    >
    <a
      href="javascript:void(0)"
      id="returnBack"
      v-on:click="returnBack"
      style="float: right; display: block; width: 140px"
      >返回Jenkins搜索</a
    >
  </div>
</template>

<script>
import utools_dev from "../js/utools_mock";
let utools = window.utools ? window.utools : utools_dev;
function getConfList() {
  let allDocs = utools.db.allDocs("jenkins");
  let ret = [];
  if (allDocs.length > 0) {
    for (let i = 0; i < allDocs.length; i++) {
      let data = allDocs[i];
      ret.push(data);
    }
  } else {
    ret.push({
      _id: "",
      data: {
        schema: null,
        url: null,
        username: null,
        password: null,
      },
    });
  }
  return ret;
}
export default {
  name: "Config",
  data: () => {
    return {
      configList: getConfList(),
    };
  },
  created() {},
  methods: {
    onInput: function (conf, index) {
      let value = utools.db.get("jenkins-" + index);
      let data = {
        _id: "jenkins-" + index,
        data: {
          schema: conf.data.schema,
          url: conf.data.url,
          username: conf.data.username,
          password: conf.data.password,
        },
        _rev: value == null ? null : value._rev,
      };
      data._rev || delete data._rev;
      utools.db.put(data);
    },
    subConf: function () {
      console.log(this.configList.length);
      let lastIndex = this.configList.length - 1;
      this.configList.splice(lastIndex, 1);
      utools.db.remove("jenkins-" + lastIndex);
    },
    addConf: function () {
      this.configList.push({
        _id: "",
        data: {
          schema: null,
          url: null,
          username: null,
          password: null,
        },
      });
    },
    returnBack: function () {
      utools.redirect("jenkins", "");
    },
  },
};
</script>

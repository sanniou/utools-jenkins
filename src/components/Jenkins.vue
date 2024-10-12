<template>
  <section data-route="origin" id="origin">
    <el-input ref="inputRef" placeholder="JOB" v-model="filterValue" />

    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span v-on:click="onClickSetting">Jenkins设置</span>
          <el-button link type="primary" @click="onclickRefreshListJob"
            >刷新状态
          </el-button>
          <el-button link type="primary" @click="setJobList"
            >刷新列表
          </el-button>
        </div>
      </template>

      <div
        v-for="config in configList"
        class="text item"
        v-bind:key="config.url"
        @click="onSwitchConf(config, configList)"
      >
        <el-link href="https://config.data.url" target="_blank"
          >{{ config.data.schema + "://" + config.data.url }}
        </el-link>
      </div>
    </el-card>
    <!-- <el-radio-group v-model="tableLayout">
      <el-radio-button label="fixed" />
      <el-radio-button label="auto" />
    </el-radio-group> -->
    <el-table :data="filterJobList" border style="width: 100%">
      <el-table-column prop="colorUrl" width="36">
        <template v-slot="scope">
          <el-image :src="scope.row.colorUrl"></el-image>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="name" sortable width="200">
        <template v-slot="scope">
          <el-button @click="onClickUrl(scope.row.url)" type="primary" link
            >{{ scope.row.name }}
          </el-button>
        </template>
      </el-table-column>
      <el-table-column prop="displayNo" label="job" width="70">
        <template v-slot="scope">
          <el-button
            @click="onClickJobNo(scope.row)"
            style="font-weight: 500"
            type="primary"
            link
            >{{ scope.row.displayNo }}
          </el-button>
        </template>
      </el-table-column>
      <el-table-column
        prop="lastChange"
        label="lastChange"
        width="200"
        show-overflow-tooltip
      />
      <el-table-column
        prop="lastBuildTime"
        label="build"
        sortable
        sort-by="lastBuildTimestamp"
        width="100"
      />
      <el-table-column prop="action" label="Action" width="120" fixed="right">
        <template v-slot="scope">
          <el-button
            @click="onRefreshJob(scope.row)"
            type="primary"
            :icon="Refresh"
            circle
          />

          <el-button
            @click="onClickBuildJob(scope.row)"
            type="primary"
            :icon="Expand"
            circle
          />
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-if="currentJob"
      :show-close="false"
      title="currentJob.displayName"
      v-model="buildDialog"
      width="80%"
      center
    >
      <el-select
        v-if="buildParameter && buildParameter.choices"
        v-model="buildCurrentParameter"
        class="m-2"
        placeholder="Select"
        size="large"
      >
        <el-option
          v-for="item in buildParameter.choices"
          :key="item"
          :label="item"
          :value="item"
        />
      </el-select>
      <el-table :data="buildList" border style="width: 100%" max-height="250">
        <el-table-column label="url">
          <template v-slot="scope">
            <el-button @click="onClickUrl(scope.row.url)" type="primary" link
              >{{ scope.row.url }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="No" width="45">
          <template v-slot="scope">
            <el-button @click="onClickBuildNo(scope.row)" type="primary" link
              >{{ scope.row.number }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="pro" width="80">
          <template v-slot="scope">
            {{
              parseInt(
                scope.row.building
                  ? ((Date.now() - scope.row.timestamp) /
                      scope.row.estimatedDuration) *
                      100
                  : 100
              ) + "%"
            }}
          </template>
        </el-table-column>
        <el-table-column prop="result" label="result" width="100" />
        <el-table-column label="build" width="100">
          <template v-slot="scope">
            {{ friendlyDate(scope.row.timestamp) }}
          </template>
        </el-table-column>
        <el-table-column prop="action" label="Act" fixed="right">
          <template v-slot="scope">
            <el-button
              @click="onRefreshBuild(scope.row)"
              type="primary"
              :icon="Refresh"
              circle
            />
            <el-button
              v-if="scope.row.building"
              @click="onClickStopJob(scope.row)"
              type="primary"
              :icon="SwitchButton"
              circle
            />
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="buildDialog = false">取 消</el-button>
          <el-button
            type="primary"
            :loading="buildStarting"
            @click="onDoBuildJob(currentJob)"
            >开始构建</el-button
          >
        </span>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { Refresh, SwitchButton, Expand } from "@element-plus/icons-vue";
</script>

<script>
import moment from "moment";
import Jenkins from "jenkins";

import friendlyTime from "friendly-time";
import { ThreadPool } from "../js/classutil";
import utools_dev from "../js/utools_mock";

let utools = window.utools ? window.utools : utools_dev;

utools.onPluginEnter(({ code, type, payload }) => {
  console.log("用户进入插件", code, type, payload);
  this.$refs.inputRef.focus();
});

function checkContains(varchr, searchWord) {
  return searchWord.split(" ").every((item) => varchr.includes(item));
}

function getConfigList() {
  let allDocs = utools.db.allDocs("jenkins");
  console.log("config list", allDocs);
  let alldata = [];
  let noActive = true;
  for (let i = 0; i < allDocs.length; i++) {
    let data = allDocs[i];
    if (data.data.active) {
      noActive = false;
    }
    alldata.push(data);
  }

  if (noActive && alldata.length > 0) {
    alldata[0].data.active = true;
  }
  console.log("alldata", alldata);
  return alldata;
}

export default {
  name: "Jenkins",
  data() {
    return {
      buildDialog: false,
      buildStarting: false,
      currentJob: null,
      configList: getConfigList(),
      jobList: [],
      buildList: [],
      buildParameter: [],
      buildCurrentParameter: "",
      filterValue: "",
    };
  },
  computed: {
    filterJobList: function () {
      let filter = this.jobList.filter((e) =>
        checkContains(e.name, this.filterValue)
      );
      return filter;
    },
    runningJobList: function () {
      let filter = this.jobList.filter((job) => job.synced);
      return filter;
    },
  },
  watch: {
    filterValue: {
      handler: function () {},
    },
    configList: {
      handler: function (val) {
        if (this.getJenkins()) {
          this.setJobList();
        }
      },
      deep: true,
    },
  },
  mounted() {
    if (this.getJenkins()) {
      this.setJobList();
    }
  },
  methods: {
    waitOnQueue: function (id, job) {
      (async () => {
        let item = await this.jenkins.queue.item({
          number: id,
          tree: "cancelled,executable",
        });
        console.log("queue", item);
        if (item.executable) {
          console.log("number:", item.executable.number);
          this.updateJobColor(job, true);
        } else if (item.cancelled) {
          console.log("cancelled");
          this.updateJobColor(job, true);
        } else {
          await new Promise((r) => {
            setTimeout(r, 1000);
          });
          this.waitOnQueue(id, job);
        }
      })();
    },

    onDoBuildJob: function (job) {
      (async () => {
        let parameters = {};
        if (this.buildParameter !== null) {
          parameters = {
            name: job.name,
            parameters: {
              [this.buildParameter.name]: this.buildCurrentParameter,
            },
          };
        } else {
          parameters = {
            name: job.name,
          };
        }

        this.buildStarting = true;
        let result = await this.jenkins.job.build(parameters);
        console.log("build result", result);

        this.waitOnQueue(result, job);

        let colorz = await this.jenkins.job.get({
          name: job.name,
          tree: "color",
        });
        console.log("color", colorz);
        job.color = colorz.color;
        this.buildDialog = false;
        this.buildStarting = false;
      })();
    },

    onclickRefreshListJob: function () {
      this.filterJobList.forEach(async (job) => {
        let colorz = await this.jenkins.job.get({
          name: job.name,
          tree: "color",
        });
        console.log("colo", colorz);
        job.color = colorz.color;
        this.updateJobColor(job);
      });

      this.syncJobDetail(this.filterJobList);
    },

    setJobColorUrl: function (job) {
      if (job.color == "notbuilt") {
        job.color = "blue";
      }

      let anime = false;
      let url = this.getCurrentJenkinsUrl();
      let colorPng =
        url + "/static/68283e49/images/16x16/" + job.color + ".png";
      if (job.color && job.color.match(/anime/)) {
        colorPng = url + "/static/68283e49/images/16x16/" + job.color + ".gif";
        anime = true;
      }
      job.colorUrl = colorPng;
      console.log("job.colorUrl", job.colorUrl);
      return anime;
    },

    updateJobColor: function (job, check) {
      if (this.setJobColorUrl(job) || check) {
        if (!job.interval || check) {
          // clear
          if (job.interval) {
            clearInterval(job.interval);
          }

          //set
          job.interval = setInterval(async () => {
            let colorz = await this.jenkins.job.get({
              name: job.name,
              tree: "color",
            });
            job.color = colorz.color;
            console.log("updateJobColor 1 : " + job.color);
            this.setJobColorUrl(job);

            if (job.color.match(/anime/) && !job.synced) {
              this.syncJobDetailNow(job);
              job.synced = true;
            }
            if (!job.color || !job.color.match(/anime/)) {
              console.log("clearInterval 2: " + job.color);
              utools.showNotification(
                job.name + " " + job.color + " ",
                "jenkins"
              );
              utools.shellBeep();
              clearInterval(job.interval);
              job.interval = null;
              job.synced = false;
            }
            console.log("updateJobColor 3 : " + job.color);
          }, 5000);
        }
      }
    },

    onClickBuildJob: async function (job) {
      let data = await this.jenkins.job.get({
        name: job.name,
        tree: "property[parameterDefinitions[defaultParameterValue,name,choices]],allBuilds[*]",
      });
      console.log("job", data);
      this.buildList = data.allBuilds;
      this.buildDialog = true;
      this.buildStarting = false;
      this.currentJob = job;

      const parameterProperty = data.property
        .filter((a) => a._class === "hudson.model.ParametersDefinitionProperty")
        .flatMap((b) => b.parameterDefinitions)
        .filter((c) => c._class === "hudson.model.ChoiceParameterDefinition")
        .find(() => true);

      console.log("parameterProperty", parameterProperty);
      if (parameterProperty) {
        this.buildParameter = parameterProperty;
        this.buildCurrentParameter = this.buildParameter.choices[0];
      } else {
        this.buildParameter = null;
      }
    },

    onClickStopJob: async function (build) {
      let data = await this.jenkins.build.term(
        build.fullDisplayName.split(" ")[0],
        build.id
      );
      build.building = false;
      build.result = "ABORTED";
      this.refreshBuildRowUi(build);
    },

    onRefreshBuild: async function (build) {
      let data = await this.jenkins.build.get(
        build.fullDisplayName.split(" ")[0],
        build.id
      );

      this.refreshBuildRowUi(data, build);
    },

    onRefreshJob: async function (job) {
      this.syncJobDetailNow(job);
    },

    getJenkins: function () {
      if (!this.configList || this.configList.length === 0) {
        return null;
      }
      console.log("configList jenkins", this.configList);
      let activeConf = this.configList.filter((e) => e.data.active)[0];
      console.log("configList jenkins", activeConf);
      this.jenkins = new Jenkins({
        baseUrl: `${activeConf.data.schema}://${activeConf.data.username}:${activeConf.data.password}@${activeConf.data.url}`,
      });
      console.log("configList jenkins end", this.jenkins);
      return this.jenkins;
    },

    friendlyDate: function (timestamp) {
      if (timestamp) {
        return friendlyTime(new Date(timestamp));
      }
      return "N/A";
    },

    formatDate: function (timestamp) {
      if (timestamp) {
        return moment(new Date(timestamp)).format("YYYY-MM-DD HH:mm:ss");
      }
      return "N/A";
    },

    onClickJobNo: function (job) {
      this.onClickUrl(
        this.getCurrentJenkinsUrl() + "/blue/organizations/jenkins/" + job.name
      );
    },

    onClickBuildNo: function (build) {
      let jobName = build.fullDisplayName.split(" ")[0];
      this.onClickUrl(`
        ${this.getCurrentJenkinsUrl()}/blue/organizations/jenkins/${jobName}/detail/${jobName}/${
        build.number
      }`);
    },

    onClickUrl: function (url) {
      utools.shellOpenExternal(url);
    },

    getSyncJobDetailRunnable: function (job) {
      let runnable = new Promise((r) => {
        let thus = this;
        (async function (job) {
          // 获取 last build
          let jobInfo = await thus.jenkins.job.get({
            name: job.name,
            depth: 1,
            tree: "lastBuild[number]",
          });

          console.log(
            "api lastBuild[number] 获取 job 的 last build : " +
              JSON.stringify(jobInfo)
          );

          if (!jobInfo.lastBuild) {
            job.lastBuildTimestamp = 0;
            job.lastBuildTime = "unknow";
            return;
          }
          let lastBuildNumber = jobInfo.lastBuild.number;
          console.log("lastBuildNumber : " + lastBuildNumber);

          // 获取 build 详情
          let lastBuild = await thus.jenkins.build.get({
            name: job.name,
            number: lastBuildNumber,
            tree: "changeSets[items[*]],culprits[fullName],displayName,timestamp",
          });

          thus.updateBuildInfo(lastBuild, job);
          r();
        })(job);
      });
      return runnable;
    },

    refreshRowUi: function (job, origin) {
      if (!origin) {
        origin = job;
      }
      this.filterJobList.splice(this.filterJobList.indexOf(origin), 1, job);
    },

    refreshBuildRowUi: function (build, origin) {
      if (!origin) {
        origin = build;
      }
      this.buildList.splice(this.buildList.indexOf(origin), 1, build);
    },

    syncJobDetailNow: function (job) {
      let promise = this.getSyncJobDetailRunnable(job);
      promise.then(() => {});
    },

    syncJobDetail: async function (jobList) {
      let threadPool = new ThreadPool(5);
      let pool = [];
      for (let job of jobList) {
        let runnable = this.getSyncJobDetailRunnable(job);
        if (!job.lastBuildTime && !job.lastChange) {
          pool.push(runnable);
        }
      }
      threadPool.submitList(pool);
    },

    getCurrentJenkinsUrl: function () {
      let activeConf = this.configList.filter((e) => e.data.active)[0];
      return activeConf.data.schema + "://" + activeConf.data.url;
    },

    setJobList: async function () {
      console.log("set job list");
      try {
        let jobs = await this.jenkins.job.list({
          tree: "jobs[name,url,color,lastBuild[changeSets[items[*]],culprits[fullName],displayName,timestamp]]",
        });
        console.info("jobs = ", jobs);
        for (let job of jobs) {
          this.updateJobColor(job);
          this.updateBuildInfo(job.lastBuild, job);
        }
        this.jobList = jobs;
      } catch (e) {
        console.error(e);
      }
    },

    onClickSetting: function () {
      utools.redirect("jenkins-set", "");
    },

    updateBuildInfo: function (lastBuild, job) {
      console.log("api build : " + JSON.stringify(lastBuild));
      if (!lastBuild) {
        job.lastBuildTimestamp = 0;
        job.lastBuildTime = "unknow";
        return;
      }

      // 写入 job 信息中
      let time = this.friendlyDate(lastBuild.timestamp);
      if (lastBuild.changeSets && lastBuild.changeSets.length > 0) {
        job.lastChange = lastBuild.changeSets[0].items
          .reverse()
          .map((item) => "(" + item.authorEmail + ") " + item.msg)
          .join("\n<br />");
      }

      if (lastBuild.culprits) {
        job.culprits = lastBuild.culprits.map((e) => e.fullName).join("\n");
      }

      job.displayNo = lastBuild.displayName;
      job.lastBuildTime = time;
      job.lastBuildMoment = this.formatDate(lastBuild.timestamp);
      job.lastBuildTimestamp = lastBuild.timestamp;
      job.initBuildData = true;
      console.log("api build job : " + JSON.stringify(job));
      this.refreshRowUi(job);
    },

    onSwitchConf: async function (conf, confList) {
      console.log("onSwitchConf", conf);

      conf.data.active = true;
      confList
        .filter((e) => e !== conf)
        .forEach((e) => (e.data.active = false));
      this.configList.forEach((e) => {
        utools.db.put({
          _id: e._id,
          data: e.data,
          _rev: e._rev,
        });
      });
    },
  },
};
</script>

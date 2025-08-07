import { createApp } from "vue";
import App from "./App.vue";
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import utools_dev from "./js/utools_mock";
import Config from "./components/Config.vue";
import Jenkins from "./components/Jenkins.vue";
import {createRouter,createWebHashHistory} from 'vue-router'

const routes = [
  { path: '/jenkins', component: Jenkins },
  { path: '/config', component: Config },
]

const router = createRouter({
  // 4. 内部提供了 history 模式的实现。为了简单起见，我们在这里使用 hash 模式。
  history: createWebHashHistory(),
  routes, // `routes: routes` 的缩写
})

let utools = window.utools ? window.utools : utools_dev;
utools.onPluginEnter(function ({ code, type, payload, optional }) {
  try {
    console.log(window.location + " plugin enter " + code);
    if (code == "jenkins") {
      window.location.hash = "jenkins";
    } else if (code == "jenkins-set") {
      window.location.hash = "config";
    }
  } catch (e) {
    console.error(e);
  }
});



const app = createApp(App);
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}
app.use(router);
app.mount("#app");

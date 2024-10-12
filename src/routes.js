import App from "./App.vue";
import Router from 'vue-router'
import Config from "./components/Config.vue";
import Jenkins from "./components/Jenkins.vue";
import utools_dev from "./js/utools_mock";

Vue.use(Router)

let router = new Router({
  routes: [
    {
      path: '/index',
      name: 'Jenkins',
      component: Jenkins
    },
    {
      path: '/config',
      name: 'Config',
      component: Config
    }
  ]
});
router.beforeEach((to, from, next) => {
    console.log('beforeEach', to);
    next();
});

export default router

// export default {
//   "/": App,
//   "/index.html": App,
//   "/Config": Config,
//   "/#Config": Config,
//   "/Jenkins": Jenkins,
// };

let utools = window.utools ? window.utools : utools_dev;
utools.onPluginEnter(function ({ code, type, payload, optional }) {
  try {
    console.log(window.location + " plugin enter " + code);
    if (code == "jenkins") {
      window.location.hash = "jenkins";
    } else if (code == "jenkins-set") {
      window.location.hash = "Config";
    }
  } catch (e) {
    console.error(e);
  }
});
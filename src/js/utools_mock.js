//import * as mock from './mock.json'
let func;
export default {
  onPluginEnter: function (funz) {
    func = funz;
  },
  callOnPluginEnter: function (data) {
    func(data);
  },
  redirect: function (name, b) {
    
  },
  onPluginReady: function () {},
  showNotification: function () {},
  shellBeep: function () {},
  db: {
    put: function () {},
    allDocs: function (key) {
      return [
        {
          _id: "",
          data: {
            schema: "http",
            url: "pipeline.1stepai.cn",
            username: "yujichang",
            password: "1179c678c06bfc7fbeb3cf2b0ecfeb4f96",
          },
        },
      ]; 
    },
  },
};

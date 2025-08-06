# uTools Jenkins 小助手

厌倦了在浏览器标签页之间反复横跳，只为看一眼 Jenkins 的构建状态？

向你的新朋友问好！这款 uTools 插件将你的整个 Jenkins 工作流带到指尖。无需离开 uTools 的舒适区，即可监控、构建和管理你的所有 Job。这就像拥有一个微型、高效的 DevOps 工程师，住在你的启动器里！

## ✨ 特性

- 🚀 **多实例管理**: 公司一个，自己一个，轻松切换，雨露均沾！
- 🔍 **闪电搜索**: 瞬间定位你的 Job，告别大海捞针。
- 📊 **状态一览**: 成功、失败、进行中？多彩的 Tag 让你一眼看穿。
- 🔗 **一键直达**: Job 页面、构建详情，点击即走，无需等待。
- 📜 **构建历史**: 轻松翻阅最近的构建记录，追溯问题好帮手。
- 👆 **远程遥控**: 直接在 uTools 里触发构建，还支持带参数构建（目前支持选择参数）！
- 🔄 **实时追踪**: 自动轮询正在运行的构建，完成后还有桌面通知。泡杯咖啡，静候佳音。

## 🛠️ 技术栈

- **Vue 3**: 使用了最新的 `<script setup>` 语法，代码更清爽。
- **Vite**: 闪电般的冷启动和模块热更新。
- **Element Plus**: 提供了一套美观且功能丰富的 UI 组件。
- **uTools Plugin API**: 深度集成 uTools 生态，数据存储、页面跳转、消息通知样样精通。
- **On-demand Imports**: 通过 `unplugin-vue-components` 和 `unplugin-auto-import` 实现组件和 API 的自动按需导入，极致优化。

## 📦 开发与构建

1.  克隆本仓库
2.  安装依赖
    ```bash
    npm install
    ```
3.  启动开发模式
    ```bash
    npm run dev
    ```
4.  在 uTools 的开发者工具中，添加 `utools-jenkins/dist` 目录作为插件入口。
5.  开始编码！

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar)

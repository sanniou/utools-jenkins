import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

import ElementPlus from "unplugin-element-plus/vite";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

import requireTransform from "vite-plugin-require-transform";
import GlobalsPolyfills from "@esbuild-plugins/node-globals-polyfill";
import rollupNodePolyFill from 'rollup-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
      plugins: [
        GlobalsPolyfills({
          process: true,
          buffer: true,
        }),
      ],
    },
  },
  resolve: {
    alias: {
      process: "rollup-plugin-node-polyfills/polyfills/process-es6", // add process
      buffer: "buffer",
      crypto: "crypto-browserify",
      stream: "stream-browserify",
      assert: "assert",
      events: "events",
      http: "stream-http",
      https: "https-browserify",
      os: "os-browserify",
      url: "rollup-plugin-node-polyfills/polyfills/url",
      util: "rollup-plugin-node-polyfills/polyfills/util",
      querystring: "rollup-plugin-node-polyfills/polyfills/qs",
    },
  },

  base: "./",
  server: {
    host: "127.0.0.1",
    port: 3000,
  },
  plugins: [
    vue(),
    ElementPlus({
      // 引入的样式的类型，可以是css、sass、less等，
      importStyle: "css",
      useSource: true,
    }),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
    requireTransform({}),
  ],
  define: {
    "process.env": {},
  },
  build: {
    // 不压缩，用于调试
    minify: false,
    rollupOptions: {
      plugins: [
        // Enable rollup polyfills plugin
        // used during production bundling
        rollupNodePolyFill(),
      ],
    },
  },
});

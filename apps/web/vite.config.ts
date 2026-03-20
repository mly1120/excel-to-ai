import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/element-plus")) {
            const componentMatch = id.match(
              /element-plus\/(?:es|lib)\/components\/([^/]+)\//
            );
            if (componentMatch?.[1]) {
              return `ep-${componentMatch[1]}`;
            }
            return "vendor-element-plus";
          }

          if (id.includes("node_modules/@vue") || id.includes("node_modules/vue")) {
            return "vendor-vue";
          }

          if (id.includes("node_modules/axios")) {
            return "vendor-axios";
          }

          if (id.includes("node_modules")) {
            return "vendor-misc";
          }

          return undefined;
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("../../packages/shared/src", import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true
      }
    },
    fs: {
      allow: [fileURLToPath(new URL("../..", import.meta.url))]
    }
  }
});

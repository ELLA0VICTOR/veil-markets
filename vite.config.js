import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const anchorBrowser = fileURLToPath(
  new URL("./node_modules/@coral-xyz/anchor/dist/browser/index.js", import.meta.url)
);
const utilBrowser = fileURLToPath(
  new URL("./node_modules/util/util.js", import.meta.url)
);
const processBrowser = fileURLToPath(
  new URL("./node_modules/process/browser.js", import.meta.url)
);

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env": JSON.stringify({ NODE_DEBUG: "" }),
    global: "globalThis",
  },
  resolve: {
    alias: [
      {
        find: /^@coral-xyz\/anchor$/,
        replacement: anchorBrowser,
      },
      { find: "buffer", replacement: "buffer" },
      { find: /^util$/, replacement: utilBrowser },
      { find: /^process$/, replacement: processBrowser },
      { find: "stream", replacement: "stream-browserify" },
      { find: "crypto", replacement: "crypto-browserify" },
    ],
  },
  optimizeDeps: {
    include: ["buffer", "util", "process", "@solana/web3.js"],
  },
  server: {
    proxy: {
      "/api/arcium": {
        target: "http://localhost:8787",
        changeOrigin: true,
        secure: false,
      },
      "/api/polymarket": {
        target: "http://localhost:8787",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const anchorBrowser = fileURLToPath(
  new URL("./node_modules/@coral-xyz/anchor/dist/browser/index.js", import.meta.url)
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
      { find: "stream", replacement: "stream-browserify" },
      { find: "crypto", replacement: "crypto-browserify" },
    ],
  },
  optimizeDeps: {
    include: ["buffer", "@solana/web3.js"],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});

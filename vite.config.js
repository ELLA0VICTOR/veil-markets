import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env": "{}",
    global: "globalThis",
  },
  resolve: {
    alias: {
      buffer: "buffer",
      stream: "stream-browserify",
      crypto: "crypto-browserify",
    },
  },
  optimizeDeps: {
    include: ["buffer", "@coral-xyz/anchor", "@solana/web3.js"],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "client",
  build: {
    outDir: "../dist",
    emptyOutDir: true
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    hmr: false,
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000"
    }
  }
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@loopin/shared": path.resolve(import.meta.dirname, "../shared/src/index.ts"),
    },
  },
  define: {
    global: "window",
  },
  server: {
    port: parseInt(process.env["VITE_DEV_PORT"] ?? "5173"),
    open: false,
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});

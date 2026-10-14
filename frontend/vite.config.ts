import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  // GitHub Pages hosts this repository under /loopin/.
  // Keep the normal root path for local development.
  base: process.env["VITE_BASE_PATH"] ?? "/",

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

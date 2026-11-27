import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const source = resolve(import.meta.dirname, "cast_react/static/src");

export default defineConfig({
  plugins: [react()],
  root: source,
  base: "/static/",
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    // The page is served by Django (another origin), so the dev server must allow it.
    cors: true,
  },
  resolve: {
    alias: {
      "@": resolve(source, "js/cast_react"),
    },
  },
  build: {
    outDir: resolve(import.meta.dirname, "cast_react/static/cast_react"),
    assetsDir: "",
    manifest: "manifest.json",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(source, "js/cast_react/main.tsx"),
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});

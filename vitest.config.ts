import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // e2e/*.spec.ts は Playwright 専用。vitest が拾わないよう除外する
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
  resolve: {
    alias: {
      // tsconfig の paths と同じく @ をプロジェクトルートへ解決する
      "@": resolve(projectRoot, "."),
    },
  },
});

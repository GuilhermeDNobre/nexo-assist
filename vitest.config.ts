import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
          exclude: ["**/*.int.test.ts", "e2e/**"],
          environment: "jsdom",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["**/*.int.test.ts"],
          exclude: ["node_modules/**"],
          environment: "node",
        },
      },
    ],
  },
});

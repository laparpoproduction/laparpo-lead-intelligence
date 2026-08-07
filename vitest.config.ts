import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    exclude: ["tests/e2e/**", "tests/e2e-authenticated/**", "node_modules/**"],
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
});

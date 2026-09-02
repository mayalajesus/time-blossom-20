import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: {
    environment: "node",
    include: ["tests/domain/**/*.test.ts"],
    fileParallelism: false,
    passWithNoTests: false,
  },
});

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    globals: false,
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // Mirror the tsconfig "@/*" -> "src/*" path alias so tests import like the app.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

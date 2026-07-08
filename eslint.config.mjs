import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
// Disables ESLint rules that conflict with Prettier so formatting is owned by
// Prettier alone and the two tools never fight. Must come LAST to win.
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma-generated client — machine output, not ours to lint.
    "src/generated/**",
    // Finished reference implementation kept out of the build during the
    // step-by-step rebuild (also gitignored). Not part of the working tree.
    "_reference/**",
  ]),
]);

export default eslintConfig;

import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import _import from "eslint-plugin-import";
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: eslint.configs.recommended,
    allConfig: eslint.configs.all
});

export default defineConfig([
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
        extends: fixupConfigRules(compat.extends(
            "plugin:import/recommended",
            "plugin:import/typescript",
            "prettier",
        )),

        plugins: {
            import: fixupPluginRules(_import),
        },

        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: __dirname,
            },
        },

        rules: {
            "@typescript-eslint/explicit-function-return-type": "error",
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/ban-ts-comment": "error",
            "@typescript-eslint/no-floating-promises": "error",

            "import/order": ["error", {
                alphabetize: {
                    order: "asc",
                },

                groups: ["builtin", "external", "internal", ["parent", "sibling", "index"]],
                "newlines-between": "always",
            }],

            "no-console": "warn",
            eqeqeq: ["error", "always"],
        },
        settings: {
            // Tell eslint-plugin-import how to resolve aliases
            "import/resolver": {
              typescript: {
                // Monorepo-aware: point at the SDK tsconfig and (optionally) the root
                project: [
                  path.join(__dirname, "tsconfig.json"),
                  path.join(__dirname, "../../tsconfig.json"),
                  path.join(__dirname, "../../packages/*/tsconfig.json"),
                ],
                alwaysTryTypes: true,
                bun: true, // since you use Bun, let resolver handle Bun modules
              },
              node: {
                extensions: [".ts", ".tsx", ".js", ".jsx", ".d.ts"],
              },
            },
          },
    }
]);
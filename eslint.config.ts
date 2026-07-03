import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import { includeIgnoreFile } from "@eslint/compat";
import eslint from "@eslint/js";
import json from "@eslint/json";
import prettier from "eslint-config-prettier";
import astro from "eslint-plugin-astro";
import jsdoc from "eslint-plugin-jsdoc";
import pkgJson from "eslint-plugin-package-json";
import perfectionist from "eslint-plugin-perfectionist";
import unicorn from "eslint-plugin-unicorn";
import workspaces from "eslint-plugin-workspaces";
import { defineConfig } from "eslint/config";
import Path from "node:path";
import tseslint from "typescript-eslint";

const gitignorePath = Path.resolve(import.meta.dirname, ".gitignore");

export default defineConfig([
    includeIgnoreFile(gitignorePath),
    {
        ignores: [
            "**/.claude",
            ".plan" // replicate global git ignore settings
        ]
    },
    workspaces.configs.recommended,
    {
        // fixtures import @grepco/astro-pagemeta instead of writing a relative import
        // from within the isolated fixtures directory, which wouldn't correspond
        // to the correct source files from where the fixture files actually are on disk
        files: [
            "packages/astro-pagemeta/tests/integration/fixtures/**",
            "packages/astro-pagemeta/tests/integration/middleware/sequence.middleware.ts"
        ],
        rules: {
            "workspaces/no-absolute-imports": "off"
        }
    },
    {
        extends: [comments.recommended],
        rules: {
            "@eslint-community/eslint-comments/require-description": "error"
        }
    },
    {
        extends: [json.configs.recommended],
        files: ["**/*.json"],
        ignores: [
            "**/package.json",
            "**/package-lock.json",
            "**/tsconfig.json",
            "**/tsconfig.*.json"
        ],
        language: "json/json",
        rules: {
            "json/sort-keys": "error"
        }
    },
    {
        extends: [json.configs.recommended],
        files: ["**/*.jsonc", ".vscode/*.json"],
        language: "json/jsonc",
        rules: {
            "json/sort-keys": "error"
        }
    },
    {
        extends: [pkgJson.configs.recommended, pkgJson.configs.stylistic],
        files: ["package.json"],
        rules: {
            "package-json/require-description": "off"
        }
    },
    {
        extends: [
            eslint.configs.recommended,
            tseslint.configs.strict,
            tseslint.configs.stylistic,
            unicorn.configs.recommended,
            perfectionist.configs["recommended-natural"]
        ],
        // astro files still get non-typed lint rules from typescript eslint ...
        files: ["**/*.{ts,astro}"],
        rules: {
            "block-scoped-var": ["error"],
            "unicorn/no-keyword-prefix": ["off"],
            "unicorn/prevent-abbreviations": ["off"],
            // irons out conflict between declaration in HTML (astro fixtures) and exact verification in node setting (tests)
            "unicorn/text-encoding-identifier-case": [
                "error",
                { withDash: true }
            ]
        }
    },
    // ... but typed linting crashes eslint on astro files, seems to be some conflict in
    // parser settings? leaving alone for now
    {
        extends: [
            tseslint.configs.strictTypeChecked,
            tseslint.configs.stylisticTypeChecked
        ],
        files: ["**/*.ts"],
        languageOptions: {
            parserOptions: {
                projectService: true
            }
        },
        rules: {
            "@typescript-eslint/restrict-template-expressions": [
                "error",
                {
                    allowBoolean: true
                }
            ]
        }
    },
    {
        extends: [astro.configs.recommended, astro.configs["jsx-a11y-strict"]],
        files: ["**/*.astro"],
        rules: {
            "unicorn/filename-case": ["off"],
            // https://github.com/sindresorhus/eslint-plugin-unicorn/blob/v56.0.1/docs/rules/prefer-module.md
            // accounts for Astro frontmatter not looking like an ES Module
            "unicorn/prefer-module": ["off"]
        }
    },

    /** rules for publishables */
    {
        extends: [
            pkgJson.configs["recommended-publishable"],
            pkgJson.configs.stylistic
        ],
        files: ["packages/**/package.json"]
    },
    {
        extends: [jsdoc.configs["flat/recommended-typescript-error"]],
        files: ["packages/**/*.ts"],
        rules: {
            // When JSDoc exists, require meaningful content ...
            "jsdoc/require-description": "error",
            // ... but don't require JSDoc on every function — only enforce style when present
            "jsdoc/require-jsdoc": "off",
            "jsdoc/require-param-description": "error",
            "jsdoc/require-returns-description": "error"
        }
    },

    prettier
]);

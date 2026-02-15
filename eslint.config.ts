import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import { includeIgnoreFile } from "@eslint/compat";
import eslint from "@eslint/js";
import json from "@eslint/json";
import prettier from "eslint-config-prettier";
import astro from "eslint-plugin-astro";
import pkgJson from "eslint-plugin-package-json";
import perfectionist from "eslint-plugin-perfectionist";
import unicorn from "eslint-plugin-unicorn";
import { defineConfig } from "eslint/config";
import globals from "globals";
import Path from "node:path";
import tseslint from "typescript-eslint";

const gitignorePath = Path.resolve(import.meta.dirname, ".gitignore");

export default defineConfig([
    includeIgnoreFile(gitignorePath),
    {
        ignores: [
            ".claude",
            ".plan", // replicate global ignore settings
            "runtime-stub.js"
        ]
    },
    {
        extends: [comments.recommended],
        rules: {
            "@eslint-community/eslint-comments/require-description": "error"
        }
    },
    {
        extends: [
            pkgJson.configs["recommended-publishable"],
            pkgJson.configs.stylistic
        ]
    },
    {
        extends: [json.configs.recommended],
        files: ["**/*.json"],
        ignores: ["package.json", "package-lock.json", "tsconfig.json"],
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
        extends: [
            eslint.configs.recommended,
            tseslint.configs.strict,
            tseslint.configs.stylistic,
            unicorn.configs.recommended,
            perfectionist.configs["recommended-natural"]
        ],
        // astro files still get non-typed lint rules from typescript eslint ...
        files: ["**/*.{js,ts,tsx,jsx,astro,mjs,mts}"],
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
        files: ["**/*.{ts,tsx,mts}"],
        languageOptions: {
            parserOptions: {
                projectService: true
            }
        }
    },
    {
        files: ["*.{js,ts,mjs}"],
        languageOptions: {
            globals: {
                ...globals.node
            }
        }
    },
    // Probably overkill, only astro files are fixtures, but figure might as well
    // have some guardrails against dumb mistakes, assuming not in the way and easy to add here
    {
        extends: [astro.configs.recommended, astro.configs["jsx-a11y-strict"]],
        files: ["**/*.astro"],
        rules: {
            // https://github.com/sindresorhus/eslint-plugin-unicorn/blob/v56.0.1/docs/rules/prefer-module.md
            // accounts for Astro frontmatter not looking like an ES Module
            "unicorn/prefer-module": ["off"]
        }
    },
    prettier
]);

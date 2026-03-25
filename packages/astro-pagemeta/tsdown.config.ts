import { defineConfig } from "tsdown";

export default defineConfig({
    attw: { profile: "esm-only" },
    deps: {
        neverBundle: ["virtual:pagemeta/config", /^@grepco\/astro-pagemeta/],
        skipNodeModulesBundle: true
    },
    dts: { sourcemap: true },
    entry: ["src/index.ts", "src/runtime.ts", "src/middleware.ts"],
    failOnWarn: "ci-only",
    format: "esm",
    publint: true,
    target: "node18",
    tsconfig: "src/tsconfig.json"
});

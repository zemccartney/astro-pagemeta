import { defineConfig } from "tsdown";

export default defineConfig({
    attw: {
        // ./Head maps to src/Head.astro — a compiler-provided module attw
        // cannot resolve (its types come from Astro's tooling, not a .d.ts).
        // Excluded so the known-inert "No resolution" warning can't fail CI
        // (failOnWarn: "ci-only"); all JS entrypoints remain checked.
        excludeEntrypoints: ["Head"],
        profile: "esm-only"
    },
    deps: {
        neverBundle: ["virtual:pagemeta/config", /^@grepco\/astro-pagemeta/],
        skipNodeModulesBundle: true
    },
    dts: { sourcemap: true },
    entry: ["src/index.ts", "src/runtime.ts", "src/middleware.ts"],
    failOnWarn: "ci-only",
    format: "esm",
    publint: true,
    target: "node22",
    tsconfig: "src/tsconfig.json"
});

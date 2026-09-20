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
        // Bundle only our own relative source files; everything else
        // (npm packages, node: builtins, the virtual config module, the
        // middleware -> runtime self-import) stays an external import as
        // written. `neverBundle: true` is the documented replacement for the
        // removed skipNodeModulesBundle, but it tries to resolve
        // virtual:ephemeris/config and warns (UNRESOLVED_IMPORT), which
        // failOnWarn turns into a CI failure — hence the predicate.
        neverBundle: (id: string) => !id.startsWith(".") && !id.startsWith("/")
    },
    dts: { sourcemap: true },
    entry: ["src/index.ts", "src/runtime.ts", "src/middleware.ts"],
    failOnWarn: "ci-only",
    format: "esm",
    publint: true,
    target: "node22",
    tsconfig: "src/tsconfig.json"
});

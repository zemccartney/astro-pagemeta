/*
 * Switch the workspace to a different supported Astro major, for local and
 * CI matrix testing (ROADMAP M2).
 *
 * Usage: node scripts/use-astro.ts <major>   (e.g. 6 or 7)
 *
 * Rewrites the `astro` catalog entry in pnpm-workspace.yaml plus the
 * playground's Astro-major-coupled `@astrojs/node` range, then runs
 * `pnpm install --no-frozen-lockfile`. Restore afterwards with:
 *
 *   git restore pnpm-workspace.yaml playground/package.json pnpm-lock.yaml && pnpm install
 *
 * Run via node's native TS support (Node 24), same pattern as
 * scripts/deps-pkg.ts.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

/**
 * Supported Astro majors mapped to the matching @astrojs/node major used by
 * the playground (the adapter releases a major per Astro major). Extend this
 * map when the support matrix moves (see maintenance/astro-node-support.md).
 */
const NODE_ADAPTER_BY_ASTRO_MAJOR: Record<string, string> = {
    "6": "^10.0.0",
    "7": "^11.0.0"
};

const major = process.argv[2];

if (!major || !(major in NODE_ADAPTER_BY_ASTRO_MAJOR)) {
    const supported = Object.keys(NODE_ADAPTER_BY_ASTRO_MAJOR).join(", ");
    console.error(
        `${major ? `Unsupported Astro major "${major}".` : "Missing Astro major."}\n\nUsage: node scripts/use-astro.ts <major>\nSupported majors: ${supported}`
    );
    // eslint-disable-next-line unicorn/no-process-exit -- this is a CLI script; a usage error should exit non-zero without a stack trace
    process.exit(1);
}

const workspaceFile = "pnpm-workspace.yaml";
const workspaceYaml = readFileSync(workspaceFile, "utf-8");
const rewrittenYaml = workspaceYaml.replace(
    /^(\s*astro:\s*)\^\d+\.\d+\.\d+$/m,
    `$1^${major}.0.0`
);
if (rewrittenYaml === workspaceYaml && !workspaceYaml.includes(`^${major}.`)) {
    console.error(
        `Could not find the astro catalog entry in ${workspaceFile}.`
    );
    // eslint-disable-next-line unicorn/no-process-exit -- this is a CLI script; a usage error should exit non-zero without a stack trace
    process.exit(1);
}
writeFileSync(workspaceFile, rewrittenYaml);

const playgroundFile = "playground/package.json";
const playgroundJson = readFileSync(playgroundFile, "utf-8");
writeFileSync(
    playgroundFile,
    playgroundJson.replace(
        /"@astrojs\/node":\s*"\^\d+\.\d+\.\d+"/,
        `"@astrojs/node": "${NODE_ADAPTER_BY_ASTRO_MAJOR[major]}"`
    )
);

console.log(`Catalog astro → ^${major}.0.0; installing...`);
execFileSync("pnpm", ["install", "--no-frozen-lockfile"], {
    stdio: "inherit"
});
console.log(
    execFileSync("pnpm", ["why", "astro", "--depth", "0"], {
        encoding: "utf-8"
    })
        .split("\n")
        .filter((line) => line.includes("astro "))
        .slice(0, 2)
        .join("\n") || `Switched to Astro ${major}.`
);

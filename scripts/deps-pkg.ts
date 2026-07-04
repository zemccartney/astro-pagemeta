/*
 * Interactive ncu for a single workspace package.
 *
 * Usage: pnpm deps:pkg <workspace-name> [extra ncu args...]
 * Errors with the list of available workspaces when the name is missing
 * or unknown. Run via node's native TS support (Node 24), same pattern
 * as packages/astro-pagemeta/scripts/check-engines.ts.
 */
import { execFileSync, spawnSync } from "node:child_process";

interface WorkspacePackage {
    name?: string;
    path: string;
}

const listing = execFileSync("pnpm", ["m", "ls", "--json", "--depth", "-1"], {
    encoding: "utf-8"
});
const packages = (JSON.parse(listing) as WorkspacePackage[])
    .filter(
        (pkg): pkg is WorkspacePackage & { name: string } =>
            pkg.path !== process.cwd() && typeof pkg.name === "string"
    )
    .map((pkg) => pkg.name)
    .toSorted();

const [target, ...passthrough] = process.argv.slice(2);

if (!target || !packages.includes(target)) {
    const problem =
        target ? `Unknown workspace "${target}".` : "Missing workspace name.";
    console.error(
        `${problem}\n\nUsage: pnpm deps:pkg <workspace>\n\nAvailable workspaces:\n${packages
            .map((name) => `  - ${name}`)
            .join(
                "\n"
            )}\n\n(For the root package or everything at once, use pnpm deps / pnpm deps:all.)`
    );
    // eslint-disable-next-line unicorn/no-process-exit -- this is a CLI script; a usage error should exit non-zero without a stack trace
    process.exit(1);
}

const result = spawnSync(
    "ncu",
    [
        "-p",
        "pnpm",
        "-i",
        "--format",
        "group",
        "--cooldown",
        "7d",
        "--no-root",
        "--workspace",
        target,
        ...passthrough
    ],
    { stdio: "inherit" }
);
// eslint-disable-next-line unicorn/no-process-exit -- this is a CLI script; propagate ncu's exit code
process.exit(result.status ?? 1);

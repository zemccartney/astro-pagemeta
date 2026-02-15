import type { AstroInlineConfig } from "astro";

import { loadFixture } from "@inox-tools/astro-tests/astroFixture";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

type FixtureConfig = Omit<AstroInlineConfig, "root">;

// Temp dirs must be within the project tree so Vite can walk up
// and find node_modules + package.json for module resolution.
const projectRoot = path.resolve(
    new URL(".", import.meta.url).pathname,
    "../.."
);
const tmpBase = path.join(projectRoot, ".test-tmp");

export async function isolatedFixture(
    fixtureUrl: URL,
    inlineConfig: FixtureConfig = {}
) {
    const sourcePath = new URL(".", fixtureUrl).pathname;

    await mkdir(tmpBase, { recursive: true });
    const tmp = await mkdtemp(path.join(tmpBase, "fixture-"));

    await cp(sourcePath, tmp, {
        filter: (src) => {
            const relative = src.slice(sourcePath.length);
            return !/^\/?(\.(astro|DS_Store)|dist|node_modules)(\/|$)/.test(
                relative
            );
        },
        recursive: true
    });

    const fixture = await loadFixture({ root: tmp, ...inlineConfig });

    return {
        cleanup: () => rm(tmp, { force: true, recursive: true }),
        fixture
    };
}

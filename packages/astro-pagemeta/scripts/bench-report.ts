/**
 * Generates BENCHMARKS.md with performance results and environment info.
 *
 * Run: node scripts/bench-report.ts
 *
 * Uses the same processor and fixtures as vitest bench, but runs
 * independently so we control the output format and can capture
 * environment metadata.
 */
import { readFile, writeFile } from "node:fs/promises";
import { cpus, platform, release, type } from "node:os";
import path from "node:path";
import { rehype } from "rehype";

import type { MetadataOptions } from "../src/types.ts";

import { FIXTURES, HEAD_CONTENT } from "../bench/fixtures/generate.ts";
import { createMetadataProcessor } from "../src/core.ts";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WARMUP = 20;
const ITERATIONS = 200;

const META: MetadataOptions = {
    custom: {
        "og:image": "https://example.com/image.png",
        "og:locale": "en_US",
        robots: "index, follow",
        "twitter:card": "summary_large_image",
        "twitter:site": "@example"
    },
    description: "A benchmark test page for measuring processing overhead",
    jsonLd: {
        "@type": "WebPage",
        description: "Benchmark page",
        name: "Benchmark"
    } as never,
    og: true,
    title: "Benchmark Page | Example Site",
    twitter: true
};

const COMPRESS_META: MetadataOptions = { ...META };

// ---------------------------------------------------------------------------
// Benchmark runner
// ---------------------------------------------------------------------------

interface BenchResult {
    mean: number;
    median: number;
    p99: number;
}

async function benchmark(
    fn: () => Promise<unknown>,
    { iterations = ITERATIONS, warmup = WARMUP } = {}
): Promise<BenchResult> {
    // Warmup
    for (let i = 0; i < warmup; i++) {
        await fn();
    }

    // Collect timings
    const timings: number[] = [];
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await fn();
        timings.push(performance.now() - start);
    }

    timings.sort((a, b) => a - b);

    const sum = timings.reduce((acc, t) => acc + t, 0);

    return {
        mean: sum / timings.length,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- sorted array with known length
        median: timings[Math.floor(timings.length * 0.5)]!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- sorted array with known length
        p99: timings[Math.floor(timings.length * 0.99)]!
    };
}

function fmt(ms: number): string {
    if (ms < 0.01) return "<0.01";
    if (ms < 1) return ms.toFixed(2);
    return ms.toFixed(1);
}

/**
 * Safely access a result record, throwing if key is missing.
 * @param record - The benchmark results record
 * @param key - The fixture name key
 * @returns The benchmark result for the given key
 */
function get(record: Record<string, BenchResult>, key: string): BenchResult {
    const result = record[key];
    if (!result) throw new Error(`Missing benchmark result for "${key}"`);
    return result;
}

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

// Fixture keys are alphabetically sorted; they happen to match display order
const DISPLAY_ORDER = [
    "p10 (25 KB)",
    "p25 (55 KB)",
    "p50 (140 KB)",
    "p75 (310 KB)",
    "p90 (610 KB)"
] as const;

console.log("Running benchmarks...\n");

const processor = createMetadataProcessor({
    addRequiredGlobalMeta: true,
    compressHTML: false,
    routePatterns: [/^\//]
});

const compressProcessor = createMetadataProcessor({
    addRequiredGlobalMeta: true,
    compressHTML: true,
    routePatterns: [/^\//]
});

const bareRehype = rehype();

// --- Rehype baseline ---
console.log("  rehype baseline...");
const baseline: Record<string, BenchResult> = {};
for (const name of DISPLAY_ORDER) {
    const html = FIXTURES[name];
    const result = await benchmark(() => bareRehype.process(html));
    baseline[name] = result;
    process.stdout.write(`    ${name}: ${fmt(result.median)}ms\n`);
}

// --- Auto mode ---
console.log("  auto mode...");
const autoMode: Record<string, BenchResult> = {};
for (const name of DISPLAY_ORDER) {
    const html = FIXTURES[name];
    const result = await benchmark(() =>
        processor.getHtmlProcessor({ metadata: META }).process(html)
    );
    autoMode[name] = result;
    process.stdout.write(`    ${name}: ${fmt(result.median)}ms\n`);
}

// --- Auto mode + compressHTML ---
console.log("  auto mode + compressHTML...");
const autoCompress: Record<string, BenchResult> = {};
for (const name of DISPLAY_ORDER) {
    const html = FIXTURES[name];
    const result = await benchmark(() =>
        compressProcessor
            .getHtmlProcessor({ metadata: COMPRESS_META })
            .process(html)
    );
    autoCompress[name] = result;
    process.stdout.write(`    ${name}: ${fmt(result.median)}ms\n`);
}

// --- Manual mode ---
console.log("  manual mode...");
const manualMode = await benchmark(() =>
    processor
        .getHtmlProcessor({ fragment: true, metadata: META })
        .process(HEAD_CONTENT)
);
process.stdout.write(`    head fragment: ${fmt(manualMode.median)}ms\n`);

// ---------------------------------------------------------------------------
// Environment info
// ---------------------------------------------------------------------------

const cpu = cpus()[0];

// Read versions from package.json files directly (can't import package.json
// subpaths — most packages don't export them)
async function readPkgVersion(pkg: string): Promise<string> {
    const dir = path.resolve(
        import.meta.dirname,
        "..",
        "node_modules",
        ...pkg.split("/")
    );
    const raw = await readFile(path.resolve(dir, "package.json"), "utf-8");
    return (JSON.parse(raw) as { version: string }).version;
}

const env = {
    cpu: cpu ? `${cpu.model.trim()} (${cpus().length} cores)` : "unknown",
    node: process.version,
    os: `${type()} ${release()} (${platform()})`,
    rehype: await readPkgVersion("rehype")
};

// ---------------------------------------------------------------------------
// Generate markdown
// ---------------------------------------------------------------------------

const dateStr = new Date().toISOString().slice(0, 10);

// Precompute key observations to keep the template readable
const medianAuto = get(autoMode, "p50 (140 KB)");
const medianBaseline = get(baseline, "p50 (140 KB)");
const medianCompress = get(autoCompress, "p50 (140 KB)");

const md = `<!-- AUTO-GENERATED by scripts/bench-report.ts — do not edit manually -->

# Benchmark Results

> Generated ${dateStr} on ${env.os}
> Node ${env.node} | rehype ${env.rehype}
> CPU: ${env.cpu}

## How to Read These Results

The integration's per-request overhead comes from parsing HTML into an AST (via rehype/parse5), running plugins that inject meta tags into \`<head>\`, then serializing the AST back to HTML.

- **Auto mode** parses and serializes the **entire document**. Cost scales linearly with page size.
- **Manual mode** (\`<Head>\` component) processes only the **\`<head>\` content**, not the full document. Cost depends on \`<head>\` size, which is typically small relative to the body.
- **Rehype baseline** is rehype with zero plugins — the irreducible cost of parse + serialize that no configuration can eliminate.

All pagemeta plugins only operate on \`<head>\` elements. The cost difference between auto mode and the rehype baseline is pagemeta's actual overhead — typically under 1ms.

### About Fixture Sizes

Fixture sizes are aligned with the [2025 Web Almanac](https://almanac.httparchive.org/en/2025/page-weight) HTML size distribution. The Almanac reports compressed transfer sizes; we estimate raw (uncompressed) sizes at ~4x compression ratio, since that's what the middleware processes. For example, the p50 (median) compressed transfer size of ~35 KB corresponds to ~140 KB of raw HTML.

## Results

All times in milliseconds (median of ${ITERATIONS} iterations after ${WARMUP} warmup).

### Auto Mode vs Manual Mode

| Document Size | Auto Mode | Auto + compressHTML | Manual Mode | Rehype Baseline |
|---|---|---|---|---|
${DISPLAY_ORDER.map((name) => `| ${name} | ${fmt(get(autoMode, name).median)} | ${fmt(get(autoCompress, name).median)} | ${fmt(manualMode.median)} | ${fmt(get(baseline, name).median)} |`).join("\n")}

### Key Observations

- **Pagemeta plugin overhead is ~${fmt(medianAuto.median - medianBaseline.median)}ms** on a median-sized (p50) page. Nearly all cost is rehype's HTML parse/serialize.
- **Manual mode is ~${fmt(manualMode.median)}ms** in this benchmark, processing a ~250-byte head fixture. In practice, cost scales with your \`<head>\` size, but \`<head>\` is typically small relative to the body.
- **\`compressHTML\` adds ~${fmt(medianCompress.median - medianAuto.median)}ms** on a median-sized page because \`rehype-minify-whitespace\` walks the entire tree, unlike the other plugins.

### Auto Mode Scaling

| Document Size | Median | p99 |
|---|---|---|
${DISPLAY_ORDER.map((name) => {
    const r = get(autoMode, name);
    return `| ${name} | ${fmt(r.median)} | ${fmt(r.p99)} |`;
}).join("\n")}

## Reproduce These Results

\`\`\`bash
# Quick check (vitest bench, interactive output)
pnpm --filter @grepco/astro-pagemeta bench

# Generate this report
node packages/astro-pagemeta/scripts/bench-report.ts
\`\`\`

The benchmark fixtures are programmatically generated HTML documents with realistic structure (headings, paragraphs, code blocks, lists, tables). Source: [\`bench/fixtures/generate.ts\`](packages/astro-pagemeta/bench/fixtures/generate.ts).
`;

const outPath = path.resolve(import.meta.dirname, "..", "BENCHMARKS.md");
await writeFile(outPath, md);

console.log(`\nWrote ${outPath}`);

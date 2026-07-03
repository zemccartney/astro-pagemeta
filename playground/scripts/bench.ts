import autocannon from "autocannon";
/**
 * Integration benchmark: measures real request latency in an Astro SSR app
 * with pagemeta installed.
 *
 * Usage: pnpm bench
 *   1. Builds the playground (astro build)
 *   2. Starts the Node standalone server
 *   3. Runs autocannon against / and /bare for 10 seconds each
 *   4. Stops the server, prints results
 */
import { execSync, spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";

const HOST = "http://localhost:4321";

// Build first
console.log("Building playground...");
execSync("pnpm build", { cwd: import.meta.dirname + "/..", stdio: "inherit" });

// Start the preview server
console.log("\nStarting preview server...");
const server = spawn("node", ["./dist/server/entry.mjs"], {
    cwd: import.meta.dirname + "/..",
    env: { ...process.env, HOST: "127.0.0.1", PORT: "4321" },
    stdio: "pipe"
});

// Wait for server to be ready
await waitForServer(HOST);
console.log("Server ready.\n");

const paths = [
    { label: "/ (complex metadata + JSON-LD)", path: "/" },
    { label: "/bare (no metadata set)", path: "/bare" }
];

for (const { label, path } of paths) {
    console.log(`\nBenchmarking: ${label}`);
    console.log("─".repeat(50));

    const result = await autocannon({
        connections: 100,
        duration: 20,
        url: `${HOST}${path}`
    });

    console.log(`  Requests/sec: ${result.requests.average}`);
    console.log(
        `  Latency (ms): p50=${result.latency.p50} p99=${result.latency.p99} max=${result.latency.max}`
    );
    console.log(
        `  Throughput:   ${formatBytes(result.throughput.average)}/sec`
    );
}

// Cleanup
server.kill();
console.log("\nDone.");

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function waitForServer(url: string, retries = 30) {
    for (let i = 0; i < retries; i++) {
        try {
            await fetch(url);
            return;
        } catch {
            await setTimeout(200);
        }
    }
    server.kill();
    throw new Error("Server did not start in time");
}

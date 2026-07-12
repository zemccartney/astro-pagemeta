import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
        /**
         * Perf/stability settings, measured 2026-07-05/06 under Astro 6.4.8
         * (M3, 8 cores, 16 GB — full data + bisection in
         * planning/artifacts/testing-isolation.md addenda):
         *
         * - maxWorkers 3: historically adopted against intermittent
         *   dev-server socket errors (ECONNREFUSED / "other side closed")
         *   under high parallelism; measurement confirmed it's also the
         *   perf sweet spot — wall time is contention-pinned (~same at 2,
         *   3, or 5 workers) while cumulative CPU scales with workers, so
         *   raising it only burns CPU. Root cause of the Astro 5→6
         *   slowdown is per-op cost (~2x) plus modest contention growth.
         *
         * - isolate false (33.5s → ~25s): workers keep one module cache
         *   for their lifetime instead of re-importing astro/vite per test
         *   file. Cross-file leaks to watch: the harness flips
         *   process.env.NODE_ENV per op and its port counter is
         *   module-level — both benign while files run sequentially
         *   per worker.
         *
         * - pool threads (→ ~21s): worker_threads instead of forked
         *   processes — separate V8 isolates (own globals/modules) in one
         *   process, so spawn/IPC overhead disappears. Revisit if a native
         *   addon ever misbehaves under multiple isolates.
         */
        isolate: false,
        maxWorkers: 3,
        pool: "threads",
        reporters: "tree"
    }
});

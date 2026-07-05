import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
        /**
         * Tests have been prone to intermittent server failures, manifesting as
         * Error: connect ECONNREFUSED ::1:29887 and SocketError: other side closed type errors
         *
         * This setting seems to help? And anecdotally makes the tests run a tic faster.
         * Maybe starting fewer servers at once means less resource competition means
         * all tests start up and run faster? Not sure
         *
         * Measured 2026-07-05 under Astro 6.4.8 (M3, 8 cores, 16 GB — see
         * planning/artifacts/testing-isolation.md addendum): wall time is
         * contention-pinned at ~37-40s regardless of workers (2 → 40s wall /
         * 66s cumulative; 3 → 37s / 92s; 5 → 37s / 149s), while solo runs
         * are fast (dev server 550ms, build 1.1s). Astro 6 ops parallelize
         * worse than Astro 5's (which ran the same suite shape at ~15s wall /
         * 30s cumulative). 3 remains the least-bad setting; raising it only
         * burns CPU.
         */
        maxWorkers: 3,
        reporters: "tree"
    }
});

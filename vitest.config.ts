import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["tests/**/*.test.ts"],
        maxWorkers: 2 // TODO remove when test suite more reliable, fewer servers spun up
    }
});

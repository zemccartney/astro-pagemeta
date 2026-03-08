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
         */
        maxWorkers: 3,
        reporters: "tree"
    }
});

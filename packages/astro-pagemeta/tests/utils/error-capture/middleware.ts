import { defineMiddleware } from "astro/middleware";
import { key } from "virtual:test-error-capture/config";

export const onRequest = defineMiddleware(async (_ctx, next) => {
    try {
        return await next();
    } catch (error) {
        if (error instanceof Error) {
            const store = globalThis as Record<string, unknown>;
            store[key] ??= [];
            (store[key] as Error[]).push(error);
            throw error;
        }
        throw error;
    }
});

import type { AstroIntegration } from "astro";

import Path from "node:path";
import { fileURLToPath } from "node:url";

const VIRTUAL_ID = "virtual:test-error-capture/config";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

export function createErrorCapture() {
    const key = `__test_error_capture_${crypto.randomUUID()}__`;

    return {
        dispose() {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- cleaning up test state from globalThis
            delete (globalThis as Record<string, unknown>)[key];
        },

        integration(): AstroIntegration {
            return {
                hooks: {
                    "astro:config:setup": (params) => {
                        params.updateConfig({
                            vite: {
                                plugins: [
                                    {
                                        name: "test:error-capture:config",
                                        resolveId(id: string) {
                                            if (id === VIRTUAL_ID) {
                                                return RESOLVED_ID;
                                            }
                                        },
                                        // eslint-disable-next-line perfectionist/sort-objects -- align with order seen in vite/rollup docs
                                        load(id: string) {
                                            if (id !== RESOLVED_ID) return;
                                            return `export const key = ${JSON.stringify(key)};`;
                                        }
                                    }
                                ]
                            }
                        });

                        params.addMiddleware({
                            entrypoint: Path.resolve(
                                Path.dirname(fileURLToPath(import.meta.url)),
                                "./middleware.ts"
                            ),
                            order: "pre"
                        });
                    }
                },
                name: "test:error-capture"
            };
        },

        lastError() {
            const errors =
                ((globalThis as Record<string, unknown>)[key] as
                    Error[] | undefined) ?? [];
            return errors.at(-1);
        }
    };
}

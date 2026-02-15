import {
    addVirtualImports,
    createResolver,
    defineIntegration
} from "astro-integration-kit";

const { resolve } = createResolver(import.meta.url);

export function createErrorCapture() {
    const key = `__test_error_capture_${crypto.randomUUID()}__`;

    return {
        dispose() {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- cleaning up test state from globalThis
            delete (globalThis as Record<string, unknown>)[key];
        },

        integration() {
            return defineIntegration({
                name: "test:error-capture",
                setup: ({ name }) => {
                    return {
                        hooks: {
                            "astro:config:setup": (params) => {
                                addVirtualImports(params, {
                                    imports: {
                                        "virtual:test-error-capture/config": `export const key = ${JSON.stringify(key)};`
                                    },
                                    name
                                });

                                params.addMiddleware({
                                    entrypoint: resolve("./middleware.ts"),
                                    order: "pre"
                                });
                            }
                        }
                    };
                }
            })();
        },

        lastError() {
            const errors =
                ((globalThis as Record<string, unknown>)[key] as
                    | Error[]
                    | undefined) ?? [];
            return errors.at(-1);
        }
    };
}

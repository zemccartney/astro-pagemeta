import type { APIContext } from "astro";
import type { ViteDevServer } from "vite";

import {
    addVitePlugin,
    createResolver,
    defineIntegration
} from "astro-integration-kit";
import { z } from "astro/zod";

import type { MetadataOptions } from "./types.ts";

const optionsSchema = z
    .object({
        addRequiredGlobalMeta: z.boolean().optional().default(false),
        defaults: z
            .union([
                z.custom<(ctx: APIContext) => MetadataOptions>(
                    (val) => typeof val === "function"
                ),
                z.custom<MetadataOptions>(
                    (val) =>
                        typeof val === "object" &&
                        val !== null &&
                        typeof val !== "function"
                )
            ])
            .optional(),
        includeExternalPages: z.boolean().optional().default(false),
        mode: z.enum(["auto", "manual"]).optional().default("auto")
    })
    .optional()
    .default({});

const VIRTUAL_CONFIG_ID = "virtual:pagemeta/config";
const RESOLVED_CONFIG_ID = "\0" + VIRTUAL_CONFIG_ID;

function createConfigPlugin({
    addRequiredGlobalMeta,
    defaults
}: Pick<z.infer<typeof optionsSchema>, "addRequiredGlobalMeta" | "defaults">) {
    let routePatterns: RegExp[] = [];
    let compressHTML = false;

    return {
        plugin: {
            name: "pagemeta:config",
            resolveId(id: string) {
                if (id === VIRTUAL_CONFIG_ID) {
                    return RESOLVED_CONFIG_ID;
                }
            },
            // eslint-disable-next-line perfectionist/sort-objects -- align with order seen in vite/rollup docs
            load(id: string) {
                if (id !== RESOLVED_CONFIG_ID) return;

                const patternsCode = routePatterns
                    .map(
                        (r) =>
                            `new RegExp(${JSON.stringify(r.source)}, ${JSON.stringify(r.flags)})`
                    )
                    .join(", ");

                let defaultsCode: string;
                if (typeof defaults === "function") {
                    defaultsCode = defaults.toString();
                } else if (defaults === undefined) {
                    defaultsCode = "undefined";
                } else {
                    defaultsCode = JSON.stringify(defaults);
                }

                return `
                    export const routePatterns = [${patternsCode}];
                    export const defaults = ${defaultsCode};
                    export const compressHTML = ${compressHTML};
                    export const addRequiredGlobalMeta = ${addRequiredGlobalMeta};
                `;
            }
        },
        setCompressHTML(compress: boolean) {
            compressHTML = compress;
        },
        setRoutePatterns(patterns: RegExp[]) {
            routePatterns = patterns;
        }
    };
}

/**
 * Astro integration that automatically injects page metadata (`<title>`,
 * `<meta>`, Open Graph tags, JSON-LD) into rendered HTML. Pages set their
 * metadata via `metadata()` in frontmatter; the integration handles
 * the rest via post-render middleware.
 * @param options - Integration configuration
 * @param options.defaults - Default metadata applied to all pages. Can be
 *   an object or a function receiving `APIContext` for per-request defaults.
 *   Functions are serialized via `toString()` — closures are not supported.
 * @param options.addRequiredGlobalMeta - When `true`, injects
 *   `<meta charset="utf-8">` and `<meta name="viewport" content="width=device-width">`
 *   if not already present.
 * @param options.mode - `"auto"` (default) registers middleware automatically.
 *   `"manual"` requires you to add the middleware yourself via the `middleware()`
 *   export from `@grepco/astro-pagemeta/runtime`.
 * @param options.includeExternalPages - When `true`, also processes pages
 *   injected by other integrations (not just project pages).
 * @example
 * ```ts
 * // astro.config.ts
 * import pagemeta from "@grepco/astro-pagemeta";
 *
 * export default defineConfig({
 *   integrations: [pagemeta({ defaults: { title: "My Site" } })],
 * });
 * ```
 */
export default defineIntegration({
    name: "@grepco/astro-pagemeta",
    optionsSchema,
    setup: ({ options }) => {
        const { resolve } = createResolver(import.meta.url);
        const configPlugin = createConfigPlugin({
            addRequiredGlobalMeta: options.addRequiredGlobalMeta,
            defaults: options.defaults
        });

        // Captured in astro:server:setup so astro:routes:resolved can
        // invalidate the virtual config module during dev. On the first
        // astro:routes:resolved call (before the server exists) the module
        // hasn't been loaded yet, so invalidation is unnecessary.
        let viteServer: undefined | ViteDevServer;
        let isRestart = false;

        return {
            hooks: {
                "astro:config:setup": (params) => {
                    addVitePlugin(params, {
                        plugin: configPlugin.plugin
                    });

                    if (options.mode !== "manual") {
                        params.addMiddleware({
                            entrypoint: resolve("./middleware.ts"),
                            order: "post"
                        });
                    }

                    isRestart = params.isRestart;
                },
                "astro:routes:resolved": ({ routes }) => {
                    configPlugin.setRoutePatterns(
                        routes
                            .filter(
                                (r) =>
                                    r.type === "page" &&
                                    (r.origin === "project" ||
                                        (options.includeExternalPages &&
                                            r.origin === "external"))
                            )
                            .map((r) => r.patternRegex)
                    );

                    /**
                     * Invalidate the virtual module so consumers see updated
                     * route patterns. Astro re-fires this hook on page file
                     * add/remove in dev, so this keeps the config in sync
                     * without a full server restart.
                     *
                     * Tied to restart b/c otherwise was causing test flakiness,
                     * with the first test against a certain fixture, across apparently
                     * random files, failing due to metadata failing to set, I assume
                     * due to our virtual module losing state / invalidating just as
                     * our test was triggering its usage. I guess? Unclear
                     */
                    if (viteServer && isRestart) {
                        const mod =
                            viteServer.moduleGraph.getModuleById(
                                RESOLVED_CONFIG_ID
                            );
                        if (mod) {
                            viteServer.moduleGraph.invalidateModule(mod);
                        }
                    }
                },
                // eslint-disable-next-line perfectionist/sort-objects -- align with hooks execution order
                "astro:config:done": ({ config }) => {
                    configPlugin.setCompressHTML(config.compressHTML);
                },
                "astro:server:setup": ({ server }) => {
                    viteServer = server;
                }
            }
        };
    }
});

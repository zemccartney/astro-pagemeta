import type { AstroIntegration } from "astro";
import type { ViteDevServer } from "vite";

import Path from "node:path";
import { fileURLToPath } from "node:url";

import type { IntegrationOptions } from "./types.ts";

type ValidatedOptions = Required<
    Pick<
        IntegrationOptions,
        "addRequiredGlobalMeta" | "includeExternalPages" | "mode"
    >
> & {
    // Present but possibly undefined (vs. optional) to satisfy
    // exactOptionalPropertyTypes at the validation boundary
    defaults: IntegrationOptions["defaults"] | undefined;
};

/**
 * Validate user-provided integration options, applying defaults.
 * Replaces the zod schema previously supplied via astro-integration-kit's
 * `optionsSchema` — checks the same shapes and applies the same defaults.
 * @param input - Raw options as passed by the user (possibly absent)
 * @returns Options with defaults applied
 * @throws {Error} With a `[pagemeta]`-prefixed message when an option has
 *   the wrong type
 */
function validateOptions(input: IntegrationOptions = {}): ValidatedOptions {
    if (
        typeof input !== "object" ||
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- handling type-indifferent runtime possibility
        input === null
    ) {
        throw new Error(
            `[pagemeta] options must be an object, got ${typeof input}`
        );
    }

    const {
        addRequiredGlobalMeta = false,
        defaults,
        includeExternalPages = false,
        mode = "auto"
    } = input;

    if (typeof addRequiredGlobalMeta !== "boolean") {
        throw new TypeError(
            `[pagemeta] addRequiredGlobalMeta must be a boolean, got ${typeof addRequiredGlobalMeta}`
        );
    }

    if (
        defaults !== undefined &&
        typeof defaults !== "function" &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- handling type-indifferent runtime possibility
        (typeof defaults !== "object" || defaults === null)
    ) {
        throw new Error(
            `[pagemeta] defaults must be an object or a function, got ${typeof defaults}`
        );
    }

    if (typeof includeExternalPages !== "boolean") {
        throw new TypeError(
            `[pagemeta] includeExternalPages must be a boolean, got ${typeof includeExternalPages}`
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- handling type-indifferent runtime possibility
    if (mode !== "auto" && mode !== "manual") {
        throw new Error(
            `[pagemeta] mode must be "auto" or "manual", got ${JSON.stringify(mode)}`
        );
    }

    return { addRequiredGlobalMeta, defaults, includeExternalPages, mode };
}

const VIRTUAL_CONFIG_ID = "virtual:pagemeta/config";
const RESOLVED_CONFIG_ID = "\0" + VIRTUAL_CONFIG_ID;

/**
 * Resolve a sibling module path relative to this file, whether running from
 * src (tests import TS directly) or dist (published build). Mirrors
 * astro-integration-kit's `createResolver`, which this replaced.
 * @param relativePath - Path relative to this module's directory
 * @returns Absolute filesystem path
 */
const resolve = (relativePath: string): string =>
    Path.resolve(Path.dirname(fileURLToPath(import.meta.url)), relativePath);

function createConfigPlugin({
    addRequiredGlobalMeta,
    defaults
}: Pick<ValidatedOptions, "addRequiredGlobalMeta" | "defaults">) {
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
 * @returns The configured Astro integration
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
const pagemeta = (options?: IntegrationOptions): AstroIntegration => {
    const validated = validateOptions(options);

    const configPlugin = createConfigPlugin({
        addRequiredGlobalMeta: validated.addRequiredGlobalMeta,
        defaults: validated.defaults
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
                params.updateConfig({
                    vite: { plugins: [configPlugin.plugin] }
                });

                if (validated.mode !== "manual") {
                    params.addMiddleware({
                        entrypoint: resolve("./middleware.js"),
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
                                    (validated.includeExternalPages &&
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
                // Astro 6.2+ allows "jsx" alongside booleans; any truthy
                // value means Astro is compressing, so we minify too
                configPlugin.setCompressHTML(Boolean(config.compressHTML));
            },
            "astro:server:setup": ({ server }) => {
                viteServer = server;
            }
        },
        name: "@grepco/astro-pagemeta"
    };
};

export default pagemeta;

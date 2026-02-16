import type { APIContext } from "astro";
import type { Options } from "rehype-meta";

import {
    addVitePlugin,
    createResolver,
    defineIntegration
} from "astro-integration-kit";
import { z } from "astro/zod";

const optionsSchema = z
    .object({
        defaults: z
            .union([
                z.custom<(ctx: APIContext) => Options>(
                    (val) => typeof val === "function"
                ),
                z.custom<Options>(
                    (val) =>
                        typeof val === "object" &&
                        val !== null &&
                        typeof val !== "function"
                )
            ])
            .optional()
    })
    .optional()
    .default({});

const VIRTUAL_CONFIG_ID = "virtual:pagemeta/config";
const RESOLVED_CONFIG_ID = "\0" + VIRTUAL_CONFIG_ID;

function createConfigPlugin(
    defaults: ((ctx: APIContext) => Options) | Options | undefined
) {
    let routePatterns: RegExp[] = [];

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

                return `export const routePatterns = [${patternsCode}];\nexport const defaults = ${defaultsCode};\n`;
            }
        },
        setRoutePatterns(patterns: RegExp[]) {
            routePatterns = patterns;
        }
    };
}

export default defineIntegration({
    name: "@grepco/astro-pagemeta",
    optionsSchema,
    setup: ({ options }) => {
        const { resolve } = createResolver(import.meta.url);
        const configPlugin = createConfigPlugin(options.defaults);

        return {
            hooks: {
                "astro:config:setup": (params) => {
                    addVitePlugin(params, {
                        plugin: configPlugin.plugin
                    });

                    params.addMiddleware({
                        entrypoint: resolve("./middleware.ts"),
                        order: "post"
                    });
                },
                "astro:routes:resolved": ({ routes }) => {
                    configPlugin.setRoutePatterns(
                        routes
                            .filter(
                                (r) =>
                                    r.origin === "project" && r.type === "page"
                            )
                            .map((r) => r.patternRegex)
                    );
                }
            }
        };
    }
});

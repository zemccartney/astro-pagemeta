import type { APIContext } from "astro";

import {
    addVitePlugin,
    createResolver,
    defineIntegration
} from "astro-integration-kit";
import { z } from "astro/zod";

import type { PagemetaOptions } from "./types.ts";

const _optionsSchema = z
    .object({
        defaults: z
            .union([
                z.custom<(ctx: APIContext) => PagemetaOptions>(
                    (val) => typeof val === "function"
                ),
                z.custom<PagemetaOptions>(
                    (val) =>
                        typeof val === "object" &&
                        val !== null &&
                        typeof val !== "function"
                )
            ])
            .optional(),
        includeExternal: z.boolean().optional().default(false),
        manual: z.boolean().optional().default(false),
        mode: z.enum(["auto", "streaming"]).optional().default("auto")
    })
    .refine((opts) => !(opts.mode === "streaming" && opts.manual), {
        message: "`manual` is only valid when mode is 'auto'",
        path: ["manual"]
    })
    .refine((opts) => !(opts.mode === "streaming" && opts.includeExternal), {
        message:
            "`includeExternal` is only valid when mode is 'auto' (it controls middleware route filtering; streaming mode has no middleware)",
        path: ["includeExternal"]
    })
    .optional()
    .default({});

type OptionsInput =
    | {
          defaults?: ((ctx: APIContext) => PagemetaOptions) | PagemetaOptions;
          includeExternal?: boolean;
          manual?: boolean;
          mode?: "auto";
      }
    | {
          defaults?: ((ctx: APIContext) => PagemetaOptions) | PagemetaOptions;
          mode: "streaming";
      };

// Accounts for how refine doesn't surface invalid input as typescript errors, only runtime
const optionsSchema = _optionsSchema as z.ZodType<
    z.output<typeof _optionsSchema>,
    z.ZodTypeDef,
    OptionsInput | undefined
>;

const VIRTUAL_CONFIG_ID = "virtual:pagemeta/config";
const RESOLVED_CONFIG_ID = "\0" + VIRTUAL_CONFIG_ID;

function createConfigPlugin(
    defaults:
        | ((ctx: APIContext) => PagemetaOptions)
        | PagemetaOptions
        | undefined
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

                    if (options.mode !== "streaming" && !options.manual) {
                        params.addMiddleware({
                            entrypoint: resolve("./middleware.ts"),
                            order: "post"
                        });
                    }
                },
                "astro:routes:resolved": ({ routes }) => {
                    configPlugin.setRoutePatterns(
                        routes
                            .filter(
                                (r) =>
                                    r.type === "page" &&
                                    (r.origin === "project" ||
                                        (options.includeExternal &&
                                            r.origin === "external"))
                            )
                            .map((r) => r.patternRegex)
                    );
                }
            }
        };
    }
});

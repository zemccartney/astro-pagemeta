import {
    addVirtualImports,
    createResolver,
    defineIntegration,
    injectDevRoute
} from "astro-integration-kit";
import * as Fs from "node:fs/promises";

import generateOgImages from "./image-gen";

// TODO Add option to set defaults (can still override per page)
// TODO Does Symbol work in virtual module? need to use UUID?
// TODO How do we type addPageMeta? follow same typing as rehype meta options
// TODO Add option, transform, to handle global cases e.g. add separator on subpages
// TODO Somehow require site on astro config?
// TODO Eventually write your own rehype plugin, apply own opinions, really
// don't like rehype-meta api, too many side-effects
// TODO expose transformation as global option
// TODO typing (have an option for lax mode i.e. where no requirements enforced, opinions ignored); users pass own schema, set via injectTypes?
// TODO Possible to lint if addPageMeta not called?
// TODO drawback to export approach, no typing; export type, set on meta / use satisfies?
// TODO in page template, how to tell people need to size canvas by image dimensions, place in top-left? or make screenshotting range configurable?
// TODO test aspect ratio handling, would need to support configuring
// TODO Export middleware functions, allow disabling, importing directly w/in user's own middleware file, for clarity of execution order
// TODO note, expected warning re: mismatched rendering modes? No, would need to provide a page aligned with user's target, to support keeping route into prod

export default defineIntegration({
    name: "@page-meta",
    setup: ({ name }) => {
        const { resolve } = createResolver(import.meta.url);

        // Using Symbol.for ensures this is a singleton across all modules in the build process.
        const OG_META_STORE_KEY = Symbol.for("astro-page-meta-store");
        /* @ts-expect-error -- fix later */
        globalThis[OG_META_STORE_KEY] = new Map();

        const state = {};

        return {
            hooks: {
                "astro:routes:resolved": ({ routes }) => {
                    const a = routes.map(({ pattern, segments }) => ({
                        pattern,
                        segments
                    }));
                    console.log(a);
                    console.log(a.map(({ segments }) => segments.flat()));
                    // TODO stash route tree
                    // TODO expose as types? expose routing utils for matching logic w/in components? Or already available
                    // on render context? set typesafe links, type anchor elements, enforce route type on other links, allow matching
                    // stash for latter, for using patternRegex to determine how to consolidate images by path
                },
                // eslint-disable-next-line perfectionist/sort-objects
                "astro:config:setup": async (params) => {
                    // if build, interpolate resolved og-image path ... no, because can't know ahead of time? unless can use the same transform given a route pattern for
                    // url setting and generation

                    addVirtualImports(params, {
                        imports: [
                            {
                                // TODO Use some sort of parser to allow writing this in a ts file, inject data as needed (magic-string? recast? ast-grep?)
                                // TODO setting routePattern here is incorrect, using route pathname everywhere else
                                // TODO Pass routePattern, too, extra context helpful?
                                // TODO Unless some other need for passing build data here, convert to script
                                // site is accessible from the API context
                                content: `
                                        export const localsKey = Symbol("page-meta::add");

                                        export const addPageMeta = (ctx, data) => {
                                            ctx.locals[localsKey] = {
                                                ...data
                                            };
                                        };

                                        const buildHash = new Map();

                                        export const resolveMeta = (ctx) => {
                                            const meta = ctx.locals[localsKey] ?? {};
                                        
                                            const base = {
                                                image: {
                                                    height: 630,
                                                    url: "/og?route=" + encodeURIComponent(ctx.routePattern),
                                                    width: 1200
                                                },
                                                og: true,
                                                origin: '${params.config.site || ""}',
                                                type: "website"
                                            };
                                        
                                            if (ctx.routePattern !== "/") {
                                                base.name = "GrepCo"; // TODO exclude site name and type from addPageMeta interface
                                                base.separator = " | ";
                                                base.ogNameInTitle = false;
                                                base.pathname = ctx.url.pathname;
                                            }
                                        
                                            return {
                                                ...base,
                                                ...meta,
                                                image: {
                                                    ...base.image,
                                                    ...meta.image
                                                }
                                            };
                                        };
                                    `,
                                context: "server",
                                id: `${name}/add`
                            }
                        ],
                        name
                    });

                    params.addMiddleware({
                        entrypoint: resolve("./middleware"),
                        order: "post"
                    });

                    injectDevRoute(params, {
                        entrypoint: resolve("./og.astro"),
                        pattern: "/og",
                        prerender: false
                    });

                    if (params.command === "dev") {
                        // TODO rename to preview
                        params.injectScript(
                            "page",
                            await Fs.readFile(resolve("./script.ts"), {
                                encoding: "utf8"
                            })
                        );
                    }
                },
                // eslint-disable-next-line perfectionist/sort-objects -- align with hook call order
                "astro:config:done": async (params) => {
                    params.injectTypes({
                        content: await Fs.readFile(resolve("./virtual.d.ts"), {
                            encoding: "utf8"
                        }),
                        filename: "page-meta.d.ts"
                    });

                    console.log(params.config.image, "IMAGES");

                    /* @ts-expect-error -- fix later */
                    state.imgConfig = params.config.image.service.entrypoint;
                },
                // eslint-disable-next-line perfectionist/sort-objects
                "astro:build:done": async () => {
                    await generateOgImages(
                        /* @ts-expect-error -- fix later */
                        globalThis[OG_META_STORE_KEY] as Parameters<
                            typeof generateOgImages
                        >[0],
                        // @ts-expect-error -- TODO fix later
                        state.imgConfig
                    );
                }
            }
        };
    }
});

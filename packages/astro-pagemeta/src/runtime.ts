import type { MiddlewareHandler } from "astro";

import { defineMiddleware } from "astro/middleware";
import {
    addRequiredGlobalMeta,
    compressHTML,
    defaults,
    routePatterns
} from "virtual:pagemeta/config";

import type { MetadataProcessor } from "./types.ts";

import { createMetadataProcessor, isHtmlDocument } from "./core.ts";

export { metadata } from "./core.ts";

const processor: MetadataProcessor = createMetadataProcessor({
    addRequiredGlobalMeta,
    compressHTML,
    defaults,
    routePatterns
});

export default processor;

/**
 * Create the pagemeta middleware. Only needed when using `mode: "manual"` —
 * in the default `"auto"` mode, the integration registers middleware itself.
 * @returns An Astro middleware that intercepts page responses and injects
 *   metadata tags into the HTML `<head>`.
 * @example
 * ```ts
 * // src/middleware.ts
 * import { middleware as pagemeta } from "@grepco/astro-pagemeta/runtime";
 * import { sequence } from "astro:middleware";
 *
 * export const onRequest = sequence(myMiddleware, pagemeta());
 * ```
 */
export const middleware = (): MiddlewareHandler => {
    return defineMiddleware(async (ctx, next) => {
        const response = await next();

        if (!processor.isPageRoute(ctx.url.pathname)) {
            return response;
        }

        const resolved = processor.resolveMetadata(ctx);

        if (!resolved) {
            return response;
        }

        const html = await response.text();

        /**
         * Skip partial pages — they render as HTML fragments without a doctype.
         * rehype parses in document mode by default and would wrap the fragment
         * in a full document structure (html/head/body), corrupting the output.
         *
         * This relies on an internal Astro behavior: Per Claude, "the compiler strips
         * <!doctype> from all .astro templates during compilation, and the
         * renderer only re-injects it for non-partial renders (gated on an
         * internal `partial` flag set by server islands and pages that export
         * `partial = true`). Because this is not a documented public API, we
         * should expect it could change without notice in a future Astro
         * release."
         *
         * unsure this explanation is 100% accurate, but at least
         * lines up with observable behavior
         */
        if (!isHtmlDocument(html)) {
            return new Response(html, {
                headers: response.headers,
                status: response.status
            });
        }

        const htmlProcessor = processor.getHtmlProcessor({
            metadata: resolved
        });
        const processed = await htmlProcessor.process(html);

        return new Response(String(processed), {
            headers: response.headers,
            status: response.status
        });
    });
};

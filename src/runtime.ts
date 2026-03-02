import { defineMiddleware } from "astro/middleware";
import {
    addRequiredGlobalMeta,
    compressHTML,
    defaults,
    routePatterns
} from "virtual:pagemeta/config";

import { createPagemetaProcessor, isHtmlDocument } from "./core.ts";

export { setPagemeta } from "./core.ts";

const processor = createPagemetaProcessor({
    addRequiredGlobalMeta,
    compressHTML,
    defaults,
    routePatterns
});

export default processor;

export const middleware = () => {
    return defineMiddleware(async (ctx, next) => {
        const response = await next();

        if (!processor.isPageRoute(ctx.url.pathname)) {
            return response;
        }

        const metadata = processor.resolvePagemeta(ctx);

        if (!metadata) {
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
         * */
        if (!isHtmlDocument(html)) {
            return new Response(html, {
                headers: response.headers,
                status: response.status
            });
        }

        const htmlProcessor = processor.getHtmlProcessor({ metadata });
        const processed = await htmlProcessor.process(html);

        return new Response(String(processed), {
            headers: response.headers,
            status: response.status
        });
    });
};

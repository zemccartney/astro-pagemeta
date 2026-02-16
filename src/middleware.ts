import { isPageRoute, resolvePagemeta } from "@grepco/astro-pagemeta/runtime";
import { defineMiddleware } from "astro/middleware";
import { rehype } from "rehype";
import rehypeMeta from "rehype-meta";

const isHtmlDocument = (html: string) => /^<!doctype\s/i.test(html.trimStart());

export const onRequest = defineMiddleware(async (context, next) => {
    const response = await next();

    // Skip non-page routes (server islands, API routes, etc.)
    if (!isPageRoute(context.url.pathname)) {
        return response;
    }

    const metadata = resolvePagemeta(context);

    if (!metadata) {
        return response;
    }

    const html = await response.text();

    // Skip partial pages — they render as HTML fragments without a doctype.
    // rehype parses in document mode by default and would wrap the fragment
    // in a full document structure (html/head/body), corrupting the output.
    // Handled separately (from isPageRoute) b/c as far as I can tell they are
    // indistinguishable from pages that output complete documents
    // in the metadata exposed in the routes:resolved integration hook (specifically,
    // type "page", per https://docs.astro.build/en/reference/integrations-reference/#routetype)
    if (!isHtmlDocument(html)) {
        return new Response(html, {
            headers: response.headers,
            status: response.status
        });
    }

    const processed = await rehype().use(rehypeMeta, metadata).process(html);

    return new Response(String(processed), {
        headers: response.headers,
        status: response.status
    });
});

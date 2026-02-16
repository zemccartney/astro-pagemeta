import type { APIContext } from "astro";
import type { Root } from "hast";

import { defineMiddleware } from "astro/middleware";
import { select } from "hast-util-select";
import { defaults, routePatterns } from "virtual:pagemeta/config";

import type { LdJson, PagemetaOptions } from "./types.ts";

const LOCALS_KEY = Symbol("pagemeta");

export const isPageRoute = (pathname: string): boolean => {
    return routePatterns.some((r) => r.test(pathname));
};

export const resolvePagemeta = (
    ctx: Readonly<APIContext>
): PagemetaOptions | undefined => {
    // @ts-expect-error -- index type error, not worrying about it given we're coordinating with our own symbol
    const pageMeta = ctx.locals[LOCALS_KEY] as
        | false // hard opt-out i.e. skip any defaults, don't set any meta tags
        | PagemetaOptions
        | undefined;

    if (pageMeta === false) {
        return;
    }

    let computedDefaults: PagemetaOptions;
    if (typeof defaults === "function") {
        const result = defaults(ctx);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- handling type-indifferent runtime possibility
        if (typeof result !== "object" || result === null) {
            throw new Error(
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- handling type-indifferent runtime possibility
                `[pagemeta] defaults function must return an object, got ${result === null ? "null" : typeof result}`
            );
        }
        computedDefaults = result;
    } else {
        computedDefaults = defaults ?? {};
    }

    if (!pageMeta && Object.keys(computedDefaults).length === 0) {
        return;
    }

    return { ...computedDefaults, ...pageMeta };
};

export const setPagemeta = (
    ctx: Readonly<APIContext>,
    data: false | Readonly<PagemetaOptions>
): void => {
    if (data === false) {
        // @ts-expect-error -- index type error, not worrying about it given we're coordinating with our own symbol
        ctx.locals[LOCALS_KEY] = false; // hard opt-out i.e. skip any defaults, don't set any meta tags
        return;
    }

    if (
        typeof data !== "object" ||
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- handling type-indifferent runtime possibility
        data === null
    ) {
        throw new Error(
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- handling type-indifferent runtime possibility
            `[pagemeta] setPagemeta data must be an object or false, got ${data === null ? "null" : typeof data}`
        );
    }

    // @ts-expect-error -- index type error, not worrying about it given we're coordinating with our own symbol
    const pageMeta = ctx.locals[LOCALS_KEY] as PagemetaOptions | undefined;

    // @ts-expect-error -- index type error, not worrying about it given we're coordinating with our own symbol
    ctx.locals[LOCALS_KEY] = {
        ...pageMeta,
        ...data
    };
};

function rehypeLdJson(ldJson: LdJson | LdJson[]) {
    const document =
        Array.isArray(ldJson) ?
            { "@context": "https://schema.org", "@graph": ldJson }
        :   { "@context": "https://schema.org", ...ldJson };

    return (tree: Root) => {
        const head = select("head", tree);
        if (!head) return;

        head.children.push({
            children: [{ type: "text", value: JSON.stringify(document) }],
            properties: { type: "application/ld+json" },
            tagName: "script",
            type: "element"
        });
    };
}

const isHtmlDocument = (html: string) => /^<!doctype\s/i.test(html.trimStart());

export const processPagemeta = async (
    ctx: Readonly<APIContext>,
    response: Response
): Promise<Response> => {
    if (!isPageRoute(ctx.url.pathname)) {
        return response;
    }

    const metadata = resolvePagemeta(ctx);

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

    const { rehype } = await import("rehype");
    const { default: rehypeMeta } = await import("rehype-meta");

    const { ldJson, ...rehypeMetaOptions } = metadata;
    let processor = rehype().use(rehypeMeta, rehypeMetaOptions);
    if (ldJson) {
        processor = processor.use(rehypeLdJson, ldJson);
    }
    const processed = await processor.process(html);

    return new Response(String(processed), {
        headers: response.headers,
        status: response.status
    });
};

export const middleware = () => {
    return defineMiddleware(async (context, next) => {
        const response = await next();
        return processPagemeta(context, response);
    });
};

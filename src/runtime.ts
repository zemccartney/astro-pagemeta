import type { APIContext } from "astro";
import type { Element, Root, Text } from "hast";

import { defineMiddleware } from "astro/middleware";
import { select } from "hast-util-select";
import { rehype } from "rehype";
import rehypeMeta from "rehype-meta";
import rehypeMinifyWhitespace from "rehype-minify-whitespace";
import {
    addRequiredGlobalMeta,
    compressHTML,
    defaults,
    routePatterns
} from "virtual:pagemeta/config";

import type { JsonLd, PagemetaOptions } from "./types.ts";

// Trailing newline after injected elements, matching rehype-meta's formatting
// convention of separating head children with line breaks for readability.
// Stripped by rehype-minify-whitespace when compressHTML is enabled.
const newline = (): Text => ({ type: "text", value: "\n" });

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

    const merged = { ...computedDefaults, ...pageMeta };
    if (computedDefaults.custom || pageMeta?.custom) {
        merged.custom = { ...computedDefaults.custom, ...pageMeta?.custom };
    }
    return merged;
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
        ...data,
        ...(pageMeta?.custom || data.custom ?
            { custom: { ...pageMeta?.custom, ...data.custom } }
        :   {})
    };
};

/**
 * Rehype plugin that extracts the children of the `<head>` element,
 * discarding the document wrapper. Used by the `<Pagemeta>` component
 * to produce inline head content from rehype-meta's document-mode output.
 */
export function rehypeHeadContentsOnly() {
    // eslint-disable-next-line unicorn/consistent-function-scoping -- prefer consistency with other plugins
    return (tree: Root) => {
        const head = select("head", tree);
        if (!head) return;
        return {
            children: head.children,
            type: "root"
        };
    };
}

// OGP-defined prefixes (https://ogp.me/) that use the `property` attribute
// on meta tags instead of `name`. Includes `fb:` which is widely used in
// practice though not in the OGP spec itself.
const OG_PREFIXES = [
    "og:",
    "article:",
    "book:",
    "music:",
    "profile:",
    "video:",
    "fb:",
    "payment:"
];

const isOgProperty = (key: string) =>
    OG_PREFIXES.some((prefix) => key.startsWith(prefix));

const CANONICAL_KEY = "link:rel:canonical";

function rehypeAddRequiredGlobalMeta() {
    // eslint-disable-next-line unicorn/consistent-function-scoping -- prefer consistency with other plugins
    return (tree: Root) => {
        const head = select("head", tree);
        if (!head) return;

        for (const key of ["charset", "viewport"] as const) {
            const existing = head.children.find(
                (node): node is Element =>
                    node.type === "element" &&
                    node.tagName === "meta" &&
                    (key === "charset" ?
                        // note camel-casing from rehype
                        "charSet" in node.properties
                    :   node.properties["name"] === key)
            );

            if (!existing) {
                switch (key) {
                    case "charset": {
                        head.children.push(
                            {
                                children: [],
                                properties: { charSet: "utf-8" },
                                tagName: "meta",
                                type: "element"
                            },
                            newline()
                        );
                        break;
                    }
                    case "viewport": {
                        head.children.push(
                            {
                                children: [],
                                properties: {
                                    name: key,
                                    // eslint-disable-next-line perfectionist/sort-objects -- prefer standard meta tag attribute ordering
                                    content: "width=device-width"
                                },
                                tagName: "meta",
                                type: "element"
                            },
                            newline()
                        );
                        break;
                    }
                }
            }
        }
    };
}

function rehypeCustomMeta(meta: Record<string, string>) {
    return (tree: Root) => {
        const head = select("head", tree);
        if (!head) return;

        for (const [key, value] of Object.entries(meta)) {
            if (key === "title") {
                const existing = head.children.find(
                    (node): node is Element =>
                        node.type === "element" && node.tagName === "title"
                );
                if (existing) {
                    existing.children = [{ type: "text", value }];
                } else {
                    head.children.push(
                        {
                            children: [{ type: "text", value }],
                            properties: {},
                            tagName: "title",
                            type: "element"
                        },
                        newline()
                    );
                }
                continue;
            }

            if (key === CANONICAL_KEY) {
                // rehype-parse normalizes `rel` to a space-separated token
                // array, so we check for array containment
                const existing = head.children.find((node): node is Element => {
                    if (node.type !== "element" || node.tagName !== "link")
                        return false;
                    const rel = node.properties["rel"];
                    return (
                        (Array.isArray(rel) && rel.includes("canonical")) ||
                        rel === "canonical"
                    );
                });
                if (existing) {
                    existing.properties["href"] = value;
                } else {
                    head.children.push(
                        {
                            children: [],
                            properties: { href: value, rel: ["canonical"] },
                            tagName: "link",
                            type: "element"
                        },
                        newline()
                    );
                }
                continue;
            }

            const attrKey = isOgProperty(key) ? "property" : "name";

            const existing = head.children.find(
                (node): node is Element =>
                    node.type === "element" &&
                    node.tagName === "meta" &&
                    node.properties[attrKey] === key
            );

            if (existing) {
                existing.properties["content"] = value;
            } else {
                head.children.push(
                    {
                        children: [],
                        properties: { [attrKey]: key, content: value },
                        tagName: "meta",
                        type: "element"
                    },
                    newline()
                );
            }
        }
    };
}

function rehypeJsonLd(jsonLd: JsonLd | JsonLd[]) {
    const document =
        Array.isArray(jsonLd) ?
            { "@context": "https://schema.org", "@graph": jsonLd }
        :   Object.assign({ "@context": "https://schema.org" }, jsonLd);

    return (tree: Root) => {
        const head = select("head", tree);
        if (!head) return;

        head.children.push(
            {
                children: [
                    {
                        type: "text",
                        value:
                            compressHTML ?
                                JSON.stringify(document)
                            :   JSON.stringify(document, undefined, 2)
                    }
                ],
                properties: { type: "application/ld+json" },
                tagName: "script",
                type: "element"
            },
            newline()
        );
    };
}

const isHtmlDocument = (html: string) => /^<!doctype\s/i.test(html.trimStart());

export const _getHtmlProcessor = ({
    fragment = false,
    metadata
}: {
    fragment?: boolean;
    metadata: PagemetaOptions;
}) => {
    const { custom, jsonLd, ...rehypeMetaOptions } = metadata;
    const processor = rehype().use(rehypeMeta, rehypeMetaOptions);
    if (jsonLd) {
        processor.use(rehypeJsonLd, jsonLd);
    }
    if (addRequiredGlobalMeta) {
        processor.use(rehypeAddRequiredGlobalMeta);
    }
    if (custom && Object.keys(custom).length > 0) {
        processor.use(rehypeCustomMeta, custom);
    }
    if (fragment) {
        processor.use(rehypeHeadContentsOnly);
    }
    if (compressHTML) {
        processor.use(rehypeMinifyWhitespace);
    }
    return processor;
};

export const middleware = () => {
    return defineMiddleware(async (ctx, next) => {
        const response = await next();

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

        const processor = _getHtmlProcessor({ metadata });
        const processed = await processor.process(html);

        return new Response(String(processed), {
            headers: response.headers,
            status: response.status
        });
    });
};

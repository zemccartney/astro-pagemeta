import type { APIContext } from "astro";
import type { Element, Root, Text } from "hast";

import { select } from "hast-util-select";
import { rehype } from "rehype";
import rehypeMeta from "rehype-meta";
import rehypeMinifyWhitespace from "rehype-minify-whitespace";

import type {
    MetadataOptions,
    MetadataProcessor,
    MetadataProcessorConfig
} from "./types.ts";

// Trailing newline after injected elements, matching rehype-meta's formatting
// convention of separating head children with line breaks for readability.
// Stripped by rehype-minify-whitespace when compressHTML is enabled.
const newline = (): Text => ({ type: "text", value: "\n" });

const LOCALS_KEY = Symbol("pagemeta");

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

const CHARSET_KEY = "meta:charSet";

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

            if (key === CHARSET_KEY) {
                // rehype-parse normalizes `charset` to camelCase `charSet`
                const existing = head.children.find(
                    (node): node is Element =>
                        node.type === "element" &&
                        node.tagName === "meta" &&
                        "charSet" in node.properties
                );
                if (existing) {
                    existing.properties["charSet"] = value;
                } else {
                    head.children.push(
                        {
                            children: [],
                            properties: { charSet: value },
                            tagName: "meta",
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

/**
 * Rehype plugin that extracts the children of the `<head>` element,
 * discarding the document wrapper. Used by the `<Head>` component
 * to produce inline head content from rehype-meta's document-mode output.
 * @returns A rehype transform that replaces the tree with `<head>` children.
 */
function rehypeHeadContentsOnly() {
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

/**
 * Used to workaround a performance cliff from importing type { Thing } from "schema-dts"
 * Or rather, tanked VSCode's on save actions, few second lag between hitting save and the
 * actions running and file actually being saved
 *
 * Unclear if those types impact end users at all; prelim tests suggest no, but will need to revisit
 */
// eslint-disable-next-line perfectionist/sort-modules -- collocate with main user of type
type FakeSchema = Record<string, unknown> | Record<string, unknown>[];

function rehypeJsonLd({
    compressHTML,
    jsonLd
}: {
    compressHTML: boolean;
    jsonLd: FakeSchema;
}) {
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

export const isHtmlDocument = (html: string): boolean =>
    /^<!doctype\s/i.test(html.trimStart());

/**
 * Set page metadata for the current request. Call this in your page's
 * frontmatter or in user middleware (before `next()`). Multiple calls
 * are merged, with later calls taking precedence. `custom` entries are
 * shallow-merged rather than replaced.
 *
 * Pass `false` to opt out of all metadata processing for this request
 * (no defaults applied, no tags injected).
 * @param ctx - Astro's request context (`Astro` in page frontmatter,
 *   or the middleware context object)
 * @param data - Metadata options to set, or `false` to skip processing
 * @example
 * ```astro
 * ---
 * import { metadata } from "@grepco/astro-pagemeta/runtime";
 * metadata(Astro, { title: "My Page", description: "A description" });
 * ---
 * ```
 */
export const metadata = (
    ctx: Readonly<APIContext>,
    data: false | Readonly<MetadataOptions>
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
            `[pagemeta] metadata data must be an object or false, got ${data === null ? "null" : typeof data}`
        );
    }

    // @ts-expect-error -- index type error, not worrying about it given we're coordinating with our own symbol
    const pageMeta = ctx.locals[LOCALS_KEY] as MetadataOptions | undefined;

    // @ts-expect-error -- index type error, not worrying about it given we're coordinating with our own symbol
    ctx.locals[LOCALS_KEY] = {
        ...pageMeta,
        ...data,
        ...(pageMeta?.custom || data.custom ?
            { custom: { ...pageMeta?.custom, ...data.custom } }
        :   {})
    };
};

export function createMetadataProcessor(
    config: MetadataProcessorConfig
): MetadataProcessor {
    return {
        getHtmlProcessor: ({
            fragment = false,
            metadata
        }: {
            fragment?: boolean;
            metadata: MetadataOptions;
        }) => {
            const { custom, jsonLd, ...rehypeMetaOptions } = metadata;
            const processor = rehype().use(rehypeMeta, rehypeMetaOptions);
            if (jsonLd) {
                processor.use(rehypeJsonLd, {
                    compressHTML: config.compressHTML,
                    jsonLd: jsonLd as unknown as FakeSchema
                });
            }
            if (custom && Object.keys(custom).length > 0) {
                processor.use(rehypeCustomMeta, custom);
            }
            if (fragment) {
                processor.use(rehypeHeadContentsOnly);
            }
            if (config.compressHTML) {
                processor.use(rehypeMinifyWhitespace);
            }
            return processor;
        },

        isPageRoute: (pathname: string): boolean => {
            return config.routePatterns.some((r) => r.test(pathname));
        },

        resolveMetadata: (
            ctx: Readonly<APIContext>
        ): MetadataOptions | undefined => {
            // @ts-expect-error -- index type error, not worrying about it given we're coordinating with our own symbol
            const pageMeta = ctx.locals[LOCALS_KEY] as
                | false // hard opt-out i.e. skip any defaults, don't set any meta tags
                | MetadataOptions
                | undefined;

            if (pageMeta === false) {
                return;
            }

            let computedDefaults: MetadataOptions;
            if (typeof config.defaults === "function") {
                const result = config.defaults(ctx);
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- handling type-indifferent runtime possibility
                if (typeof result !== "object" || result === null) {
                    throw new Error(
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- handling type-indifferent runtime possibility
                        `[pagemeta] defaults function must return an object, got ${result === null ? "null" : typeof result}`
                    );
                }
                computedDefaults = result;
            } else {
                computedDefaults = config.defaults ?? {};
            }

            const requiredGlobalMeta =
                config.addRequiredGlobalMeta ?
                    {
                        [CHARSET_KEY]: "utf-8",
                        viewport: "width=device-width"
                    }
                :   undefined;

            if (
                !pageMeta &&
                Object.keys(computedDefaults).length === 0 &&
                !requiredGlobalMeta
            ) {
                return;
            }

            const merged = { ...computedDefaults, ...pageMeta };
            if (
                requiredGlobalMeta ||
                computedDefaults.custom ||
                pageMeta?.custom
            ) {
                merged.custom = {
                    ...requiredGlobalMeta,
                    ...computedDefaults.custom,
                    ...pageMeta?.custom
                };
            }
            return merged;
        }
    };
}

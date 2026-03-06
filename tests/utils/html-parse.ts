import type { Element } from "hast";

import { select, selectAll } from "hast-util-select";
import rehypeParse from "rehype-parse";
import { unified } from "unified";

export const parseHtml = (html: string) =>
    unified().use(rehypeParse).parse(html);

/**
 * Select elements matching a CSS selector from parsed HTML and normalize
 * to a `{ tag, properties }` shape. Titles get `{ text }` as their
 * properties; everything else gets the raw hast properties object.
 */
export const query = (html: string, selector: string) => {
    const tree = parseHtml(html);

    return selectAll(selector, tree).map((el) => {
        if (el.tagName === "title") {
            const textNode = el.children.find((c) => c.type === "text");
            return {
                properties: { text: textNode?.value ?? "" },
                tag: "title"
            };
        }

        return { properties: el.properties, tag: el.tagName };
    });
};

/**
 * Determine whether an HTML string is a fragment (not a full document).
 *
 * Parses in document mode — the parser always adds html/head/body, but
 * only creates a doctype node if the input actually had one. So the
 * presence of a doctype node proves the input was a full document.
 *
 * This aligns with Astro's behavior: Astro appears to add doctypes
 * for non-partial renders only
 */
export const isFragment = (html: string): boolean => {
    const tree = parseHtml(html);
    return !tree.children.some((node) => node.type === "doctype");
};

export const extractJsonLd = (html: string): unknown[] => {
    const tree = parseHtml(html);

    return selectAll('head > script[type="application/ld+json"]', tree)
        .map((el) => {
            const textNode = el.children.find((c) => c.type === "text");
            return textNode ?
                    (JSON.parse(textNode.value) as unknown)
                :   undefined;
        })
        .filter((el) => el !== undefined);
};

/**
 * Extract all child elements of `<head>`, including styles, scripts, etc.
 * Unlike `extractMeta` which only captures meta/title/link, this captures
 * everything — useful for verifying that Astro-injected assets (styles,
 * scripts) survive rehype processing.
 */
export const extractHeadElements = (html: string) => {
    assertValidDocumentStructure(html);
    const tree = parseHtml(html);
    const head = select("head", tree);
    if (!head) return [];

    return head.children
        .filter((node): node is Element => node.type === "element")
        .map((el) => {
            const textNode = el.children.find((c) => c.type === "text");
            return {
                properties: el.properties,
                tag: el.tagName,
                ...(textNode ? { textContent: textNode.value } : {})
            };
        });
};

/**
 * Validates that raw HTML has well-formed document structure before
 * rehype parsing normalizes it away. Catches issues like nested
 * `<head>` elements that rehype silently flattens.
 */
export function assertValidDocumentStructure(html: string): void {
    const headMatches = html.match(/<head[\s>]/gi);
    if (headMatches && headMatches.length > 1) {
        throw new Error(
            `Malformed HTML: found ${headMatches.length} <head> elements (expected at most 1).\n` +
                `This likely means a component is rendering a <head> inside an existing <head>.`
        );
    }

    const bodyMatches = html.match(/<body[\s>]/gi);
    if (bodyMatches && bodyMatches.length > 1) {
        throw new Error(
            `Malformed HTML: found ${bodyMatches.length} <body> elements (expected at most 1).`
        );
    }
}

export const extractMeta = (html: string) => {
    assertValidDocumentStructure(html);
    return query(html, "head > title, head > meta, head > link");
};

/**
 * Extract the server island preload URL from rendered page HTML.
 *
 * Finds the `<link rel="preload" as="fetch">` that Astro injects for
 * server island requests and returns its href. Assumes a single server
 * island per page — sufficient for our test fixtures.
 *
 * Throws if no server island URL is found in the HTML.
 */
export const extractServerIslandUrl = (html: string): string => {
    const tree = parseHtml(html);
    const link = select(
        'link[rel~=preload][as=fetch][href*="_server-islands"]',
        tree
    );

    if (!link || typeof link.properties["href"] !== "string") {
        throw new Error(
            "No server island preload URL found in HTML. " +
                "Does the page contain a component with server:defer?"
        );
    }

    return link.properties["href"];
};

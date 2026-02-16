import type { Element } from "hast";

import { select, selectAll } from "hast-util-select";
import rehypeParse from "rehype-parse";
import { unified } from "unified";

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
    const tree = unified().use(rehypeParse).parse(html);
    return !tree.children.some((node) => node.type === "doctype");
};

const extractElement = (el: Element) => {
    if (el.tagName === "title") {
        const textNode = el.children.find((c) => c.type === "text");
        return { properties: { text: textNode?.value ?? "" }, tag: "title" };
    }

    if (el.tagName === "meta" || el.tagName === "link") {
        return { properties: el.properties, tag: el.tagName };
    }
};

export const extractLdJson = (html: string): unknown[] => {
    const tree = unified().use(rehypeParse).parse(html);

    return selectAll('head > script[type="application/ld+json"]', tree)
        .map((el) => {
            const textNode = el.children.find((c) => c.type === "text");
            return textNode ?
                    (JSON.parse(textNode.value) as unknown)
                :   undefined;
        })
        .filter((el) => el !== undefined);
};

export const extractMeta = (html: string) => {
    const tree = unified().use(rehypeParse).parse(html);

    return selectAll("head > title, head > meta, head > link", tree)
        .map((el) => extractElement(el))
        .filter((el) => el !== undefined);
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
    const tree = unified().use(rehypeParse).parse(html);
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

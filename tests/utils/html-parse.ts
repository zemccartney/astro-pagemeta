import type { Element, RootContent } from "hast";

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

const findHead = (nodes: RootContent[]): Element | undefined => {
    for (const node of nodes) {
        if (node.type !== "element") continue;
        if (node.tagName === "head") return node;
        const found = findHead(node.children as RootContent[]);
        if (found) return found;
    }
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

export const extractMeta = (html: string) => {
    const tree = unified().use(rehypeParse).parse(html);
    const head = findHead(tree.children);
    if (!head) return [];

    return head.children
        .filter((child) => child.type === "element")
        .map((el) => extractElement(el))
        .filter((el) => el !== undefined);
};

const findServerIslandPreload = (nodes: RootContent[]): string | undefined => {
    for (const node of nodes) {
        if (node.type !== "element") continue;

        if (
            node.tagName === "link" &&
            Array.isArray(node.properties["rel"]) &&
            node.properties["rel"].includes("preload") &&
            node.properties["as"] === "fetch" &&
            typeof node.properties["href"] === "string" &&
            node.properties["href"].includes("_server-islands")
        ) {
            return node.properties["href"];
        }

        const found = findServerIslandPreload(node.children as RootContent[]);
        if (found) return found;
    }
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
    const url = findServerIslandPreload(tree.children);

    if (!url) {
        throw new Error(
            "No server island preload URL found in HTML. " +
                "Does the page contain a component with server:defer?"
        );
    }

    return url;
};

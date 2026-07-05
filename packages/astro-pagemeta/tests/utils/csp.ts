import { createHash } from "node:crypto";

/**
 * Extract the content of Astro's CSP meta tag from rendered HTML.
 * @param html - Full rendered document
 * @returns The CSP directive string, or undefined when absent
 */
export function extractCspContent(html: string): string | undefined {
    const match =
        /<meta\s+http-equiv="content-security-policy"\s+content="([^"]*)"/i.exec(
            html
        ) ??
        /<meta\s+content="([^"]*)"\s+http-equiv="content-security-policy"/i.exec(
            html
        );
    if (!match?.[1]) return undefined;
    // Our re-serialization entity-encodes quotes inside attribute values
    // (' → &#x27;). Browsers decode attributes before CSP parsing, so this
    // is semantics-preserving; decode here so assertions compare directives.
    return match[1]
        .replaceAll("&#x27;", "'")
        .replaceAll("&#x22;", '"')
        .replaceAll("&quot;", '"')
        .replaceAll("&amp;", "&");
}

/**
 * Extract the text content of every inline `<style>` element.
 * @param html - Full rendered document
 * @returns Style bodies in document order
 */
export function extractInlineStyles(html: string): string[] {
    return [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(
        (m) => m[1] ?? ""
    );
}

/**
 * Compute the CSP source token for a chunk of inline content.
 * @param text - Exact text between the element's tags
 * @returns A token like `'sha256-...'` as it would appear in a directive
 */
export function sha256Token(text: string): string {
    return `'sha256-${createHash("sha256").update(text).digest("base64")}'`;
}

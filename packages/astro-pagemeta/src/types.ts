import type { APIContext } from "astro";
import type { Options } from "rehype-meta";
import type { Thing } from "schema-dts";

/**
 * Metadata options for a page. Extends rehype-meta's `Options` with support
 * for arbitrary custom meta tags and JSON-LD structured data.
 * @see https://github.com/rehypejs/rehype-meta#options
 */
export interface PagemetaOptions extends Options {
    /**
     * Arbitrary key-value pairs injected as `<meta>` tags. Keys matching
     * Open Graph prefixes (`og:`, `article:`, etc.) use the `property`
     * attribute; all others use `name`. Special keys: `"title"` sets
     * `<title>`, `"link:rel:canonical"` sets `<link rel="canonical">`,
     * `"meta:charSet"` sets `<meta charset>`.
     */
    custom?: Record<string, string>;
    /**
     * JSON-LD structured data to inject as a `<script type="application/ld+json">`
     * tag. Pass a single `Thing` or an array (rendered as an `@graph`).
     * @see https://schema.org
     */
    jsonLd?: Thing | Thing[];
}

export interface PagemetaProcessorConfig {
    addRequiredGlobalMeta: boolean;
    compressHTML: boolean;
    defaults?:
        | ((ctx: APIContext) => PagemetaOptions)
        | PagemetaOptions
        | undefined;
    routePatterns: RegExp[];
}

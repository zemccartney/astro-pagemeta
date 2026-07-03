/**
 * Plugin overhead: incrementally adds plugins to isolate per-plugin cost.
 * Uses the p50 (median) fixture to show meaningful differences.
 *
 * This answers: "which plugins cost what?" and specifically highlights
 * rehypeMinifyWhitespace, which unlike the other plugins walks the entire
 * tree (O(n) in doc size) rather than just <head>.
 */
import { bench, describe } from "vitest";

import { createMetadataProcessor } from "../src/core.ts";
import { FIXTURES } from "./fixtures/generate.ts";

const html = FIXTURES["p50 (140 KB)"];

describe("plugin overhead — p50 (140 KB) document", () => {
    bench("rehypeMeta only (title + description)", async () => {
        const processor = createMetadataProcessor({
            addRequiredGlobalMeta: false,
            compressHTML: false,
            routePatterns: []
        });
        await processor
            .getHtmlProcessor({
                metadata: {
                    description: "A test page",
                    og: true,
                    title: "Benchmark",
                    twitter: true
                }
            })
            .process(html);
    });

    bench("+ rehypeCustomMeta (5 custom tags)", async () => {
        const processor = createMetadataProcessor({
            addRequiredGlobalMeta: false,
            compressHTML: false,
            routePatterns: []
        });
        await processor
            .getHtmlProcessor({
                metadata: {
                    custom: {
                        "og:image": "https://example.com/image.png",
                        "og:locale": "en_US",
                        robots: "index, follow",
                        "twitter:card": "summary_large_image",
                        "twitter:site": "@example"
                    },
                    description: "A test page",
                    og: true,
                    title: "Benchmark",
                    twitter: true
                }
            })
            .process(html);
    });

    bench("+ rehypeJsonLd", async () => {
        const processor = createMetadataProcessor({
            addRequiredGlobalMeta: false,
            compressHTML: false,
            routePatterns: []
        });
        await processor
            .getHtmlProcessor({
                metadata: {
                    custom: {
                        "og:image": "https://example.com/image.png",
                        "og:locale": "en_US",
                        robots: "index, follow",
                        "twitter:card": "summary_large_image",
                        "twitter:site": "@example"
                    },
                    description: "A test page",
                    jsonLd: {
                        "@type": "WebPage",
                        description: "Benchmark page",
                        name: "Benchmark"
                    } as never,
                    og: true,
                    title: "Benchmark",
                    twitter: true
                }
            })
            .process(html);
    });

    bench("+ rehypeMinifyWhitespace (compressHTML)", async () => {
        const processor = createMetadataProcessor({
            addRequiredGlobalMeta: false,
            compressHTML: true,
            routePatterns: []
        });
        await processor
            .getHtmlProcessor({
                metadata: {
                    custom: {
                        "og:image": "https://example.com/image.png",
                        "og:locale": "en_US",
                        robots: "index, follow",
                        "twitter:card": "summary_large_image",
                        "twitter:site": "@example"
                    },
                    description: "A test page",
                    jsonLd: {
                        "@type": "WebPage",
                        description: "Benchmark page",
                        name: "Benchmark"
                    } as never,
                    og: true,
                    title: "Benchmark",
                    twitter: true
                }
            })
            .process(html);
    });
});

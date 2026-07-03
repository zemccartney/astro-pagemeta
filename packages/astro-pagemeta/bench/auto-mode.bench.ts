/**
 * Auto mode: full document processing through the complete pagemeta pipeline.
 * This is the primary "what does pagemeta cost?" benchmark — it measures
 * the same code path as the post-render middleware in auto mode.
 */
import { bench, describe } from "vitest";

import { createMetadataProcessor } from "../src/core.ts";
import { FIXTURES } from "./fixtures/generate.ts";

const processor = createMetadataProcessor({
    addRequiredGlobalMeta: true,
    compressHTML: false,
    routePatterns: [/^\//]
});

// Realistic metadata: title, description, OG, custom tags, JSON-LD
const META = {
    custom: {
        "og:image": "https://example.com/image.png",
        "og:locale": "en_US",
        robots: "index, follow",
        "twitter:card": "summary_large_image",
        "twitter:site": "@example"
    },
    description: "A benchmark test page for measuring processing overhead",
    jsonLd: {
        "@type": "WebPage",
        description: "Benchmark page",
        name: "Benchmark"
    } as never,
    og: true,
    title: "Benchmark Page | Example Site",
    twitter: true
};

describe("auto mode — full document", () => {
    for (const [name, html] of Object.entries(FIXTURES)) {
        bench(name, async () => {
            await processor.getHtmlProcessor({ metadata: META }).process(html);
        });
    }
});

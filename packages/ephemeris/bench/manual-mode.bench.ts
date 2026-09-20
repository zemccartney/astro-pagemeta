/**
 * Manual mode: head-only fragment processing via the Head component path.
 * Processes only the ~250 bytes of head content, regardless of document size.
 * This measures the cost users pay when using <Head> instead of auto middleware.
 *
 * Note: we benchmark the same head content at each "document size" label to
 * make the comparison table against auto-mode directly readable — the point is
 * that manual mode cost is constant while auto mode scales with document size.
 */
import { bench, describe } from "vitest";

import { createMetadataProcessor } from "../src/core.ts";
import { HEAD_CONTENT } from "./fixtures/generate.ts";

const processor = createMetadataProcessor({
    addRequiredGlobalMeta: true,
    compressHTML: false,
    routePatterns: [/^\//]
});

// Same metadata as auto-mode benchmark for apples-to-apples comparison
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

describe("manual mode — head content only", () => {
    // Single benchmark since input is always the same ~250 bytes of head content
    bench("head fragment (~250B)", async () => {
        await processor
            .getHtmlProcessor({ fragment: true, metadata: META })
            .process(HEAD_CONTENT);
    });
});

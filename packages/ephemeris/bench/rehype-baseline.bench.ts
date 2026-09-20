/**
 * Rehype baseline: parse + serialize with zero plugins.
 * This measures the irreducible cost of using rehype — the floor
 * that no plugin configuration can get below.
 */
import { rehype } from "rehype";
import { bench, describe } from "vitest";

import { FIXTURES } from "./fixtures/generate.ts";

const processor = rehype();

describe("rehype baseline (no plugins)", () => {
    for (const [name, html] of Object.entries(FIXTURES)) {
        bench(name, async () => {
            await processor.process(html);
        });
    }
});

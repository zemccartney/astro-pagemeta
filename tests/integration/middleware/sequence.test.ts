import type { TestApp } from "@inox-tools/astro-tests/astroFixture";

import testAdapter from "@inox-tools/astro-tests/testAdapter";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../src/index.ts";
import { extractMeta } from "../../utils/html-parse.ts";
import { isolatedFixture } from "../../utils/isolated-fixture.ts";

/**
 * Manual mode with middleware sequencing.
 *
 * The runtime's `middleware()` export lets users compose the built-in
 * processing pipeline with their own middleware via Astro's `sequence()`.
 *
 * With `sequence(custom, middleware())`:
 *   custom calls next() → enters middleware()
 *     middleware() calls next() → page renders
 *     middleware() processes response with rehype-meta (adds standard tags)
 *   custom receives processed response, can add its own tags
 *
 * Two scenarios:
 * 1. `/` — standard processing only (title + description via rehype-meta)
 * 2. `/custom` — standard processing + custom robots tag added by user middleware
 */

const { cleanup, fixture, inject } = await isolatedFixture(
    "middleware/manual",
    {
        adapter: testAdapter(),
        output: "server"
    }
);

await inject(
    "middleware.ts",
    new URL("sequence.middleware.ts", import.meta.url)
);

const config = {
    integrations: [pagemeta({ mode: "manual" })]
};

afterAll(() => cleanup());

describe("manual mode + sequence / SSR / dev server", () => {
    let devServer: Awaited<ReturnType<typeof fixture.startDevServer>>;

    beforeAll(async () => {
        devServer = await fixture.startDevServer(config);
    });

    afterAll(async () => {
        await devServer.stop();
    });

    test("standard processing via middleware()", async () => {
        const response = await fixture.fetch("/");
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "Index Page Title" }, tag: "title" },
            {
                properties: {
                    content: "Index page description",
                    name: "description"
                },
                tag: "meta"
            }
        ]);
    });

    test("standard processing + custom robots tag via sequence", async () => {
        const response = await fixture.fetch("/custom");
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "Custom Page Title" }, tag: "title" },
            {
                properties: {
                    content: "Custom page description",
                    name: "description"
                },
                tag: "meta"
            },
            {
                properties: {
                    content: "index, follow",
                    name: "robots"
                },
                tag: "meta"
            }
        ]);
    });
});

describe("manual mode + sequence / SSR / build", () => {
    let app: TestApp;

    beforeAll(async () => {
        await fixture.build(config);
        app = await fixture.loadTestAdapterApp();
    });

    test("standard processing via middleware()", async () => {
        const response = await app.render(new Request("https://example.com/"));
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "Index Page Title" }, tag: "title" },
            {
                properties: {
                    content: "Index page description",
                    name: "description"
                },
                tag: "meta"
            }
        ]);
    });

    test("standard processing + custom robots tag via sequence", async () => {
        const response = await app.render(
            new Request("https://example.com/custom")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "Custom Page Title" }, tag: "title" },
            {
                properties: {
                    content: "Custom page description",
                    name: "description"
                },
                tag: "meta"
            },
            {
                properties: {
                    content: "index, follow",
                    name: "robots"
                },
                tag: "meta"
            }
        ]);
    });
});

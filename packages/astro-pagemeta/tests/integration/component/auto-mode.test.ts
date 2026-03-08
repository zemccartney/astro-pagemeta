import type { TestApp } from "@inox-tools/astro-tests/astroFixture";

import testAdapter from "@inox-tools/astro-tests/testAdapter";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../src/index.ts";
import { extractMeta } from "../../utils/html-parse.ts";
import { isolatedFixture } from "../../utils/isolated-fixture.ts";

// Uses the component fixture but with auto mode config (middleware active).
// Documents that the component works alongside the middleware — rehype-meta's
// ensure() deduplicates on the middleware's second pass, producing no duplicates.
const { cleanup, fixture } = await isolatedFixture("component", {
    adapter: testAdapter(),
    output: "server"
});

const config = {
    integrations: [
        pagemeta({
            defaults: { author: "Default Author" },
            mode: "auto"
        })
    ]
};

afterAll(() => cleanup());

describe("component + auto mode / SSR / dev server", () => {
    let devServer: Awaited<ReturnType<typeof fixture.startDevServer>>;

    beforeAll(async () => {
        devServer = await fixture.startDevServer(config);
    });

    afterAll(async () => {
        await devServer.stop();
    });

    test("component output + middleware re-processing produces no duplicates", async () => {
        const response = await fixture.fetch("/auto-mode");
        const html = await response.text();
        const headMeta = extractMeta(html);

        // The component renders meta tags inline, then the middleware
        // re-processes the full document. rehype-meta's ensure() finds
        // the existing tags and updates them rather than duplicating.
        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "Test Page Title" }, tag: "title" },
            {
                properties: {
                    content: "Test page description",
                    name: "description"
                },
                tag: "meta"
            },
            {
                properties: { content: "Default Author", name: "author" },
                tag: "meta"
            }
        ]);
    });
});

describe("component + auto mode / SSR / build", () => {
    let app: TestApp;

    beforeAll(async () => {
        await fixture.build(config);
        app = await fixture.loadTestAdapterApp();
    });

    test("component output + middleware re-processing produces no duplicates", async () => {
        const response = await app.render(
            new Request("https://example.com/auto-mode")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "Test Page Title" }, tag: "title" },
            {
                properties: {
                    content: "Test page description",
                    name: "description"
                },
                tag: "meta"
            },
            {
                properties: { content: "Default Author", name: "author" },
                tag: "meta"
            }
        ]);
    });
});

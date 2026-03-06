import type { TestApp } from "@inox-tools/astro-tests/astroFixture";

import testAdapter from "@inox-tools/astro-tests/testAdapter";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../src/index.ts";
import { extractMeta } from "../../utils/html-parse.ts";
import { isolatedFixture } from "../../utils/isolated-fixture.ts";

// No defaults configured — demonstrates the component gracefully handles
// the absence of any metadata (no defaults, no setPagemeta call).
// Common scenario: integration in layout template, but a given page
// doesn't need custom meta tags.
const { cleanup, fixture } = await isolatedFixture("streaming", {
    adapter: testAdapter(),
    output: "server"
});

const config = {
    integrations: [pagemeta({ mode: "streaming" })]
};

afterAll(() => cleanup());

describe("streaming / no defaults / dev server", () => {
    let devServer: Awaited<ReturnType<typeof fixture.startDevServer>>;

    beforeAll(async () => {
        devServer = await fixture.startDevServer(config);
    });

    afterAll(async () => {
        await devServer.stop();
    });

    test("component with slot but no metadata passes through slot content", async () => {
        const response = await fixture.fetch("/defaults-only");
        const html = await response.text();
        const headMeta = extractMeta(html);

        // No metadata at all — component passes through slot content unchanged
        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" }
        ]);
    });

    test("empty component with no metadata renders nothing", async () => {
        const response = await fixture.fetch("/no-children");
        const html = await response.text();
        const headMeta = extractMeta(html);

        // Self-closing <Pagemeta /> with no metadata outputs nothing —
        // only the hardcoded charset outside the component survives
        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" }
        ]);
    });
});

describe("streaming / no defaults / build", () => {
    let app: TestApp;

    beforeAll(async () => {
        await fixture.build(config);
        app = await fixture.loadTestAdapterApp();
    });

    test("component with slot but no metadata passes through slot content", async () => {
        const response = await app.render(
            new Request("https://example.com/defaults-only")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" }
        ]);
    });

    test("empty component with no metadata renders nothing", async () => {
        const response = await app.render(
            new Request("https://example.com/no-children")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" }
        ]);
    });
});

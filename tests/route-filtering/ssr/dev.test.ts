import testAdapter from "@inox-tools/astro-tests/testAdapter";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../src/index.ts";
import { extractMeta } from "../../utils/extract-meta.ts";
import { isolatedFixture } from "../../utils/isolated-fixture.ts";

const { cleanup, fixture } = await isolatedFixture(
    new URL("../../fixtures/route-filtering/", import.meta.url),
    { adapter: testAdapter(), output: "server" }
);

const config = {
    integrations: [pagemeta({ defaults: { title: "Default Title" } })],
    redirects: { "/old-page": "/" }
};

describe("route-filtering / SSR / dev server", () => {
    let devServer: Awaited<ReturnType<typeof fixture.startDevServer>>;

    beforeAll(async () => {
        devServer = await fixture.startDevServer(config);
    });

    afterAll(async () => {
        await devServer.stop();
        await cleanup();
    });

    test("page with server:defer gets meta tags", async () => {
        const response = await fixture.fetch("/");
        const html = await response.text();
        const headMeta = extractMeta(html);

        // Astro injects a <link rel="preload"> for the server island fetch,
        // so use arrayContaining to assert on the metadata we control
        expect(headMeta).toEqual(
            expect.arrayContaining([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                {
                    properties: { text: "Server Island Page" },
                    tag: "title"
                },
                {
                    properties: {
                        content: "Page with server island",
                        name: "description"
                    },
                    tag: "meta"
                }
            ])
        );
    });

    test("page with server:defer has island placeholder", async () => {
        const response = await fixture.fetch("/");
        const html = await response.text();

        expect(html).toContain("server-island");
    });

    test("JSON endpoint passes through", async () => {
        const response = await fixture.fetch("/api/data.json");
        const contentType = response.headers.get("content-type");
        const body = await response.json();

        expect(contentType).toContain("application/json");
        expect(body).toEqual({ message: "hello" });
    });

    test("HTML endpoint not processed by middleware", async () => {
        const response = await fixture.fetch("/api/html-endpoint");
        const contentType = response.headers.get("content-type");
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(contentType).toContain("text/html");
        // Only the charset meta from the endpoint's own HTML — no Default Title injected
        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" }
        ]);
    });

    test("config redirect returns redirect response", async () => {
        const response = await fixture.fetch("/old-page");
        const contentType = response.headers.get("content-type");

        // eslint-disable-next-line unicorn/no-null -- output of Response API
        expect(contentType).toEqual(null);
        expect(response.status).toEqual(301);
    });

    test("rewrite has target's meta tags", async () => {
        const response = await fixture.fetch("/rewrite-source");
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "Rewrite Target Title" }, tag: "title" },
            {
                properties: {
                    content: "Rewrite target description",
                    name: "description"
                },
                tag: "meta"
            }
        ]);
    });
});

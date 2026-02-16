import type { TestApp } from "@inox-tools/astro-tests/astroFixture";

import testAdapter from "@inox-tools/astro-tests/testAdapter";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../src/index.ts";
import {
    extractMeta,
    extractServerIslandUrl,
    isFragment
} from "../utils/html-parse.ts";
import { isolatedFixture } from "../utils/isolated-fixture.ts";

const { cleanup, fixture } = await isolatedFixture("route-filtering", {
    adapter: testAdapter(),
    output: "server"
});

const config = {
    integrations: [pagemeta({ defaults: { title: "Default Title" } })],
    redirects: { "/old-page": "/" }
};

afterAll(() => cleanup());

describe("route-filtering / SSR / dev server", () => {
    let devServer: Awaited<ReturnType<typeof fixture.startDevServer>>;

    beforeAll(async () => {
        devServer = await fixture.startDevServer(config);
    });

    afterAll(async () => {
        await devServer.stop();
    });

    test("server island fragment not processed by middleware", async () => {
        const response = await fixture.fetch("/");
        const html = await response.text();

        const islandUrl = extractServerIslandUrl(html);

        const islandResponse = await fixture.fetch(islandUrl);
        const islandHtml = await islandResponse.text();

        expect(isFragment(islandHtml)).toBe(true);
        expect(islandHtml).toContain("Hello from server island");
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

    test("partial page not processed by middleware", async () => {
        const response = await fixture.fetch("/partial");
        const html = await response.text();

        expect(isFragment(html)).toBe(true);
        expect(html).toContain("I'm a partial fragment");
    });
});

describe("route-filtering / SSR / build", () => {
    let app: TestApp;

    beforeAll(async () => {
        await fixture.build(config);
        app = await fixture.loadTestAdapterApp();
    });

    test("server island fragment not processed by middleware", async () => {
        const response = await app.render(new Request("https://example.com/"));
        const html = await response.text();

        const islandUrl = extractServerIslandUrl(html);

        const islandResponse = await app.render(
            new Request(`https://example.com${islandUrl}`)
        );
        const islandHtml = await islandResponse.text();

        expect(isFragment(islandHtml)).toBe(true);
        expect(islandHtml).toContain("Hello from server island");
    });

    test("JSON endpoint passes through", async () => {
        const response = await app.render(
            new Request("https://example.com/api/data.json")
        );
        const contentType = response.headers.get("content-type");
        const body = await response.json();

        expect(contentType).toContain("application/json");
        expect(body).toEqual({ message: "hello" });
    });

    test("HTML endpoint not processed by middleware", async () => {
        const response = await app.render(
            new Request("https://example.com/api/html-endpoint")
        );
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
        const response = await app.render(
            new Request("https://example.com/old-page")
        );
        const contentType = response.headers.get("content-type");

        // eslint-disable-next-line unicorn/no-null -- output of Response API
        expect(contentType).toEqual(null);
        expect(response.status).toEqual(301);
    });

    test("rewrite has target's meta tags", async () => {
        const response = await app.render(
            new Request("https://example.com/rewrite-source")
        );
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

    test("partial page not processed by middleware", async () => {
        const response = await app.render(
            new Request("https://example.com/partial")
        );
        const html = await response.text();

        expect(isFragment(html)).toBe(true);
        expect(html).toContain("I'm a partial fragment");
    });
});

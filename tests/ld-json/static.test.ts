import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../src/index.ts";
import { extractLdJson } from "../utils/html-parse.ts";
import { isolatedFixture } from "../utils/isolated-fixture.ts";

const { cleanup, fixture } = await isolatedFixture("ld-json");

const config = {
    integrations: [pagemeta()]
};

afterAll(() => cleanup());

describe("ld-json / static / dev server", () => {
    let devServer: Awaited<ReturnType<typeof fixture.startDevServer>>;

    beforeAll(async () => {
        devServer = await fixture.startDevServer(config);
    });

    afterAll(async () => {
        await devServer.stop();
    });

    test("injects single LD-JSON script tag with auto @context", async () => {
        const response = await fixture.fetch("/");
        const html = await response.text();
        const ldJson = extractLdJson(html);

        expect(ldJson).toEqual([
            {
                "@context": "https://schema.org",
                "@type": "WebPage",
                name: "LD-JSON Test Page"
            }
        ]);
    });

    test("wraps array in @graph with single script tag", async () => {
        const response = await fixture.fetch("/array");
        const html = await response.text();
        const ldJson = extractLdJson(html);

        expect(ldJson).toEqual([
            {
                "@context": "https://schema.org",
                "@graph": [
                    { "@type": "Organization", name: "Test Org" },
                    { "@type": "WebSite", name: "Test Site" }
                ]
            }
        ]);
    });

    test("template LD-JSON and injected LD-JSON both preserved", async () => {
        const response = await fixture.fetch("/template-ld-json");
        const html = await response.text();
        const ldJson = extractLdJson(html);

        expect(ldJson).toEqual([
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: []
            },
            {
                "@context": "https://schema.org",
                "@type": "Article",
                headline: "Injected Article"
            }
        ]);
    });
});

describe("ld-json / static / build", () => {
    beforeAll(async () => {
        await fixture.build(config);
    });

    test("injects single LD-JSON script tag with auto @context", async () => {
        const html = await fixture.readFile("/index.html");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
        const ldJson = extractLdJson(html!);

        expect(ldJson).toEqual([
            {
                "@context": "https://schema.org",
                "@type": "WebPage",
                name: "LD-JSON Test Page"
            }
        ]);
    });

    test("wraps array in @graph with single script tag", async () => {
        const html = await fixture.readFile("/array/index.html");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
        const ldJson = extractLdJson(html!);

        expect(ldJson).toEqual([
            {
                "@context": "https://schema.org",
                "@graph": [
                    { "@type": "Organization", name: "Test Org" },
                    { "@type": "WebSite", name: "Test Site" }
                ]
            }
        ]);
    });

    test("template LD-JSON and injected LD-JSON both preserved", async () => {
        const html = await fixture.readFile("/template-ld-json/index.html");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
        const ldJson = extractLdJson(html!);

        expect(ldJson).toEqual([
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: []
            },
            {
                "@context": "https://schema.org",
                "@type": "Article",
                headline: "Injected Article"
            }
        ]);
    });
});

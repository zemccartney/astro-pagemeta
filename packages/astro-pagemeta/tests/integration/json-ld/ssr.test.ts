import type { TestApp } from "@inox-tools/astro-tests/astroFixture";

import testAdapter from "@inox-tools/astro-tests/testAdapter";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../src/index.ts";
import { extractJsonLd } from "../../utils/html-parse.ts";
import { isolatedFixture } from "../../utils/isolated-fixture.ts";

const { cleanup, fixture } = await isolatedFixture("json-ld", {
    adapter: testAdapter(),
    output: "server"
});

const config = {
    integrations: [pagemeta()]
};

afterAll(() => cleanup());

describe("json-ld / SSR / dev server", () => {
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
        const jsonLd = extractJsonLd(html);

        expect(jsonLd).toEqual([
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
        const jsonLd = extractJsonLd(html);

        expect(jsonLd).toEqual([
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
        const response = await fixture.fetch("/template-json-ld");
        const html = await response.text();
        const jsonLd = extractJsonLd(html);

        expect(jsonLd).toEqual([
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

describe("json-ld / SSR / build", () => {
    let app: TestApp;

    beforeAll(async () => {
        await fixture.build(config);
        app = await fixture.loadTestAdapterApp();
    });

    test("injects single LD-JSON script tag with auto @context", async () => {
        const response = await app.render(new Request("https://example.com/"));
        const html = await response.text();
        const jsonLd = extractJsonLd(html);

        expect(jsonLd).toEqual([
            {
                "@context": "https://schema.org",
                "@type": "WebPage",
                name: "LD-JSON Test Page"
            }
        ]);
    });

    test("wraps array in @graph with single script tag", async () => {
        const response = await app.render(
            new Request("https://example.com/array")
        );
        const html = await response.text();
        const jsonLd = extractJsonLd(html);

        expect(jsonLd).toEqual([
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
        const response = await app.render(
            new Request("https://example.com/template-json-ld")
        );
        const html = await response.text();
        const jsonLd = extractJsonLd(html);

        expect(jsonLd).toEqual([
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

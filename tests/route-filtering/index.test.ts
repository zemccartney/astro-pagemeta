import type { TestApp } from "@inox-tools/astro-tests/astroFixture";
import type { AstroIntegration } from "astro";

import testAdapter from "@inox-tools/astro-tests/testAdapter";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../src/index.ts";
import {
    extractMeta,
    extractServerIslandUrl,
    isFragment
} from "../utils/html-parse.ts";
import { isolatedFixture } from "../utils/isolated-fixture.ts";

describe("route-filtering", async () => {
    const { cleanup, fixture } = await isolatedFixture("route-filtering", {
        adapter: testAdapter(),
        output: "server"
    });

    const config = {
        integrations: [pagemeta({ defaults: { title: "Default Title" } })],
        redirects: { "/old-page": "/" }
    };

    afterAll(() => cleanup());

    describe("dev server", () => {
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

        // Server island that renders a complete page (html/head/body with its
        // own title). Astro strips the doctype so the response is a fragment,
        // and /_server-islands/ doesn't match any page route — neither the
        // island's own title nor integration defaults appear in processed output.
        test("server island rendering full page is still not processed", async () => {
            const response = await fixture.fetch("/full-doc-island-page");
            const html = await response.text();

            const islandUrl = extractServerIslandUrl(html);

            const islandResponse = await fixture.fetch(islandUrl);
            const islandHtml = await islandResponse.text();

            expect(isFragment(islandHtml)).toBe(true);
            // The component's own title and charset survive as static template
            // content, but no "Default Title" from integration defaults
            expect(extractMeta(islandHtml)).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                { properties: { text: "Island-Rendered Page" }, tag: "title" }
            ]);
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

        // The template includes <!doctype html> and the frontmatter calls
        // setPagemeta(), but astro appears to strip the doctype from all
        // non-page renders. Since this page exports `partial = true`, the response has no doctype and the
        // middleware's isHtmlDocument() check classifies it as a fragment,
        // skipping all metadata injection. setPagemeta() and integration
        // defaults are both silently ignored.
        test("partial with full document template not processed", async () => {
            const response = await fixture.fetch("/partial-full-doc");
            const html = await response.text();

            // Astro strips doctype — response is classified as fragment
            expect(isFragment(html)).toBe(true);
            // Only template-level metadata survives; setPagemeta() and defaults ignored
            expect(extractMeta(html)).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" }
            ]);
            expect(html).toContain(
                "I'm a partial with full document structure"
            );
        });
    });

    describe("build", () => {
        let app: TestApp;

        beforeAll(async () => {
            await fixture.build(config);
            app = await fixture.loadTestAdapterApp();
        });

        test("server island fragment not processed by middleware", async () => {
            const response = await app.render(
                new Request("https://example.com/")
            );
            const html = await response.text();

            const islandUrl = extractServerIslandUrl(html);

            const islandResponse = await app.render(
                new Request(`https://example.com${islandUrl}`)
            );
            const islandHtml = await islandResponse.text();

            expect(isFragment(islandHtml)).toBe(true);
            expect(islandHtml).toContain("Hello from server island");
        });

        test("server island rendering full page not processed", async () => {
            const response = await app.render(
                new Request("https://example.com/full-doc-island-page")
            );
            const html = await response.text();

            const islandUrl = extractServerIslandUrl(html);

            const islandResponse = await app.render(
                new Request(`https://example.com${islandUrl}`)
            );
            const islandHtml = await islandResponse.text();

            expect(isFragment(islandHtml)).toBe(true);
            expect(extractMeta(islandHtml)).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                { properties: { text: "Island-Rendered Page" }, tag: "title" }
            ]);
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

        test("partial with full document template not processed", async () => {
            const response = await app.render(
                new Request("https://example.com/partial-full-doc")
            );
            const html = await response.text();

            expect(isFragment(html)).toBe(true);
            expect(extractMeta(html)).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" }
            ]);
            expect(html).toContain(
                "I'm a partial with full document structure"
            );
        });
    });
});

// Integration-injected pages: by default, pages added via injectRoute()
// (origin: "external") are excluded from route patterns and don't receive
// integration defaults. The isPageRoute() check exists to ensure we only
// act on pages the user controls and is immediately aware of.
const integrationPageEntrypoint = new URL(
    "integration-page.astro",
    import.meta.url
);

function injectPageIntegration(): AstroIntegration {
    return {
        hooks: {
            "astro:config:setup": ({ injectRoute }) => {
                injectRoute({
                    entrypoint: integrationPageEntrypoint,
                    pattern: "/injected"
                });
            }
        },
        name: "test-inject-page"
    };
}

describe("route-filtering / integration-injected pages", () => {
    describe("excluded by default", async () => {
        const { cleanup, fixture } = await isolatedFixture("route-filtering", {
            adapter: testAdapter(),
            output: "server"
        });

        const config = {
            integrations: [
                pagemeta({ defaults: { title: "Default Title" } }),
                injectPageIntegration()
            ]
        };

        afterAll(() => cleanup());

        describe("dev server", () => {
            let devServer: Awaited<ReturnType<typeof fixture.startDevServer>>;

            beforeAll(async () => {
                devServer = await fixture.startDevServer(config);
            });

            afterAll(async () => {
                await devServer.stop();
            });

            test("integration-injected page does not receive defaults", async () => {
                const response = await fixture.fetch("/injected");
                const html = await response.text();
                const headMeta = extractMeta(html);

                expect(headMeta).toEqual([
                    { properties: { charSet: "utf-8" }, tag: "meta" }
                ]);
                expect(html).toContain("Integration-injected page");
            });
        });

        describe("build", () => {
            let app: TestApp;

            beforeAll(async () => {
                await fixture.build(config);
                app = await fixture.loadTestAdapterApp();
            });

            test("integration-injected page does not receive defaults", async () => {
                const response = await app.render(
                    new Request("https://example.com/injected")
                );
                const html = await response.text();
                const headMeta = extractMeta(html);

                expect(headMeta).toEqual([
                    { properties: { charSet: "utf-8" }, tag: "meta" }
                ]);
                expect(html).toContain("Integration-injected page");
            });
        });
    });

    describe("includeExternal opts in", async () => {
        const { cleanup, fixture } = await isolatedFixture("route-filtering", {
            adapter: testAdapter(),
            output: "server"
        });

        const config = {
            integrations: [
                pagemeta({
                    defaults: { title: "Default Title" },
                    includeExternal: true
                }),
                injectPageIntegration()
            ]
        };

        afterAll(() => cleanup());

        describe("dev server", () => {
            let devServer: Awaited<ReturnType<typeof fixture.startDevServer>>;

            beforeAll(async () => {
                devServer = await fixture.startDevServer(config);
            });

            afterAll(async () => {
                await devServer.stop();
            });

            test("integration-injected page receives defaults", async () => {
                const response = await fixture.fetch("/injected");
                const html = await response.text();
                const headMeta = extractMeta(html);

                expect(headMeta).toContainEqual({
                    properties: { text: "Default Title" },
                    tag: "title"
                });
                expect(html).toContain("Integration-injected page");
            });
        });

        describe("build", () => {
            let app: TestApp;

            beforeAll(async () => {
                await fixture.build(config);
                app = await fixture.loadTestAdapterApp();
            });

            test("integration-injected page receives defaults", async () => {
                const response = await app.render(
                    new Request("https://example.com/injected")
                );
                const html = await response.text();
                const headMeta = extractMeta(html);

                expect(headMeta).toContainEqual({
                    properties: { text: "Default Title" },
                    tag: "title"
                });
                expect(html).toContain("Integration-injected page");
            });
        });
    });
});

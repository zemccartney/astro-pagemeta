import type { TestApp } from "@inox-tools/astro-tests/astroFixture";

import testAdapter from "@inox-tools/astro-tests/testAdapter";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../src/index.ts";
import {
    extractHeadElements,
    extractMeta,
    query
} from "../../utils/html-parse.ts";
import { isolatedFixture } from "../../utils/isolated-fixture.ts";

const { cleanup, fixture } = await isolatedFixture("component", {
    adapter: testAdapter(),
    output: "server"
});

const config = {
    integrations: [
        pagemeta({
            defaults: { author: "Default Author" },
            mode: "manual"
        })
    ]
};

afterAll(() => cleanup());

describe("component / SSR / dev server", () => {
    let devServer: Awaited<ReturnType<typeof fixture.startDevServer>>;

    beforeAll(async () => {
        devServer = await fixture.startDevServer(config);
    });

    afterAll(async () => {
        await devServer.stop();
    });

    test("page without component receives no injection even with defaults", async () => {
        const response = await fixture.fetch("/no-component");
        const html = await response.text();
        const headMeta = extractMeta(html);

        // Only the hardcoded charset — no title, description, or author
        // despite setPagemeta() call and configured defaults
        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" }
        ]);
    });

    test("integration defaults apply via the component", async () => {
        const response = await fixture.fetch("/defaults-only");
        const html = await response.text();
        const headMeta = extractMeta(html);

        // charset from slot children + author from defaults
        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            {
                properties: { content: "Default Author", name: "author" },
                tag: "meta"
            }
        ]);
    });

    test("empty component renders without breaking, sibling head elements survive", async () => {
        const response = await fixture.fetch("/no-children");
        const html = await response.text();
        const headMeta = extractMeta(html);

        // The hardcoded charset outside the component survives, and
        // defaults still apply through the empty component
        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            {
                properties: { content: "Default Author", name: "author" },
                tag: "meta"
            }
        ]);
    });

    test("injects title and description meta tags", async () => {
        const response = await fixture.fetch("/basic");
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

    test("injects complex metadata with OG and Twitter tags", async () => {
        const response = await fixture.fetch("/complex");
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            {
                properties: {
                    text: "Understanding Astro Integrations - Astro Blog"
                },
                tag: "title"
            },
            {
                properties: {
                    content:
                        "A deep dive into how Astro integrations work and how to build your own.",
                    name: "description"
                },
                tag: "meta"
            },
            {
                properties: { content: "Jane Developer", name: "author" },
                tag: "meta"
            },
            {
                properties: { content: "article", property: "og:type" },
                tag: "meta"
            },
            {
                properties: {
                    content: "Astro Blog",
                    property: "og:site_name"
                },
                tag: "meta"
            },
            {
                properties: {
                    content: "Understanding Astro Integrations",
                    property: "og:title"
                },
                tag: "meta"
            },
            {
                properties: {
                    content:
                        "A deep dive into how Astro integrations work and how to build your own.",
                    property: "og:description"
                },
                tag: "meta"
            },
            {
                properties: {
                    content: "@astrodotbuild",
                    name: "twitter:site"
                },
                tag: "meta"
            },
            {
                properties: {
                    content: "@janedev",
                    name: "twitter:creator"
                },
                tag: "meta"
            }
        ]);
    });

    test("non-head-valid children are filtered out", async () => {
        const response = await fixture.fetch("/non-head-tags");
        const html = await response.text();
        const headMeta = extractMeta(html);

        // Only head-valid tags survive — <p> and <div> are filtered by
        // rehype's document-mode parser (moved to <body>, then stripped
        // by rehypeHeadContentsOnly)
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

    test("Astro-injected styles coexist with component output", async () => {
        const response = await fixture.fetch("/with-styled-component");
        const html = await response.text();

        // Full head contents: component-rendered meta tags appear first
        // (at the component's position in the template), followed by
        // Astro-injected style + Vite dev scripts
        const headElements = extractHeadElements(html);
        expect(headElements).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: {}, tag: "title", textContent: "Styled Page" },
            {
                properties: {
                    content: "Page with styled component",
                    name: "description"
                },
                tag: "meta"
            },
            {
                properties: { content: "Default Author", name: "author" },
                tag: "meta"
            },
            {
                properties: {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matcher
                    dataViteDevId: expect.stringContaining("Styled.astro")
                },
                tag: "style",
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matcher
                textContent: expect.stringMatching(
                    /^\.styled\[data-astro-cid-\w+\]\{color:red\}$/
                )
            },
            {
                properties: { src: "/@vite/client", type: "module" },
                tag: "script"
            },
            {
                properties: {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matcher
                    src: expect.stringContaining("Styled.astro"),
                    type: "module"
                },
                tag: "script"
            }
        ]);
    });

    test("component outside <head> renders meta tags in body, not head", async () => {
        const response = await fixture.fetch("/outside-head");
        const html = await response.text();

        // No meta tags in <head> — the component's output never reaches it
        expect(extractMeta(html)).toEqual([]);

        // The tags render in <body> instead — structurally wrong,
        // invisible to crawlers in a streaming context
        expect(query(html, "body > title, body > meta")).toEqual([
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

describe("component / SSR / build", () => {
    let app: TestApp;

    beforeAll(async () => {
        await fixture.build(config);
        app = await fixture.loadTestAdapterApp();
    });

    test("page without component receives no injection even with defaults", async () => {
        const response = await app.render(
            new Request("https://example.com/no-component")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" }
        ]);
    });

    test("integration defaults apply via the component", async () => {
        const response = await app.render(
            new Request("https://example.com/defaults-only")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            {
                properties: { content: "Default Author", name: "author" },
                tag: "meta"
            }
        ]);
    });

    test("empty component renders without breaking, sibling head elements survive", async () => {
        const response = await app.render(
            new Request("https://example.com/no-children")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        // The hardcoded charset outside the component survives, and
        // defaults still apply through the empty component
        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            {
                properties: { content: "Default Author", name: "author" },
                tag: "meta"
            }
        ]);
    });

    test("injects title and description meta tags", async () => {
        const response = await app.render(
            new Request("https://example.com/basic")
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

    test("injects complex metadata with OG and Twitter tags", async () => {
        const response = await app.render(
            new Request("https://example.com/complex")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            {
                properties: {
                    text: "Understanding Astro Integrations - Astro Blog"
                },
                tag: "title"
            },
            {
                properties: {
                    content:
                        "A deep dive into how Astro integrations work and how to build your own.",
                    name: "description"
                },
                tag: "meta"
            },
            {
                properties: { content: "Jane Developer", name: "author" },
                tag: "meta"
            },
            {
                properties: { content: "article", property: "og:type" },
                tag: "meta"
            },
            {
                properties: {
                    content: "Astro Blog",
                    property: "og:site_name"
                },
                tag: "meta"
            },
            {
                properties: {
                    content: "Understanding Astro Integrations",
                    property: "og:title"
                },
                tag: "meta"
            },
            {
                properties: {
                    content:
                        "A deep dive into how Astro integrations work and how to build your own.",
                    property: "og:description"
                },
                tag: "meta"
            },
            {
                properties: {
                    content: "@astrodotbuild",
                    name: "twitter:site"
                },
                tag: "meta"
            },
            {
                properties: {
                    content: "@janedev",
                    name: "twitter:creator"
                },
                tag: "meta"
            }
        ]);
    });

    test("non-head-valid children are filtered out", async () => {
        const response = await app.render(
            new Request("https://example.com/non-head-tags")
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

    test("Astro-injected styles coexist with component output", async () => {
        const response = await app.render(
            new Request("https://example.com/with-styled-component")
        );
        const html = await response.text();

        // Full head contents: component-rendered meta tags first,
        // Astro-injected inline style last (no Vite scripts in build)
        const headElements = extractHeadElements(html);
        expect(headElements).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: {}, tag: "title", textContent: "Styled Page" },
            {
                properties: {
                    content: "Page with styled component",
                    name: "description"
                },
                tag: "meta"
            },
            {
                properties: { content: "Default Author", name: "author" },
                tag: "meta"
            },
            {
                properties: {},
                tag: "style",
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matcher
                textContent: expect.stringMatching(
                    /^\.styled\[data-astro-cid-\w+\]\{color:red\}\n?$/
                )
            }
        ]);
    });

    test("component outside <head> renders meta tags in body, not head", async () => {
        const response = await app.render(
            new Request("https://example.com/outside-head")
        );
        const html = await response.text();

        // No meta tags in <head>
        expect(extractMeta(html)).toEqual([]);

        // The tags render in <body> instead
        expect(query(html, "body > title, body > meta")).toEqual([
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

import type { TestApp } from "@inox-tools/astro-tests/astroFixture";

import testAdapter from "@inox-tools/astro-tests/testAdapter";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../src/index.ts";
import { extractHeadElements, extractMeta } from "../../utils/html-parse.ts";
import { isolatedFixture } from "../../utils/isolated-fixture.ts";

const { cleanup, fixture } = await isolatedFixture("basic", {
    adapter: testAdapter(),
    output: "server"
});

const config = {
    integrations: [pagemeta()]
};

afterAll(() => cleanup());

describe("SSR / dev server", () => {
    let devServer: Awaited<ReturnType<typeof fixture.startDevServer>>;

    beforeAll(async () => {
        devServer = await fixture.startDevServer(config);
    });

    afterAll(async () => {
        await devServer.stop();
    });

    test("injects title and description meta tags", async () => {
        const response = await fixture.fetch("/");
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
            }
        ]);
    });

    test("page without metadata() passes through unmodified", async () => {
        const response = await fixture.fetch("/no-meta");
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" }
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

    test("multiple metadata calls merge metadata", async () => {
        const response = await fixture.fetch("/override");
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            {
                properties: { text: "Overridden Title - Site Name" },
                tag: "title"
            },
            {
                properties: {
                    content: "Overridden description",
                    name: "description"
                },
                tag: "meta"
            },
            {
                properties: { content: "Initial Author", name: "author" },
                tag: "meta"
            }
        ]);
    });

    test("metadata overrides template title and preserves other template meta", async () => {
        const response = await fixture.fetch("/template-metadata");
        const html = await response.text();
        const headMeta = extractMeta(html);

        // metadata overrides template title, adds description
        // Template's generator meta is preserved
        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            {
                properties: { content: "Astro", name: "generator" },
                tag: "meta"
            },
            { properties: { text: "Title from metadata" }, tag: "title" },
            {
                properties: {
                    content: "Description from metadata",
                    name: "description"
                },
                tag: "meta"
            }
        ]);
    });

    test("rehype-meta creates head element if missing", async () => {
        const response = await fixture.fetch("/no-head");
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { text: "Title for Headless Page" }, tag: "title" },
            {
                properties: {
                    content: "Description for headless page",
                    name: "description"
                },
                tag: "meta"
            }
        ]);
    });

    // Template metadata that rehype-meta manages (like <title>) cannot be
    // removed via metadata — only replaced with a truthy value. Even
    // explicitly setting title to false doesn't remove the template's
    // <title>. There's no way to negate a template tag short of opting out
    // entirely with metadata(Astro, false), which skips everything.
    test("setting title: false does not remove template title", async () => {
        const response = await fixture.fetch("/template-title-only");
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            // Template title survives despite metadata({ title: false })
            { properties: { text: "Template Title" }, tag: "title" },
            {
                properties: {
                    content: "Description from metadata",
                    name: "description"
                },
                tag: "meta"
            }
        ]);
    });

    // Documented limitation: hardcoded template tags are not inputs to
    // rehype-meta's dependent-key logic. A template <meta name="author">
    // doesn't feed into copyright generation because rehype-meta never sees it.
    test("hardcoded template author does not feed into rehype-meta copyright", async () => {
        const response = await fixture.fetch("/copyright-wrinkle");
        const html = await response.text();
        const headMeta = extractMeta(html);

        // Template author is preserved
        expect(headMeta).toContainEqual({
            properties: { content: "Arundhati Roy", name: "author" },
            tag: "meta"
        });

        // But no copyright meta is generated — rehype-meta doesn't see
        // the template's author value, so copyright: true is a no-op
        const copyrightMeta = headMeta.filter(
            (m) => m.tag === "meta" && m.properties["name"] === "copyright"
        );
        expect(copyrightMeta).toHaveLength(0);
    });

    test("Astro-injected styles survive rehype processing", async () => {
        const response = await fixture.fetch("/with-styled-component");
        const html = await response.text();

        // Full head contents: Astro-injected style + Vite dev scripts
        // coexist with middleware-injected meta tags
        const headElements = extractHeadElements(html);
        expect(headElements).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
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
            },
            { properties: {}, tag: "title", textContent: "Styled Page" },
            {
                properties: {
                    content: "Page with styled component",
                    name: "description"
                },
                tag: "meta"
            }
        ]);
    });
});

describe("SSR / build", () => {
    let app: TestApp;

    beforeAll(async () => {
        await fixture.build(config);
        app = await fixture.loadTestAdapterApp();
    });

    test("injects title and description meta tags", async () => {
        const response = await app.render(new Request("https://example.com/"));
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
            }
        ]);
    });

    test("page without metadata() passes through unmodified", async () => {
        const response = await app.render(
            new Request("https://example.com/no-meta")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" }
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

    test("multiple metadata calls merge metadata", async () => {
        const response = await app.render(
            new Request("https://example.com/override")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            {
                properties: { text: "Overridden Title - Site Name" },
                tag: "title"
            },
            {
                properties: {
                    content: "Overridden description",
                    name: "description"
                },
                tag: "meta"
            },
            {
                properties: { content: "Initial Author", name: "author" },
                tag: "meta"
            }
        ]);
    });

    test("metadata overrides template title and preserves other template meta", async () => {
        const response = await app.render(
            new Request("https://example.com/template-metadata")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        // metadata overrides template title, adds description
        // Template's generator meta is preserved
        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            {
                properties: { content: "Astro", name: "generator" },
                tag: "meta"
            },
            { properties: { text: "Title from metadata" }, tag: "title" },
            {
                properties: {
                    content: "Description from metadata",
                    name: "description"
                },
                tag: "meta"
            }
        ]);
    });

    test("rehype-meta creates head element if missing", async () => {
        const response = await app.render(
            new Request("https://example.com/no-head")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { text: "Title for Headless Page" }, tag: "title" },
            {
                properties: {
                    content: "Description for headless page",
                    name: "description"
                },
                tag: "meta"
            }
        ]);
    });

    test("setting title: false does not remove template title", async () => {
        const response = await app.render(
            new Request("https://example.com/template-title-only")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "Template Title" }, tag: "title" },
            {
                properties: {
                    content: "Description from metadata",
                    name: "description"
                },
                tag: "meta"
            }
        ]);
    });

    test("hardcoded template author does not feed into rehype-meta copyright", async () => {
        const response = await app.render(
            new Request("https://example.com/copyright-wrinkle")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toContainEqual({
            properties: { content: "Arundhati Roy", name: "author" },
            tag: "meta"
        });

        const copyrightMeta = headMeta.filter(
            (m) => m.tag === "meta" && m.properties["name"] === "copyright"
        );
        expect(copyrightMeta).toHaveLength(0);
    });

    test("Astro-injected styles survive rehype processing", async () => {
        const response = await app.render(
            new Request("https://example.com/with-styled-component")
        );
        const html = await response.text();

        // Full head contents: Astro-injected inline style coexists
        // with middleware-injected meta tags (no Vite scripts in build)
        const headElements = extractHeadElements(html);
        expect(headElements).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            {
                properties: {},
                tag: "style",
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest asymmetric matcher
                textContent: expect.stringMatching(
                    /^\.styled\[data-astro-cid-\w+\]\{color:red\}\n?$/
                )
            },
            { properties: {}, tag: "title", textContent: "Styled Page" },
            {
                properties: {
                    content: "Page with styled component",
                    name: "description"
                },
                tag: "meta"
            }
        ]);
    });
});

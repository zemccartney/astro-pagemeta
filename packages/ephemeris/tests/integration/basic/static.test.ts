import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../src/index.ts";
import { extractMeta } from "../../utils/html-parse.ts";
import { isolatedFixture } from "../../utils/isolated-fixture.ts";

const { cleanup, fixture } = await isolatedFixture("basic");

const config = {
    integrations: [pagemeta()]
};

afterAll(() => cleanup());

describe("static / dev server", () => {
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

    test("setting title: false does not remove template title", async () => {
        const response = await fixture.fetch("/template-title-only");
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
});

describe("static / build", () => {
    beforeAll(async () => {
        await fixture.build(config);
    });

    test("injects title and description meta tags", async () => {
        const html = await fixture.readFile("/index.html");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
        const headMeta = extractMeta(html!);

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
        const html = await fixture.readFile("/no-meta/index.html");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
        const headMeta = extractMeta(html!);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" }
        ]);
    });

    test("injects complex metadata with OG and Twitter tags", async () => {
        const html = await fixture.readFile("/complex/index.html");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
        const headMeta = extractMeta(html!);

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
        const html = await fixture.readFile("/override/index.html");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
        const headMeta = extractMeta(html!);

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
        const html = await fixture.readFile("/template-metadata/index.html");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
        const headMeta = extractMeta(html!);

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
        const html = await fixture.readFile("/no-head/index.html");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
        const headMeta = extractMeta(html!);

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
        const html = await fixture.readFile("/template-title-only/index.html");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
        const headMeta = extractMeta(html!);

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
});

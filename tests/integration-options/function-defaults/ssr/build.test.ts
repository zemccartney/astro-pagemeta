import type { TestApp } from "@inox-tools/astro-tests/astroFixture";

import testAdapter from "@inox-tools/astro-tests/testAdapter";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../../src/index.ts";
import { extractMeta } from "../../../utils/extract-meta.ts";
import { isolatedFixture } from "../../../utils/isolated-fixture.ts";

const { cleanup, fixture } = await isolatedFixture(
    new URL("../../../fixtures/function-defaults/", import.meta.url),
    { adapter: testAdapter(), output: "server" }
);

const config = {
    integrations: [
        pagemeta({
            defaults: (ctx) => ({
                author: "Function Author",
                description: `Page at ${ctx.url.pathname}`,
                title: `${ctx.routePattern} - ${ctx.site?.hostname ?? "Unknown"}`
            })
        })
    ],
    site: "https://example.com"
};

describe("function-defaults / SSR / build", () => {
    let app: TestApp;

    beforeAll(async () => {
        await fixture.build(config);
        app = await fixture.loadTestAdapterApp();
    });

    afterAll(() => cleanup());

    test("applies defaults to page without setPagemeta()", async () => {
        const response = await app.render(new Request("https://example.com/"));
        expect(extractMeta(await response.text())).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "/ - example.com" }, tag: "title" },
            {
                properties: { content: "Page at /", name: "description" },
                tag: "meta"
            },
            {
                properties: { content: "Function Author", name: "author" },
                tag: "meta"
            }
        ]);
    });

    test("page-level metadata overrides defaults", async () => {
        const response = await app.render(
            new Request("https://example.com/override")
        );
        expect(extractMeta(await response.text())).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "Overridden Title" }, tag: "title" },
            {
                properties: {
                    content: "Overridden description",
                    name: "description"
                },
                tag: "meta"
            },
            {
                properties: { content: "Function Author", name: "author" },
                tag: "meta"
            }
        ]);
    });

    test("metadata: false skips all defaults", async () => {
        const response = await app.render(
            new Request("https://example.com/opt-out")
        );
        expect(extractMeta(await response.text())).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" }
        ]);
    });

    test("function can access routePattern for dynamic routes", async () => {
        const response = await app.render(
            new Request("https://example.com/test-page")
        );
        expect(extractMeta(await response.text())).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "/[slug] - example.com" }, tag: "title" },
            {
                properties: {
                    content: "Page at /test-page",
                    name: "description"
                },
                tag: "meta"
            },
            {
                properties: { content: "Function Author", name: "author" },
                tag: "meta"
            }
        ]);
    });

    test("function defaults override template title", async () => {
        const response = await app.render(
            new Request("https://example.com/template-defaults")
        );
        expect(extractMeta(await response.text())).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            {
                properties: { text: "/template-defaults - example.com" },
                tag: "title"
            },
            {
                properties: {
                    content: "Page at /template-defaults",
                    name: "description"
                },
                tag: "meta"
            },
            {
                properties: { content: "Function Author", name: "author" },
                tag: "meta"
            }
        ]);
    });

    test("full cascade: setPagemeta > function defaults > template", async () => {
        const response = await app.render(
            new Request("https://example.com/full-cascade")
        );

        // All 3 sources contribute:
        // - Template: charset, generator, og:site_name (preserved)
        // - Function defaults: author, description (using pathname)
        // - setPagemeta: title (overrides function default)
        //
        // Template metadata survives because:
        // - generator: rehype-meta doesn't manage this tag
        // - og:site_name: rehype-meta manages it, but we didn't set it
        expect(extractMeta(await response.text())).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            {
                properties: { content: "Astro", name: "generator" },
                tag: "meta"
            },
            {
                properties: {
                    content: "Template Site Name",
                    property: "og:site_name"
                },
                tag: "meta"
            },
            { properties: { text: "Title from setPagemeta" }, tag: "title" },
            {
                properties: {
                    content: "Page at /full-cascade",
                    name: "description"
                },
                tag: "meta"
            },
            {
                properties: { content: "Function Author", name: "author" },
                tag: "meta"
            }
        ]);
    });
});

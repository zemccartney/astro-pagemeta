import type { TestApp } from "@inox-tools/astro-tests/astroFixture";

import { loadFixture } from "@inox-tools/astro-tests/astroFixture";
import testAdapter from "@inox-tools/astro-tests/testAdapter";
import { beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../../src/index.ts";
import { extractMeta } from "../../../utils/extract-meta.ts";

const fixture = await loadFixture({
    adapter: testAdapter(),
    root: "./fixture"
});

const config = {
    integrations: [
        pagemeta({
            defaults: {
                author: "Default Author",
                description: "Default site description",
                title: "Default Title"
            }
        })
    ]
};

describe("static-defaults / SSR / build", () => {
    let app: TestApp;

    beforeAll(async () => {
        await fixture.build(config);
        app = await fixture.loadTestAdapterApp();
    });

    test("applies defaults to page without setPagemeta()", async () => {
        const response = await app.render(new Request("https://example.com/"));
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "Default Title" }, tag: "title" },
            {
                properties: {
                    content: "Default site description",
                    name: "description"
                },
                tag: "meta"
            },
            {
                properties: {
                    content: "Default Author",
                    name: "author"
                },
                tag: "meta"
            }
        ]);
    });

    test("page-level metadata overrides defaults", async () => {
        const response = await app.render(
            new Request("https://example.com/override")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
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
                properties: {
                    content: "Default Author",
                    name: "author"
                },
                tag: "meta"
            }
        ]);
    });

    test("metadata: false skips all defaults", async () => {
        const response = await app.render(
            new Request("https://example.com/opt-out")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" }
        ]);
    });

    test("defaults override template title", async () => {
        const response = await app.render(
            new Request("https://example.com/template-defaults")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        // Default title replaces template title
        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "Default Title" }, tag: "title" },
            {
                properties: {
                    content: "Default site description",
                    name: "description"
                },
                tag: "meta"
            },
            {
                properties: {
                    content: "Default Author",
                    name: "author"
                },
                tag: "meta"
            }
        ]);
    });

    test("full cascade: setPagemeta > defaults > template", async () => {
        const response = await app.render(
            new Request("https://example.com/full-cascade")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        // All 3 sources contribute:
        // - Template: charset, generator, og:site_name (preserved)
        // - Defaults: title (overrides template), author (added)
        // - setPagemeta: description (overrides defaults)
        //
        // Template metadata survives because:
        // - generator: rehype-meta doesn't manage this tag
        // - og:site_name: rehype-meta manages it, but we didn't set it
        expect(headMeta).toEqual([
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
            { properties: { text: "Default Title" }, tag: "title" },
            {
                properties: {
                    content: "Description from setPagemeta",
                    name: "description"
                },
                tag: "meta"
            },
            {
                properties: {
                    content: "Default Author",
                    name: "author"
                },
                tag: "meta"
            }
        ]);
    });
});

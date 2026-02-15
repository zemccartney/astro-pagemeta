import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../../src/index.ts";
import { extractMeta } from "../../../utils/extract-meta.ts";
import { isolatedFixture } from "../../../utils/isolated-fixture.ts";

const { cleanup, fixture } = await isolatedFixture(
    new URL("../../../fixtures/static-defaults/", import.meta.url)
);

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

describe("static-defaults / static / build", () => {
    beforeAll(async () => {
        await fixture.build(config);
    });

    afterAll(() => cleanup());

    test("applies defaults to page without setPagemeta()", async () => {
        const html = await fixture.readFile("/index.html");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
        const headMeta = extractMeta(html!);

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
        const html = await fixture.readFile("/override/index.html");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
        const headMeta = extractMeta(html!);

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
        const html = await fixture.readFile("/opt-out/index.html");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
        const headMeta = extractMeta(html!);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" }
        ]);
    });

    test("defaults override template title", async () => {
        const html = await fixture.readFile("/template-defaults/index.html");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
        const headMeta = extractMeta(html!);

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
        const html = await fixture.readFile("/full-cascade/index.html");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
        const headMeta = extractMeta(html!);

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

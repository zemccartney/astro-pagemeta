import type { TestApp } from "@inox-tools/astro-tests/astroFixture";

import testAdapter from "@inox-tools/astro-tests/testAdapter";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../../src/index.ts";
import { extractMeta } from "../../../utils/extract-meta.ts";
import { isolatedFixture } from "../../../utils/isolated-fixture.ts";

const { cleanup, fixture } = await isolatedFixture(
    new URL("../../../fixtures/i18n-fallback/", import.meta.url),
    {
        adapter: testAdapter(),
        i18n: {
            defaultLocale: "en",
            fallback: { fr: "en" },
            locales: ["en", "fr"],
            routing: {
                fallbackType: "rewrite",
                prefixDefaultLocale: false
            }
        },
        output: "server"
    }
);

const config = {
    integrations: [pagemeta()]
};

describe("i18n-fallback / SSR / build", () => {
    let app: TestApp;

    beforeAll(async () => {
        await fixture.build(config);
        app = await fixture.loadTestAdapterApp();
    });

    afterAll(() => cleanup());

    test("default locale page gets meta tags", async () => {
        const response = await app.render(new Request("https://example.com/"));
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "English Page" }, tag: "title" },
            {
                properties: {
                    content: "English page description",
                    name: "description"
                },
                tag: "meta"
            }
        ]);
    });

    test("fallback locale route gets meta tags", async () => {
        const response = await app.render(
            new Request("https://example.com/fr/")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "English Page" }, tag: "title" },
            {
                properties: {
                    content: "English page description",
                    name: "description"
                },
                tag: "meta"
            }
        ]);
    });
});

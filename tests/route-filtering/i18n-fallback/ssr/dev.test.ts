import { loadFixture } from "@inox-tools/astro-tests/astroFixture";
import testAdapter from "@inox-tools/astro-tests/testAdapter";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../../src/index.ts";
import { extractMeta } from "../../../utils/extract-meta.ts";

const fixture = await loadFixture({
    adapter: testAdapter(),
    root: "./fixture"
});

const config = {
    integrations: [pagemeta()]
};

describe("i18n-fallback / SSR / dev server", () => {
    let devServer: Awaited<ReturnType<typeof fixture.startDevServer>>;

    beforeAll(async () => {
        devServer = await fixture.startDevServer(config);
    });

    afterAll(async () => {
        await devServer.stop();
    });

    test("default locale page gets meta tags", async () => {
        const response = await fixture.fetch("/");
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
        const response = await fixture.fetch("/fr/");
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

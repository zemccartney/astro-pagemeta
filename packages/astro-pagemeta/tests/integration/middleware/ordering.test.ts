import type { TestApp } from "@inox-tools/astro-tests/astroFixture";

import testAdapter from "@inox-tools/astro-tests/testAdapter";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../src/index.ts";
import { extractMeta } from "../../utils/html-parse.ts";
import { isolatedFixture } from "../../utils/isolated-fixture.ts";

/**
 * Middleware ordering tests.
 *
 * The integration registers middleware with `order: "post"`, making it
 * the inner wrapper. User middleware is the outer wrapper:
 *
 *   User middleware (before next)  — metadata() sets defaults
 *     → next()
 *       Integration middleware (before next)
 *         → next()
 *           Page renders — metadata() overrides
 *         Integration after-next: reads final metadata, injects tags
 *       Returns processed Response
 *     User middleware (after next) — sees already-processed HTML
 *   Returns final Response
 *
 * This means user middleware can set defaults before next() that
 * pages can selectively override via metadata().
 */

const { cleanup, fixture } = await isolatedFixture("middleware/ordering", {
    adapter: testAdapter(),
    output: "server"
});

const config = {
    integrations: [pagemeta()]
};

afterAll(() => cleanup());

describe("middleware-ordering / SSR / dev server", () => {
    let devServer: Awaited<ReturnType<typeof fixture.startDevServer>>;

    beforeAll(async () => {
        devServer = await fixture.startDevServer(config);
    });

    afterAll(async () => {
        await devServer.stop();
    });

    test("page without metadata gets middleware defaults", async () => {
        const response = await fixture.fetch("/without-meta");
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "Middleware Default Title" }, tag: "title" },
            {
                properties: {
                    content: "Middleware default description",
                    name: "description"
                },
                tag: "meta"
            }
        ]);
    });

    test("page with full override gets page metadata", async () => {
        const response = await fixture.fetch("/with-override");
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "Page Override Title" }, tag: "title" },
            {
                properties: {
                    content: "Page override description",
                    name: "description"
                },
                tag: "meta"
            }
        ]);
    });

    test("page with partial override merges with middleware defaults", async () => {
        const response = await fixture.fetch("/partial-override");
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "Page Title Only" }, tag: "title" },
            {
                properties: {
                    content: "Middleware default description",
                    name: "description"
                },
                tag: "meta"
            }
        ]);
    });
});

describe("middleware-ordering / SSR / build", () => {
    let app: TestApp;

    beforeAll(async () => {
        await fixture.build(config);
        app = await fixture.loadTestAdapterApp();
    });

    test("page without metadata gets middleware defaults", async () => {
        const response = await app.render(
            new Request("https://example.com/without-meta")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "Middleware Default Title" }, tag: "title" },
            {
                properties: {
                    content: "Middleware default description",
                    name: "description"
                },
                tag: "meta"
            }
        ]);
    });

    test("page with full override gets page metadata", async () => {
        const response = await app.render(
            new Request("https://example.com/with-override")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "Page Override Title" }, tag: "title" },
            {
                properties: {
                    content: "Page override description",
                    name: "description"
                },
                tag: "meta"
            }
        ]);
    });

    test("page with partial override merges with middleware defaults", async () => {
        const response = await app.render(
            new Request("https://example.com/partial-override")
        );
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "Page Title Only" }, tag: "title" },
            {
                properties: {
                    content: "Middleware default description",
                    name: "description"
                },
                tag: "meta"
            }
        ]);
    });
});

import type { TestApp } from "@inox-tools/astro-tests/astroFixture";

import testAdapter from "@inox-tools/astro-tests/testAdapter";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../src/index.ts";
import { extractMeta } from "../utils/html-parse.ts";
import { isolatedFixture } from "../utils/isolated-fixture.ts";

describe("custom-meta / SSR", async () => {
    const { cleanup, fixture } = await isolatedFixture("custom-meta", {
        adapter: testAdapter(),
        output: "server"
    });

    const config = {
        integrations: [pagemeta()]
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

        test("injects custom meta tags", async () => {
            const response = await fixture.fetch("/");
            const html = await response.text();
            const headMeta = extractMeta(html);

            expect(headMeta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                { properties: { text: "Custom Meta Test" }, tag: "title" },
                {
                    properties: { content: "Astro", name: "generator" },
                    tag: "meta"
                },
                {
                    properties: {
                        content: "index, follow",
                        name: "robots"
                    },
                    tag: "meta"
                }
            ]);
        });

        test("replaces existing template meta tag", async () => {
            const response = await fixture.fetch("/template-override");
            const html = await response.text();
            const headMeta = extractMeta(html);

            // Template <meta name="robots" content="index, follow"> replaced in-place
            expect(headMeta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                {
                    properties: {
                        content: "noindex, nofollow",
                        name: "robots"
                    },
                    tag: "meta"
                },
                {
                    properties: { text: "Template Override Test" },
                    tag: "title"
                }
            ]);
        });

        test("deep merges custom across multiple setPagemeta calls", async () => {
            const response = await fixture.fetch("/merge-calls");
            const html = await response.text();
            const headMeta = extractMeta(html);

            // generator preserved from first call, robots overridden by second,
            // viewport added by second
            expect(headMeta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                { properties: { text: "Merge Calls Test" }, tag: "title" },
                {
                    properties: { content: "Astro", name: "generator" },
                    tag: "meta"
                },
                {
                    properties: { content: "noindex", name: "robots" },
                    tag: "meta"
                },
                {
                    properties: {
                        content: "width=device-width",
                        name: "viewport"
                    },
                    tag: "meta"
                }
            ]);
        });
    });

    describe("build", () => {
        let app: TestApp;

        beforeAll(async () => {
            await fixture.build(config);
            app = await fixture.loadTestAdapterApp();
        });

        test("injects custom meta tags", async () => {
            const response = await app.render(
                new Request("https://example.com/")
            );
            const html = await response.text();
            const headMeta = extractMeta(html);

            expect(headMeta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                { properties: { text: "Custom Meta Test" }, tag: "title" },
                {
                    properties: { content: "Astro", name: "generator" },
                    tag: "meta"
                },
                {
                    properties: {
                        content: "index, follow",
                        name: "robots"
                    },
                    tag: "meta"
                }
            ]);
        });

        test("replaces existing template meta tag", async () => {
            const response = await app.render(
                new Request("https://example.com/template-override")
            );
            const html = await response.text();
            const headMeta = extractMeta(html);

            expect(headMeta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                {
                    properties: {
                        content: "noindex, nofollow",
                        name: "robots"
                    },
                    tag: "meta"
                },
                {
                    properties: { text: "Template Override Test" },
                    tag: "title"
                }
            ]);
        });

        test("deep merges custom across multiple setPagemeta calls", async () => {
            const response = await app.render(
                new Request("https://example.com/merge-calls")
            );
            const html = await response.text();
            const headMeta = extractMeta(html);

            expect(headMeta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                { properties: { text: "Merge Calls Test" }, tag: "title" },
                {
                    properties: { content: "Astro", name: "generator" },
                    tag: "meta"
                },
                {
                    properties: { content: "noindex", name: "robots" },
                    tag: "meta"
                },
                {
                    properties: {
                        content: "width=device-width",
                        name: "viewport"
                    },
                    tag: "meta"
                }
            ]);
        });
    });
});

describe("custom-meta with defaults / SSR", async () => {
    const { cleanup, fixture } = await isolatedFixture("custom-meta", {
        adapter: testAdapter(),
        output: "server"
    });

    const config = {
        integrations: [
            pagemeta({
                defaults: {
                    custom: {
                        generator: "Default Generator",
                        robots: "index"
                    }
                }
            })
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

        test("defaults custom applies when no setPagemeta()", async () => {
            const response = await fixture.fetch("/defaults-only");
            const html = await response.text();
            const headMeta = extractMeta(html);

            expect(headMeta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                {
                    properties: {
                        content: "Default Generator",
                        name: "generator"
                    },
                    tag: "meta"
                },
                {
                    properties: { content: "index", name: "robots" },
                    tag: "meta"
                }
            ]);
        });

        test("page custom deep-merges with defaults custom", async () => {
            const response = await fixture.fetch("/defaults-merge");
            const html = await response.text();
            const headMeta = extractMeta(html);

            // Page overrides generator, adds viewport; defaults' robots preserved
            expect(headMeta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                {
                    properties: {
                        content: "Custom Generator",
                        name: "generator"
                    },
                    tag: "meta"
                },
                {
                    properties: { content: "index", name: "robots" },
                    tag: "meta"
                },
                {
                    properties: {
                        content: "width=device-width",
                        name: "viewport"
                    },
                    tag: "meta"
                }
            ]);
        });
    });
});

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../src/index.ts";
import { extractMeta } from "../utils/html-parse.ts";
import { isolatedFixture } from "../utils/isolated-fixture.ts";

describe("custom-meta / static", async () => {
    const { cleanup, fixture } = await isolatedFixture("custom-meta");

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
        beforeAll(async () => {
            await fixture.build(config);
        });

        test("injects custom meta tags", async () => {
            const html = await fixture.readFile("/index.html");
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
            const headMeta = extractMeta(html!);

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
            const html = await fixture.readFile(
                "/template-override/index.html"
            );
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
            const headMeta = extractMeta(html!);

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
            const html = await fixture.readFile("/merge-calls/index.html");
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
            const headMeta = extractMeta(html!);

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

describe("custom-meta with defaults / static", async () => {
    const { cleanup, fixture } = await isolatedFixture("custom-meta");

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

    describe("build", () => {
        beforeAll(async () => {
            await fixture.build(config);
        });

        test("defaults custom applies when no setPagemeta()", async () => {
            const html = await fixture.readFile("/defaults-only/index.html");
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
            const headMeta = extractMeta(html!);

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
            const html = await fixture.readFile("/defaults-merge/index.html");
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
            const headMeta = extractMeta(html!);

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

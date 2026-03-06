import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../src/index.ts";
import { extractMeta } from "../../utils/html-parse.ts";
import { isolatedFixture } from "../../utils/isolated-fixture.ts";

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
            const meta = extractMeta(html);

            expect(meta).toEqual([
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
            const meta = extractMeta(html);

            expect(meta).toEqual([
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
            const meta = extractMeta(html);

            expect(meta).toEqual([
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

        test("custom overrides rehype-meta managed OG tags via property attribute", async () => {
            const response = await fixture.fetch("/overrides-managed");
            const html = await response.text();
            const meta = extractMeta(html);

            expect(meta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                {
                    properties: {
                        content: "custom description",
                        name: "description"
                    },
                    tag: "meta"
                },
                {
                    properties: { content: "website", property: "og:type" },
                    tag: "meta"
                },
                {
                    properties: {
                        content: "rehype-meta description",
                        property: "og:description"
                    },
                    tag: "meta"
                },
                {
                    properties: {
                        content: "/path/to/my/image.png",
                        property: "og:image"
                    },
                    tag: "meta"
                },
                {
                    properties: {
                        content: "custom alt",
                        property: "og:image:alt"
                    },
                    tag: "meta"
                },
                {
                    properties: {
                        content: "1200",
                        property: "og:image:width"
                    },
                    tag: "meta"
                },
                {
                    properties: {
                        content: "99999",
                        property: "og:image:height"
                    },
                    tag: "meta"
                }
            ]);
        });

        test("custom title overrides rehype-meta computed title", async () => {
            const response = await fixture.fetch("/title-override");
            const html = await response.text();
            const meta = extractMeta(html);

            expect(meta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                { properties: { text: "Exact Title Override" }, tag: "title" }
            ]);
        });

        test("custom title creates title element when rehype-meta didn't set one", async () => {
            const response = await fixture.fetch("/title-create");
            const html = await response.text();
            const meta = extractMeta(html);

            expect(meta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                {
                    properties: {
                        content: "Has a description but title only via custom",
                        name: "description"
                    },
                    tag: "meta"
                },
                {
                    properties: { text: "Title From Custom Only" },
                    tag: "title"
                }
            ]);
        });

        test("custom canonical overrides rehype-meta computed canonical", async () => {
            const response = await fixture.fetch("/canonical-override");
            const html = await response.text();
            const meta = extractMeta(html);

            expect(meta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                {
                    properties: {
                        href: "https://canonical.example.com/override",
                        rel: ["canonical"]
                    },
                    tag: "link"
                },
                {
                    properties: { content: "website", property: "og:type" },
                    tag: "meta"
                },
                {
                    properties: {
                        content: "https://example.com/original-path",
                        property: "og:url"
                    },
                    tag: "meta"
                }
            ]);
        });

        test("custom canonical creates link element without origin/pathname", async () => {
            const response = await fixture.fetch("/canonical-create");
            const html = await response.text();
            const meta = extractMeta(html);

            expect(meta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                { properties: { text: "Page With Canonical" }, tag: "title" },
                {
                    properties: {
                        href: "https://example.com/my-page",
                        rel: ["canonical"]
                    },
                    tag: "link"
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
            const meta = extractMeta(html!);

            expect(meta).toEqual([
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
            const meta = extractMeta(html!);

            expect(meta).toEqual([
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
            const meta = extractMeta(html!);

            expect(meta).toEqual([
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

        test("custom overrides rehype-meta managed OG tags via property attribute", async () => {
            const html = await fixture.readFile(
                "/overrides-managed/index.html"
            );
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
            const meta = extractMeta(html!);

            expect(meta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                {
                    properties: {
                        content: "custom description",
                        name: "description"
                    },
                    tag: "meta"
                },
                {
                    properties: { content: "website", property: "og:type" },
                    tag: "meta"
                },
                {
                    properties: {
                        content: "rehype-meta description",
                        property: "og:description"
                    },
                    tag: "meta"
                },
                {
                    properties: {
                        content: "/path/to/my/image.png",
                        property: "og:image"
                    },
                    tag: "meta"
                },
                {
                    properties: {
                        content: "custom alt",
                        property: "og:image:alt"
                    },
                    tag: "meta"
                },
                {
                    properties: {
                        content: "1200",
                        property: "og:image:width"
                    },
                    tag: "meta"
                },
                {
                    properties: {
                        content: "99999",
                        property: "og:image:height"
                    },
                    tag: "meta"
                }
            ]);
        });

        test("custom title overrides rehype-meta computed title", async () => {
            const html = await fixture.readFile("/title-override/index.html");
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
            const meta = extractMeta(html!);

            expect(meta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                { properties: { text: "Exact Title Override" }, tag: "title" }
            ]);
        });

        test("custom title creates title element when rehype-meta didn't set one", async () => {
            const html = await fixture.readFile("/title-create/index.html");
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
            const meta = extractMeta(html!);

            expect(meta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                {
                    properties: {
                        content: "Has a description but title only via custom",
                        name: "description"
                    },
                    tag: "meta"
                },
                {
                    properties: { text: "Title From Custom Only" },
                    tag: "title"
                }
            ]);
        });

        test("custom canonical overrides rehype-meta computed canonical", async () => {
            const html = await fixture.readFile(
                "/canonical-override/index.html"
            );
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
            const meta = extractMeta(html!);

            expect(meta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                {
                    properties: {
                        href: "https://canonical.example.com/override",
                        rel: ["canonical"]
                    },
                    tag: "link"
                },
                {
                    properties: { content: "website", property: "og:type" },
                    tag: "meta"
                },
                {
                    properties: {
                        content: "https://example.com/original-path",
                        property: "og:url"
                    },
                    tag: "meta"
                }
            ]);
        });

        test("custom canonical creates link element without origin/pathname", async () => {
            const html = await fixture.readFile("/canonical-create/index.html");
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
            const meta = extractMeta(html!);

            expect(meta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                { properties: { text: "Page With Canonical" }, tag: "title" },
                {
                    properties: {
                        href: "https://example.com/my-page",
                        rel: ["canonical"]
                    },
                    tag: "link"
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
            const meta = extractMeta(html);

            expect(meta).toEqual([
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
            const meta = extractMeta(html);

            // Page overrides generator, adds viewport; defaults' robots preserved
            expect(meta).toEqual([
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
            const meta = extractMeta(html!);

            expect(meta).toEqual([
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
            const meta = extractMeta(html!);

            // Page overrides generator, adds viewport; defaults' robots preserved
            expect(meta).toEqual([
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

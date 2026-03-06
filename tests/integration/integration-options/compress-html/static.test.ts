import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../../src/index.ts";
import { extractJsonLd, extractMeta } from "../../../utils/html-parse.ts";
import { isolatedFixture } from "../../../utils/isolated-fixture.ts";

// Regex for matching ld+json script tags — uses [^>]* to handle Vite
// potentially reordering attributes in dev mode
const LD_JSON_SCRIPT_RE =
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/;

// compressHTML: true — rehype-minify-whitespace strips whitespace from
// injected tags, and JSON-LD is minified (single-line)
describe("compressHTML enabled", async () => {
    const { cleanup, fixture } = await isolatedFixture("json-ld", {
        compressHTML: true
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

        test("JSON-LD is minified (single-line)", async () => {
            const response = await fixture.fetch("/");
            const html = await response.text();

            const scriptMatch = LD_JSON_SCRIPT_RE.exec(html);
            expect(scriptMatch).not.toBeNull();
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- asserted above
            expect(scriptMatch![1]).not.toContain("\n");

            const jsonLd = extractJsonLd(html);
            expect(jsonLd).toEqual([
                {
                    "@context": "https://schema.org",
                    "@type": "WebPage",
                    name: "LD-JSON Test Page"
                }
            ]);
        });

        test("meta tags still correctly injected", async () => {
            const response = await fixture.fetch("/");
            const html = await response.text();
            const headMeta = extractMeta(html);

            expect(headMeta).toContainEqual({
                properties: { text: "LD-JSON Test Page" },
                tag: "title"
            });
        });
    });

    describe("build", () => {
        beforeAll(async () => {
            await fixture.build(config);
        });

        test("JSON-LD is minified (single-line)", async () => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
            const html = (await fixture.readFile("/index.html"))!;

            const scriptMatch = LD_JSON_SCRIPT_RE.exec(html);
            expect(scriptMatch).not.toBeNull();
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- asserted above
            expect(scriptMatch![1]).not.toContain("\n");

            const jsonLd = extractJsonLd(html);
            expect(jsonLd).toEqual([
                {
                    "@context": "https://schema.org",
                    "@type": "WebPage",
                    name: "LD-JSON Test Page"
                }
            ]);
        });
    });
});

// compressHTML: false — JSON-LD is pretty-printed
describe("compressHTML disabled", async () => {
    const { cleanup, fixture } = await isolatedFixture("json-ld", {
        compressHTML: false
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

        test("JSON-LD is pretty-printed (multi-line)", async () => {
            const response = await fixture.fetch("/");
            const html = await response.text();

            const jsonLd = extractJsonLd(html);
            expect(jsonLd).toEqual([
                {
                    "@context": "https://schema.org",
                    "@type": "WebPage",
                    name: "LD-JSON Test Page"
                }
            ]);

            const scriptMatch = LD_JSON_SCRIPT_RE.exec(html);
            expect(scriptMatch).not.toBeNull();
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- asserted above
            expect(scriptMatch![1]).toContain("\n");
        });
    });

    describe("build", () => {
        beforeAll(async () => {
            await fixture.build(config);
        });

        test("JSON-LD is pretty-printed (multi-line)", async () => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
            const html = (await fixture.readFile("/index.html"))!;

            const scriptMatch = LD_JSON_SCRIPT_RE.exec(html);
            expect(scriptMatch).not.toBeNull();
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- asserted above
            expect(scriptMatch![1]).toContain("\n");
        });
    });
});

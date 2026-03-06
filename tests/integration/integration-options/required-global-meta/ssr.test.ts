import type { TestApp } from "@inox-tools/astro-tests/astroFixture";

import testAdapter from "@inox-tools/astro-tests/testAdapter";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../../src/index.ts";
import { extractMeta } from "../../../utils/html-parse.ts";
import { isolatedFixture } from "../../../utils/isolated-fixture.ts";

// addRequiredGlobalMeta: true — injects charset and viewport when missing
describe("addRequiredGlobalMeta enabled", async () => {
    const { cleanup, fixture } = await isolatedFixture("required-global-meta", {
        adapter: testAdapter(),
        output: "server"
    });

    const config = {
        integrations: [
            pagemeta({
                addRequiredGlobalMeta: true,
                defaults: { title: "Default" }
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

        test("does not duplicate when both charset and viewport present", async () => {
            const response = await fixture.fetch("/");
            const html = await response.text();
            const headMeta = extractMeta(html);

            // Only one charset and one viewport — no duplicates
            const charsets = headMeta.filter(
                (m) => m.tag === "meta" && "charSet" in m.properties
            );
            const viewports = headMeta.filter(
                (m) => m.tag === "meta" && m.properties["name"] === "viewport"
            );
            expect(charsets).toHaveLength(1);
            expect(viewports).toHaveLength(1);
        });

        test("injects charset when missing", async () => {
            const response = await fixture.fetch("/no-charset");
            const html = await response.text();
            const headMeta = extractMeta(html);

            expect(headMeta).toContainEqual({
                properties: { charSet: "utf-8" },
                tag: "meta"
            });
        });

        test("injects viewport when missing", async () => {
            const response = await fixture.fetch("/no-viewport");
            const html = await response.text();
            const headMeta = extractMeta(html);

            expect(headMeta).toContainEqual({
                properties: {
                    content: "width=device-width",
                    name: "viewport"
                },
                tag: "meta"
            });
        });

        test("injects both charset and viewport when neither present", async () => {
            const response = await fixture.fetch("/neither");
            const html = await response.text();
            const headMeta = extractMeta(html);

            expect(headMeta).toContainEqual({
                properties: { charSet: "utf-8" },
                tag: "meta"
            });
            expect(headMeta).toContainEqual({
                properties: {
                    content: "width=device-width",
                    name: "viewport"
                },
                tag: "meta"
            });
        });

        test("injects into rehype-meta-created head (no head in template)", async () => {
            const response = await fixture.fetch("/no-head");
            const html = await response.text();
            const headMeta = extractMeta(html);

            expect(headMeta).toContainEqual({
                properties: { charSet: "utf-8" },
                tag: "meta"
            });
            expect(headMeta).toContainEqual({
                properties: {
                    content: "width=device-width",
                    name: "viewport"
                },
                tag: "meta"
            });
            // setPagemeta values still present
            expect(headMeta).toContainEqual({
                properties: { text: "No Head Page" },
                tag: "title"
            });
        });
    });

    describe("build", () => {
        let app: TestApp;

        beforeAll(async () => {
            await fixture.build(config);
            app = await fixture.loadTestAdapterApp();
        });

        test("does not duplicate when both charset and viewport present", async () => {
            const response = await app.render(
                new Request("https://example.com/")
            );
            const html = await response.text();
            const headMeta = extractMeta(html);

            const charsets = headMeta.filter(
                (m) => m.tag === "meta" && "charSet" in m.properties
            );
            const viewports = headMeta.filter(
                (m) => m.tag === "meta" && m.properties["name"] === "viewport"
            );
            expect(charsets).toHaveLength(1);
            expect(viewports).toHaveLength(1);
        });

        test("injects charset when missing", async () => {
            const response = await app.render(
                new Request("https://example.com/no-charset")
            );
            const html = await response.text();
            const headMeta = extractMeta(html);

            expect(headMeta).toContainEqual({
                properties: { charSet: "utf-8" },
                tag: "meta"
            });
        });

        test("injects viewport when missing", async () => {
            const response = await app.render(
                new Request("https://example.com/no-viewport")
            );
            const html = await response.text();
            const headMeta = extractMeta(html);

            expect(headMeta).toContainEqual({
                properties: {
                    content: "width=device-width",
                    name: "viewport"
                },
                tag: "meta"
            });
        });

        test("injects both when neither present", async () => {
            const response = await app.render(
                new Request("https://example.com/neither")
            );
            const html = await response.text();
            const headMeta = extractMeta(html);

            expect(headMeta).toContainEqual({
                properties: { charSet: "utf-8" },
                tag: "meta"
            });
            expect(headMeta).toContainEqual({
                properties: {
                    content: "width=device-width",
                    name: "viewport"
                },
                tag: "meta"
            });
        });

        test("injects into rehype-meta-created head", async () => {
            const response = await app.render(
                new Request("https://example.com/no-head")
            );
            const html = await response.text();
            const headMeta = extractMeta(html);

            expect(headMeta).toContainEqual({
                properties: { charSet: "utf-8" },
                tag: "meta"
            });
            expect(headMeta).toContainEqual({
                properties: {
                    content: "width=device-width",
                    name: "viewport"
                },
                tag: "meta"
            });
        });
    });
});

// addRequiredGlobalMeta: false (default) — no injection
describe("addRequiredGlobalMeta disabled (default)", async () => {
    const { cleanup, fixture } = await isolatedFixture("required-global-meta", {
        adapter: testAdapter(),
        output: "server"
    });

    const config = {
        integrations: [pagemeta({ defaults: { title: "Default" } })]
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

        test("does not inject charset or viewport into empty head", async () => {
            const response = await fixture.fetch("/neither");
            const html = await response.text();
            const headMeta = extractMeta(html);

            const charsets = headMeta.filter(
                (m) => m.tag === "meta" && "charSet" in m.properties
            );
            const viewports = headMeta.filter(
                (m) => m.tag === "meta" && m.properties["name"] === "viewport"
            );
            expect(charsets).toHaveLength(0);
            expect(viewports).toHaveLength(0);
        });

        test("page without setPagemeta does not get injected meta", async () => {
            const response = await fixture.fetch("/no-meta");
            const html = await response.text();
            const headMeta = extractMeta(html);

            // No setPagemeta + no defaults that trigger metadata = no processing
            // Only the default title from integration defaults
            expect(headMeta).toEqual([
                { properties: { text: "Default" }, tag: "title" }
            ]);
        });
    });

    describe("build", () => {
        let app: TestApp;

        beforeAll(async () => {
            await fixture.build(config);
            app = await fixture.loadTestAdapterApp();
        });

        test("does not inject charset or viewport into empty head", async () => {
            const response = await app.render(
                new Request("https://example.com/neither")
            );
            const html = await response.text();
            const headMeta = extractMeta(html);

            const charsets = headMeta.filter(
                (m) => m.tag === "meta" && "charSet" in m.properties
            );
            const viewports = headMeta.filter(
                (m) => m.tag === "meta" && m.properties["name"] === "viewport"
            );
            expect(charsets).toHaveLength(0);
            expect(viewports).toHaveLength(0);
        });
    });
});

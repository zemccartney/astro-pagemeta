import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../src/index.ts";
import { extractMeta } from "../../utils/html-parse.ts";
import { isolatedFixture } from "../../utils/isolated-fixture.ts";

describe("addRequiredGlobalMeta enabled / static", async () => {
    const { cleanup, fixture } = await isolatedFixture("required-global-meta");

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

            const charsets = headMeta.filter(
                (m) => m.tag === "meta" && "charSet" in m.properties
            );
            const viewports = headMeta.filter(
                (m) => m.tag === "meta" && m.properties["name"] === "viewport"
            );
            expect(charsets).toHaveLength(1);
            expect(viewports).toHaveLength(1);
        });

        test("injects both when neither present", async () => {
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
    });

    describe("build", () => {
        beforeAll(async () => {
            await fixture.build(config);
        });

        test("does not duplicate when both present", async () => {
            const html = await fixture.readFile("/index.html");
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
            const headMeta = extractMeta(html!);

            const charsets = headMeta.filter(
                (m) => m.tag === "meta" && "charSet" in m.properties
            );
            const viewports = headMeta.filter(
                (m) => m.tag === "meta" && m.properties["name"] === "viewport"
            );
            expect(charsets).toHaveLength(1);
            expect(viewports).toHaveLength(1);
        });

        test("injects both when neither present", async () => {
            const html = await fixture.readFile("/neither/index.html");
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
            const headMeta = extractMeta(html!);

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

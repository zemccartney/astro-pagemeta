import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../src/index.ts";
import { extractMeta } from "../../utils/html-parse.ts";
import { isolatedFixture } from "../../utils/isolated-fixture.ts";

// Demonstrates that the <Head> component works with static rendering —
// it isn't dependent on SSR. Static builds still have middleware and locals
// during build-time rendering, so resolveMetadata() works the same way.
const { cleanup, fixture } = await isolatedFixture("component");

const config = {
    integrations: [
        pagemeta({
            defaults: { author: "Default Author" },
            mode: "manual"
        })
    ]
};

afterAll(() => cleanup());

describe("component / static / dev server", () => {
    let devServer: Awaited<ReturnType<typeof fixture.startDevServer>>;

    beforeAll(async () => {
        devServer = await fixture.startDevServer(config);
    });

    afterAll(async () => {
        await devServer.stop();
    });

    test("injects title and description meta tags", async () => {
        const response = await fixture.fetch("/basic");
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "Test Page Title" }, tag: "title" },
            {
                properties: {
                    content: "Test page description",
                    name: "description"
                },
                tag: "meta"
            },
            {
                properties: { content: "Default Author", name: "author" },
                tag: "meta"
            }
        ]);
    });

    test("integration defaults apply via the component", async () => {
        const response = await fixture.fetch("/defaults-only");
        const html = await response.text();
        const headMeta = extractMeta(html);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            {
                properties: { content: "Default Author", name: "author" },
                tag: "meta"
            }
        ]);
    });
});

describe("component / static / build", () => {
    beforeAll(async () => {
        await fixture.build(config);
    });

    test("injects title and description meta tags", async () => {
        const html = await fixture.readFile("/basic/index.html");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
        const headMeta = extractMeta(html!);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            { properties: { text: "Test Page Title" }, tag: "title" },
            {
                properties: {
                    content: "Test page description",
                    name: "description"
                },
                tag: "meta"
            },
            {
                properties: { content: "Default Author", name: "author" },
                tag: "meta"
            }
        ]);
    });

    test("integration defaults apply via the component", async () => {
        const html = await fixture.readFile("/defaults-only/index.html");
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- test will fail if null
        const headMeta = extractMeta(html!);

        expect(headMeta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" },
            {
                properties: { content: "Default Author", name: "author" },
                tag: "meta"
            }
        ]);
    });
});

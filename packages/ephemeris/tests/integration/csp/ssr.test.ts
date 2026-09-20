import type { TestApp } from "@grepco/astro-fixture/astroFixture";

import testAdapter from "@grepco/astro-fixture/testAdapter";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../src/index.ts";
import {
    extractCspContent,
    extractInlineStyles,
    sha256Token
} from "../../utils/csp.ts";
import { extractJsonLd } from "../../utils/html-parse.ts";
import { isolatedFixture } from "../../utils/isolated-fixture.ts";

/**
 * SSR leg of the CSP interplay coverage — see static.test.ts for the
 * hash-verification rationale. Dev assertions are looser (Astro's dev
 * CSP wiring differs from build output); build assertions recompute
 * hashes from the final rendered HTML.
 */
const { cleanup, fixture } = await isolatedFixture("csp", {
    adapter: testAdapter(),
    output: "server" as const
});

const config = {
    integrations: [pagemeta()],
    security: { csp: true },
    site: "https://example.com"
};

afterAll(() => cleanup());

describe("csp / ssr / dev server", () => {
    let devServer: Awaited<ReturnType<typeof fixture.startDevServer>>;

    beforeAll(async () => {
        devServer = await fixture.startDevServer(config);
    });

    afterAll(async () => {
        await devServer.stop();
    });

    test("pagemeta works normally; astro emits no CSP in dev", async () => {
        const response = await fixture.fetch("/");
        const html = await response.text();

        // Verified against astro 6.4.8: dev emits neither the CSP header
        // nor the meta tag (dev serves unbundled modules — nothing to
        // hash). CSP is a build-output surface; the build tests below and
        // in static.test.ts carry the real assertions. Here we prove
        // enabling security.csp doesn't disturb pagemeta in dev.
        expect(response.headers.get("content-security-policy")).toBeNull();
        expect(extractCspContent(html)).toBeUndefined();
        expect(html).toContain("<title>CSP Page</title>");
        expect(extractJsonLd(html)).toContainEqual(
            expect.objectContaining({ "@type": "WebPage" })
        );
    });
});

describe("csp / ssr / build", () => {
    let app: TestApp;

    beforeAll(async () => {
        await fixture.build(config);
        app = await fixture.loadTestAdapterApp();
    });

    test("CSP header survives the pipeline with valid style hashes", async () => {
        const response = await app.render(new Request("https://example.com/"));
        const html = await response.text();

        const csp = response.headers.get("content-security-policy");
        expect(csp).toBeTruthy();
        expect(csp).toContain("style-src");

        const styles = extractInlineStyles(html);
        expect(styles.length).toBeGreaterThan(0);
        for (const style of styles) {
            expect(csp).toContain(sha256Token(style));
        }

        expect(html).toContain("<title>CSP Page</title>");
    });

    test("stale Content-Length is not carried onto the rewritten body", async () => {
        const response = await app.render(new Request("https://example.com/"));
        const html = await response.text();

        // Astro sets Content-Length on non-streamed on-demand responses;
        // pagemeta grows the body, so carrying the original value over
        // would make strict clients truncate the document. The middleware
        // must drop it (or it must match the actual byte length).
        const contentLength = response.headers.get("content-length");
        if (contentLength !== null) {
            expect(Number(contentLength)).toBe(
                new TextEncoder().encode(html).byteLength
            );
        }
    });
});

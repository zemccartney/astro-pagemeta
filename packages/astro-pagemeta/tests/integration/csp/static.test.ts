import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../../src/index.ts";
import {
    extractCspContent,
    extractInlineStyles,
    sha256Token
} from "../../utils/csp.ts";
import { extractJsonLd, extractMeta } from "../../utils/html-parse.ts";
import { isolatedFixture } from "../../utils/isolated-fixture.ts";

/**
 * Astro 6's `security.csp` injects a
 * `<meta http-equiv="content-security-policy">` whose script-src/style-src
 * directives carry hashes of the page's inline assets. Because pagemeta
 * re-parses and re-serializes the whole document, these tests recompute the
 * hashes from the FINAL html — if the pipeline alters one byte of hashed
 * content (e.g. via compressHTML minification, on by default), the hash
 * comparison fails. pagemeta's injected JSON-LD is a non-executable data
 * block, exempt from script-src by spec, so it needs no hash.
 */
const { cleanup, fixture } = await isolatedFixture("csp");

const config = {
    build: { inlineStylesheets: "always" as const },
    integrations: [pagemeta()],
    security: { csp: true },
    site: "https://example.com"
};

afterAll(() => cleanup());

describe("csp / static / build", () => {
    beforeAll(async () => {
        await fixture.build(config);
    });

    test("CSP meta survives the pipeline with valid style hashes", async () => {
        const html = await fixture.readFile("/index.html");
        expect(html).toBeTruthy();

        const csp = extractCspContent(html ?? "");
        expect(csp).toBeTruthy();
        expect(csp).toContain("style-src");

        const styles = extractInlineStyles(html ?? "");
        expect(styles.length).toBeGreaterThan(0);
        for (const style of styles) {
            expect(csp).toContain(sha256Token(style));
        }
    });

    test("pagemeta metadata and JSON-LD injected alongside CSP", async () => {
        const html = await fixture.readFile("/index.html");
        const meta = extractMeta(html ?? "");

        expect(meta).toContainEqual({
            properties: { text: "CSP Page" },
            tag: "title"
        });
        expect(meta).toContainEqual({
            properties: {
                content: "Verifying pagemeta coexists with Astro's CSP",
                name: "description"
            },
            tag: "meta"
        });

        const jsonLd = extractJsonLd(html ?? "");
        expect(jsonLd).toContainEqual(
            expect.objectContaining({ "@type": "WebPage" })
        );

        // The injected JSON-LD is a data block — assert Astro did NOT hash
        // it into script-src (nothing executable was added)
        const csp = extractCspContent(html ?? "") ?? "";
        const jsonLdTexts = [
            ...(html ?? "").matchAll(
                /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
            )
        ].map((m) => m[1] ?? "");
        expect(jsonLdTexts.length).toBeGreaterThan(0);
        for (const text of jsonLdTexts) {
            expect(csp).not.toContain(sha256Token(text));
        }
    });
});

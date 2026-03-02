import type { APIContext } from "astro";

import { describe, expect, test } from "vitest";

import {
    createPagemetaProcessor,
    isHtmlDocument,
    LOCALS_KEY,
    setPagemeta
} from "../../src/core.ts";
import { extractJsonLd, extractMeta } from "../utils/html-parse.ts";

const MINIMAL_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>`;

function mockContext(
    overrides: Partial<APIContext> = {}
): Readonly<APIContext> {
    return {
        locals: {},
        url: new URL("https://example.com/"),
        ...overrides
    } as unknown as Readonly<APIContext>;
}

describe("isHtmlDocument", () => {
    test("detects full document", () => {
        expect(isHtmlDocument("<!DOCTYPE html><html>")).toBe(true);
    });

    test("detects document with leading whitespace", () => {
        expect(isHtmlDocument("  \n<!doctype html><html>")).toBe(true);
    });

    test("rejects fragment", () => {
        expect(isHtmlDocument("<div>hello</div>")).toBe(false);
    });

    test("rejects empty string", () => {
        expect(isHtmlDocument("")).toBe(false);
    });
});

describe("setPagemeta", () => {
    test("stores metadata in locals via symbol", () => {
        const ctx = mockContext();
        setPagemeta(ctx, { title: "Hello" });
        // @ts-expect-error -- accessing via symbol
        expect(ctx.locals[LOCALS_KEY]).toEqual({ title: "Hello" });
    });

    test("merges multiple calls", () => {
        const ctx = mockContext();
        setPagemeta(ctx, { title: "Hello" });
        setPagemeta(ctx, { description: "World" });
        // @ts-expect-error -- accessing via symbol
        expect(ctx.locals[LOCALS_KEY]).toEqual({
            description: "World",
            title: "Hello"
        });
    });

    test("merges custom meta shallowly", () => {
        const ctx = mockContext();
        setPagemeta(ctx, { custom: { author: "Alice" } });
        setPagemeta(ctx, { custom: { robots: "noindex" } });
        // @ts-expect-error -- accessing via symbol
        expect(ctx.locals[LOCALS_KEY]).toEqual({
            custom: { author: "Alice", robots: "noindex" }
        });
    });

    test("false opt-out stores false", () => {
        const ctx = mockContext();
        setPagemeta(ctx, false);
        // @ts-expect-error -- accessing via symbol
        expect(ctx.locals[LOCALS_KEY]).toBe(false);
    });

    test("throws on null", () => {
        const ctx = mockContext();
        expect(() => {
            // @ts-expect-error -- testing invalid input
            // eslint-disable-next-line unicorn/no-null -- testing invalid input
            setPagemeta(ctx, null);
        }).toThrow("got null");
    });

    test("throws on string", () => {
        const ctx = mockContext();
        expect(() => {
            // @ts-expect-error -- testing invalid input
            setPagemeta(ctx, "bad");
        }).toThrow("got string");
    });
});

describe("createPagemetaProcessor", () => {
    describe("isPageRoute", () => {
        const processor = createPagemetaProcessor({
            addRequiredGlobalMeta: false,
            compressHTML: false,
            routePatterns: [/^\/$/, /^\/about\/?$/]
        });

        test("matches configured patterns", () => {
            expect(processor.isPageRoute("/")).toBe(true);
            expect(processor.isPageRoute("/about")).toBe(true);
            expect(processor.isPageRoute("/about/")).toBe(true);
        });

        test("rejects non-matching paths", () => {
            expect(processor.isPageRoute("/api/data")).toBe(false);
            expect(processor.isPageRoute("/other")).toBe(false);
        });
    });

    describe("resolvePagemeta", () => {
        test("returns undefined when no metadata set and no defaults", () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                routePatterns: []
            });
            const ctx = mockContext();
            expect(processor.resolvePagemeta(ctx)).toBeUndefined();
        });

        test("returns page metadata when set", () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                routePatterns: []
            });
            const ctx = mockContext();
            setPagemeta(ctx, { title: "My Page" });
            expect(processor.resolvePagemeta(ctx)).toEqual({
                title: "My Page"
            });
        });

        test("merges object defaults with page metadata", () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                defaults: { description: "Default desc", title: "Default" },
                routePatterns: []
            });
            const ctx = mockContext();
            setPagemeta(ctx, { title: "Override" });
            expect(processor.resolvePagemeta(ctx)).toEqual({
                description: "Default desc",
                title: "Override"
            });
        });

        test("calls function defaults with context", () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                defaults: (ctx) => ({
                    title: `Page: ${ctx.url.pathname}`
                }),
                routePatterns: []
            });
            const ctx = mockContext({
                url: new URL("https://example.com/about")
            });
            setPagemeta(ctx, { description: "About us" });
            expect(processor.resolvePagemeta(ctx)).toEqual({
                description: "About us",
                title: "Page: /about"
            });
        });

        test("returns undefined on false opt-out", () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                defaults: { title: "Default" },
                routePatterns: []
            });
            const ctx = mockContext();
            setPagemeta(ctx, false);
            expect(processor.resolvePagemeta(ctx)).toBeUndefined();
        });

        test("throws when function defaults returns non-object", () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                // @ts-expect-error -- testing invalid return type
                // eslint-disable-next-line unicorn/no-null -- testing invalid return type
                defaults: () => null,
                routePatterns: []
            });
            const ctx = mockContext();
            setPagemeta(ctx, { title: "Trigger resolve" });
            expect(() => processor.resolvePagemeta(ctx)).toThrow(
                "defaults function must return an object, got null"
            );
        });

        test("throws when function defaults returns string", () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                // @ts-expect-error -- testing invalid return type
                defaults: () => "invalid",
                routePatterns: []
            });
            const ctx = mockContext();
            setPagemeta(ctx, { title: "Trigger resolve" });
            expect(() => processor.resolvePagemeta(ctx)).toThrow(
                "defaults function must return an object, got string"
            );
        });

        test("throws when function defaults throws", () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                defaults: () => {
                    throw new Error("Intentional error in defaults");
                },
                routePatterns: []
            });
            const ctx = mockContext();
            setPagemeta(ctx, { title: "Trigger resolve" });
            expect(() => processor.resolvePagemeta(ctx)).toThrow(
                "Intentional error in defaults"
            );
        });

        test("merges custom meta from defaults and page", () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                defaults: { custom: { author: "Default Author" } },
                routePatterns: []
            });
            const ctx = mockContext();
            setPagemeta(ctx, { custom: { robots: "noindex" } });
            expect(processor.resolvePagemeta(ctx)).toEqual({
                custom: { author: "Default Author", robots: "noindex" }
            });
        });
    });

    describe("getHtmlProcessor", () => {
        test("injects title into HTML", async () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                routePatterns: []
            });

            const result = await processor
                .getHtmlProcessor({
                    metadata: { title: "Test Title" }
                })
                .process(MINIMAL_HTML);

            const meta = extractMeta(String(result));
            expect(meta).toContainEqual({
                properties: { text: "Test Title" },
                tag: "title"
            });
        });

        test("injects description meta tag", async () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                routePatterns: []
            });

            const result = await processor
                .getHtmlProcessor({
                    metadata: { description: "A test page" }
                })
                .process(MINIMAL_HTML);

            const meta = extractMeta(String(result));
            expect(meta).toContainEqual({
                properties: { content: "A test page", name: "description" },
                tag: "meta"
            });
        });

        test("injects custom meta with OG property attribute", async () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                routePatterns: []
            });

            const result = await processor
                .getHtmlProcessor({
                    metadata: {
                        custom: { "og:image": "https://example.com/img.png" }
                    }
                })
                .process(MINIMAL_HTML);

            const meta = extractMeta(String(result));
            expect(meta).toContainEqual({
                properties: {
                    content: "https://example.com/img.png",
                    property: "og:image"
                },
                tag: "meta"
            });
        });

        test("injects JSON-LD script", async () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                routePatterns: []
            });

            const result = await processor
                .getHtmlProcessor({
                    metadata: {
                        jsonLd: {
                            "@type": "WebPage",
                            name: "Test"
                        } as never
                    }
                })
                .process(MINIMAL_HTML);

            const jsonLd = extractJsonLd(String(result));
            expect(jsonLd).toHaveLength(1);
            expect(jsonLd[0]).toEqual({
                "@context": "https://schema.org",
                "@type": "WebPage",
                name: "Test"
            });
        });

        test("minifies JSON-LD when compressHTML is true", async () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: true,
                routePatterns: []
            });

            const result = await processor
                .getHtmlProcessor({
                    metadata: {
                        jsonLd: {
                            "@type": "WebPage",
                            name: "Test"
                        } as never
                    }
                })
                .process(MINIMAL_HTML);

            const html = String(result);
            // compressHTML should produce single-line JSON (no indentation)
            expect(html).toContain(
                '{"@context":"https://schema.org","@type":"WebPage","name":"Test"}'
            );
        });

        test("pretty-prints JSON-LD when compressHTML is false", async () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                routePatterns: []
            });

            const result = await processor
                .getHtmlProcessor({
                    metadata: {
                        jsonLd: {
                            "@type": "WebPage",
                            name: "Test"
                        } as never
                    }
                })
                .process(MINIMAL_HTML);

            const html = String(result);
            // Should contain indented JSON
            expect(html).toContain('"@context": "https://schema.org"');
        });

        test("adds required global meta when enabled", async () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: true,
                compressHTML: false,
                routePatterns: []
            });

            const bareHtml = `<!DOCTYPE html><html><head></head><body></body></html>`;
            const result = await processor
                .getHtmlProcessor({
                    metadata: { title: "Test" }
                })
                .process(bareHtml);

            const meta = extractMeta(String(result));
            expect(meta).toContainEqual({
                properties: { charSet: "utf-8" },
                tag: "meta"
            });
            expect(meta).toContainEqual({
                properties: { content: "width=device-width", name: "viewport" },
                tag: "meta"
            });
        });

        test("skips required global meta when already present", async () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: true,
                compressHTML: false,
                routePatterns: []
            });

            const result = await processor
                .getHtmlProcessor({
                    metadata: { title: "Test" }
                })
                .process(MINIMAL_HTML);

            const meta = extractMeta(String(result));
            const charsetTags = meta.filter(
                (m) => m.tag === "meta" && "charSet" in m.properties
            );
            // Should not duplicate — original charset is preserved
            expect(charsetTags).toHaveLength(1);
        });

        test("fragment mode returns head contents only", async () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                routePatterns: []
            });

            const result = await processor
                .getHtmlProcessor({
                    fragment: true,
                    metadata: { title: "Fragment Test" }
                })
                .process("<meta charset='utf-8'><title>Old</title>");

            const html = String(result);
            // Should NOT contain html/head/body wrappers
            expect(html).not.toContain("<html");
            expect(html).not.toContain("<head");
            expect(html).not.toContain("<body");
            // Should contain the title
            expect(html).toContain("Fragment Test");
        });

        test("canonical link injection", async () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                routePatterns: []
            });

            const result = await processor
                .getHtmlProcessor({
                    metadata: {
                        custom: {
                            "link:rel:canonical":
                                "https://example.com/canonical"
                        }
                    }
                })
                .process(MINIMAL_HTML);

            const meta = extractMeta(String(result));
            expect(meta).toContainEqual({
                properties: {
                    href: "https://example.com/canonical",
                    rel: ["canonical"]
                },
                tag: "link"
            });
        });
    });
});

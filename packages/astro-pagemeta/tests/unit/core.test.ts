import type { APIContext } from "astro";

import { describe, expect, test } from "vitest";

import {
    createPagemetaProcessor,
    isHtmlDocument,
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
    const processor = createPagemetaProcessor({
        addRequiredGlobalMeta: false,
        compressHTML: false,
        routePatterns: []
    });

    test("stores metadata", () => {
        const ctx = mockContext();
        setPagemeta(ctx, { title: "Hello" });
        expect(processor.resolvePagemeta(ctx)).toEqual({ title: "Hello" });
    });

    test("merges multiple calls", () => {
        const ctx = mockContext();
        setPagemeta(ctx, { title: "Hello" });
        setPagemeta(ctx, { description: "World" });
        expect(processor.resolvePagemeta(ctx)).toEqual({
            description: "World",
            title: "Hello"
        });
    });

    test("merges custom meta shallowly", () => {
        const ctx = mockContext();
        setPagemeta(ctx, { custom: { author: "Alice" } });
        setPagemeta(ctx, { custom: { robots: "noindex" } });
        expect(processor.resolvePagemeta(ctx)).toEqual({
            custom: { author: "Alice", robots: "noindex" }
        });
    });

    test("false opt-out stores false", () => {
        const ctx = mockContext();
        setPagemeta(ctx, false);
        expect(processor.resolvePagemeta(ctx)).toBeUndefined();
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

        test("adds required global meta via custom keys", async () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                routePatterns: []
            });

            const bareHtml = `<!DOCTYPE html><html><head></head><body></body></html>`;
            const result = await processor
                .getHtmlProcessor({
                    metadata: {
                        custom: {
                            "meta:charSet": "utf-8",
                            viewport: "width=device-width"
                        },
                        title: "Test"
                    }
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
                addRequiredGlobalMeta: false,
                compressHTML: false,
                routePatterns: []
            });

            const result = await processor
                .getHtmlProcessor({
                    metadata: {
                        custom: {
                            "meta:charSet": "utf-8",
                            viewport: "width=device-width"
                        },
                        title: "Test"
                    }
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

        describe("template interaction", () => {
            test("preserves existing template meta tags", async () => {
                const processor = createPagemetaProcessor({
                    addRequiredGlobalMeta: false,
                    compressHTML: false,
                    routePatterns: []
                });

                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="generator" content="Astro"></head><body></body></html>`;
                const result = await processor
                    .getHtmlProcessor({
                        metadata: {
                            description: "My page",
                            title: "My Title"
                        }
                    })
                    .process(html);

                const meta = extractMeta(String(result));
                expect(meta).toContainEqual({
                    properties: { content: "Astro", name: "generator" },
                    tag: "meta"
                });
                expect(meta).toContainEqual({
                    properties: { text: "My Title" },
                    tag: "title"
                });
            });

            test("overrides existing template title", async () => {
                const processor = createPagemetaProcessor({
                    addRequiredGlobalMeta: false,
                    compressHTML: false,
                    routePatterns: []
                });

                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Old</title></head><body></body></html>`;
                const result = await processor
                    .getHtmlProcessor({
                        metadata: { title: "New" }
                    })
                    .process(html);

                const meta = extractMeta(String(result));
                const titles = meta.filter((m) => m.tag === "title");
                expect(titles).toHaveLength(1);
                expect(titles[0]).toEqual({
                    properties: { text: "New" },
                    tag: "title"
                });
            });

            test("template title survives when title is false", async () => {
                const processor = createPagemetaProcessor({
                    addRequiredGlobalMeta: false,
                    compressHTML: false,
                    routePatterns: []
                });

                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Old</title></head><body></body></html>`;
                const result = await processor
                    .getHtmlProcessor({
                        metadata: { title: false as unknown as string }
                    })
                    .process(html);

                const meta = extractMeta(String(result));
                const titles = meta.filter((m) => m.tag === "title");
                expect(titles).toHaveLength(1);
                expect(titles[0]).toEqual({
                    properties: { text: "Old" },
                    tag: "title"
                });
            });

            test("creates head when document has none", async () => {
                const processor = createPagemetaProcessor({
                    addRequiredGlobalMeta: false,
                    compressHTML: false,
                    routePatterns: []
                });

                const html = `<!DOCTYPE html><html><body></body></html>`;
                const result = await processor
                    .getHtmlProcessor({
                        metadata: { title: "Injected" }
                    })
                    .process(html);

                const meta = extractMeta(String(result));
                expect(meta).toContainEqual({
                    properties: { text: "Injected" },
                    tag: "title"
                });
            });
        });

        describe("custom meta edge cases", () => {
            test("replaces existing template meta in-place", async () => {
                const processor = createPagemetaProcessor({
                    addRequiredGlobalMeta: false,
                    compressHTML: false,
                    routePatterns: []
                });

                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="robots" content="index"></head><body></body></html>`;
                const result = await processor
                    .getHtmlProcessor({
                        metadata: { custom: { robots: "noindex" } }
                    })
                    .process(html);

                const meta = extractMeta(String(result));
                const robotsTags = meta.filter(
                    (m) =>
                        m.tag === "meta" &&
                        "name" in m.properties &&
                        m.properties["name"] === "robots"
                );
                expect(robotsTags).toHaveLength(1);
                expect(robotsTags[0]).toEqual({
                    properties: { content: "noindex", name: "robots" },
                    tag: "meta"
                });
            });

            test("custom title creates title element when no rehype-meta title", async () => {
                const processor = createPagemetaProcessor({
                    addRequiredGlobalMeta: false,
                    compressHTML: false,
                    routePatterns: []
                });

                const result = await processor
                    .getHtmlProcessor({
                        metadata: { custom: { title: "Custom Title" } }
                    })
                    .process(MINIMAL_HTML);

                const meta = extractMeta(String(result));
                expect(meta).toContainEqual({
                    properties: { text: "Custom Title" },
                    tag: "title"
                });
            });

            test("custom canonical overrides template canonical", async () => {
                const processor = createPagemetaProcessor({
                    addRequiredGlobalMeta: false,
                    compressHTML: false,
                    routePatterns: []
                });

                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="canonical" href="https://example.com/old"></head><body></body></html>`;
                const result = await processor
                    .getHtmlProcessor({
                        metadata: {
                            custom: {
                                "link:rel:canonical": "https://example.com/new"
                            }
                        }
                    })
                    .process(html);

                const meta = extractMeta(String(result));
                const canonicals = meta.filter(
                    (m) =>
                        m.tag === "link" &&
                        Array.isArray(m.properties["rel"]) &&
                        (m.properties["rel"] as string[]).includes("canonical")
                );
                expect(canonicals).toHaveLength(1);
                expect(canonicals[0]).toEqual({
                    properties: {
                        href: "https://example.com/new",
                        rel: ["canonical"]
                    },
                    tag: "link"
                });
            });

            test("custom OG overrides rehype-meta computed OG", async () => {
                const processor = createPagemetaProcessor({
                    addRequiredGlobalMeta: false,
                    compressHTML: false,
                    routePatterns: []
                });

                // rehype-meta with og: true computes og:title from title
                const result = await processor
                    .getHtmlProcessor({
                        metadata: {
                            custom: { "og:title": "Override" },
                            og: true,
                            title: "Page Title"
                        }
                    })
                    .process(MINIMAL_HTML);

                const meta = extractMeta(String(result));
                const ogTitles = meta.filter(
                    (m) =>
                        m.tag === "meta" &&
                        "property" in m.properties &&
                        m.properties["property"] === "og:title"
                );
                // custom runs after rehype-meta, so it should replace
                expect(ogTitles).toHaveLength(1);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- length asserted above
                expect(ogTitles[0]!.properties["content"]).toBe("Override");
            });
        });

        describe("JSON-LD", () => {
            test("array wraps in @graph", async () => {
                const processor = createPagemetaProcessor({
                    addRequiredGlobalMeta: false,
                    compressHTML: false,
                    routePatterns: []
                });

                const result = await processor
                    .getHtmlProcessor({
                        metadata: {
                            jsonLd: [
                                { "@type": "Organization", name: "Org" },
                                { "@type": "WebSite", name: "Site" }
                            ] as never
                        }
                    })
                    .process(MINIMAL_HTML);

                const jsonLd = extractJsonLd(String(result));
                expect(jsonLd).toHaveLength(1);
                expect(jsonLd[0]).toEqual({
                    "@context": "https://schema.org",
                    "@graph": [
                        { "@type": "Organization", name: "Org" },
                        { "@type": "WebSite", name: "Site" }
                    ]
                });
            });

            test("template JSON-LD preserved alongside injected", async () => {
                const processor = createPagemetaProcessor({
                    addRequiredGlobalMeta: false,
                    compressHTML: false,
                    routePatterns: []
                });

                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[]}</script></head><body></body></html>`;
                const result = await processor
                    .getHtmlProcessor({
                        metadata: {
                            jsonLd: {
                                "@type": "Article",
                                headline: "Test"
                            } as never
                        }
                    })
                    .process(html);

                const jsonLd = extractJsonLd(String(result));
                expect(jsonLd).toHaveLength(2);
                expect(jsonLd).toContainEqual({
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    itemListElement: []
                });
                expect(jsonLd).toContainEqual({
                    "@context": "https://schema.org",
                    "@type": "Article",
                    headline: "Test"
                });
            });
        });

        describe("defaults cascade with HTML", () => {
            test("three-way cascade: defaults + page + template", async () => {
                const processor = createPagemetaProcessor({
                    addRequiredGlobalMeta: false,
                    compressHTML: false,
                    defaults: { title: "Default" },
                    routePatterns: []
                });

                const ctx = mockContext();
                setPagemeta(ctx, { description: "Page desc" });
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- setPagemeta guarantees metadata
                const metadata = processor.resolvePagemeta(ctx)!;

                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="generator" content="Astro"></head><body></body></html>`;
                const result = await processor
                    .getHtmlProcessor({ metadata })
                    .process(html);

                const meta = extractMeta(String(result));
                expect(meta).toContainEqual({
                    properties: { text: "Default" },
                    tag: "title"
                });
                expect(meta).toContainEqual({
                    properties: { content: "Page desc", name: "description" },
                    tag: "meta"
                });
                expect(meta).toContainEqual({
                    properties: { content: "Astro", name: "generator" },
                    tag: "meta"
                });
            });

            test("defaults override template title", async () => {
                const processor = createPagemetaProcessor({
                    addRequiredGlobalMeta: false,
                    compressHTML: false,
                    defaults: { title: "Default" },
                    routePatterns: []
                });

                // No page metadata — only defaults apply
                const ctx = mockContext();
                setPagemeta(ctx, {});
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- defaults guarantee metadata
                const metadata = processor.resolvePagemeta(ctx)!;

                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Template</title></head><body></body></html>`;
                const result = await processor
                    .getHtmlProcessor({ metadata })
                    .process(html);

                const meta = extractMeta(String(result));
                const titles = meta.filter((m) => m.tag === "title");
                expect(titles).toHaveLength(1);
                expect(titles[0]).toEqual({
                    properties: { text: "Default" },
                    tag: "title"
                });
            });
        });

        describe("addRequiredGlobalMeta combinations", () => {
            const REQUIRED_CUSTOM = {
                "meta:charSet": "utf-8",
                viewport: "width=device-width"
            };

            test("only charset missing — injects charset only", async () => {
                const processor = createPagemetaProcessor({
                    addRequiredGlobalMeta: false,
                    compressHTML: false,
                    routePatterns: []
                });

                const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"></head><body></body></html>`;
                const result = await processor
                    .getHtmlProcessor({
                        metadata: { custom: REQUIRED_CUSTOM, title: "Test" }
                    })
                    .process(html);

                const meta = extractMeta(String(result));
                expect(meta).toContainEqual({
                    properties: { charSet: "utf-8" },
                    tag: "meta"
                });
                // Viewport should not be duplicated
                const viewportTags = meta.filter(
                    (m) =>
                        m.tag === "meta" &&
                        "name" in m.properties &&
                        m.properties["name"] === "viewport"
                );
                expect(viewportTags).toHaveLength(1);
            });

            test("only viewport missing — injects viewport only", async () => {
                const processor = createPagemetaProcessor({
                    addRequiredGlobalMeta: false,
                    compressHTML: false,
                    routePatterns: []
                });

                const result = await processor
                    .getHtmlProcessor({
                        metadata: { custom: REQUIRED_CUSTOM, title: "Test" }
                    })
                    .process(MINIMAL_HTML);

                const meta = extractMeta(String(result));
                expect(meta).toContainEqual({
                    properties: {
                        content: "width=device-width",
                        name: "viewport"
                    },
                    tag: "meta"
                });
                // Charset should not be duplicated
                const charsetTags = meta.filter(
                    (m) => m.tag === "meta" && "charSet" in m.properties
                );
                expect(charsetTags).toHaveLength(1);
            });

            test("no head element — both injected into rehype-created head", async () => {
                const processor = createPagemetaProcessor({
                    addRequiredGlobalMeta: false,
                    compressHTML: false,
                    routePatterns: []
                });

                const html = `<!DOCTYPE html><html><body></body></html>`;
                const result = await processor
                    .getHtmlProcessor({
                        metadata: { custom: REQUIRED_CUSTOM, title: "Test" }
                    })
                    .process(html);

                const meta = extractMeta(String(result));
                expect(meta).toContainEqual({
                    properties: { charSet: "utf-8" },
                    tag: "meta"
                });
                expect(meta).toContainEqual({
                    properties: {
                        content: "width=device-width",
                        name: "viewport"
                    },
                    tag: "meta"
                });
            });

            test("without required globals custom — does not inject charset/viewport", async () => {
                const processor = createPagemetaProcessor({
                    addRequiredGlobalMeta: false,
                    compressHTML: false,
                    routePatterns: []
                });

                const html = `<!DOCTYPE html><html><head></head><body></body></html>`;
                const result = await processor
                    .getHtmlProcessor({ metadata: { title: "Test" } })
                    .process(html);

                const meta = extractMeta(String(result));
                expect(
                    meta.some(
                        (m) => m.tag === "meta" && "charSet" in m.properties
                    )
                ).toBe(false);
                expect(
                    meta.some(
                        (m) =>
                            m.tag === "meta" &&
                            "name" in m.properties &&
                            m.properties["name"] === "viewport"
                    )
                ).toBe(false);
            });
        });
    });

    describe("resolvePagemeta — additional error cases", () => {
        test("throws when function defaults returns undefined", () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                // @ts-expect-error -- testing invalid return type
                // eslint-disable-next-line @typescript-eslint/no-empty-function -- testing invalid return type
                defaults: () => {},
                routePatterns: []
            });
            const ctx = mockContext();
            setPagemeta(ctx, { title: "Trigger" });
            expect(() => processor.resolvePagemeta(ctx)).toThrow(
                "defaults function must return an object, got undefined"
            );
        });

        test("throws when function defaults returns number", () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                // @ts-expect-error -- testing invalid return type
                defaults: () => 42,
                routePatterns: []
            });
            const ctx = mockContext();
            setPagemeta(ctx, { title: "Trigger" });
            expect(() => processor.resolvePagemeta(ctx)).toThrow(
                "defaults function must return an object, got number"
            );
        });

        test("throws when function defaults returns false", () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                // @ts-expect-error -- testing invalid return type
                defaults: () => false,
                routePatterns: []
            });
            const ctx = mockContext();
            setPagemeta(ctx, { title: "Trigger" });
            expect(() => processor.resolvePagemeta(ctx)).toThrow(
                "defaults function must return an object, got boolean"
            );
        });
    });

    describe("setPagemeta + resolvePagemeta + getHtmlProcessor integration", () => {
        test("multiple setPagemeta calls merge into final HTML output", async () => {
            const processor = createPagemetaProcessor({
                addRequiredGlobalMeta: false,
                compressHTML: false,
                routePatterns: []
            });

            const ctx = mockContext();
            setPagemeta(ctx, { title: "My Title" });
            setPagemeta(ctx, {
                custom: { "og:image": "https://example.com/img.png" },
                description: "My Desc"
            });

            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- setPagemeta guarantees metadata
            const metadata = processor.resolvePagemeta(ctx)!;
            const result = await processor
                .getHtmlProcessor({ metadata })
                .process(MINIMAL_HTML);

            const meta = extractMeta(String(result));
            expect(meta).toContainEqual({
                properties: { text: "My Title" },
                tag: "title"
            });
            expect(meta).toContainEqual({
                properties: { content: "My Desc", name: "description" },
                tag: "meta"
            });
            expect(meta).toContainEqual({
                properties: {
                    content: "https://example.com/img.png",
                    property: "og:image"
                },
                tag: "meta"
            });
        });
    });
});

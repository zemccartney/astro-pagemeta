import { describe, expect, test } from "vitest";

import pagemeta from "../../src/index.ts";

describe("integration option validation", () => {
    test("rejects CSP custom keys in static defaults at config time", () => {
        expect(() =>
            pagemeta({
                defaults: {
                    custom: {
                        "Content-Security-Policy": "default-src 'self'"
                    }
                }
            })
        ).toThrow(/Content-Security-Policy cannot be set via pagemeta/);
    });

    test("rejects non-boolean addRequiredGlobalMeta", () => {
        expect(() =>
            // @ts-expect-error -- simulating untyped JS caller
            pagemeta({ addRequiredGlobalMeta: "yes" })
        ).toThrow(/addRequiredGlobalMeta must be a boolean/);
    });

    test("rejects invalid mode", () => {
        expect(() =>
            // @ts-expect-error -- simulating untyped JS caller
            pagemeta({ mode: "automatic" })
        ).toThrow(/mode must be "auto" or "manual"/);
    });

    test("rejects non-object, non-function defaults", () => {
        expect(() =>
            // @ts-expect-error -- simulating untyped JS caller
            pagemeta({ defaults: "title" })
        ).toThrow(/defaults must be an object or a function/);
    });

    test("accepts empty invocation", () => {
        expect(() => pagemeta()).not.toThrow();
    });
});

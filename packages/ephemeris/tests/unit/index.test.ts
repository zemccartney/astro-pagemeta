import { describe, expect, test } from "vitest";

import ephemeris from "../../src/index.ts";

describe("integration option validation", () => {
    test("rejects non-boolean addRequiredGlobalMeta", () => {
        expect(() =>
            // @ts-expect-error -- simulating untyped JS caller
            ephemeris({ addRequiredGlobalMeta: "yes" })
        ).toThrow(/addRequiredGlobalMeta must be a boolean/);
    });

    test("rejects invalid mode", () => {
        expect(() =>
            // @ts-expect-error -- simulating untyped JS caller
            ephemeris({ mode: "automatic" })
        ).toThrow(/mode must be "auto" or "manual"/);
    });

    test("rejects non-object, non-function defaults", () => {
        expect(() =>
            // @ts-expect-error -- simulating untyped JS caller
            ephemeris({ defaults: "title" })
        ).toThrow(/defaults must be an object or a function/);
    });

    test("accepts empty invocation", () => {
        expect(() => ephemeris()).not.toThrow();
    });
});

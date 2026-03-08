/**
 * Error Handling Integration Tests: Defaults Function Edge Cases
 *
 * These tests verify behavior that requires the full Astro integration pipeline
 * (virtual module serialization, middleware error handling, HTTP response codes).
 *
 * Reduced to 3 tests to minimize dev server cycles and avoid SocketError flakiness.
 * Additional error cases (undefined, string, number, false returns; function throws;
 * title coercion; unknown properties) are covered by unit tests in core.test.ts.
 *
 * Each test uses its own isolatedFixture so the framework assigns a unique port
 * per dev server — avoids TCP TIME_WAIT port reuse issues from sequential
 * stop/start cycles on the same fixture.
 *
 * KEPT TESTS:
 * | Test                        | Integration seam proven                           |
 * |-----------------------------|---------------------------------------------------|
 * | returning null              | Bad defaults function → 500 through Astro pipeline |
 * | closure over external var   | Virtual module serialization limitation            |
 * | empty object                | Function defaults work end-to-end                  |
 */

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import pagemeta from "../../src/index.ts";
import { createErrorCapture } from "../utils/error-capture/index.ts";
import { extractMeta } from "../utils/html-parse.ts";
import { isolatedFixture } from "../utils/isolated-fixture.ts";

describe("non-object return → 500 error", async () => {
    const { cleanup, fixture } = await isolatedFixture("error-handling");
    const errorCapture = createErrorCapture();

    let devServer: Awaited<ReturnType<typeof fixture.startDevServer>>;

    beforeAll(async () => {
        devServer = await fixture.startDevServer({
            integrations: [
                errorCapture.integration(),
                pagemeta({
                    // @ts-expect-error -- testing invalid return type
                    // eslint-disable-next-line unicorn/no-null -- simulating random user input
                    defaults: () => null
                })
            ]
        });
    });

    afterAll(async () => {
        errorCapture.dispose();
        await devServer.stop();
        await cleanup();
    });

    test("returning null", async () => {
        const response = await fixture.fetch("/");
        expect(response.status).toBe(500);
        expect(errorCapture.lastError()?.message).toContain(
            "defaults function must return an object, got null"
        );
    });
});

describe("serialization limitation → 500 error", async () => {
    const { cleanup, fixture } = await isolatedFixture("error-handling");
    const errorCapture = createErrorCapture();

    let devServer: Awaited<ReturnType<typeof fixture.startDevServer>>;

    // defaults functions are serialized via Function.prototype.toString() into a
    // virtual module. Closures over external variables produce a ReferenceError at
    // runtime because the variable doesn't exist in the virtual module's scope.
    beforeAll(async () => {
        const siteTitle = "My Site";
        devServer = await fixture.startDevServer({
            integrations: [
                errorCapture.integration(),
                pagemeta({
                    defaults: () => ({ title: siteTitle })
                })
            ]
        });
    });

    afterAll(async () => {
        errorCapture.dispose();
        await devServer.stop();
        await cleanup();
    });

    test("function closing over external variable", async () => {
        const response = await fixture.fetch("/");
        expect(response.status).toBe(500);
        const error = errorCapture.lastError();
        expect(error).toBeInstanceOf(ReferenceError);
        expect(error?.message).toContain("siteTitle is not defined");
    });
});

describe("valid function defaults → pass through", async () => {
    const { cleanup, fixture } = await isolatedFixture("error-handling");

    let devServer: Awaited<ReturnType<typeof fixture.startDevServer>>;

    beforeAll(async () => {
        devServer = await fixture.startDevServer({
            integrations: [
                pagemeta({
                    defaults: () => ({})
                })
            ]
        });
    });

    afterAll(async () => {
        await devServer.stop();
        await cleanup();
    });

    test("empty object", async () => {
        const response = await fixture.fetch("/");
        expect(response.status).toBe(200);
        const html = await response.text();
        const meta = extractMeta(html);
        expect(meta).toEqual([
            { properties: { charSet: "utf-8" }, tag: "meta" }
        ]);
    });
});

/**
 * Error Handling Tests: Defaults Function Edge Cases
 *
 * Tests runtime validation that defaults function returns an object.
 * We only validate the type is object, not the contents - rehype-meta
 * ignores unknown keys and coerces values as needed.
 *
 * BEHAVIOR SUMMARY:
 *
 * | Input                           | Behavior       | Why                              |
 * |---------------------------------|----------------|----------------------------------|
 * | null                            | 500 error      | Not an object                    |
 * | undefined                       | 500 error      | Not an object                    |
 * | string                          | 500 error      | Not an object                    |
 * | number                          | 500 error      | Not an object                    |
 * | false                           | 500 error      | Not an object                    |
 * | empty object {}                 | Passes         | Valid object                     |
 * | { title: 123 }                  | Passes         | Valid object, rehype coerces     |
 * | { unknownProp: 'x' }            | Passes         | Valid object, rehype ignores     |
 * | throws Error                    | 500 error      | Exception propagates             |
 * | closes over external variable   | 500 error      | Serialized fn loses closure scope|
 */

import { afterAll, afterEach, describe, expect, test } from "vitest";

import pagemeta from "../src/index.ts";
import { createErrorCapture } from "./utils/error-capture/index.ts";
import { extractMeta } from "./utils/html-parse.ts";
import { isolatedFixture } from "./utils/isolated-fixture.ts";

const { cleanup, fixture } = await isolatedFixture("error-handling");

describe("defaults function edge cases", () => {
    let devServer: Awaited<ReturnType<typeof fixture.startDevServer>>;
    // undefined, for cases where we don't use the error capturing integration
    let errorCapture: ReturnType<typeof createErrorCapture> | undefined;

    afterEach(async () => {
        errorCapture?.dispose();
        await devServer.stop();
    });

    afterAll(() => cleanup());

    describe("non-object returns → 500 error", () => {
        test("returning null", async () => {
            errorCapture = createErrorCapture();
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

            const response = await fixture.fetch("/");
            expect(response.status).toBe(500);
            expect(errorCapture.lastError()?.message).toContain(
                "defaults function must return an object, got null"
            );
        });

        test("returning undefined", async () => {
            errorCapture = createErrorCapture();
            devServer = await fixture.startDevServer({
                integrations: [
                    errorCapture.integration(),
                    pagemeta({
                        // @ts-expect-error -- testing invalid return type
                        // eslint-disable-next-line @typescript-eslint/no-empty-function -- simulating random user input
                        defaults: () => {}
                    })
                ]
            });

            const response = await fixture.fetch("/");
            expect(response.status).toBe(500);
            expect(errorCapture.lastError()?.message).toContain(
                "defaults function must return an object, got undefined"
            );
        });

        test("returning a string", async () => {
            errorCapture = createErrorCapture();
            devServer = await fixture.startDevServer({
                integrations: [
                    errorCapture.integration(),
                    pagemeta({
                        // @ts-expect-error -- testing invalid return type
                        defaults: () => "invalid string"
                    })
                ]
            });

            const response = await fixture.fetch("/");
            expect(response.status).toBe(500);
            expect(errorCapture.lastError()?.message).toContain(
                "defaults function must return an object, got string"
            );
        });

        test("returning a number", async () => {
            errorCapture = createErrorCapture();
            devServer = await fixture.startDevServer({
                integrations: [
                    errorCapture.integration(),
                    pagemeta({
                        // @ts-expect-error -- testing invalid return type
                        defaults: () => 42
                    })
                ]
            });

            const response = await fixture.fetch("/");
            expect(response.status).toBe(500);
            expect(errorCapture.lastError()?.message).toContain(
                "defaults function must return an object, got number"
            );
        });

        test("returning false", async () => {
            errorCapture = createErrorCapture();
            devServer = await fixture.startDevServer({
                integrations: [
                    errorCapture.integration(),
                    pagemeta({
                        // @ts-expect-error -- testing invalid return type
                        defaults: () => false
                    })
                ]
            });

            const response = await fixture.fetch("/");
            expect(response.status).toBe(500);
            expect(errorCapture.lastError()?.message).toContain(
                "defaults function must return an object, got boolean"
            );
        });

        test("function throws", async () => {
            errorCapture = createErrorCapture();
            devServer = await fixture.startDevServer({
                integrations: [
                    errorCapture.integration(),
                    pagemeta({
                        defaults: () => {
                            throw new Error("Intentional error in defaults");
                        }
                    })
                ]
            });

            const response = await fixture.fetch("/");
            expect(response.status).toBe(500);
            expect(errorCapture.lastError()?.message).toContain(
                "Intentional error in defaults"
            );
        });
    });

    describe("serialization limitations → 500 error", () => {
        // defaults functions are serialized via Function.prototype.toString() into a
        // virtual module. Closures over external variables produce a ReferenceError at
        // runtime because the variable doesn't exist in the virtual module's scope.
        test("function closing over external variable", async () => {
            errorCapture = createErrorCapture();
            const siteTitle = "My Site";
            devServer = await fixture.startDevServer({
                integrations: [
                    errorCapture.integration(),
                    pagemeta({
                        defaults: () => ({ title: siteTitle })
                    })
                ]
            });

            const response = await fixture.fetch("/");
            expect(response.status).toBe(500);
            const error = errorCapture.lastError();
            expect(error).toBeInstanceOf(ReferenceError);
            expect(error?.message).toContain("siteTitle is not defined");
        });
    });

    describe("valid objects → pass through", () => {
        test("empty object", async () => {
            devServer = await fixture.startDevServer({
                integrations: [
                    pagemeta({
                        defaults: () => ({})
                    })
                ]
            });

            const response = await fixture.fetch("/");
            expect(response.status).toBe(200);
            const html = await response.text();
            const meta = extractMeta(html);
            expect(meta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" }
            ]);
        });

        // rehype-meta coerces number to string
        test("title as number → coerced to string", async () => {
            devServer = await fixture.startDevServer({
                integrations: [
                    pagemeta({
                        // @ts-expect-error -- simulating random user input
                        defaults: () => ({
                            title: 123
                        })
                    })
                ]
            });

            const response = await fixture.fetch("/");
            expect(response.status).toBe(200);
            const html = await response.text();
            const meta = extractMeta(html);
            expect(meta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                { properties: { text: "123" }, tag: "title" }
            ]);
        });

        // rehype-meta ignores unknown properties
        test("unknown properties → ignored by rehype-meta", async () => {
            devServer = await fixture.startDevServer({
                integrations: [
                    pagemeta({
                        defaults: () => ({
                            title: "Valid Title",
                            unknownMeta: "value"
                        })
                    })
                ]
            });

            const response = await fixture.fetch("/");
            expect(response.status).toBe(200);
            const html = await response.text();
            const meta = extractMeta(html);
            // Unknown props ignored, title works
            expect(meta).toEqual([
                { properties: { charSet: "utf-8" }, tag: "meta" },
                { properties: { text: "Valid Title" }, tag: "title" }
            ]);
        });
    });
});

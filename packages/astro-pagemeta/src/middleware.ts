import type { MiddlewareHandler } from "astro";

// This file is injected into the consumer's project by Astro via addMiddleware,
// so it runs in the consumer's context. The import must use the package name
// (not a relative path) to resolve through the package's exports map.
// eslint-disable-next-line workspaces/no-absolute-imports -- must resolve through package exports, not relative to source (see comment above)
import { middleware } from "@grepco/astro-pagemeta/runtime";

export const onRequest: MiddlewareHandler = middleware();

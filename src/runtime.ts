import type { Options } from "rehype-meta";

import { defaults, routePatterns } from "virtual:pagemeta/config";

import type { IsPageRoute, ResolvePagemeta, SetPagemeta } from "./types.ts";

const LOCALS_KEY = Symbol("pagemeta");

export const isPageRoute: IsPageRoute = (pathname) => {
    return routePatterns.some((r) => r.test(pathname));
};

export const resolvePagemeta: ResolvePagemeta = (ctx) => {
    // @ts-expect-error -- index type error, not worrying about it given we're coordinating with our own symbol
    const pageMeta = ctx.locals[LOCALS_KEY] as
        | false // hard opt-out i.e. skip any defaults, don't set any meta tags
        | Options
        | undefined;

    if (pageMeta === false) {
        return;
    }

    let computedDefaults: Options;
    if (typeof defaults === "function") {
        const result = defaults(ctx);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- handling type-indifferent runtime possibility
        if (typeof result !== "object" || result === null) {
            throw new Error(
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- handling type-indifferent runtime possibility
                `[pagemeta] defaults function must return an object, got ${result === null ? "null" : typeof result}`
            );
        }
        computedDefaults = result;
    } else {
        computedDefaults = defaults ?? {};
    }

    if (!pageMeta && Object.keys(computedDefaults).length === 0) {
        return;
    }

    return { ...computedDefaults, ...pageMeta };
};

export const setPagemeta: SetPagemeta = (ctx, data) => {
    if (data === false) {
        // @ts-expect-error -- index type error, not worrying about it given we're coordinating with our own symbol
        ctx.locals[LOCALS_KEY] = false; // hard opt-out i.e. skip any defaults, don't set any meta tags
        return;
    }

    if (
        typeof data !== "object" ||
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- handling type-indifferent runtime possibility
        data === null
    ) {
        throw new Error(
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- handling type-indifferent runtime possibility
            `[pagemeta] setPagemeta data must be an object or false, got ${data === null ? "null" : typeof data}`
        );
    }

    // @ts-expect-error -- index type error, not worrying about it given we're coordinating with our own symbol
    const pageMeta = ctx.locals[LOCALS_KEY] as Options | undefined;

    // @ts-expect-error -- index type error, not worrying about it given we're coordinating with our own symbol
    ctx.locals[LOCALS_KEY] = {
        ...pageMeta,
        ...data
    };
};

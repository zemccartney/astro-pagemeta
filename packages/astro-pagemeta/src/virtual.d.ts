declare module "virtual:pagemeta/config" {
    import type { APIContext } from "astro";
    type PagemetaOptions = import("./types.ts").PagemetaOptions;

    export const routePatterns: RegExp[];
    export const defaults:
        | ((ctx: APIContext) => PagemetaOptions)
        | PagemetaOptions
        | undefined;
    export const compressHTML: boolean;
    export const addRequiredGlobalMeta: boolean;
}

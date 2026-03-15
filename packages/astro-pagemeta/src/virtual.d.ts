declare module "virtual:pagemeta/config" {
    import type { APIContext } from "astro";
    type MetadataOptions = import("./types.ts").MetadataOptions;

    export const routePatterns: RegExp[];
    export const defaults:
        | ((ctx: APIContext) => MetadataOptions)
        | MetadataOptions
        | undefined;
    export const compressHTML: boolean;
    export const addRequiredGlobalMeta: boolean;
}

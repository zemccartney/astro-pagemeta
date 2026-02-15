declare module "@grepco/astro-pagemeta/runtime" {
    // https://stackoverflow.com/questions/39040108/import-class-in-definition-file-d-ts/66768386#66768386
    // https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-9.html#import-types
    export const setPagemeta: import("./types.ts").SetPagemeta;
    export const resolvePagemeta: import("./types.ts").ResolvePagemeta;
    export const isPageRoute: import("./types.ts").IsPageRoute;
}

declare module "virtual:pagemeta/config" {
    import type { APIContext } from "astro";
    import type { Options } from "rehype-meta";

    export const routePatterns: RegExp[];
    export const defaults: ((ctx: APIContext) => Options) | Options | undefined;
}

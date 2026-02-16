declare module "virtual:pagemeta/config" {
    import type { APIContext } from "astro";
    import type { Options } from "rehype-meta";

    export const routePatterns: RegExp[];
    export const defaults: ((ctx: APIContext) => Options) | Options | undefined;
}

declare module "@page-meta/add" {
    import type { APIContext } from "astro";
    import type { Image, Options } from "rehype-meta";

    export const localsKey: unique symbol;

    export const addPageMeta: (
        ctx: { locals: App.Locals },
        data: Options
    ) => void;

    export const resolveMeta: (ctx: APIContext) => Options;

    // TODO Why the fuck did I do this?
    export interface PageMeta extends Omit<Options, "image"> {
        image: Image;
    }

    export interface PageMetaImageComponentProps {
        meta: PageMeta;
        pathname: string;
    }
}

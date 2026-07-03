import type { APIContext } from "astro";
import type { Options as MetaOptions } from "rehype-meta";

import { resolveMeta } from "@page-meta/add";
import { hashTransform, propsToFilename } from "astro/assets/utils";
import { defineMiddleware, sequence } from "astro:middleware";
import Filenamify from "filenamify";
import { rehype } from "rehype";
import rehypeMeta from "rehype-meta";

/*
    TESTS

    - no meta set, skipped
    - og:type output as website
    - link rel:canonical and og:url properly formatted
    - verify possible to reference astro-managed images and public assets as og:image

    - what happens if tags already set? overwritten, right? would need to document if published
*/

const isPage = (ctx: APIContext, response: Response) => {
    // TODO routing integration, surface data
    return (
        ctx.routePattern &&
        ctx.routePattern !== "/og" && // TODO configurable endpoint path
        response.headers.get("content-type")?.includes("text/html") // TODO excludes /_image, TODO but would catch server islands ...
    );
};

// TODO needed only if server rendered
export const preview = defineMiddleware(async (context, next) => {
    const response = await next();
    // TODO this is insufficient, falls down for server islands, need to verify that;
    // TODO if bundling routes integration, would need to document how to opt out of types augmentation / injection? i.e. ignore visible side-effect
    // TODO for rewrites, handle in transforms, i think the only possible way (tho on rewrite, wouldn't you want canonical url set to pre-rewrite?)
    if (!isPage(context, response)) {
        return response;
    }

    const isPreview = context.url.searchParams.has("og-img");

    if (!isPreview) {
        return response;
    }

    const searchParams = new URLSearchParams();
    searchParams.append("route", context.url.pathname);

    return context.rewrite("/og?" + searchParams.toString());
});

export const process = defineMiddleware(async (context, next) => {
    const response = await next();
    // TODO this is insufficient, falls down for server islands, need to verify that;
    // TODO if bundling routes integration, would need to document how to opt out of types augmentation / injection? i.e. ignore visible side-effect
    // TODO for rewrites, handle in transforms, i think the only possible way (tho on rewrite, wouldn't you want canonical url set to pre-rewrite?)
    if (!isPage(context, response)) {
        return response;
    }

    /*
        DON'T EXPOSE AS ARGS ON UTILITY
            - type
            - origin

        title : required
        description : required
        url : set via site parameter (document how this works, relation to rel="canonical"), don't expose setting
            https://yoast.com/rel-canonical/#when-canonical
            http://www.thesempost.com/using-rel-canonical-on-all-pages-for-duplicate-content-protection/
    */
    const meta = resolveMeta(context);

    // TODO Differentiate meta undefined vs. globally defined
    if (!meta) {
        return response;
    }

    const opts: MetaOptions = {
        ...meta,
        pathname: context.url.pathname // TODO Test how this ends up formatted against origin set e.g. warnings about trailing slashes (warn w/ typescript, template literal?)
    };

    // store the metadata for the astro:build:done hook
    // TODO security concerns here?
    if (
        context.isPrerendered &&
        opts.image &&
        /* @ts-expect-error -- TODO fix later */
        globalThis[Symbol.for("astro-page-meta-store")]
    ) {
        // TODO Surface image variance / defaulting patterns here somehow? Should be tested in dev
        // TODO manually replacing leading and trailing slashes so don't result in ugly-looking filenames
        // TODO expose formatting options to end user? if only input to filenamify?
        const filePath = `${Filenamify(context.url.pathname === "/" ? "base" : context.url.pathname.replace(/^\//, "").replace(/\/$/, ""), { replacement: "-" })}.png`;
        const transform = {
            format: "png",
            // TODO Don't expose image array as an option, resolve these TS errors via upstream patch
            /* @ts-expect-error -- TODO fix later */
            height: opts.image.height,
            src: filePath,
            /* @ts-expect-error -- TODO fix later */
            width: opts.image.width
        };

        /*
            Don't worry too much about matching Astro exactly
            - Use the built-in sharp image service for local generation, for initial release
            - hash image names as best you can, not sure what astro's doing to produce different naming
            structure, if it actually matters to align to that

            - even need to use astro's APIs? I suppose good to be consistent, but propsToFilename might be unhelpful

            - get image data
            - transform with sharp service, don't get from config, import directly
        */

        const finalImgPath = propsToFilename(
            filePath,
            transform,
            // TODO explain fake image service name
            // https://github.com/withastro/astro/blob/main/packages/astro/src/assets/utils/transformToPath.ts
            hashTransform(transform, "page-meta-img", [
                "format",
                "height",
                "src",
                "width"
            ])
        ).replace(/^\//, ""); // propsToFilename adds a leading slash, remove ... TODO do better?

        // Replace the last underscore before the extension with a period (e.g., filename_hash.extension -> filename.hash.extension)
        const parts = finalImgPath.split(".");
        const extension = parts.pop();
        const nameWithoutExtension = parts.join(".");
        const modifiedName = nameWithoutExtension.replace(/_([^_]*)$/, ".$1");
        const transformedFinalImgPath = `${modifiedName}.${extension}`;

        const ogImgProp = new URL(
            `og-images/${transformedFinalImgPath}`,
            context.site
        ).toString();

        /* @ts-expect-error -- TODO fix later */
        opts.image.url = ogImgProp;

        /* @ts-expect-error -- TODO fix later */
        globalThis[Symbol.for("astro-page-meta-store")].set(
            context.url.pathname,
            {
                imagePath: transformedFinalImgPath,
                meta: { ...opts },
                ogImgProp
            }
        );
    }

    const html = await response.text();

    // TODO minify whitespace in prod ... How? Manipulate middleware source somehow?

    // TODO How to transform pathnames to filenames? Reuse logic at image generation time
    const processed = await rehype().use(rehypeMeta, opts).process(html);

    // TODO What does this do?
    return new Response(String(processed), response);
});

export const onRequest = sequence(preview, process);

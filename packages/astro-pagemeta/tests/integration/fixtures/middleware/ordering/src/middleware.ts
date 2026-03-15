import { metadata } from "@grepco/astro-pagemeta/runtime";
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
    metadata(context, {
        description: "Middleware default description",
        title: "Middleware Default Title"
    });
    return next();
});

import { metadata } from "@grepco/ephemeris/runtime";
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
    metadata(context, {
        description: "Middleware default description",
        title: "Middleware Default Title"
    });
    return next();
});

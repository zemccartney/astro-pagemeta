import node from "@astrojs/node";
import { defineConfig } from "astro/config";

import pagemeta from "../src/index.ts";

export default defineConfig({
    adapter: node({
        mode: "standalone"
    }),
    /* i18n: {
        defaultLocale: "en",
        fallback: { fr: "es" },
        locales: ["en", "fr", "es"],
        routing: {
            fallbackType: "rewrite",
            prefixDefaultLocale: false
        }
    },*/
    integrations: [
        pagemeta({
            mode: "auto",
            addRequiredGlobalMeta: true,
            defaults: (ctx) => ({
                // type: "website",
                author: "Jane Doe",
                origin: ctx.site?.origin,
                image: "provolone.com"
            })
        })
    ],
    site: "https://www.playground.com",
    output: "server",
    compressHTML: true
});

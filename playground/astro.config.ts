import node from "@astrojs/node";
import pagemeta from "@grepco/astro-pagemeta";
import { defineConfig } from "astro/config";

export default defineConfig({
    adapter: node({
        mode: "standalone"
    }),
    compressHTML: false,
    integrations: [
        pagemeta({
            addRequiredGlobalMeta: true,
            mode: "manual"
        })
    ],
    output: "server",
    site: "https://www.playground.com"
});

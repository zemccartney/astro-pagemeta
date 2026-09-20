import node from "@astrojs/node";
import ephemeris from "@grepco/ephemeris";
import { defineConfig } from "astro/config";

export default defineConfig({
    adapter: node({
        mode: "standalone"
    }),
    compressHTML: false,
    integrations: [
        ephemeris({
            addRequiredGlobalMeta: true,
            mode: "manual"
        })
    ],
    output: "server",
    site: "https://www.playground.com"
});

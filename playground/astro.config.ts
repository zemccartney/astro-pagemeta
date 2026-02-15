import node from "@astrojs/node";
import { defineConfig } from "astro/config";

import pagemeta from "../src/index.ts";

export default defineConfig({
    adapter: node({
        mode: "standalone"
    }),
    integrations: [
        pagemeta({
            defaults: () => {
                return { title: "Default Title" };
            }
        })
    ],
    output: "server",
    redirects: { "/old-page": "/" }
});

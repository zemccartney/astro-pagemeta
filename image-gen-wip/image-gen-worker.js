import * as Astro from "astro";
import * as devalue from "devalue";
import Fs from "node:fs/promises";
import Path from "node:path";
import Puppeteer from "puppeteer";

// TODO in dev, write in TS, convert via jiti
// when shipped, just import the js file
async function generateOgImages(routesMeta) {
    let browser;
    let astroServer;

    try {
        browser = await Puppeteer.launch();
        astroServer = await Astro.dev({
            devToolbar: { enabled: false },
            logLevel: "warn",
            mode: "development",
            server: { port: 4322 }
        });

        // eslint-disable-next-line no-undef
        const outDir = Path.resolve(process.cwd(), "dist");
        const protocol = "http";
        const host = astroServer.address.address;
        const port = astroServer.address.port;
        const baseUrl =
            host.includes(":") ?
                `${protocol}://[${host}]:${port}`
            :   `${protocol}://${host}:${port}`;
        const ogImageDir = Path.join(outDir, "og-images/");
        const STATUS_PAGES = new Set(["404", "500"]); // TODO Any reason to exclude? Fine if someone opts in to having og images for these pages?
        const imgVary = [
            { pattern: "/blog/[slug]", rx: /^\/blog\/([^/]+?)\/?$/ }
        ];
        const normalizePathname = (pathname) => {
            const normalized = pathname.replace(/\/$/, "");
            return normalized.startsWith("/") ? normalized : `/${normalized}`;
        };

        await Fs.rm(ogImageDir, { force: true, recursive: true });
        await Fs.mkdir(ogImageDir);

        const page = await browser.newPage();

        // What is the default config? is there one?
        // Given route matching x pattern, resolve to this path i.e. describe how to generate multiple images from a single path? or do that at the page meta level?
        const imagesToGenerate = new Map([
            [
                "/",
                routesMeta.get("/") // TODO User would need to specify the default path? Which I think is the path which, when input to their template, produces the image they'd expect
            ]
        ]);

        for (const [pathname, config] of routesMeta.entries()) {
            // TODO What the fuck is this utility even doing? Not thinking at all clearly about this... what is the challenge? Model in TS?
            const normalizedPath = normalizePathname(pathname);
            const cleanedPath = normalizedPath.replace(/^\//, "");

            if (STATUS_PAGES.has(cleanedPath)) continue;

            const varyPath = imgVary.find((pat) => pat.rx.test(normalizedPath));
            const pathImgTpl = varyPath ? normalizedPath : "/";

            // TODO Better way to filter a Map?
            // Using the right pathname here?
            if (!imagesToGenerate.get(pathImgTpl)) {
                imagesToGenerate.set(pathImgTpl, config);
            }
        }

        for (const [pathname, config] of imagesToGenerate.entries()) {
            const ogImgDimensions = {
                /* @ts-expect-error -- TODO fix later */
                height: config.meta.image.height,
                /* @ts-expect-error -- TODO fix later */
                width: config.meta.image.width
            };

            // eslint-disable-next-line no-undef
            const searchParams = new URLSearchParams();
            searchParams.append("route", pathname);
            // eslint-disable-next-line no-undef
            const url = new URL("/og?" + searchParams.toString(), baseUrl);
            const finalOutPath = Path.join(ogImageDir, config.imagePath);

            await page.goto(url.href);
            await page.setViewport(ogImgDimensions);
            await page.screenshot({ path: finalOutPath, type: "png" });
        }
    } finally {
        await browser?.close();
        await astroServer?.stop();
    }
}

// TODO remove
// eslint-disable-next-line no-undef
process.on("message", async (data) => {
    const parsed = devalue.parse(data);
    try {
        await generateOgImages(parsed.routesMeta);
        // eslint-disable-next-line no-undef
        process.exit(0);
    } catch (error) {
        // eslint-disable-next-line no-undef
        console.error("Failed to generate OG images in worker:", error);
        // eslint-disable-next-line no-undef
        process.exit(1);
    }
});

import type { Options } from "rehype-meta";

import * as Astro from "astro";
import Fs from "node:fs/promises";
import Path from "node:path";
import Puppeteer from "puppeteer";

async function generateOgImages(
    routesMeta: Map<
        string,
        { imagePath: string; meta: Options; ogImgProp: string }
    >
) {
    let browser;
    let astroServer;

    try {
        browser = await Puppeteer.launch();
        // TODO possible issues w/ discerning root / src?
        astroServer = await Astro.dev({
            devToolbar: { enabled: false },
            logLevel: "warn",
            mode: "development",
            server: { port: 4322 }
        });

        const outDir = Path.resolve(process.cwd(), "dist");
        const protocol = "http";
        const host = astroServer.address.address;
        const port = astroServer.address.port;
        const baseUrl =
            host.includes(":") ?
                `${protocol}://[${host}]:${port}`
            :   `${protocol}://${host}:${port}`;
        const ogImageDir = Path.join(outDir, "og-images/");
        const STATUS_PAGES = new Set(["404", "500"]);
        const imgVary = [
            { pattern: "/blog/[slug]", rx: /^\/blog\/([^/]+?)\/?$/ }
        ];
        const normalizePathname = (pathname: string) => {
            const normalized = pathname.replace(/\/$/, "");
            return normalized.startsWith("/") ? normalized : `/${normalized}`;
        };

        await Fs.rm(ogImageDir, { force: true, recursive: true });
        await Fs.mkdir(ogImageDir);

        const page = await browser.newPage();

        for (const [pathname, config] of routesMeta.entries()) {
            const normalizedPath = normalizePathname(pathname);
            console.log({ normalizedPath, pathname });
            const varyPath = imgVary.find((pat) => pat.rx.test(normalizedPath));
            const pathImgTpl = varyPath ? normalizedPath : "/";
            const cleanedPath = normalizedPath.replace(/^\//, "");

            console.log({ cleanedPath, pathImgTpl, varyPath });
            if (STATUS_PAGES.has(cleanedPath)) continue;

            const ogImgDimensions = {
                /* @ts-expect-error -- TODO fix later */
                height: config.meta.image.height,
                /* @ts-expect-error -- TODO fix later */
                width: config.meta.image.width
            };

            const searchParams = new URLSearchParams();
            searchParams.append("route", pathImgTpl);
            const url = new URL("/og?" + searchParams.toString(), baseUrl);
            const finalOutPath = Path.join(
                ogImageDir,
                config.imagePath.replace(/^\//, "")
            );

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
process.on("message", async (data: any) => {
    try {
        await generateOgImages(data.routesMeta);
        process.exit(0);
    } catch (error) {
        console.error("Failed to generate OG images in worker:", error);
        process.exit(1);
    }
});

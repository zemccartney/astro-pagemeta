import { hashTransform, propsToFilename } from "astro/assets/utils";
import Filenamify from "filenamify";
import URL from "node:url";

const filePath = `${Filenamify("")}.png`;
const transform = {
    format: "png",
    // TODO Don't expose image array as an option, resolve these TS errors via upstream patch
    height: 1200,
    src: filePath,
    width: 630
};

// eslint-disable-next-line no-undef
console.log(filePath);

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
);

const ogImgProp = new URL.URL(finalImgPath, "https://grepco.net").toString();

// eslint-disable-next-line no-undef
console.log(
    { finalImgPath, ogImgProp },
    encodeURIComponent(finalImgPath),
    Filenamify(".png")
);

const rm = new Map([
    [
        "/",
        {
            imagePath: "/!_dDTbH.png",
            meta: {
                description:
                    "Zack McCartney's personal site / a fake production company",
                image: { height: 630, width: 1200 },
                og: true,
                origin: "https://grepco.net",
                pathname: "/",
                title: 'Global Regular Expressions: A "Production Company"',
                type: "website"
            },
            ogImgProp: "https://grepco.net/!_dDTbH.png"
        }
    ],
    [
        "/about/",
        {
            imagePath: "/!about!_Zv6jEP.png",
            meta: {
                description: "About a fake production company and it's author",
                image: {
                    height: 630,
                    url: "https://grepco.net/!about!_Zv6jEP.png",
                    width: 1200
                },
                name: "GrepCo",
                og: true,
                ogNameInTitle: false,
                origin: "https://grepco.net",
                pathname: "/about/",
                separator: " | ",
                title: "About Me",
                type: "website"
            },
            ogImgProp: "https://grepco.net/!about!_Zv6jEP.png"
        }
    ],
    [
        "/projects/",
        {
            imagePath: "/!projects!_ZtoBoQ.png",
            meta: {
                description: "Catalog of GrepCo's projects",
                image: { height: 630, width: 1200 },
                name: "GrepCo",
                og: true,
                ogNameInTitle: false,
                origin: "https://grepco.net",
                pathname: "/projects/",
                separator: " | ",
                title: "Projects",
                type: "website"
            },
            ogImgProp: "https://grepco.net/!projects!_ZtoBoQ.png"
        }
    ]
]);

import generateOgImages from "./image-gen";

await generateOgImages(rm);

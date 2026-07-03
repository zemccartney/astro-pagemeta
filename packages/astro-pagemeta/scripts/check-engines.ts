import { readFile } from "node:fs/promises";

const read = async (path: string) =>
    JSON.parse(await readFile(path, "utf-8")) as Record<string, unknown>;

// Node major version → maximum ES lib year that version fully supports
// https://github.com/microsoft/TypeScript/wiki/Node-Target-Mapping
const NODE_TO_ES_LIB: Record<number, number> = {
    18: 2022,
    20: 2023,
    22: 2023,
    24: 2024,
    26: 2025
};

const [astro, pkg, srcTsconfig, tsdownConfig] = await Promise.all([
    read("node_modules/astro/package.json"),
    read("package.json"),
    read("src/tsconfig.json"),
    readFile("tsdown.config.ts", "utf-8")
]);

// --- Check 1: publishConfig.engines.node matches Astro's engines.node ---

const astroEngines = (astro["engines"] as Record<string, string>)["node"];
if (!astroEngines) {
    throw new Error("Could not read engines.node from astro's package.json");
}

const publishConfig = pkg["publishConfig"] as
    | Record<string, Record<string, string>>
    | undefined;
const publishedEngines = publishConfig?.["engines"]?.["node"];

if (publishedEngines !== astroEngines) {
    throw new Error(
        `publishConfig.engines.node is ${JSON.stringify(publishedEngines)}, astro expects ${JSON.stringify(astroEngines)}`
    );
}

// --- Check 2: src/tsconfig.json lib aligns with Astro's lowest Node version ---

// Parse lowest major version from engine string like "18.20.8 || ^20.3.0 || >=22.0.0"
const lowestNodeMajor = Math.min(
    ...astroEngines.split("||").map((segment) => {
        const match = /(\d+)/.exec(segment.trim());
        if (!match?.[1]) {
            throw new Error(
                `Could not parse Node major version from engine segment: ${segment.trim()}`
            );
        }
        return Number(match[1]);
    })
);

const expectedEsYear = NODE_TO_ES_LIB[lowestNodeMajor];
if (expectedEsYear === undefined) {
    throw new Error(
        `No ES lib mapping for Node ${String(lowestNodeMajor)}. Update NODE_TO_ES_LIB in scripts/check-engines.ts`
    );
}

const lib = (srcTsconfig["compilerOptions"] as Record<string, unknown>)[
    "lib"
] as string[] | undefined;
const actualLib = lib?.[0]?.toLowerCase();
const expectedLib = `es${String(expectedEsYear)}`;

if (actualLib !== expectedLib) {
    throw new Error(
        `src/tsconfig.json lib is ${JSON.stringify(actualLib)}, should be ${JSON.stringify(expectedLib)} for Node ${String(lowestNodeMajor)}`
    );
}

// --- Check 3: tsdown target aligns with Astro's lowest Node version ---

const targetMatch = /target:\s*["']node(\d+)["']/.exec(tsdownConfig);
if (!targetMatch?.[1]) {
    throw new Error(
        'Could not parse target from tsdown.config.ts. Expected format: target: "node<major>"'
    );
}
const tsdownNodeMajor = Number(targetMatch[1]);

if (tsdownNodeMajor !== lowestNodeMajor) {
    throw new Error(
        `tsdown target is node${String(tsdownNodeMajor)}, should be node${String(lowestNodeMajor)} to match Astro's lowest supported Node version`
    );
}

console.log(`Engines aligned: ${publishedEngines}`);
console.log(`Lib aligned: ${actualLib} (Node ${String(lowestNodeMajor)})`);
console.log(`tsdown target aligned: node${String(tsdownNodeMajor)}`);

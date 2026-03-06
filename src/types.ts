import type { Options } from "rehype-meta";
import type { Thing } from "schema-dts";

export interface PagemetaOptions extends Options {
    custom?: Record<string, string>;
    jsonLd?: Thing | Thing[];
}

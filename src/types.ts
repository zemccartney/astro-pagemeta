import type { Options } from "rehype-meta";
import type { Thing } from "schema-dts";

export type JsonLd = Thing;

export interface PagemetaOptions extends Options {
    custom?: Record<string, string>;
    jsonLd?: JsonLd | JsonLd[];
}

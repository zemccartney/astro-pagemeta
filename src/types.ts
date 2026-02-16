import type { Options } from "rehype-meta";

export type LdJson = Record<string, unknown> & {
    "@type"?: string;
};

export interface PagemetaOptions extends Options {
    custom?: Record<string, string>;
    ldJson?: LdJson | LdJson[];
}

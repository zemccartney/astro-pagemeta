# API Reference

- [Default export](#default-export)
    - [pagemeta(options?)](#pagemetaoptions)
- [Runtime](#runtime)
    - [setPagemeta(ctx, options)](#setpagemetactx-options)
    - [middleware()](#middleware)
- [Head](#head)
- [Types](#types)
    - [PagemetaOptions](#pagemetaoptions-1)

## Default export

```ts
import pagemeta from "@grepco/astro-pagemeta";
```

### pagemeta(options?)

The integration itself

Returns an [Astro integration](https://docs.astro.build/en/reference/integrations-reference/) instance

#### options

- Required/Optional: optional
- Type:

```ts
{
    mode?: "auto" | "manual";
    defaults?: ((ctx: APIContext) => PagemetaOptions) | PagemetaOptions;
    addRequiredGlobalMeta?: boolean;
    includeExternalPages?: boolean;
}
```

- Default: `{ mode: "auto", addRequiredGlobalMeta: false, includeExternalPages: false }`

##### mode

- Required/Optional: optional
- Type: One of `"auto"` or `"manual"`
- Default: `"auto"`

Controls how `astro-pagemeta` injects your metadata into the HTML that Astro generates

- `"auto"` adds a middleware that consumes eligible response streams — eligible meaning full pages only; partials, API endpoints, and server islands are not processed — , injects meta tags based on your input into the `<head />`, then responds with a complete document
- `"manual"` really just turns off everything that `"auto"` does; no middleware is added, no processing happens by default, response streams untouched. To still have your metadata set, you have two options for the manual setup required:
    - Register the built-in middleware within your own middleware chain (see also [`middleware()`](#middleware))
    - Add the [`Head` component](#head) to your layout. See the [streaming documentation](./streaming.md) for more details

##### defaults

- Required/Optional: optional
- Type: Either a `PagemetaOptions` object or a function that receives Astro's rendering context and returns a `PagemetaOptions` object
- Default: none

Set tags by default for all requests.

The function variant is more powerful, as it receives [Astro's render context](https://docs.astro.build/en/reference/api-reference/), for the current request, so you can factor request-specific data into your metadata. However, be warned that you must not reference variables in your config file's scope, as it doesn't execute in that context, but later, in the context of Astro's distribution (in other words, an [isolated function](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/isolated-functions.md))

See the [usage examples](./usage.md) to get a feel for how the defaults system works.

##### addRequiredGlobalMeta

- Required/Optional: optional
- Type: `boolean`
- Default: `false`

Whether or not to automatically inject the two meta tags that you were probably already setting on all of your pages anyway :) (and if not, [you should be!](https://web.dev/learn/html/metadata#the_required_meta_tags_revisited)). That is, an extremely minor convenience / "convenience".

The tags in question:

```html
<meta charset="utf-8" />
<meta
    name="viewport"
    content="width=device-width"
/>
```

This option does NOT overwrite these tags if already hardcoded in your template, adds only if they're not found in your `<head />`

##### includeExternalPages?

- Required/Optional: optional
- Type: `boolean`
- Default: `false`

Determines if the middleware, whether added automatically in `"auto"` mode or setup manually in `"manual"` mode, skips external pages i.e. those added by other integrations. The integration defaults to false, assuming you want to apply metadata automatically only to pages under your control, that you can reason about directly e.g. the templates for an integration's pages might not be accessible, such that you might not be able to say how this integration would affect those pages, assuming you'd even want to set metadata on them. In other words, this integration assumes you mean to add metadata only to pages you've written yourself.

This option is a no-op when using the [`Head` component](#head) instead of middleware.

## Runtime

```ts
import { middleware, setPagemeta } from "@grepco/astro-pagemeta/runtime";
```

Warning: usable only within an astro project (internally relies on a virtual module, a product of Vite's pipeline)

### setPagemeta(ctx, options)

A function for setting the metadata configuration for the current request

Doesn't return anything

#### ctx

[Astro's render context](https://docs.astro.build/en/reference/api-reference/)

#### options

- Required/Optional: required
- Type: `PagemetaOptions | false`

An object describing the metadata you want to set for the current request. See the [`PagemetaOptions`](#pagemetaoptions-1) reference for supported tags.

Passing `false` is a hard opt-out: it skips all defaults and tag injection for the current request.

Multiple calls to `setPagemeta` within the same request merge their inputs. Top-level properties are shallow-merged (later calls win), while the `custom` property is deep-merged one level. This is useful for setting base values in middleware that pages can selectively override.

### middleware()

A function that returns the same middleware the integration automatically injects when in `"auto"` mode.

Use when in `"manual"` mode and you want to control this middleware's order relative to others in your project, modeled after [Astro's manual i18n routing](https://docs.astro.build/en/guides/internationalization/#manual).

For example, if your auth middleware redirects unauthenticated users, you'd want it to run before pagemeta so redirected responses aren't needlessly processed:

```ts
import { middleware as pagemetaMiddleware } from "@grepco/astro-pagemeta/runtime";
import { defineMiddleware, sequence } from "astro:middleware";

const auth = defineMiddleware(async (ctx, next) => {
    if (!ctx.locals.user) return ctx.redirect("/login");
    return next();
});

export const onRequest = sequence(auth, pagemetaMiddleware());
```

## Head

```astro
---
import Head from "@grepco/astro-pagemeta/Head";
---

<html>
    <Head>
        <meta charset="utf-8" />
    </Head>
    <body>...</body>
</html>
```

A component that renders a `<head>` element, implementing the same metadata processing as the middleware added in `"auto"` mode, but without consuming the entire response stream — applying your metadata input on top of its children only.

Use this in place of a hardcoded `<head />` in your layouts. Slot children (your hardcoded meta tags) are processed through `rehype-meta`, which handles deduplication — e.g., a template `<title>` is replaced if `setPagemeta()` sets a title.

When you need to preserve Astro's HTML streaming for your site, use this together with `"manual"` mode. See the [streaming documentation](./streaming.md) for details.

## Types

### PagemetaOptions

```ts
import type { Options } from "rehype-meta";
interface PagemetaOptions extends Options {
    custom?: Record<string, string>;
    jsonLd?: JsonLd | JsonLd[];
}
```

An object describing the metadata that should be added to a document's `<head />`. Extends [`rehype-meta`'s options](https://github.com/rehypejs/rehype-meta/tree/main?tab=readme-ov-file#options) with some additional tools. See [`rehype-meta`'s documentation](https://github.com/rehypejs/rehype-meta/tree/main?tab=readme-ov-file#options) for most available options and how they interact to produce various meta tag sets.

**custom**

- Required/Optional: optional
- Type: `Record<string, string>` an object mapping arbitrary string keys to string content
- Default: none

Define custom extensions and overrides to `rehype-meta`'s managed tags. See [the usage examples](./usage.md#custom-extensions) for a more detailed picture of what you can do with this option.

```ts
setPagemeta(Astro, {
    custom: {
        robots: "no-index" // rehype-meta doesn't know about <meta name="robots" />
    }
});
```

would yield

```html
<meta
    name="robots"
    content="no-index"
/>
```

This is a general-purpose escape hatch from `rehype-meta`'s API, which is powerful but narrowly-scoped — [explicitly](https://github.com/rehypejs/rehype-meta/tree/main?tab=readme-ov-file#what-is-this) not designed to cover every possible meta tag. See the [usage examples](./usage.md#custom-extensions) for a deeper look at the design rationale and how `custom` interacts with `rehype-meta`'s output.

Some keys receive special handling to allow overriding any tag the integration might produce:

| `custom` key                                                                          | Output                                        |
| ------------------------------------------------------------------------------------- | --------------------------------------------- |
| `title`                                                                               | `<title>{value}</title>`                      |
| `meta:charSet`                                                                        | `<meta charset="{value}" />`                  |
| `link:rel:canonical`                                                                  | `<link rel="canonical" href="{value}" />`     |
| `og:*`, `article:*`, `book:*`, `music:*`, `profile:*`, `video:*`, `fb:*`, `payment:*` | `<meta property="{key}" content="{value}" />` |
| Any other key                                                                         | `<meta name="{key}" content="{value}" />`     |

All keys deduplicate: if a matching element already exists in the `<head>`, its value is updated in place rather than adding a duplicate.

**jsonLd**

- Required/Optional: optional
- Type: `Thing | Thing[]`, where `Thing` is [`schema-dts`](https://github.com/google/schema-dts)'s implementation of the schema.org base [Thing type](https://schema.org/Thing)
- Default: none

One or more [JSON-LD objects](https://json-ld.org/) encoding types in schema.org's vocabulary.

Array input is automatically wrapped in a [top-level graph node](https://github.com/google/schema-dts?tab=readme-ov-file#graphs-and-ids), so your objects can then reference each other by their ids.

```ts
setPagemeta(Astro, {
    jsonLd: {
        "@type": "NewsArticle",
        headline: "BREAKING NEWS AT THIS HOUR",
        datePublished: "2026-03-11"
    }
});
```

Yields

```html
<script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": "BREAKING NEWS AT THIS HOUR",
        "datePublished": "2026-03-11"
    }
</script>
```

# pagemeta

An Astro integration for setting your pages' meta tags

## Why

This project aims to make setting page-specific meta tags more convenient by
injecting specified metadata into the proper metadata tags within the document head.

More convenient here is relative to what I usually did before writing this integration: write a layout
that accepted props by which I set the meta tag's with the `<head/ >` element declared with the layout's
template. Then pipe down values for those props from each page. Then extend that piping down a level if I ever decided to extend my base layout.

Maybe contrived, maybe this approach i.e. theoretical foundation of this library is wrongheaded, I dunno!
The thing is at the very least useful to me, possibly useful to you. YMMV.

## Disclaimers

- I have tested this library in production on static sites only; while I wrote tests for dynamic rendering cases, I have no sense how well this library holds up under real usage with dynamic rendering. Feedback / PRs welcome if you use the integration this way and find bugs or warts

<!-- TODO fill out -->

## Installation

```sh
# npm
npx astro add @grepco/pagemeta
# pnpm
pnpm astro add @grepco/pagemeta

# Or, manual installation (requires passing the integration to your astro config)
## npm
npm install @grepco/pagemeta
## pnpm
pnpm add @grepco/pagemeta
```

## Usage

### Basic

<!-- TODO possible to put filename in title of codeblock? -->

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import pagemeta from "@grepco/pagemeta";

export default defineConfig({
    integrations: [pagemeta()]
});
```

Then, in your pages

```astro
---
import { setPagemeta } from "@grepco/pagemeta/virtual";

setPagemeta({
    ctx: Astro,
    metadata: {
        title: "This is my title tag",
        description: "Describing the page"
    }
});
---

<Layout>
    <div>This is my page</div>
</Layout>
```

Which results in:

```html
<head>
    <!-- ... whatever else you've declared in your head -->
    <title>This is my title tag</title>
    <meta
        name="description"
        content="Describing the page"
    />
</head>
```

### With Defaults

You can set defaults for all pages, one of two ways.

#### Static

Static settings that apply to all pages (unless you explicitly opt out)

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import pagemeta from "@grepco/pagemeta";

export default defineConfig({
    integrations: [
        pagemeta({
            metadata: {
                title: "My Website",
                author: "Provolone Jones"
            }
        })
    ]
});
```

Then, in your pages

```astro
---
// index.astro
---

<Layout>
    <div>This is my page</div>
</Layout>
```

```astro
---
// about.astro

import { setPagemeta } from "@grepco/pagemeta/virtual";

setPagemeta({
    ctx: Astro,
    metadata: {
        title: "About Page!!", // Page-specific override
        description: "This page is about the website it belongs to"
    }
});
---

<Layout>
    <div>About this site</div>
</Layout>
```

Resulting in:

```html
<!-- index.html -->
<head>
    <title>My Website</title>
    <meta
        name="author"
        content="Provolone Jones"
    />
</head>

<!-- about.html -->
<head>
    <title>About Page!!</title>
    <meta
        name="author"
        content="Provolone Jones"
    />
    <meta
        name="description"
        content="This page is about the website it belongs to"
    />
</head>
```

#### Dynamic

More flexibly, you can pass a function, which will receive the [rendering context](https://docs.astro.build/en/reference/api-reference/) of the current request and the metadata set on the corresponding page:

<!--TODO
test closures; do they work w/ devalue? I assume not? what rules must be followed?


-->

```js
import pagemeta from "@grepco/pagemeta";

export default defineConfig({
    site: "https://grepco.net",
    integrations: [
        pagemeta({
            metadata: (ctx) => {
                const base = {
                    og: true,
                    origin: ctx.site,
                    pathname: ctx.url.pathname
                };

                if (ctx.routePattern !== "/") {
                    base.name = "GrepCo";
                    base.separator = " | ";
                    base.ogNameInTitle = true;
                }
            }
        })
    ]
});
```

Then, in your pages

```astro
---
// index.astro
import { setPagemeta } from "@grepco/pagemeta/virtual";

setPagemeta({
    ctx: Astro,
    metadata: {
        description: "My personal site",
        title: `Global Regular Expressions: A "Production Company"`
    }
});
---

<Layout>
    <div>This is my page</div>
</Layout>
```

```astro
---
// about.astro

import { setPagemeta } from "@grepco/pagemeta/virtual";

setPagemeta({
    ctx: Astro,
    metadata: {
        title: "About Page!!",
        description: "This page is about the website it belongs to"
    }
});
---
```

Resulting in:

```html
<!-- index.html -->
<head>
    <title>Global Regular Expressions: A "Production Company"</title>
    <meta
        name="description"
        content="My personal site"
    />
    <link
        rel="canonical"
        href="https://grepco.net"
    />
    <meta
        property="og:title"
        content='Global Regular Expressions: A "Production Company"'
    />
    <meta
        property="og:url"
        href="https://grepco.net"
    />
</head>

<!-- about.html -->
<head>
    <title>About Page!! | GrepCo</title>
    <meta
        name="description"
        content="This page is about the website it belongs to"
    />
    <link
        rel="canonical"
        href="https://grepco.net/about"
    />
    <meta
        property="og:title"
        content="About Page!! | GrepCo"
    />
    <meta
        property="og:description"
        content="This page is about the website it belongs to"
    />
    <meta
        property="og:site_name"
        content="GrepCo"
    />
    <meta
        property="og:url"
        href="https://grepco.net/about"
    />
</head>
```

### Images

<!-- TODO -->

## Reference

### pagemeta([config])

The integration itself, package's default export.

#### options

(optional, no defaults) Configuration for the integration

##### PagemetaConfig (typescript type)

```ts
import type { APIContext } from "astro";
import type { Options } from "rehype-meta";

interface PagemetaConfig {
    metadata: Options | ((ctx: readonly APIContext) => Options);
    options: {
        override?: boolean;
    };
}
```

##### metadata

Metadata defaults for all pages on your site. However you set it, by object or function, implements the [`Options` type](https://github.com/rehypejs/rehype-meta?tab=readme-ov-file#options) from [`rehype-meta`](https://github.com/rehypejs/rehype-meta).

Either an `Options` object or a function returning one.

Consult `rehype-meta`'s docs for reference on how these options translate to actual HTML tags. Output order — the order in which tags are output to the final document — is [documented here](https://github.com/rehypejs/rehype-meta/blob/51b0814fe4a7170dac12749cee5546ca4d52b048/lib/index.js#L16-L41).

##### options

Various switches to control how the integration applies metadata.

###### override

(optional, default `false`) If the integration should override existing tags

### Runtime module (virtual import)

The integration exposes the utilities for setting metadata via virtual import
You don't need to know exactly what that means, only that the imports documented here do not correspond back to a physical file installed as part of this package.

To import:

```ts
import { setPagemeta } from "@grepco/pagemeta/virtual";
```

### setPagemeta(config: PagemetaConfig)

```ts
import type { APIContext } from "astro";

interface SetPagemetaConfig extends PagemetaConfig {
    ctx: APIContext;
}

type SetPagemetaArgs = SetPagemetaConfig | false;
```

#### config

(required) Configuration for setting a given page's metadata

<!-- TODO link to PagemetaConfig type -->

Either an object with all the properties of `PagemetaConfig` plus the current [render context](https://docs.astro.build/en/reference/api-reference/) — in practice, this will be the `Astro` global — or `false` to completely opt out of the integration's transformation (e.g. unsetting defaults for a page)

<!--
TODO

- how should image work for defaulting? same as pages? true to opt in, image file to apply to all

-->

```

```

## How it Works

`pagemeta` injects meta tags, corresponding to your inputs, into the `<head></head>` of your rendered pages prior to sending the HTML back over the wire. It follows a few rules: - **existing tags takes
precedence**: under the hood, `pagemeta` injects a middleware that handles
injecting meta tags into the already-rendered HTML of the currently requested
page. If the integration detects existing meta tags it would overwrite, it sets
only the new tags, leaving said existing tags alone (though you can configure
this behavior with the `override` flag (see "Reference"))

<!-- TODO link References to header -->

<!-- TODO

Need to offset "overwrites existing metadata in <head> (for example, when a <title> already exists, it’s updated)"
behavior of rehype-meta for this to work
-->

- **only ever applies to your pages**: As in, `pagemeta` takes care to not apply
  to astro's reserved routes e.g. `/_server-island`, only your pages, whether
  declared within your project or
  [injected](https://docs.astro.build/en/reference/integrations-reference/#injectroute-option)
  through an integration. - **injects meta tags at the end of the head**: The
  integration adds meta tags right before `` (closing tag). Following from the
  first rule, existing meta tags are not relocated.

<!-- TODO is this placement problematic at all?

TODO is order of output defined?
-->

- see architecture diagram (TODO) - see theory (TODO) - integration ordering -
  mention pre-existing tags take precedence

## Assumptions and Limitations

### Only rehype-meta managed tags are settable

This integration uses [rehype-meta](https://github.com/rehypejs/rehype-meta) under the hood to inject meta tags. Only the tags that rehype-meta knows how to manage can be set or overridden via `setPagemeta()` or integration defaults.

For example, Astro's `<meta name="generator" content="Astro">` tag (commonly present in templates) is **not** managed by rehype-meta. This means:

- You cannot set or override the generator tag via this integration
- If it exists in your template, it will always be preserved as-is

Conversely, tags that rehype-meta **does** manage (like `title`, `description`, `author`, `og:*`, `twitter:*`) will be overridden if you set them via `setPagemeta()` or defaults, but preserved if you don't.

In practice, this means your template's existing meta tags integrate naturally with this integration:

- Tags rehype-meta doesn't manage: always preserved (e.g., `generator`, `viewport`, `charset`)
- Tags rehype-meta manages but you don't set: preserved from template
- Tags you set via defaults or `setPagemeta()`: override any existing template values

See [rehype-meta's options](https://github.com/rehypejs/rehype-meta?tab=readme-ov-file#options) for the full list of managed tags.

---

## Notes / Ideas (WIP)

Scratch space for things to factor into the docs once implementation settles.

### Template metadata can be replaced but not removed

rehype-meta's `ensure()` function finds-or-creates elements by CSS selector. It replaces content when a value is provided and leaves existing tags alone when no value is provided. There is no mechanism to remove a tag.

This means if a template has `<title>Foo</title>`:

- `setPagemeta(Astro, { title: "Bar" })` replaces it with "Bar"
- `setPagemeta(Astro, { description: "..." })` (no title) leaves "Foo" in place
- `setPagemeta(Astro, false)` opts out of all processing — "Foo" stays as-is
- There is no way to say "remove the template's title tag"

This contrasts with how integration defaults and `setPagemeta` interact with each other, where the merge hierarchy (`setPagemeta > defaults > template`) allows full override. The gap is at the bottom of the stack: you can override template tags with new values, but you can't null them out.

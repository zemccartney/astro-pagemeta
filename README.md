# pagemeta

<!-- TODO TOC -->

An Astro integration for setting your pages' meta tags

## What is this?

An Astro integration that aims to simplify setting metadata tags for your pages by

- automatically injecting your settings into the `<head/>` instead of requiring layout changes (with an important caveat about [streaming](./docs/streaming.md))
- leaning on [`rehype-meta`'s API](https://github.com/rehypejs/rehype-meta/tree/main?tab=readme-ov-file#use) for auto-generating tags based on other's content, solving for repetitive nature of metadata management

## When should I use this?

To be clear, you can use this integration for any Astro site, the below is just the main scenario I was solving for (myself, primarily, too, so your mileage may vary :) )

- You need to set metadata for your sites' pages
- You've structured your pages using one or more [layouts](https://docs.astro.build/en/basics/layouts/), which own the `<head />`
- you don't like setting metadata by passing props down to your layouts and
    - EITHER auto-setting metadata with zero layout changes at the expense of HTML streaming
    - OR your site relies on HTML streaming to performantly serve some or all pages and you can live with adding an element to your template's `<head />`

Why the HTML streaming caveat? It's a bit in the weeds; check out the [in-depth explanation](./docs/streaming.md) to hopefully clear up any questions.

## Installation

### `astro add`

```sh
# npm
npx astro add @grepco/astro-pagemeta
# pnpm
pnpm astro add @grepco/astro-pagemeta
```

### Manual

```sh
## npm
npm install @grepco/astro-pagemeta
## pnpm
pnpm add @grepco/astro-pagemeta
```

Then add the integration to your `astro.config.*`

```diff
import { defineConfig } from 'astro/config';
+import pagemeta from '@grepco/astro-pagemeta';

export default defineConfig({
  integrations: [
+    pagemeta()
  ],
})
```

## Basic Usage

This integration works by exposing APIs that let you describe the metadata for a given request, whether specific to a page
or defaults that should apply to all requests, then translating that input into actual meta tags output to the HTML that Astro
generates. It takes care to only work with pages i.e. complete documents: partials, API endpoints, and server islands are not processed.

(Optionally) Set some defaults that apply to every request ...

```ts
import { defineConfig } from "astro/config";
import pagemeta from "@grepco/astro-pagemeta";

export default defineConfig({
    site: "https://www.example.com",
    integrations: [
        pagemeta({
            // ctx is Astro's render context i.e. the signature of the Astro global
            defaults: (ctx) => {
                const base = {
                    origin: ctx.site,
                    pathname: ctx.url.pathname
                };

                if (ctx.url.pathname !== "/") {
                    base.name = "ACME";
                    base.separator = " | ";
                }
            }
        })
    ]
});
```

... then set whatever metadata you need within your pages

```astro
---
// index.astro
import { setPagemeta } from "@grepco/astro-pagemeta/runtime";
import Layout from "../layouts/Layout.astro";

setPagemeta(Astro, {
    name: "ACME Corporation Unlimited",
    description: "This is my home page, described!"
});
---

<Layout>
    <p>My home page!</p>
</Layout>
```

```astro
---
// about.astro
import { setPagemeta } from "@grepco/astro-pagemeta/runtime";
import Layout from "../layouts/Layout.astro";

setPagemeta(Astro, {
    title: "My About Page",
    description: "This page is about about us"
});
---

<Layout>
    <p>It was the best of times, it was the blurst of times</p>
</Layout>
```

... And you should get back something like

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
    <head>
        <title>ACME Corporation Unlimited</title>
        <link
            rel="canonical"
            href="https://www.example.com/"
        />
        <meta
            name="description"
            content="This is my home page, described!"
        />
    </head>
    <body>
        <p>My home page!</p>
    </body>
</html>

<!-- about.html-->
<!DOCTYPE html>
<html>
    <head>
        <title>My About Page | ACME</title>
        <link
            rel="canonical"
            href="https://www.example.com/about"
        />
        <meta
            name="description"
            content="This page is about about us"
        />
    </head>
    <body>
        <p>It was the best of times, it was the blurst of times</p>
    </body>
</html>
```

## Documentation

There's a pile more you can do with this integration. The following docs should have you covered, but if you find any gaps or have any questions, don't hesitate to file an issue.

- [API Reference](./docs/API.md)
- [Usage In-Depth](./docs/usage.md) (defaults system, JSON-LD, Custom extensions / escape hatches, manual middleware)
- [Interoperating with Astro's HTML Streaming](./docs/streaming.md)

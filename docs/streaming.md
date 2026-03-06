# Interoperating with Astro's HTML Streaming

## TLDR

To use this integration with HTML streaming:

- set the integration to `"manual"` mode
- replace any hardcoded `<head />`s in your templates with the `Head.astro` component
- live without the `includeExternalPages` integration option i.e. since this approach requires editing your templates, you won't be able to factor it into any pages added by integrations unless those integrations provide a way to edit said pages' templates

## Background

The problem: by default (in `"auto"` mode), this integration disables Astro's HTML streaming. Not great!

Let's get into why and how to workaround, but first, just enough background

In on-demand rendering, Astro serves pages in chunks across component boundaries via [HTML streaming](https://docs.astro.build/en/guides/on-demand-rendering/#html-streaming). As [their recipe shows](https://docs.astro.build/en/recipes/streaming-improve-page-performance/), if a component contains some async work i.e. needs to `await` something, Astro's smart enough to figure that out and serve non-awaiting parts of the page, so the user sees some of your content sooner while the more time-intensive pieces load. Great for reducing your [server's response times](https://developer.chrome.com/docs/performance/insights/document-latency).

If you want to get even more into it, I highly recommend reading this [deep dive](https://angelika.me/2025/03/16/implications-of-astro-html-streaming/).

## Why?

By default, the integration works by injecting a middleware decides which pages to process and then processes your input into meta tags added to the outgoing HTML. You can also opt into this same behavior via `"manual"` mode, then manually using the [`middleware()` export](./API.md#middleware).

That is, the integration tends to naively assume we're only ever acting on a full response, not part of one i.e. one component of many used to build up a page.

```ts
defineMiddleware(async (ctx, next) => {
    const response = await next();
    const html = await response.text(); // Stream consumed!
    const withMeta = await rehype()
        .use(rehypeMeta, yourInputHere)
        .process(html);

    return new Response(String(processed), {
        headers: response.headers,
        status: response.status
    });
});
```

For pages that would otherwise quickly load simpler parts while waiting on more intensive ones to load, with this integration the end user would instead wait for the longest-loading component to resolve before seeing anything.

The `rehype`-based pipeline needs to see the entire document to process it because we need to see the completely resolved
`<head />` to know how to modify it: what tags already exist so we can know which to overwrite vs. add. And to see the entire document, we need to wait for the entire thing to load.

This limitation is just fine for static sites (you're always serving static HTML, no computation to await) or SSR sites that don't leverage streaming, whether due to their data loading patterns (needing to fetch everything up front) or that most/all of their pages are quick to render (I suspect the latter case isn't particularly real, but noting for completeness; your SSR site won't crash just by using this integration in `"auto"` mode, but it will respond differently).

But for SSR sites that lean on HTML streaming in any capacity, this limitation is a non-starter.

## How to Work Around

The first step is, in `astro.config.*`, setting the `mode` option to `"manual"`

```ts
export default defineConfig({
    integrations: [pagemeta({ mode: "manual" })]
});
```

Then, in your pages or layouts, wherever you intend to define a complete document, you need to use the integration's `<Head />`
component in place of `<head />`

```astro
---
// layouts/Layout.astro

import Head from "@grepco/astro-pagemeta/Head.astro";
---

<html>
    <Head>
        <title>My title!</title>
    </Head>
    <body>
        <slot />
    </body>
</html>
```

```astro
---
// pages/contact.astro

import { setPagemeta } from "@grepco/astro-pagemeta/runtime";

setPagemeta({
    title: "Contact Us!"
});
---
```

`<Head />` works as follows

- Renders a `<head />` element
- Within the `<head />`, renders the result of running `<Head />`'s children through the integration's processing, applying any input metadata
- Tags that the integration doesn't manage passthrough unmodified. So, for example, any stylesheet or scripts won't be mangled or removed

Which is all to say, the component uses the same core — `rehype` processing pipeline and mechanics for resolving your defaults and `setPagemeta` input into a final metadata config — as the middleware, but scopes the work only to contents of your `<Head />`. The integration's processing is now part of generating the response instead of depending on it.

Lastly, `<Head />` is in no way dependent on SSR or `"manual"` mode; it only works together with those settings to re-enable HTML streaming with this integration. It works in static rendering. It even works in `"auto"` mode (entirely redundant with the middleware processing that follows, purely performance overhead, but works nonetheless).

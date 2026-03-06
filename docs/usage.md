# Usage In-Depth

A catalog of usage examples and finer-grained documentation of how the integration works

## Defaults

It might not be immediately apparent how all the ways you can set metadata work together, what's their order of precedence.

The full cascade is as follows (later overwrite earlier)

1. Hardcoded tags
2. Defaults
3. Explicitly set i.e. `setPagemeta`

And the integration navigates this cascade by always deduplicating: if a matching element already exists in the <head>, its value is updated in place rather than adding a duplicate.

So, given

```ts
// astro.config.ts

import { defineConfig } from "astro/config";
import pagemeta from "@grepco/astro-pagemeta";

export default defineConfig({
    integrations: [
        pagemeta({
            defaults: {
                description: "Description — Default",
                author: "Author — Default"
            }
        })
    ]
});
```

```astro
---
import { setPagemeta } from "@grepco/astro-pagemeta/runtime";

setPagemeta({
    author: "Author — Explicit"
});
---

<html>
    <head>
        <title>Title — Hardcoded</title>
        <meta
            name="description"
            content="Description — Hardcoded"
        />
        <meta
            name="author"
            content="Author — Hardcoded"
        />
    </head>
    <body>content</body>
</html>
```

The final `<head />` would be:

```html
<head>
    <title>Title — Hardcoded</title>
    <meta
        name="description"
        content="Description — Default"
    />
    <meta
        name="author"
        content="Author — Explicit"
    />
</head>
```

One wrinkle: while hard-coded tags are replaced, they aren't actually input to `rehype-meta`, which means they don't influence its output like your defaults or input to `setPagemeta`

For example,

```astro
---
setPagemeta(Astro, {
    copyright: true
});
---

<html>
    <head>
        <meta
            name="author"
            content="Arundhati Roy"
        />
    </head>
    <body>Test</body>
</html>
```

You might expect, per `rehype-meta`'s [`copyright` processing](https://github.com/rehypejs/rehype-meta/tree/main?tab=readme-ov-file#metanamecopyright), the integration would add the following:

```html
<meta
    name="copyright"
    content="© 2026 Arundhati Roy"
/>
```

Instead, it outputs nothing. `rehype-meta` doesn't see the existing author content and since `copyright` depends on the `author` option being set, `copyright` is ignored.

Given the workaround is to declare all metadata with the integration's APIs instead of in your templates and that fixing would likely mean some form of vendoring and refactoring `rehype-meta` (maybe? not sure, haven't thought too hard about it), this is considered an edge case at time of writing, won't fix unless this behavior proves enough of a pain over time.

## Customization

### Theory / brain dump

The `custom` property of [`PagemetaOptions`](./API.md#pagemetaoptions) is not just for adding any and all tags. It's really a general purpose escape hatch that hopefully allows you to fix any limitations of `rehype-meta`'s API "in post"

The mental model: `rehype-meta` options describe _inputs_ to a tag-generation process. `custom` describes the _outputs_ you want, overriding whatever that process produced.

In the integration's processing pipeline, your `custom` input is processed _after_ `rehype-meta` has done its work, which means it can override anything in the final `<head>` output: not just add tags that `rehype-meta` doesn't know about, but also replace tags that `rehype-meta` already set. This matters because rehype-meta has a dependent-keys design: many output tags are derived from combinations of input properties. `og: true` gates all OG tags. The `<title>` element is computed from `title + separator + name`. The canonical `<link>` is derived from `origin + pathname`. If you want fine-grained control — e.g., override just `og:image:alt` without touching `og:image`, or set an exact `<title>` without it being concatenated with a site name — rehype-meta doesn't offer that.

Enough word soup, an example:

```astro
---
import { setPagemeta } from "@grepco/astro-pagemeta/runtime";

setPagemeta(Astro, {
    og: true
});
---

...
```

By default, you'd get this

```html
<head>
    <meta
        property="og:type"
        content="website"
    />
</head>
```

As `rehype-meta` defaults `og:type` to `website` and only supports that and `article` as types.

But OpenGraph documents plenty of other types. So if you were marking up, say, a movie, you could do:

```ts
setPagemeta(Astro, {
    og: true,
    custom: {
        "og:type": "video.movie"
    }
});
```

And you'd get

```html
<head>
    <meta
        property="og:type"
        content="video.movie"
    />
</head>
```

### Reference

To make this whole escape hatch thing work i.e. allow overriding any tags that might be changed/output by the integration, `custom` has special handling for some keys. Here's a complete catalog of all its handling rules.

| `custom` key                                                                          | Output                                        |
| ------------------------------------------------------------------------------------- | --------------------------------------------- |
| `title`                                                                               | `<title>{value}</title>`                      |
| `meta:charSet`                                                                        | `<meta charset="{value}" />`                  |
| `link:rel:canonical`                                                                  | `<link rel="canonical" href="{value}" />`     |
| `og:*`, `article:*`, `book:*`, `music:*`, `profile:*`, `video:*`, `fb:*`, `payment:*` | `<meta property="{key}" content="{value}" />` |
| Any other key                                                                         | `<meta name="{key}" content="{value}" />`     |

All keys deduplicate: if a matching element already exists in the `<head>`, its value is updated in place rather than adding a duplicate.

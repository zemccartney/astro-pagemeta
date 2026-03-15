# Usage In-Depth

A catalog of usage examples and finer-grained documentation of how the integration works

- [How Metadata Merges](#how-metadata-merges)
- [Custom Extensions](#custom-extensions)
- [Behavior Notes](#behavior-notes)

## How Metadata Merges

There are three ways metadata can end up in your `<head>`, and it might not be immediately apparent how they interact. The full cascade is (later overwrites earlier):

1. **Hardcoded tags** — elements in your template's `<head>`
2. **Defaults** — set via the integration's `defaults` option
3. **`metadata`** — called in page frontmatter or middleware

The integration deduplicates at each layer: if a matching element already exists in the `<head>`, its value is updated in place rather than adding a duplicate.

`metadata` itself can be called multiple times within a single request (e.g., once in middleware, once in the page). Calls are merged: top-level properties are shallow-merged (later calls win), while `custom` is deep-merged one level.

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
import { metadata } from "@grepco/astro-pagemeta/runtime";

metadata(Astro, {
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

One wrinkle: while hard-coded tags are replaced, they aren't actually input to `rehype-meta`, which means they don't influence its output like your defaults or input to `metadata`

For example,

```astro
---
metadata(Astro, {
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

Instead, it outputs nothing. `rehype-meta` doesn't see the existing author content, and since `copyright` depends on the `author` option being set, it's ignored. This is a known limitation. Workaround: declare all metadata via the integration's APIs instead of hardcoding in templates.

## Custom Extensions

### Design rationale

The `custom` property of [`MetadataOptions`](./API.md#metadataoptions-1) is a general-purpose escape hatch from `rehype-meta`'s API.

The mental model: `rehype-meta` options describe _inputs_ to a tag-generation process. `custom` describes the _outputs_ you want, overriding whatever that process produced.

In the integration's pipeline, `custom` is processed _after_ `rehype-meta` has done its work, which means it can override anything in the final `<head>` output — not just add tags that `rehype-meta` doesn't know about, but also replace tags it already set. This matters because rehype-meta has a dependent-keys design: many output tags are derived from combinations of input properties. `og: true` gates all OG tags. The `<title>` element is computed from `title + separator + name`. The canonical `<link>` is derived from `origin + pathname`. If you want fine-grained control — e.g., override just `og:image:alt` without touching `og:image`, or set an exact `<title>` without it being concatenated with a site name — `rehype-meta` doesn't offer that. `custom` does.

For example:

```astro
---
import { metadata } from "@grepco/astro-pagemeta/runtime";

metadata(Astro, {
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
metadata(Astro, {
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

Some keys receive special handling to allow overriding any tag the integration might produce. See the [complete key reference](./API.md#custom) in the API docs.

## Behavior Notes

**When `metadata` is never called**: If defaults are configured, they still apply. If no defaults are set and `metadata` is never called, the middleware skips processing entirely — the response passes through unmodified.

**Opting out of processing**: Pass `false` to `metadata` to skip all defaults and tag injection for the current request:

```ts
metadata(Astro, false);
```

**`compressHTML` integration**: The integration respects Astro's [`compressHTML`](https://docs.astro.build/en/reference/configuration-reference/#compresshtml) config option. When enabled, injected whitespace is stripped and JSON-LD output is minified. When disabled (the default), JSON-LD is pretty-printed with 2-space indentation.

**`Head` component passthrough**: When no metadata is resolved (no defaults, no `metadata` call), the `Head` component renders its slot children as-is without running them through the rehype pipeline — zero processing overhead.

The core philosophical difference

astro-metadata: "Put a component in your layout, pass it props."
pagemeta: "Call a function in your page, middleware handles the rest."

Both solve the same user problem. The question is whether the automatic injection justifies the machinery behind it.

Where astro-metadata is better

Simplicity. It's pure Astro components — no Vite plugin, no virtual modules, no middleware, no rehype pipeline, no function serialization. Users understand components.
The mental model is: import thing, use thing, done.

The component-based approach is idiomatic Astro. Every Astro project already has a layout file. Adding <Head title={title} /> to it is trivial. The "prop drilling
problem" that pagemeta's automatic injection solves is... putting props on a component you already have.

Their individual component exports (<Title>, <OpenGraph>, <Robots>, etc.) give users fine-grained control without needing to understand a merge hierarchy. Composition
over configuration — very Astro-native.

Developer approachability. A new user can understand astro-metadata in 5 minutes. pagemeta requires understanding integration hooks, virtual modules, middleware
ordering, and rehype.

Where pagemeta is genuinely better

SSR safety. This is the big one. astro-metadata uses a module-level singleton for its Metadata store. In SSR with concurrent requests, one request's Metadata.set() can
clobber another's before resolve() runs. That's a real bug, not a theoretical one. Your Astro.locals[Symbol()] approach is per-request by definition — correct by
construction.

Existing tag merging. Your three-level hierarchy (metadata > defaults > template HTML) means the middleware can update an existing <title> tag rather than adding a
duplicate. astro-metadata's components just render — if a template already has a <title>, you get two.

Route filtering. You automatically skip API routes, server islands, partials. astro-metadata doesn't think about this at all because it's component-based (components
only render where you put them), but that also means the user has to manage which layouts get meta tags and which don't.

Function defaults with request context. Being able to compute defaults based on APIContext (pathname, site URL, etc.) is genuinely useful. astro-metadata's
Metadata.resolve(defaults) takes a static object.

The hard question: is pagemeta overengineered?

Partially, yes. Here's my breakdown:

Worth the complexity:

- Per-request isolation via Symbol-keyed locals — solves a real SSR correctness problem
- Post-render middleware approach — enables the tag-merging behavior that components can't do
- Route filtering — necessary consequence of the middleware approach and handles it well

Complexity that doesn't pay for itself:

- Custom Vite plugin + virtual module — all this machinery exists to serialize route patterns and defaults into a module. The function serialization via
  Function.toString() is clever but introduces a surprising limitation (no closures) that users will hit. astro-metadata just... doesn't need any of this.
- Rehype pipeline with 4+ custom plugins — you're parsing and re-serializing every HTML response. That's a real performance cost. For most sites, the metadata is known
  at render time and could just be rendered directly.
- The test infrastructure — isolatedFixture(), temp directories, error capture integrations, the entire MAINTENANCE.md explaining test quirks. This is a consequence of
  the architectural complexity, not a feature. astro-metadata tests with Playwright against a running dev server — simpler because the architecture is simpler.

The uncomfortable summary

astro-metadata solves 90% of the problem with 20% of the complexity. The component approach is more idiomatic, easier to understand, and works for the vast majority of
Astro projects (which are static sites).

pagemeta's automatic injection is technically superior in edge cases (SSR isolation, tag merging, dynamic defaults), but most users won't encounter those edge cases.
The "automatic" part — not needing to modify your layout — saves the user about 3 lines of code at the cost of a custom Vite plugin, virtual module serialization, a
rehype pipeline, and post-render middleware.

You are not embarrassingly overengineered, but you are solving harder problems than most users have. The SSR isolation issue in astro-metadata is a genuine bug that
validates your architectural choice. But if you're targeting the same audience (most Astro users building content sites), their simpler approach will be more appealing.

What I'd actually recommend

If you want to compete, you need to articulate why the middleware approach matters. The pitch isn't "you don't need a component" — that's a weak differentiator. The
pitch is:

1. SSR-correct by design (their library has a concurrency bug)
2. Works with existing templates (merges, doesn't duplicate)
3. Zero layout changes required (works across any layout, any component hierarchy)
4. Dynamic defaults (compute metadata from request context)

If those advantages don't resonate with your target audience, then the simpler library wins on approachability alone. That's not a failure of engineering — it's a
market positioning question.

---

The wrong pitch

"You don't need to add a component to your layout" — this saves 3 lines of code. Nobody cares.

The right pitch

pagemeta is for teams that need metadata to Just Work across their entire site without manual orchestration.

Specific angles:

1.  "Set it and forget it" defaults. Configure your site's OG image, Twitter handle, and title template once in the integration config. Every page gets them
    automatically. Override per-page when needed. No layout prop drilling, no forgetting to pass defaults.
2.  SSR-safe by design. If you're running SSR (which more Astro projects are as server islands and hybrid mode grow), pagemeta's per-request isolation via Astro.locals
    means metadata never leaks between concurrent requests. Component-based approaches with module-level state have a concurrency bug here.
3.  Works with your existing HTML. Already have <title> and <meta> tags in your template? pagemeta updates them in place rather than duplicating. No need to remove
    existing tags when adopting the library.
4.  Dynamic defaults from request context. Compute metadata based on the URL, cookies, or any other request data. Your defaults function receives the full APIContext.

Who should NOT use pagemeta

Be honest about this in your docs:

- Static-only sites with simple needs — astro-metadata or even manual <meta> tags are simpler and have zero overhead
- Performance-critical SSR — the rehype buffering adds 15-80ms per request and breaks streaming. If you're optimizing for TTFB, the component approach is faster (or use
  pagemeta's streaming mode)
- Teams that want explicit control — some teams prefer seeing exactly which tags are rendered in their templates. pagemeta's "magic" middleware can feel opaque

Competitive framing

Don't position against astro-metadata specifically. Position against the approach:

"Component-based metadata works until it doesn't — when you need site-wide defaults, SSR isolation, or tag deduplication. pagemeta handles the metadata lifecycle so you
can focus on content."

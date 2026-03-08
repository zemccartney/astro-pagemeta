Principles:

- Test all logic under both static and dynamic (SSR) rendering. likely redundant / unnecessary, but to
  demonstrate and document that library works in expected environments for any and all Astro applications (setting aside adapters)
- Test all logic under dev and build, ensure library works consistently across all stages of Astro application development
- Eventually, when Astro 6 lands, test under different adapters i.e. when environment API unlocks usable local support for different runtimes esp. cloudflare

In short, favor test clunkiness and redundancy for the sake of having documentary proof that library works under a wide variety of conditions. Do not assume that things will work out across Astro's mechanical flexibility, assume I don't know how anything works in Astro land, that things might change; adversarial, always-prove-it view for the sake of continued stability

- Fixtures
    - contain pages with logic necessary to trigger behaviors under test
    - test cases = integration options + fixture pages
        - output we're interested in is a product integration options + pages (meta tags set + calls to setPagemeta)
    - could conceivably have 1 fixture for all tests, but thought it would be easier to reason about scope of tests, impact of changing any given file, by coupling fixture files to only one test directory i.e. if every test file uses the same fixture, how would you ever change them? just always add more files?
    - should only ever use APIs / functionality usable across static and server rendering, unless tests apply only to one environment / rendering mode or the other
        - solve for variance by supporting injecting files into shared fixtures to solve for rendering-mode-specific tests
    - isolated fixture utility solves for reusing the same fixture across multiple test files, which would otherwise i.e. with a single physical fixture, have multiple processes racing for filesystem resources. this is really only the dist folder for building, I think? could be there are some conflicts in dev i.e. ssr and static output differently, but unclear
        - this is a consequence of constraining ourselves to testing all logic under static vs. ssr and dev vs. build, which requires us to have at least 2 test files per rendering mode ... or could conceivably have only a single test file per logic
            - PRO: no fixture isolation required
            - CON: much slower tests, less parallelizable

- Fixtures correspond to test folders correspond to a set of integration options

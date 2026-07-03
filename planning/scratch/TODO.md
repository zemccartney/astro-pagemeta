1. Get it working (add tests as we go, keep 100% code coverage)
2. Improve / sand it, poke at it
3. audit technical decisions

- pnpm config
- eslint config
- node versioning approach

4. audit astro version support (pass docs to AI)
5. Push, run in CI

- Is engines appropriate? How do you expose node version support?
    - no, engines
        - use pnpm's publish packagejson hook? does that cover engines? (which would point
          to pinning pnpm version FOR DEV ONLY SHOULDN'T ENFORCE PNPM VERSION WHEN CONSUMING,
          MUST BE NPM INSTALLABLE)
- Should I pin pnpm version? Will that affect consumers?
- make astro a peer dependency, announce astro version support (test against 5 only?)
- Evaluate TS setup
    - unsure on lib and target (shouldn't target be lowest node version supported by astro?
      same w/ node types?)
- Evaluate pnpm usage; sensible?
    - Since need to test across node versions, does it make sense to NOT use lockfile?

[ ] set up a maintenance folder, document all of this stuff

## publishing

- license?
- author?
- description?
- keywords?
- how to build / publish?
    - np?
    - esbuild? Why not plain typescript?
- How to simplify managing release notes, clarity on changes for consumers?
    - conventional commits?
    - changesets?

[ ] set astro as peer dependency
[ ] use AI to summarize astro docs and release notes, identify min astro version supported
(min of 5) to decide on peer dep range
[ ] How to think about code output? In which environments should it run? How do we evaluate that?
Would like to flag any features not supported in node versions and baseline widely available i.e. polyfills required?
[ ] set up ts down

- https://tsdown.dev/
- https://alan.norbauer.com/articles/tsdown-bundler/

[ ] add JSDoc comments - JSDoc is typescript -

## Maintenance

- renovate? goal is to simplify and automate dependency management, security scanning (trivy? snyk?)
    - stop doing this manually, set up rules to auto-merge and launch OR wait for approval (breaking
      change); find some way to notify if high-severity CVE on prod dep flagged
    - don't have time to manage deps and security on all projects over time

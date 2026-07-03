## tsdown

- automatic exports checking (should fail in CI?)
- need to update package.json to reference build files
- mark astro deps as external explicitly? unclear on what would need to be manually externalized,
  given deps are excluded by default?
- can use esm
- definitely want package validation (want to run locally, too, see it work)
- enable declaration maps?

- "You're building a library that will be further processed by the consuming application" this is us, so... our tsconfig should use most modern target, rely on consumers to specify their own
  / Astro handles compilation???
    - also means no need for source maps

- isolatedDeclarations??

## CI

- knip
- typechecking
- formatting
- linting
- security check?
- changeset enforcement? (changeset bot)
- build affected projects?

For PRs i.e. proposal to dev:

For release candidacy:

- after merge to main
    - rerun all checks, sum of all changes, verify integration

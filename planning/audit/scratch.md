- auditing other deps upgrades, spec'ing out e.g. pnpm upgrade (foundation)
- fix deps script (npm-check-updates) to be usable across all packages? what is deps updating procedure for packages?
- how to run things myself
- security auditing system (foundation)
- tsconfig doc is outdated e.g. references eslint globals. problem was ts didn't enforce proper es version in integration's src dir ... b/c vite overrode?
-

- [ ] Brainstorm image gen protocol and puppeteer-based one
- [ ] Brainstorm virtual fs implementation for test system? Possible to actually replace astro-tests? Or propose improvement?
- [ ] Brainstorm rust-based replacement of rehype-meta (though couldn't be used on previous astro versions?)
- [ ] Go through supply chain security brainstorm
- [ ] Brainstorm adoption of renovate? To what end? what problems are you solving for yourself?
- [ ] Summarize all changes across Astro 6 and 7, want to get up to speed on what I've missed (flagging for later)

## maintenance considerations

- https://docs.astro.build/en/upgrade-astro/#nodejs-support-and-upgrade-policies
    - doc rules for astro support
        - how to document / audit which environments are supported? by node version, I guess?
- install socket in github? or use locally?
- renovate? goal is to simplify and automate dependency management, security scanning (trivy? snyk?)
    - stop doing this manually, set up rules to auto-merge and launch OR wait for approval (breaking
      change); find some way to notify if high-severity CVE on prod dep flagged, don't want to have to check myself
    - don't have time to manage deps and security on all projects over time

- how does all the benching shit click together? in both playground AND in integration itself (playground is really an integration env)
- do node versions in publish config carry through? are those the ones actually published?

## release considerations

- check js doc comments showing in intellisense (still care about IDEs)
- verify presence on astro catalog

## reminders for working on personal sites

- sitemap
- look through that site on what makes for a good website
- astro CSP (watch video on CSP ... google dev summit?)

---

- need to refamiliarize with testing setup, isolation, why set up this way
- go slow w/ release process
    - get a better feel, actually learn tsdown (write down your learning to solidify)
    - using changesets
        - how to manage changelog
        - how to produce releases
        - how to enforce usage?
    - review documentation

    write through as you go, going to be a beginner only once (tsdown, changesets, npm publishining / provenance (or attestation?), prerelease checklists, CI checks (what's your intent? what are desired outcomes, how do these guardrails help achieve?))

- ask AI to brainstorm additional tests to run, evaluate tests written so far

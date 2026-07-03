Outcomes:

- Done with the benchmarking thing, understand well enough to feel ok w/ shipping
- Reviewed code base, cleaned up funk, thought enough to have a better sense of ownership
- I FEEL the release process. I know how to run it, how to check if it's working, how to handle contributors
    - Clear on preflight process (checklist of manual / other testing steps to run prior to launching)
- I know how to develop within the project (spend some time manually building the image generator, get a feel for working with monorepo)
- More consistent agent scaffolding / harnessing / process (right now, no enforcement of process, need stronger guardrails... envisioning as a dev:
  always run certain checks, pass of to QA for evaluation when done)
- I can talk semi-intelligently about my testing setup, limitations
- I'm in a good place for keeping the project running smoothly (responsible for deps upgrades,
  system to be notified if CVEs / deps issues)

---

1. Get it shipped
    - changesets
    - release process
        - npm provenance
        - benchmarking report
    - Preflight checklist:
        - on merging to main, as part of changesets proposal, write out checklist of manual / other testing steps that should be run prior to launching, to ensure all smooth
          (better place to do this than merging to main? cut a release candidate branch, block merging to main from branches other than rc?)

2. Test on portfolio (ship it)
    - need manual testing checklist (verify helpful)
        - automate what we can w/ claude / playwright using the playground

EXPECT:

- I can install the thing from npm
- I can see the thing, with provenance attestation, on npm and npmx (read about npmx)
- Manual checklist passes / checklist refined with things to check for, learned from integration

3. Improve
    - expand CI (see pub.md)
        - check tsdown settings / CI optimization?
        - run knip
        - node version testing matrix
            - implement locally somehow?
        - astro version testing matrix
            - implement locally somehow?
    - review / clean up maintenance docs
    - Full AI review / audit (do ping pong on work computer)
    - README review / test on playground
        - review output from benchmarking
        - refine your value pitch, how this relates to astro-seo and astro-metadata and other competitors
            - Core: adapts to any organizational strategy, can scale out automatically
            - still benefit for simple sites, really comes down to your test for props drilling
            - check middleware usage API reference link
    - get working with astro 6
    - fresh installation of the repo, to ensure nothing fucked up, but latently fixed due to you doing something dumb?

4. release v0.5

When it goes public, I want documentation to not be total trash, some semblance of cleaned up. And I want to be able to talk intelligently about odd parts
of codebase

- any need for architecture diagrams?
- ask claude what it would want?
- review code, tidy any obvious slop
- clean up docs
    - simplify CLAUDE.md
    - delete TODO.md
    - delete any other unused docs
- maintenance docs organized, I'm clear on how to do core maintenance tasks / what the maintenance schedule is
    - setup renovate? schedule deps review? want reminders / automating remembering work to do
    - keeping deps up to date?
    - keeping github actions deps up to date (How?)
    - keeping license year up to date? necessary to set the year? meaning of the year?
- To understand and document (learning-opportunities?)
    - testing setup (analyze transcripts)
        - dev server issue (need for headless core)
    - typescript config issues / unable to limit node version? reproduce somehow (ask claude)

5. spend some time learning fundamentals better
    - think about using AI as learning assistant, work through questions as you build
    - see learn list below
    - write as you go, publish later

6. image generator: just enough for yourself, but also documentation for how to create your own service
    - build out AI harness
        - skill for a guided tour?
            - desired outcome:
                - feel more familiar with the codebase, more ownership
                - look at Cat Hicks skills
                - What are you trying to learn?
                    - what does all the code look like?
                    - did I make any insane decisions? Could the tests be simplified / pared down?
                        - Could I make them look like astro / inox-tools tests?
        - https://tsdown.dev/guide/skills
        - astro skill?
        - knip
    - work manually at first: think through architecture, build prototype, get used to working w/ monorepo?
        - how to run deps script on all packages? is that even useful anymore?
    - test AI harness w/ building out an additional image generator... satori, maybe?

7. Release v1, publicize

8. Follow ups

- upgrade to eslint 10? or follow nakazawa, oxfmt/oxlint/tsgo ports
- add integration with dev toolbar app for inspecting if existing doesn't work
    - report fix if they compatible?
- bundle impact assessment: how?
- bug reporting
    - exposing partials in routing metadata per routes:resolved
    - possible for astro to not inject @types/node, so end users can control strictly? or document?
      possible to override with your own node version, if one you have to target? or vary for cloudflare (if cloudflare's
      types would be different? seems like you can get a project to typecheck, but crash locally when running a
      node version out of step with astro's node types?)
    - ask astro about how to reason about browser compatibility and server compatibility / target, when building libraries?

---

## LEARN

- https://developers.google.com/search/docs/crawling-indexing/special-tags
- https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/Webpage_metadata
- look at your sites' search console, get more out of that
- go through this whole piece: https://angelika.me/2025/03/16/implications-of-astro-html-streaming/

What's the point of metadata? Best practices?
Intuition for opengraph?
intuition for JSON-LD?

## TESTING

This needs to end up in documentation somewhere (playground?)

- og validators
- json LD dev toolbar: https://x.com/skix123/status/2028081167828709443
- use google search console
- google rich results
- intellisense / TS
- reminder to check integration library on Monday after release
- integration option errors
- capo JS (in playground)
- metadata middleware works for newly added pages (dev server refresh works)
    - docs in maintenance as a manual test to run
    - checklist to launch
        - check virtual module invalidation in dev
- prove race condition in competing metadata library: https://github.com/eremannisto/astro-metadata?tab=readme-ov-file
    - How does that library work w/ streaming? no impact?
    - Ask Claude to evaluate the two libraries, compare and contrast; is higher level of engineering on pagemeta justified?
- view display on npm and npmx registries
- editor performance / typechecking impact
- trigger integration input error; gross stacktrace?
- reproduce observed lobotomized document from playground; is that the integration's fault? or astro's default behavior? review no-head tests?
- verify all documented installation instructions work
- test your README documentation
- does TS go-to-definition work?
- mozilla http observatory
- take snapshots of portfolio pages before and after adding integration
- can click to go to type definitions (re: declaration maps / declaration files?)
- test triggering an error in SSR i.e. call one of the error cases, see how it shows up in server log? Testing for need for source maps
- How do we test declaration file maps? What's the intuition for if those are correct?

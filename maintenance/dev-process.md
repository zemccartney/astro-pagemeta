# Development process

The canonical loop for any change in this repo, whether Zack does it by hand or an agent does it. The goal is that Zack always understands what changed and why, and never has to take an agent's word for it.

**Agents: read this before starting a tranche.** If step 2's note does not exist for the work you are about to do, ask Zack for it before touching code.

## The loop

1. **Orient.** Open [`planning/plan/ROADMAP.md`](../planning/plan/ROADMAP.md). The next unchecked box is the work. One box, or one bounded slice of a box, per tranche. Do not bundle unrelated improvements into it.
2. **Say what right looks like, first.** Before the work starts, Zack writes a short note in `planning/scratch/` stating the expected outcome and how he intends to check it (see `planning/scratch/m1.md` for the shape). The agent restates it in its own words and flags disagreements before writing code. This step caught two overclaims in the CSP work on 2026-07-05 and is the cheapest guardrail we have.
3. **Work in small commits.** One concern per commit. The message says what changed and names anything still unverified. Planning updates go in their own commit. Agents never write to `planning/scratch/`.
4. **Verify before claiming.** Run the checks below and read the output. "Tests pass" means the run was watched, not assumed. Distinguish _verified_ (ran it, saw it) from _expected_ (reasoned about it) in every report.
5. **Record.** Update the ROADMAP entry with what was done, what remains unverified, and the date. The ROADMAP is the place of record, not the chat transcript.
6. **Review.** Zack reads the diff commit by commit, runs the checks himself, and compares the ROADMAP claims to what he sees. Anything he cannot trace, he asks the agent to explain. Only then does the box get checked.
7. **Close.** Clean tree, push, confirm CI is green.

```sh
git log -p --reverse <base>..HEAD      # step 6: read the tranche in order
```

## The checks

Run from the repo root. On a fresh clone run `typecheck` before `lint`: lint's typed rules need the playground's generated `.astro` types, which typecheck produces.

```sh
pnpm install --frozen-lockfile
pnpm audit --prod
pnpm typecheck
pnpm lint
pnpm fmt
pnpm knip
pnpm --filter @grepco/astro-pagemeta check:engines
pnpm --filter @grepco/astro-pagemeta test
```

To prove a change on the other supported Astro major:

```sh
pnpm use-astro 6 && pnpm --filter @grepco/astro-pagemeta test
git restore pnpm-workspace.yaml playground/package.json pnpm-lock.yaml && pnpm install
```

The restore line resets those three files to the last commit. Commit any dependency changes before switching majors, or the switch-back discards them.

Behaviors that automated tests cannot cover are in the playground checklist ([`playground/README.md`](../playground/README.md)); run it before a release.

## Working agreements for agents

- Keep the tranche the size Zack asked for. Note further improvements in the ROADMAP or BACKLOG instead of doing them.
- Quote check output rather than summarizing it. Never report a step as done if it was skipped or failed.
- When a claim in the ROADMAP turns out to be wrong, correct the ROADMAP in the same tranche and say so.
- Prefer an explanation Zack can follow over a clever fix. If a change cannot be explained in a few sentences, it is too big for one commit.

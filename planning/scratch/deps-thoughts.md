Thoughts on the deps-security doc and decisions therein:

- sticks with caret ranges for deps, as you suggest
- bump the min release age to 7; also update the the deps script to match (ncu needs --cooldown b/c it doesn't auto-detect pnpm's setting, that I know of; worth quick researching to verify)
- agreed, renovate after M2; I've never used renovate, I'll need help figuring out
- sticking w/ only socket sounds good
    - though what's an OpenSSF scorecard? what is OpenSSF?
- yes, definitely using npm's OIDC system for authenticating publishing

Further, for M1: let's commit to dropping support for astro v5 now because it supports a node version (node 18) that is EOL.
For this, double-check I have a peer dep range set correctly on the integration for that.

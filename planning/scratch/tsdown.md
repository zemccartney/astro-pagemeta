## Here's what I'm thinking so far:

- target the node platform: https://tsdown.dev/options/platform
- package validation: https://tsdown.dev/options/lint
- need to update package.json to reference build files

- optimize for CLI, but allow for running locally
    - could be temporary, I want to be able to run tsdown on my own locally, to get a feel for how it works

- externalize astro dependencies: our integration source code references exports of astro, which is a peer dependency i.e. we assume will be provided by the using environment, so should not be bundled

- should use esm format exclusively

- failOnWarn: 'ci-only',

- create declaration files
    - turn on isolatedDeclarations, per tsdown's advice: https://tsdown.dev/options/dts#with-isolateddeclarations

## Here's what I don't understand:

- Should we generate and ship declaration map files? https://tsdown.dev/options/dts#declaration-map
    - I wonder if it makes sense to do so, and ship our original ts files, if that would allow consumers to map back to the original source code in their editors?

- Does it matter if we minify?
- Do we need source maps?
- Should I disable target transformations? https://tsdown.dev/options/target

All of these tie back to what I was confused about when I setup the various tsconfig files in astro-pagemeta, as documented in maintenance/tsconfig.md. That is, to quote tsdown's docs "You're building a library that will be further processed by the consuming application", which seems to apply to us: HOWEVER,

- some of our code won't be processed by astro, but will run directly on the user's host. specifically, our integration entrypoint, which runs during dev and build time, but not runtime i.e. when the build is shipped. so I assume that code must align with astro's node version support
- I have no idea how astro's node support relates to how it processes code during build time. as in, does astro transpile / downlevel user code? it seems like does for client-side code i.e. code that could end up in the browser, as its docs mention using vite's browser compatibility. but what about server-side? what guarantees does it make about the server-side code it outputs? Does it guarantee that it processes your code for compatibility with its node versions? That is, I wouldn't have to worry about writing my code to align with astro's node version support, given that Astro is the consuming application that will further process our code

The source maps question is really: how do errors from code output by our integration to end users show up in their build logs? Does Astro generate source maps such that its build output can map back to my integration's input files?

I guess the broader question: do we even need to bundle my library? Or could we ship raw ts files as-is, leaving the bundling / building to astro entirely? I don't think so today, since we can't guarantee end users are on a version of node with typescript support built in. but seems like in the future, once astro requires a minimum of node 24, we wouldn't need to build anything, given Astro already has a build step. Does that seem right?

## How will we check our work? I want to be able to test locally

I assume building will run as part of pnpm installing the workspace, such that playground will reference our build output?

To check this work, I want to:

- run tsdown locally, with publinting and attw checking available for now
- verify that the playground still uses the package correctly

/// <reference types="bun-types" />

/**
 * Makes `bun:test` visible to `tsc`, so the front-end's tests are typechecked
 * along with everything else.
 *
 * The root project takes the other route — `tsconfig.json` there excludes
 * `**\/*.test.ts` outright — which means its tests compile only in Bun's
 * runtime, where nothing checks them. Types are worth most in tests, where a
 * wrong stub shape is otherwise found by a confusing runtime failure, so this
 * package opts in instead.
 *
 * A `types` entry in tsconfig would have been the other way to do it, but that
 * key REPLACES automatic @types discovery rather than adding to it, so it would
 * have meant also naming node, react and react-dom and keeping that list
 * correct forever.
 */
export {};

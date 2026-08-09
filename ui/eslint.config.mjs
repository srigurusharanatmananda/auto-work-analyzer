/**
 * Replaces `.eslintrc.json`, because Next 16 removed `next lint`.
 *
 * That command was the only thing reading the old file: it shimmed eslintrc
 * into ESLint 9, which defaults to flat config and would otherwise ignore it.
 * With the shim gone, `next lint` resolves "lint" as a *directory argument*
 * and fails with "no such directory: ui/lint" — a message that says nothing
 * about the actual cause. So the script is now plain `eslint`, and the config
 * has to be flat for that to find it.
 *
 * `eslint-config-next@16` already exports flat arrays from
 * `./core-web-vitals` and `./typescript`, so this is a re-spelling of the two
 * lines the eslintrc had, not a change of policy.
 *
 * Separate from the repo-root `eslint.config.js`, which ignores `ui/**` and
 * exists for one purpose (unawaited Promises in `src/`). Two configs because
 * they lint two languages of problem, not because of the directory split.
 */

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const config = [
  {
    // Build output and deps. Flat config has no implicit ignores beyond
    // node_modules, and `.next/` holds generated code that fails every rule.
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
];

export default config;

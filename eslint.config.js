/**
 * One job: catch a Promise nobody waited for.
 *
 * The SQLite→Postgres move turned ~104 statements async, and every caller that
 * forgot an `await` still type-checked, because ignoring a Promise is legal
 * TypeScript. A review found four survivors — one made `GET /api/auth/me`
 * return an empty user to every caller, another let a scan mark a day complete
 * before its dedup rows were written, which is exactly the duplicate-task bug
 * the scan lease was built to prevent. `tsc` was clean and 944 tests passed the
 * whole time. Neither of those tools can see this class of bug; this one can.
 *
 * Deliberately NOT `recommendedTypeChecked`. Turning it on reported 931
 * problems, almost all pre-existing `any` usage and unnecessary assertions —
 * real smells, but a gate that fails 931 times is a gate nobody reads, and the
 * two rules that matter would be invisible inside it. Those cleanups are worth
 * doing as their own change, not as a condition of this one.
 *
 * `*.test.ts` is excluded from tsconfig, so type-aware linting cannot see it;
 * `allowDefaultProject` would lint it without type information, which for
 * these rules means not linting it at all.
 */

import tseslint from "typescript-eslint";

export default tseslint.config({
  files: ["src/**/*.ts"],
  ignores: ["**/*.test.ts", "dist/**", "node_modules/**", "ui/**"],
  extends: [tseslint.configs.base],
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    // `node:test`'s describe/test/it return a Promise that callers are not
    // meant to await — the runner owns it. Without this the *.nodetest.ts
    // files alone produce ~500 errors and drown every real one.
    "@typescript-eslint/no-floating-promises": [
      "error",
      {
        allowForKnownSafeCalls: [
          { from: "package", package: "node:test", name: ["describe", "test", "it"] },
        ],
      },
    ],
    "@typescript-eslint/await-thenable": "error",
    // `checksVoidReturn` off: it flags every `app.get(path, async (req, res) …)`,
    // which is how this codebase — and Express generally — is written. Those
    // handlers all catch internally. Leaving it on would mean ~30 unactionable
    // errors guarding nothing.
    "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
  },
});

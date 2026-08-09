#!/usr/bin/env bash
#
# Runs the *.nodetest.ts suite one file per `node --test` invocation.
#
# Why not a single `tsx --test "src/**/*.nodetest.ts"`: node:test runs files in
# parallel child processes, and under tsx that intermittently died with
#
#   Error: Unable to deserialize cloned data due to invalid or unsupported version
#       at node:internal/test_runner/runner
#
# which kills a whole FILE (so the total test count silently drops) and is never
# an assertion failure. It hit roughly 1 run in 3. Giving each file its own
# invocation removes the parallel IPC entirely: 4/4 clean where the parallel
# runner failed 2/6 on the same commit.
#
# Two things this also fixes: the reported total is now stable, so a dropped file
# is visible as a count change; and `/bin/sh` globstar being off no longer
# matters, because `find` does the walking (the old glob silently only matched
# one directory level deep).
#
# Slower than the parallel runner — that is the trade, and a suite whose green is
# trustworthy is worth more than a fast one that is not.
set -uo pipefail

total_pass=0
total_fail=0
failed_files=()

while IFS= read -r file; do
  output=$(npx tsx --test "$file" 2>&1)
  status=$?

  pass=$(printf '%s' "$output" | grep -oE '^ℹ pass [0-9]+' | grep -oE '[0-9]+' || echo 0)
  fail=$(printf '%s' "$output" | grep -oE '^ℹ fail [0-9]+' | grep -oE '[0-9]+' || echo 0)
  total_pass=$((total_pass + ${pass:-0}))
  total_fail=$((total_fail + ${fail:-0}))

  if [ "$status" -ne 0 ] || [ "${fail:-0}" -ne 0 ]; then
    failed_files+=("$file")
    printf '✖ %s (pass %s, fail %s)\n' "$file" "${pass:-0}" "${fail:-0}"
    printf '%s\n' "$output" | grep -E '✖|Error|AssertionError|actual:|expected:' | head -25
  else
    printf '✔ %s (%s)\n' "$file" "${pass:-0}"
  fi
done < <(find src -name '*.nodetest.ts' | sort)

printf '\nℹ pass %s\nℹ fail %s\n' "$total_pass" "$total_fail"

if [ ${#failed_files[@]} -ne 0 ]; then
  printf '\nFailed files:\n'
  printf '  %s\n' "${failed_files[@]}"
  exit 1
fi

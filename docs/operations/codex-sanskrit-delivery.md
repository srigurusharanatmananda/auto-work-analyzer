# Codex Sanskrit Delivery Automation

The repository now provides two local commands:

```sh
npm run learn:audit-sanskrit
npm run learn:verify-sanskrit
```

Use the project skill `sanskrit-curriculum-delivery` for each source-attested
tranche. It requires source evidence, a red-green manifest test, provenance
updates, and the focused verification gate.

## Optional Codex scheduled task

An account owner must create this in Codex because it is account-scoped. Use a
daily or manual schedule, give it repository access, and paste:

> Continue Sanskrit curriculum delivery on the active feature branch. Use the
> `sanskrit-curriculum-delivery` project skill. Work only from scan-backed
> sources and their answer keys; add a tranche only when every glyph and gloss
> is evidenced. Run `npm run learn:audit-sanskrit` and
> `npm run learn:verify-sanskrit`; commit and push review-ready changes. Stop
> only for a curriculum-policy decision or external-action approval.

The schedule should notify the owner of each pushed commit and stop on any
failed verification rather than retrying indefinitely.

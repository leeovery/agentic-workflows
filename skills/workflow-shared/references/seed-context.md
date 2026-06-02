# Read the Work's Seed

*Shared reference for the research, discussion, investigation, and scoping processing skills.*

---

A **seed** is the work unit's origin — the inbox item it was promoted from (tracked in `manifest.seeds[]`, stored under `seeds/`). It is the trigger the work was spawned from, not reference material it pulled in. Read it at phase start so its verbatim content (exact repro, stack trace, fully-worked idea) seeds this phase rather than being re-gathered.

## Read the Seed

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit} seeds
```

`get` returns empty on an absent field — treat empty as "no seed".

#### If `work_type` is `epic` or there is no seed

Nothing to read here. For an epic the seed sits above the topics and is broader than any single one — it surfaces as the relevant slice per topic through the knowledge base (the phase's contextual query handles that), so it is not bulk-read into a single topic. For work with no seed there is nothing to load.

→ Return to caller.

#### Otherwise

Single-topic work with a seed. Read each `seeds/{filename}.md` (paths are relative to `.workflows/{work_unit}/`) in full — its scope *is* this phase's scope, so it is the definitional input the phase builds on. Let it inform how you open and what you focus on; don't dump it back to the user verbatim.

→ Return to caller.

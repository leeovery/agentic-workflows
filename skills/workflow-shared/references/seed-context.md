# Read the Work's Seed

*Shared reference for the research, discussion, investigation, and scoping processing skills.*

---

The work unit's **seed** is its origin — a promoted inbox item, tracked in `manifest.seeds[]` and stored under `seeds/`.

## Read the Seed

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit} seeds
```

`get` returns empty on an absent field — treat empty as "no seed".

#### If `work_type` is `epic` or there is no seed

Nothing to read here. (For an epic, the seed surfaces per topic via the knowledge base, not here.)

→ Return to caller.

#### Otherwise

Read each `seeds/{filename}.md` (paths are relative to `.workflows/{work_unit}/`) in full and use it to seed this phase. Don't dump it back to the user verbatim.

→ Return to caller.

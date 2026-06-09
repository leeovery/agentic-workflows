# Pivot to Epic

*Shared reference. Loaded by `workflow-start` (manage menu), `workflow-research-process`, and `workflow-discussion-process` (off-topic pivot) to convert a single-topic feature into an epic.*

---

Converts a feature work unit into an epic: flips its `work_type`, re-indexes its completed artifacts so chunk metadata stays in sync, and registers its single topic on the new discovery map. Mechanical only — the caller owns the user-facing framing and the commit (this reference writes the manifest but does **not** commit).

## Parameters

The caller provides this via context before loading:

- `work_unit` — the feature being converted. Its single topic shares the work unit's name.

## A. Convert the Work Type

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit} work_type epic
```

→ Proceed to **B. Re-Index Completed Artifacts**.

## B. Re-Index Completed Artifacts

Re-index so every completed chunk carries the new `work_type: epic`:

→ Load **[reindex-work-unit.md](../../workflow-knowledge/references/reindex-work-unit.md)** with work_unit = `{work_unit}`.

→ Proceed to **C. Register the Topic on the Discovery Map**.

## C. Register the Topic on the Discovery Map

The feature's single topic (topic name = work unit name) joins the discovery map. Leave `summary` and `description` unset — `summary-backfill.md` fills them on the next `/workflow-continue-epic` entry.

Determine routing from whether the feature did research:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}.research
```

Create the map item — `routing` is `research` if the research phase exists, otherwise `discussion`:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs create-discovery-topic {work_unit}.{work_unit} --routing {research|discussion} --source discovery
```

No commit here — the caller frames the conversion and folds this write into its own commit.

→ Return to caller.

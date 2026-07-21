# Pivot to Epic

*Shared reference. Loaded by `workflow-start` (manage menu), `workflow-research-process`, and `workflow-discussion-process` (off-topic pivot) to convert a single-topic feature into an epic.*

---

One engine transaction converts the feature: flips `work_type: epic` in the work-unit manifest and the project manifest's registration, registers the feature's single topic (topic name = work unit name) on the discovery map — routing reflects whether the feature did research; `summary`/`description` are left unset for `summary-backfill.md` to fill on the next `/workflow-continue-epic` entry — re-indexes the unit so chunk metadata carries the new work_type, and commits both manifests.

## Parameters

The caller provides this via context before loading:

- `work_unit` — the feature being converted. Its single topic shares the work unit's name.

## A. Run the Pivot

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit pivot {work_unit}
```

Emit the response's `DISPLAY: kb warning` section when present, verbatim per its marker. (The response's `MENU: pivot continuation` section is emitted by the caller at its menu step.)

→ Return to caller.

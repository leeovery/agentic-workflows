# Pivot to Epic

*Shared reference. Loaded by `workflow-start` (manage menu), `workflow-research-process`, and `workflow-discussion-process` (off-topic pivot) to convert a single-topic feature into an epic.*

---

One engine transaction converts the feature: flips `work_type: epic` in the work-unit manifest and the project manifest's registration, registers the feature's single topic (topic name = work unit name) on the discovery map — routing reflects whether the feature did research; `summary`/`description` are left unset for `summary-backfill.md` to fill on the next `/workflow-continue-epic` entry — re-indexes the unit so chunk metadata carries the new work_type, and commits both manifests.

## Parameters

The caller provides this via context before loading:

- `work_unit` — the feature being converted. Its single topic shares the work unit's name.

## A. Run the Pivot

Pass `--continuation-menu` only when the caller's flow has a menu step for the response's `MENU: pivot continuation` section (the manage flow does; the off-topic reroute paths do not — they continue their session and must omit the flag).

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit pivot {work_unit} [--continuation-menu]
```

Emit the response's `DISPLAY: kb warning` section when present, verbatim per its marker. (With `--continuation-menu`, the response also carries `MENU: pivot continuation` — the caller emits it at its menu step.)

→ Return to caller.

# Backfill Checks

*Reference for **[continue-epic](../SKILL.md)***

---

Dispatches one-time-per-project recovery work. The caller's gate has already verified that at least one of the two checks below has work; this reference runs the gates in order — legacy-bridge first (because it may modify the map), then summary-backfill (with fresh state if legacy-split ran).

The caller provides via context:

- `work_unit` — the epic's work unit name
- `qualifying_sources` — legacy-bridge detector output (parsed from `detect.cjs`)
- `items_to_recover` — list of map items missing `summary` or `description`

## A. Legacy-Bridge Gate

#### If `qualifying_sources` is non-empty

Invoke the **[workflow-legacy-research-split](../../workflow-legacy-research-split/SKILL.md)** skill with work_unit = `{work_unit}`. Follow its instructions as written.

On return, re-run discovery so **B** sees the post-split map state:

```bash
node .claude/skills/continue-epic/scripts/discovery.cjs {work_unit}
```

Re-filter `discovery_map` for items where `summary` or `description` is null or missing. Overwrite `items_to_recover` with this fresh list — legacy-split creates themes with full metadata and removes the source's inception item, so the caller's pre-split filter is stale.

→ Proceed to **B. Summary-Backfill Gate**.

#### If `qualifying_sources` is empty

→ Proceed to **B. Summary-Backfill Gate**.

## B. Summary-Backfill Gate

#### If `items_to_recover` is non-empty

Load **[summary-backfill.md](summary-backfill.md)** with work_unit = `{work_unit}`, items_to_recover = `{items_to_recover}`.

→ Return to caller.

#### If `items_to_recover` is empty

→ Return to caller.

# Backfill Checks

*Reference for **[workflow-continue-epic](../SKILL.md)***

---

Dispatches one-time-per-project recovery work. The caller's gate has already verified that at least one of the two checks below has work; this reference runs the gates in order — legacy-bridge first (because it may modify the map), then summary-backfill (with fresh state if legacy-split ran).

The caller provides via context:

- `work_unit` — the epic's work unit name
- `qualifying_sources` — legacy-bridge detector output (parsed from `detect.cjs`)
- `items_to_recover` — list of map items where `summary_present` is false or `description_present` is false

## A. Legacy-Bridge Gate

#### If `qualifying_sources` is non-empty

Invoke the **[workflow-legacy-research-split](../../workflow-legacy-research-split/SKILL.md)** skill with work_unit = `{work_unit}`. Follow its instructions as written.

On return, re-run discovery so **B** sees the post-split map state:

```bash
node .claude/skills/workflow-continue-epic/scripts/discovery.cjs {work_unit}
```

Re-filter `discovery_map` for items where `summary_present` is false or `description_present` is false. Overwrite `items_to_recover` with this fresh list — legacy-split creates themes with full metadata and removes the source's discovery item, so the caller's pre-split filter is stale.

→ Proceed to **B. Summary-Backfill Gate**.

#### If `qualifying_sources` is empty

→ Proceed to **B. Summary-Backfill Gate**.

## B. Summary-Backfill Gate

#### If `items_to_recover` is non-empty

Load **[summary-backfill.md](summary-backfill.md)** with work_unit = `{work_unit}`, items_to_recover = `{items_to_recover}`.

→ Proceed to **C. Advise Restart**.

#### If `items_to_recover` is empty

→ Proceed to **C. Advise Restart**.

## C. Advise Restart

Mutations from A and B are already committed. Returning to the caller would continue Step 6 onward inside the same conversation, but the backfill pass — particularly legacy decomposition — is context-heavy by design. Hand the user a fresh window before the rest of `/workflow-continue-epic` runs.

> *Output the next fenced block as a code block:*

```
── Backfill Complete ────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Backfill work is recorded and committed. This pass was
> context-heavy — decomposing legacy research files and
> drafting missing discovery summaries from source content.
>
> Run `/clear`, then `/workflow-start` to pick up with a clean
> window. The backfill gates will be no-ops on the next pass:
> legacy sources are now renamed and excluded, and populated
> summaries skip the recovery filter — the normal epic flow
> takes over immediately.
```

**STOP.** Terminal — do not return to the caller's Step 6.

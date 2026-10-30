# Backfill Checks

*Reference for **[workflow-continue-epic](../SKILL.md)***

---

Dispatches one-time-per-project recovery work. The caller's gate has already verified that at least one of the two checks below has work; this reference runs the gates in order — legacy-bridge first (because it may modify the map), then summary-backfill (with fresh state if legacy-split ran).

The caller provides via context:

- `work_unit` — the epic's work unit name
- `qualifying_sources` — legacy-bridge detector output (parsed from `detect.cjs`)
- `items_to_recover` — list of map rows where `summary=absent` or `description=absent`
- `completed_phase`, `outcome` — what the epic menu received, where it arrived from a phase that concluded, paused or left its topic; unset otherwise

## A. Legacy-Bridge Gate

#### If `qualifying_sources` is non-empty

Invoke the **[workflow-legacy-research-split](../../workflow-legacy-research-split/SKILL.md)** skill with work_unit = `{work_unit}`. Follow its instructions as written.

On return, re-run discovery so **B** sees the post-split map state:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs {work_unit}
```

Re-filter `discovery_map` for rows where `summary=absent` or `description=absent`. Overwrite `items_to_recover` with this fresh list — legacy-split creates themes with full metadata and removes the source's discovery item, so the caller's pre-split filter is stale.

→ Proceed to **B. Summary-Backfill Gate**.

#### If `qualifying_sources` is empty

→ Proceed to **B. Summary-Backfill Gate**.

## B. Summary-Backfill Gate

#### If `items_to_recover` is non-empty

Load **[summary-backfill.md](summary-backfill.md)** with work_unit = `{work_unit}`, items_to_recover = `{items_to_recover}`.

→ On return, proceed to **C. Start Afresh**.

#### If `items_to_recover` is empty

→ Proceed to **C. Start Afresh**.

## C. Start Afresh

#### If nothing was committed this pass

No legacy split ran and the batch wrote nothing (skipped) — no recovery work landed, and nothing context-heavy happened. The skipped items re-offer on the next epic entry.

→ Return to caller.

#### Otherwise

Mutations from A and B are already committed, and the backfill pass — particularly legacy decomposition — is context-heavy by design, so the epic menu starts afresh rather than continuing in this conversation.

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Backfill Complete`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Backfill work is recorded and committed — legacy research files decomposed and missing discovery summaries drafted from source content. The epic picks up from here.
```

Set `route` = `/workflow-continue-epic {work_unit} {completed_phase} {outcome}` where `completed_phase` and `outcome` are set, else `/workflow-continue-epic {work_unit}`.

→ Load **[handing-off.md](../../workflow-shared/references/handing-off.md)** with route = `{route}`.

# Backfill Checks

*Reference for **[leeway-continue-epic](../SKILL.md)***

---

Dispatches one-time-per-project recovery work — the summary backfill. The caller's gate has already verified it has work.

The caller provides via context:

- `work_unit` — the epic's work unit name
- `items_to_recover` — list of map rows where `summary=absent` or `description=absent`
- `completed_phase`, `outcome` — what the epic menu received, where it arrived from a phase that concluded, paused or left its topic; unset otherwise

## A. Summary Backfill

Load **[summary-backfill.md](summary-backfill.md)** with work_unit = `{work_unit}`, items_to_recover = `{items_to_recover}`.

→ On return, proceed to **B. Start Afresh**.

## B. Start Afresh

#### If nothing was committed this pass

The batch wrote nothing (skipped) — no recovery work landed, and nothing context-heavy happened. The skipped items re-offer on the next epic entry.

→ Return to caller.

#### Otherwise

The backfill's writes are already committed, and the pass is context-heavy by design, so the epic menu starts afresh rather than continuing in this conversation.

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Backfill Complete`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Backfill work is recorded and committed — missing discovery summaries drafted from source content. The epic picks up from here.
```

Set `route` = `/leeway-continue-epic {work_unit} {completed_phase} {outcome}` where `completed_phase` and `outcome` are set, else `/leeway-continue-epic {work_unit}`.

→ Load **[handing-off.md](../../leeway-shared/references/handing-off.md)** with route = `{route}`.

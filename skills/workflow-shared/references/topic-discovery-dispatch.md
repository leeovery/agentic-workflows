# Topic Discovery Dispatch

*Shared reference. Loaded by `workflow-continue-epic` and `workflow-bridge`.*

---

Wraps the cache-status check and conditional dispatch around [topic-discovery.md](topic-discovery.md). Both `workflow-continue-epic` (Step 6) and `workflow-bridge` (section B of `epic-continuation.md`) run the same dispatch pattern: read analysis-cache status from a prior discovery output, fire the analysis when its cache is stale, re-run discovery to pick up auto-added items.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name. Always present.
- `analysis_caches` — the `analysis_caches` line from the caller's prior `workflow-continue-epic/scripts/gateway.cjs` invocation: `gap_analysis=<status>`.

The caller is also responsible for surfacing `new_arrivals` afterwards (e.g. as a callout above the discovery map).

## A. Initialise Tracker

Initialise an in-conversation tracker:

```
new_arrivals = { gap_analysis: [] }
```

This tracker is populated by `topic-discovery.md` when the analysis fires below. The caller reads it after this reference returns — the key exists even when no analysis fires.

→ Proceed to **B. Cache Status Check**.

## B. Cache Status Check

Read the status from the caller's `analysis_caches` line: `gap_analysis` — `valid` | `stale` | `absent`.

#### If the cache is `valid` or `absent`

Nothing to run. `new_arrivals` stays empty.

→ Return to caller.

#### If the cache is `stale`

The analysis reads completed corpora, and a live peer session is mid-conversation on material it would read. Check first:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs presence scan {work_unit}
```

**If the response has `live_sources` greater than `0`:**

Hold off — the cache self-heals at the next entry once those sessions conclude. Emit the response's `DISPLAY: presence deferral` section verbatim at this moment. `new_arrivals` stays empty.

→ Return to caller.

**Otherwise:**

→ Proceed to **C. Dispatch and Re-discover**.

## C. Dispatch and Re-discover

→ Load **[topic-discovery.md](topic-discovery.md)** with work_unit = `{work_unit}`.

On return, `topic-discovery.md` has populated `new_arrivals` with any items added by the analysis.

Re-run discovery so the caller sees fresh state including any auto-added items:

```bash
node .claude/skills/workflow-continue-epic/scripts/gateway.cjs {work_unit}
```

→ Return to caller.

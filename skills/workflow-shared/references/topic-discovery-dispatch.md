# Topic Discovery Dispatch

*Shared reference. Loaded by `workflow-continue-epic` and `workflow-bridge`.*

---

Wraps the cache-status check and conditional dispatch around [topic-discovery.md](topic-discovery.md). Both `workflow-continue-epic` (Step 6) and `workflow-bridge` (section B of `epic-continuation.md`) run the same dispatch pattern: read analysis-cache status from a prior discovery output, fire the analyses when caches are stale, re-run discovery to pick up auto-added items.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name. Always present.
- `analysis_caches` — the `analysis_caches` object from the caller's prior `workflow-continue-epic/scripts/discovery.cjs` invocation. Shape: `{research_analysis: {status, ...}, gap_analysis: {status, ...}}`.

The caller is also responsible for surfacing `new_arrivals` afterwards (e.g. as a callout above the discovery map).

## A. Initialise Tracker

Initialise an in-conversation tracker:

```
new_arrivals = {}
```

This tracker is populated by `topic-discovery.md` when analyses fire below. The caller reads it after this reference returns.

→ Proceed to **B. Cache Status Check**.

## B. Cache Status Check

Read `analysis_caches` from the caller's prior discovery output:

- `analysis_caches.research_analysis.status` — `valid` | `stale` | `absent`
- `analysis_caches.gap_analysis.status` — same

#### If both caches are `valid` or `absent`

No analyses to run. `new_arrivals` stays empty.

→ Return to caller.

#### If at least one cache is `stale`

→ Proceed to **C. Dispatch and Re-discover**.

## C. Dispatch and Re-discover

→ Load **[topic-discovery.md](topic-discovery.md)** with work_unit = `{work_unit}`.

On return, `topic-discovery.md` has populated `new_arrivals` with any items added by the analyses.

Re-run discovery so the caller sees fresh state including any auto-added items:

```bash
node .claude/skills/workflow-continue-epic/scripts/discovery.cjs {work_unit}
```

→ Return to caller.

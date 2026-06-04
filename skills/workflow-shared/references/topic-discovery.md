# Topic Discovery

*Shared reference. Loaded by [topic-discovery-dispatch.md](topic-discovery-dispatch.md), which `workflow-continue-epic` and `workflow-bridge` run.*

---

Drives cache-based dispatch of `research-analysis` and `discovery-gap-analysis` against an epic's discovery map. For each stale analysis the flow is **stage → present → approve → write → stamp**: the analysis stages its genuinely-new candidates to a per-analysis staging file, the approval gate ([analysis-approval-gate.md](analysis-approval-gate.md)) presents each for per-topic approval, approved candidates are written to `phases.discovery.items.{topic}` with `source` provenance, and the cache is stamped once the gate completes. The no-gate cases (already-on-map, dismissed) are resolved silently at stage time and respect the per-work-unit `phases.discovery.dismissed[]` list.

The gate runs before the dashboard — it is the boot-time review surface for both callers. Hosting the orchestration here covers both boot callers (`workflow-continue-epic` Step 6 and `workflow-bridge` section B) via the shared dispatch.

Each analysis self-gates on a precondition (research-analysis needs at least one completed research item; gap-analysis needs at least one completed research OR discussion item). When the precondition fails the analysis returns without staging, gating, or stamping — dispatching on `stale` is safe even when no qualifying inputs exist yet.

**Decline vs defer.** Skipping every candidate (decline-all) still stamps the cache, so the analysis won't re-fire. **Deferring** at the gate leaves every candidate `pending` and does **not** stamp — the still-valid staging file is re-presented next boot rather than re-running the analysis. Keep these strictly distinct.

The caller is responsible for surfacing the result — `workflow-continue-epic` shows a callout above the discovery map; `workflow-bridge` does the same on its epic-continuation display.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name. Always present.

## A. Read Cache State

> *Output the next fenced block as a code block:*

```
·· Cache Check ··································
```

Run discovery for the work unit:

```bash
node .claude/skills/workflow-discovery/scripts/discovery.cjs {work_unit}
```

Parse `analysis_caches` from the output:

- `analysis_caches.research_analysis` — `{status, generated, files}` for the research-analysis cache. `status` is `valid` | `stale` | `absent`.
- `analysis_caches.gap_analysis` — same shape for the gap-analysis cache.

Initialise an in-conversation tracker:

```
new_arrivals = { research_analysis: [], gap_analysis: [] }
```

This tracker captures topic names **approved and written** during this run, per analysis — the approval gate appends a name only when the user approves the candidate, so the caller's `⚑ N new topics` callout counts approvals, not proposals. The caller reads it after **E. Return**.

→ Proceed to **B. Run Research Analysis if Stale**.

## B. Run Research Analysis if Stale

Research-analysis runs first because gap-analysis reads its cache file as a secondary input.

#### If `analysis_caches.research_analysis.status` is `stale`

> *Output the next fenced block as a code block:*

```
·· Research Analysis ····························
```

**Stage or reuse.** Check `.workflows/{work_unit}/.state/research-analysis-candidates.md`. If it exists with at least one `status: pending` candidate, the analysis was deferred on a prior boot — reuse it and skip staging. Otherwise stage fresh:

→ Load **[research-analysis.md](research-analysis.md)** with work_unit = `{work_unit}`.

On return (or on reuse), run the approval gate over the staged candidates:

→ Load **[analysis-approval-gate.md](analysis-approval-gate.md)** with analysis = `research-analysis`, work_unit = `{work_unit}`, tracker = `new_arrivals.research_analysis`, staging_file = `.workflows/{work_unit}/.state/research-analysis-candidates.md`.

On return, read `gate_outcome`.

**If `gate_outcome` is `processed`:**

Stamp the cache (a decline-all pass still stamps, so the analysis won't re-fire):

→ Load **[research-analysis.md](research-analysis.md)** for **E. Update Cache** and follow its instructions. When it returns:

→ Proceed to **C. Run Gap Analysis if Stale**.

**If `gate_outcome` is `deferred`:**

Leave the cache stale so the still-valid staging file is re-presented next boot.

→ Proceed to **C. Run Gap Analysis if Stale**.

#### Otherwise (`valid` or `absent`)

No dispatch.

→ Proceed to **C. Run Gap Analysis if Stale**.

## C. Run Gap Analysis if Stale

#### If `analysis_caches.gap_analysis.status` is `stale`

> *Output the next fenced block as a code block:*

```
·· Gap Analysis ·································
```

**Stage or reuse.** Check `.workflows/{work_unit}/.state/discovery-gap-analysis-candidates.md`. If it exists with at least one `status: pending` candidate, the analysis was deferred on a prior boot — reuse it and skip staging. Otherwise stage fresh:

→ Load **[discovery-gap-analysis.md](discovery-gap-analysis.md)** with work_unit = `{work_unit}`.

On return (or on reuse), run the approval gate over the staged candidates:

→ Load **[analysis-approval-gate.md](analysis-approval-gate.md)** with analysis = `discovery-gap-analysis`, work_unit = `{work_unit}`, tracker = `new_arrivals.gap_analysis`, staging_file = `.workflows/{work_unit}/.state/discovery-gap-analysis-candidates.md`.

On return, read `gate_outcome`.

**If `gate_outcome` is `processed`:**

Stamp the cache (a decline-all pass still stamps, so the analysis won't re-fire):

→ Load **[discovery-gap-analysis.md](discovery-gap-analysis.md)** for **E. Update Cache** and follow its instructions. When it returns:

→ Proceed to **D. Dedupe Sources**.

**If `gate_outcome` is `deferred`:**

Leave the cache stale so the still-valid staging file is re-presented next boot.

→ Proceed to **D. Dedupe Sources**.

#### Otherwise (`valid` or `absent`)

No dispatch.

→ Proceed to **D. Dedupe Sources**.

## D. Dedupe Sources

When both analyses surface the same kebab-case theme, research-analysis runs first; if the user approves it, the item is on the map by the time gap-analysis stages. Gap-analysis's **D. Filter and Stage** then takes the already-on-map branch and silently merges the source (`research-analysis:{parent},gap-analysis`) instead of staging a duplicate.

If a name appears in both `new_arrivals.research_analysis` and `new_arrivals.gap_analysis`, treat it as a research-analysis arrival only for caller-side display purposes (single callout entry, single Topic Discovery Arrivals bullet). The manifest already records the comma-joined source.

→ Proceed to **E. Return**.

## E. Return

The caller reads `new_arrivals` from conversation memory:

- **`workflow-continue-epic`** — passes `new_arrivals` to `epic-display-and-menu.md` for the `⚑ N new topics added to the map from {analysis}` callout above the Discovery Map. Callout is rendered once at this boot-up; subsequent boots without changes don't repeat it.
- **`workflow-bridge`** — same callout pattern on its epic-continuation menu, populated by the same `new_arrivals` tracker.

→ Return to caller.

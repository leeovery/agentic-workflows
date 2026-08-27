# Topic Discovery

*Shared reference. Loaded by [topic-discovery-dispatch.md](topic-discovery-dispatch.md), which `workflow-continue-epic` and `workflow-bridge` run.*

---

Drives cache-based dispatch of `discovery-gap-analysis` against an epic. When the cache is stale the flow is **stage → present → approve → write → stamp**: the analysis stages its genuinely-new candidates to a staging file, the gate ([analysis-approval-gate.md](analysis-approval-gate.md)) presents each for per-item approval, approved items are written to `phases.discovery.items.{topic}` with `source` provenance, and the cache is stamped once the gate completes. The no-gate cases (already-on-map, dismissed) are resolved silently at stage time against the per-work-unit `phases.discovery.dismissed[]` list.

The gate runs before the dashboard — it is the boot-time review surface for both callers. Hosting the orchestration here covers both boot callers (`workflow-continue-epic` Step 6 and `workflow-bridge` section B) via the shared dispatch.

The analysis self-gates on a precondition (at least one completed research OR discussion item). When the precondition fails it returns without staging, gating, or stamping — dispatching on `stale` is safe even when no qualifying inputs exist yet.

Skipping every candidate (decline-all) still stamps the cache, so the analysis won't re-fire until its inputs change.

The caller is responsible for surfacing the result — `workflow-continue-epic` shows a callout above the discovery map; `workflow-bridge` does the same on its epic-continuation display.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name. Always present.

## A. Read Cache State

Run discovery for the work unit:

```bash
node .claude/skills/workflow-discovery/scripts/gateway.cjs {work_unit}
```

Parse the `analysis_caches` line from the output (`gap_analysis=<status>`): `valid` | `stale` | `absent`.

Initialise an in-conversation tracker:

```
new_arrivals = { gap_analysis: [] }
```

This tracker captures topic names **approved and written** during this run — the gate appends a name only when the user approves the item, so the caller's callout counts approvals, not proposals. The caller reads it after **D. Return**.

→ Proceed to **B. Run Gap Analysis if Stale**.

## B. Run Gap Analysis if Stale

#### If `analysis_caches.gap_analysis.status` is `stale`

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Gap Analysis`**
```

**Stage or reuse.** Check the manifest: `manifest get {work_unit}.discovery analysis_staging.discovery-gap-analysis`.

**If any candidate there is `pending`** — a prior session staged candidates the gate never finished walking. Reuse the staged file and skip staging; nothing is re-read:

> *Output the next fenced block as markdown (not a code block):*

```
> Presenting the gap candidates still awaiting review from the last run — the analysis has not re-run.
```

**Otherwise** — stage fresh:

> *Output the next fenced block as markdown (not a code block):*

```
> Reading all completed research and discussions together for what fell between them — themes no discussion picked up, deferred threads, and decisions that interact where no topic covers the join. Approved candidates join the map as new topics.
```

→ Load **[discovery-gap-analysis.md](discovery-gap-analysis.md)** with work_unit = `{work_unit}`.

On return (or on reuse), run the approval gate over the staged candidates:

→ Load **[analysis-approval-gate.md](analysis-approval-gate.md)** with work_unit = `{work_unit}`, tracker = `new_arrivals.gap_analysis`.

On return, stamp the cache (a decline-all pass still stamps, so the analysis won't re-fire):

→ Load **[discovery-gap-analysis.md](discovery-gap-analysis.md)** for **E. Update Cache** and follow its instructions. When it returns:

→ On return, proceed to **C. Sweep**.

#### Otherwise (`valid` or `absent`)

No dispatch.

→ Proceed to **C. Sweep**.

## C. Sweep

The analysis and its gate write state nothing self-commits — the staging file and gate registrations, spent-state clears, the cache file, manifest stamps, knowledge-store dirt. Check for leavings:

```bash
git status --porcelain -- .workflows/{work_unit}/.state .workflows/{work_unit}/manifest.json .workflows/.knowledge
```

#### If the tree is dirty

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --state -m "discovery({work_unit}): analysis run bookkeeping"
```

→ Proceed to **D. Return**.

#### Otherwise

Every write was already carried by a self-committing delivery — nothing to sweep.

→ Proceed to **D. Return**.

## D. Return

The caller reads `new_arrivals` from conversation memory:

- **`workflow-continue-epic`** — passes `new_arrivals` to `epic-display-and-menu.md` for the callout above the Discovery Map: `⚑ N new topics added to the map from gap-analysis`. Callouts are rendered once at this boot-up; subsequent boots without changes don't repeat them.
- **`workflow-bridge`** — same callout pattern on its epic-continuation menu, populated by the same `new_arrivals` tracker.

→ Return to caller.

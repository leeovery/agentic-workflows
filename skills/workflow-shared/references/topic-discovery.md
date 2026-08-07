# Topic Discovery

*Shared reference. Loaded by [topic-discovery-dispatch.md](topic-discovery-dispatch.md), which `workflow-continue-epic` and `workflow-bridge` run.*

---

Drives cache-based dispatch of `research-analysis`, `discovery-gap-analysis`, and `coherence-analysis` against an epic. For each stale analysis the flow is **stage → present → approve → write → stamp**: the analysis stages its genuinely-new candidates to a per-analysis staging file, the gate presents each for per-item approval, approved items are written, and the cache is stamped once the gate completes. The two topic analyses share the approval gate ([analysis-approval-gate.md](analysis-approval-gate.md)) and write approved candidates to `phases.discovery.items.{topic}` with `source` provenance, resolving the no-gate cases (already-on-map, dismissed) silently at stage time against the per-work-unit `phases.discovery.dismissed[]` list. Coherence-analysis writes no map items — its gate ([coherence-findings-gate.md](coherence-findings-gate.md)) delivers approved findings through triage, reopening the yielding discussion; its skip fingerprints live in `phases.discovery.dismissed_findings[]`.

The gates run before the dashboard — they are the boot-time review surface for both callers. Hosting the orchestration here covers both boot callers (`workflow-continue-epic` Step 6 and `workflow-bridge` section B) via the shared dispatch.

Each analysis self-gates on a precondition (research-analysis needs at least one completed research item; gap-analysis needs at least one completed research OR discussion item; coherence-analysis needs at least two completed discussion items). When the precondition fails the analysis returns without staging, gating, or stamping — dispatching on `stale` is safe even when no qualifying inputs exist yet.

**Decline vs defer.** Skipping every candidate (decline-all) still stamps the cache, so the analysis won't re-fire. **Deferring** at the gate leaves every candidate `pending` and does **not** stamp — the still-valid staging file is re-presented next boot rather than re-running the analysis. Keep these strictly distinct.

The caller is responsible for surfacing the result — `workflow-continue-epic` shows a callout above the discovery map; `workflow-bridge` does the same on its epic-continuation display.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name. Always present.

## A. Read Cache State

Run discovery for the work unit:

```bash
node .claude/skills/workflow-discovery/scripts/gateway.cjs {work_unit}
```

Parse the `analysis_caches` line from the output (`research_analysis=<status>, gap_analysis=<status>, coherence_analysis=<status>`):

- `research_analysis` — `valid` | `stale` | `absent`
- `gap_analysis` — same for the gap-analysis cache.
- `coherence_analysis` — same for the coherence-analysis cache.

Initialise an in-conversation tracker:

```
new_arrivals = { research_analysis: [], gap_analysis: [], coherence_analysis: [] }
```

This tracker captures topic names **approved and written** during this run, per analysis — a gate appends a name only when the user approves the item, so the caller's callouts count approvals, not proposals. The two topic analyses collect topics added to the map; `coherence_analysis` collects topics **reopened** by landed findings. The caller reads it after **G. Return**.

→ Proceed to **B. Run Research Analysis if Stale**.

## B. Run Research Analysis if Stale

Research-analysis runs first so that a theme both analyses surface is already on the map when gap-analysis stages — its already-on-map branch then merges provenance instead of staging a duplicate (see **E. Dedupe Sources**).

#### If `analysis_caches.research_analysis.status` is `stale`

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Research Analysis`**
```

**Stage or reuse.** Check the manifest: `manifest get {work_unit}.discovery analysis_staging.research-analysis`.

**If any candidate there is `pending`** — the analysis was deferred on a prior boot. Reuse the staged file and skip staging; nothing is re-read:

> *Output the next fenced block as markdown (not a code block):*

```
> Presenting the follow-up topic candidates you deferred last boot — the analysis has not re-run.
```

**Otherwise** — stage fresh:

> *Output the next fenced block as markdown (not a code block):*

```
> Reading your completed research for follow-up themes that deserve a topic of their own. Each candidate comes to you for approval before anything lands on the map.
```

→ Load **[research-analysis.md](research-analysis.md)** with work_unit = `{work_unit}`.

On return (or on reuse), run the approval gate over the staged candidates:

→ Load **[analysis-approval-gate.md](analysis-approval-gate.md)** with analysis = `research-analysis`, work_unit = `{work_unit}`, tracker = `new_arrivals.research_analysis`, staging_file = `.workflows/{work_unit}/.state/research-analysis-candidates.md`.

On return, read `gate_outcome`.

**If `gate_outcome` is `processed`:**

Stamp the cache (a decline-all pass still stamps, so the analysis won't re-fire):

→ Load **[research-analysis.md](research-analysis.md)** for **E. Update Cache** and follow its instructions. When it returns:

→ On return, proceed to **C. Run Gap Analysis if Stale**.

**If `gate_outcome` is `deferred`:**

Leave the cache stale so the still-valid staging file is re-presented next boot.

→ Proceed to **C. Run Gap Analysis if Stale**.

#### Otherwise (`valid` or `absent`)

No dispatch.

→ Proceed to **C. Run Gap Analysis if Stale**.

## C. Run Gap Analysis if Stale

#### If `analysis_caches.gap_analysis.status` is `stale`

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Gap Analysis`**
```

**Stage or reuse.** Check the manifest: `manifest get {work_unit}.discovery analysis_staging.discovery-gap-analysis`.

**If any candidate there is `pending`** — the analysis was deferred on a prior boot. Reuse the staged file and skip staging; nothing is re-read:

> *Output the next fenced block as markdown (not a code block):*

```
> Presenting the gap candidates you deferred last boot — the analysis has not re-run.
```

**Otherwise** — stage fresh:

> *Output the next fenced block as markdown (not a code block):*

```
> Reading all completed research and discussions together for what fell between them — themes no discussion picked up, deferred threads, and decisions that interact where no topic covers the join. Approved candidates join the map as new topics.
```

→ Load **[discovery-gap-analysis.md](discovery-gap-analysis.md)** with work_unit = `{work_unit}`.

On return (or on reuse), run the approval gate over the staged candidates:

→ Load **[analysis-approval-gate.md](analysis-approval-gate.md)** with analysis = `discovery-gap-analysis`, work_unit = `{work_unit}`, tracker = `new_arrivals.gap_analysis`, staging_file = `.workflows/{work_unit}/.state/discovery-gap-analysis-candidates.md`.

On return, read `gate_outcome`.

**If `gate_outcome` is `processed`:**

Stamp the cache (a decline-all pass still stamps, so the analysis won't re-fire):

→ Load **[discovery-gap-analysis.md](discovery-gap-analysis.md)** for **E. Update Cache** and follow its instructions. When it returns:

→ On return, proceed to **D. Run Coherence Analysis if Stale**.

**If `gate_outcome` is `deferred`:**

Leave the cache stale so the still-valid staging file is re-presented next boot.

→ Proceed to **D. Run Coherence Analysis if Stale**.

#### Otherwise (`valid` or `absent`)

No dispatch.

→ Proceed to **D. Run Coherence Analysis if Stale**.

## D. Run Coherence Analysis if Stale

#### If `analysis_caches.coherence_analysis.status` is `stale`

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Coherence Check`**
```

**Stage or reuse.** Check the manifest: `manifest get {work_unit}.discovery analysis_staging.coherence-analysis`.

**If any candidate there is `pending`** — the analysis was deferred on a prior boot. Reuse the staged file and skip staging; nothing is re-read:

> *Output the next fenced block as markdown (not a code block):*

```
> Presenting the coherence findings you deferred last boot — the analysis has not re-run.
```

**Otherwise** — stage fresh:

> *Output the next fenced block as markdown (not a code block):*

```
> Re-reading the full discussion corpus for decisions that no longer cohere — unacknowledged conflicts, references to since-changed decisions, ambiguities with one clear home document. Approved findings reopen the yielding discussion through triage.
```

→ Load **[coherence-analysis.md](coherence-analysis.md)** with work_unit = `{work_unit}`.

On return (or on reuse), run the findings gate over the staged findings:

→ Load **[coherence-findings-gate.md](coherence-findings-gate.md)** with work_unit = `{work_unit}`, tracker = `new_arrivals.coherence_analysis`, staging_file = `.workflows/{work_unit}/.state/coherence-analysis-candidates.md`.

On return, read `gate_outcome`.

**If `gate_outcome` is `processed`:**

Stamp the cache (a skip-all pass still stamps, so the analysis won't re-fire):

→ Load **[coherence-analysis.md](coherence-analysis.md)** for **E. Update Cache** and follow its instructions. When it returns:

→ On return, proceed to **E. Dedupe Sources**.

**If `gate_outcome` is `deferred`:**

Leave the cache stale so the still-valid staging file is re-presented next boot.

→ Proceed to **E. Dedupe Sources**.

#### Otherwise (`valid` or `absent`)

No dispatch.

→ Proceed to **E. Dedupe Sources**.

## E. Dedupe Sources

When both analyses surface the same kebab-case theme, research-analysis runs first; if the user approves it, the item is on the map by the time gap-analysis stages. Gap-analysis's **D. Filter and Stage** then takes the already-on-map branch and silently merges the source (`research-analysis:{parent},gap-analysis`) instead of staging a duplicate.

If a name appears in both `new_arrivals.research_analysis` and `new_arrivals.gap_analysis`, treat it as a research-analysis arrival only for caller-side display purposes (single callout entry, single Topic Discovery Arrivals bullet). The manifest already records the comma-joined source. Coherence-analysis does not participate — it adds no map items; `new_arrivals.coherence_analysis` names reopened topics and stays as-is.

→ Proceed to **F. Sweep**.

## F. Sweep

Analyses and their gates write state nothing self-commits — staging files and gate registrations (a deferred gate's pending candidates included), spent-state clears, cache files, manifest stamps, knowledge-store dirt. Check for leavings:

```bash
git status --porcelain -- .workflows/{work_unit} .workflows/.knowledge
```

#### If the tree is dirty

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "discovery({work_unit}): analysis run bookkeeping"
```

→ Proceed to **G. Return**.

#### Otherwise

Every write was already carried by a self-committing delivery — nothing to sweep.

→ Proceed to **G. Return**.

## G. Return

The caller reads `new_arrivals` from conversation memory:

- **`workflow-continue-epic`** — passes `new_arrivals` to `epic-display-and-menu.md` for the callouts above the Discovery Map: `⚑ N new topics added to the map from {analysis}` for the topic analyses, and a reopened-topics callout for `coherence_analysis` (the tracker holds topics reopened by landed findings). Callouts are rendered once at this boot-up; subsequent boots without changes don't repeat them.
- **`workflow-bridge`** — same callout pattern on its epic-continuation menu, populated by the same `new_arrivals` tracker.

→ Return to caller.

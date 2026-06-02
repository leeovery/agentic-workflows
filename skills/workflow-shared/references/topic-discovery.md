# Topic Discovery

*Shared reference. Loaded by [topic-discovery-dispatch.md](topic-discovery-dispatch.md), which `workflow-continue-epic` and `workflow-bridge` run.*

---

Drives cache-based dispatch of `research-analysis` and `discovery-gap-analysis` against an epic's discovery map. The analyses write directly to `phases.discovery.items.{topic}` with `source` provenance and respect the per-work-unit `phases.discovery.dismissed[]` list.

Each analysis self-gates on a precondition (research-analysis needs at least one completed research item; gap-analysis needs at least one completed research OR discussion item). When the precondition fails the analysis returns without touching cache or manifest — dispatching on `stale` is safe even when no qualifying inputs exist yet.

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

This tracker captures topic names added during this run, per analysis. The caller reads it after **E. Return**.

→ Proceed to **B. Run Research Analysis if Stale**.

## B. Run Research Analysis if Stale

Research-analysis runs first because gap-analysis reads its cache file as a secondary input.

#### If `analysis_caches.research_analysis.status` is `stale`

> *Output the next fenced block as a code block:*

```
·· Research Analysis ····························
```

→ Load **[research-analysis.md](research-analysis.md)** with work_unit = `{work_unit}`, tracker = `new_arrivals.research_analysis`.

On return, the tracker holds the names of any discovery items just added by research-analysis.

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

→ Load **[discovery-gap-analysis.md](discovery-gap-analysis.md)** with work_unit = `{work_unit}`, tracker = `new_arrivals.gap_analysis`.

On return, the tracker holds the names of any discovery items just added by gap-analysis.

→ Proceed to **D. Dedupe Sources**.

#### Otherwise (`valid` or `absent`)

No dispatch.

→ Proceed to **D. Dedupe Sources**.

## D. Dedupe Sources

When both analyses surface the same kebab-case theme, the second analysis writes the discovery item with `source` already comma-joined (`research-analysis,gap-analysis`) — see each analysis's **D. Filter and Save** section.

If a name appears in both `new_arrivals.research_analysis` and `new_arrivals.gap_analysis`, treat it as a research-analysis arrival only for caller-side display purposes (single callout entry, single Topic Discovery Arrivals bullet). The manifest already records the comma-joined source.

→ Proceed to **E. Return**.

## E. Return

The caller reads `new_arrivals` from conversation memory:

- **`workflow-continue-epic`** — passes `new_arrivals` to `epic-display-and-menu.md` for the `⚑ N new topics added to the map from {analysis}` callout above the Discovery Map. Callout is rendered once at this boot-up; subsequent boots without changes don't repeat it.
- **`workflow-bridge`** — same callout pattern on its epic-continuation menu, populated by the same `new_arrivals` tracker.

→ Return to caller.

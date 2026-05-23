# Self-Healing

*Shared reference. Loaded by `continue-epic` and `workflow-inception-process`.*

---

Drives cache-based dispatch of `research-analysis` and `inception-gap-analysis` against an epic's discovery map. The analyses write directly to `phases.inception.items.{topic}` with `source` provenance and respect the per-work-unit `phases.inception.dismissed[]` list.

The analyses self-gate on a precondition: they return without action when no completed research (for research-analysis) or no completed research-or-discussion (for gap-analysis) exists. Cache `stale` does not imply work to do — caller can safely dispatch unconditionally on `stale`.

The caller is responsible for surfacing the result — `continue-epic` shows a callout above the discovery map; `refinement-session.md` records names under **Self-Healing Arrivals** in the active session log.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic's work unit name. Always present.

## A. Read Cache State

> *Output the next fenced block as a code block:*

```
·· Self-Healing Check ···························
```

Run discovery for the work unit:

```bash
node .claude/skills/workflow-inception-process/scripts/discovery.cjs {work_unit}
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

On return, the tracker holds the names of any inception items just added by research-analysis.

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

→ Load **[inception-gap-analysis.md](inception-gap-analysis.md)** with work_unit = `{work_unit}`, tracker = `new_arrivals.gap_analysis`.

On return, the tracker holds the names of any inception items just added by gap-analysis.

→ Proceed to **D. Dedupe Sources**.

#### Otherwise (`valid` or `absent`)

No dispatch.

→ Proceed to **D. Dedupe Sources**.

## D. Dedupe Sources

When both analyses surface the same kebab-case theme, the second analysis writes the inception item with `source` already comma-joined (`research-analysis,gap-analysis`) — see each analysis's **D. Filter and Save** section.

If a name appears in both `new_arrivals.research_analysis` and `new_arrivals.gap_analysis`, treat it as a research-analysis arrival only for caller-side display purposes (single callout entry, single Self-Healing Arrivals bullet). The manifest already records the comma-joined source.

→ Proceed to **E. Return**.

## E. Return

The caller reads `new_arrivals` from conversation memory:

- **`continue-epic`** — passes `new_arrivals` to `epic-display-and-menu.md` for the `⚑ N new topics added to the map from {analysis}` callout above the Discovery Map. Callout is rendered once at this boot-up; subsequent boots without changes don't repeat it.
- **`workflow-inception-process` refinement** — appends each name to the active session log's **Self-Healing Arrivals** section as `- {topic} (added by {analysis}, source: {provenance})`, replacing the `(none)` placeholder if it's still present.

→ Return to caller.

The prose should have taken this path:

1. initialisation runs the boot pipeline — no migrations, knowledge
   ready — and the discovery dump shows one active epic, routing to
   the active-work display; the first scripted answer selects the epic
2. continue-epic loads the shared framework, opens with its phase title,
   and runs the scoped validation snapshot directly (the work unit
   arrived as an argument, so no selection menu renders)
3. the backfill checks find nothing — no qualifying legacy sources, no
   map rows missing a summary or description
4. topic discovery reads the caches: research-analysis absent,
   gap-analysis valid, coherence-analysis stale — only the coherence
   branch dispatches; no gap or research analysis re-runs, and neither
   of their caches is restamped
5. the coherence analysis reads both completed discussion files and
   their manifest subtopic states, full corpus, and finds the seeded
   conflict: behavioural-ranking's decision that no live signal stream
   will be built against synonym-handling's decision resting on the
   live click-signal stream, neither citing the other. It stages one
   finding with verbatim quotes from both documents (file + section),
   proposes synonym-handling as the yielding target (the passing
   assumption yields to the deliberate rejection), and registers the
   gate state — gate_mode gated, the candidate pending
6. the findings gate leads in with a count of 1; the second scripted
   answer reviews; the finding renders with its category, both quotes,
   and the proposed target; the third scripted answer approves
7. triage landing classifies the live target — a completed discussion
   — and `topic triage` reopens it to in-progress; the finding lands
   in synonym-handling.md's `## Triage` section as one entry carrying
   the conflict's full context, replacing the `(none)` placeholder
8. the gate completes: the candidate recorded approved, the tracker
   carries synonym-handling, the spent `analysis_staging` subtree
   deleted, and one commit — "discovery(search-relevance): coherence
   findings triaged" — covers the landing
9. the orchestrator re-enters the analysis at its cache section: the
   cache file lands at `.state/coherence-analysis.md` and the
   coherence cache is stamped over the one still-completed discussion
   file — the reopened target has already left the completed set, so
   the stamp covers behavioural-ranking.md alone and the cache reads
   absent until synonym-handling re-completes
10. dedupe no-ops for coherence, the dispatch re-runs discovery, the
    sequencing step is skipped (every live topic already ordered), and
    the epic dashboard renders with the reopened-by-coherence callout
    and its menu; the walk ends there without selecting anything

Further claims:

- synonym-handling's discussion item ends `in-progress` (reopened);
  behavioural-ranking's stays `completed`; relevance-measurement still
  has no per-phase work
- synonym-handling.md's Triage section holds one entry whose body
  carries both decisions with quotes anchored to file and section; the
  `(none)` placeholder is gone; the document's decided sections are
  otherwise untouched
- `analysis_staging.coherence-analysis` is absent from the manifest
- `phases.discovery.coherence_analysis_cache` exists with a checksum,
  a generated timestamp, and input_files naming only
  behavioural-ranking.md — the reopened target left the completed set
  before the stamp
- the gap-analysis cache object is untouched (never restamped), though
  it now derives stale — the reopen shrank its input set out from
  under its stored checksum; the discovery map gained no items and
  lost none; no discussion or research session was opened with the
  user
- if the analysis staged any finding beyond the seeded conflict, it
  was skipped and its fingerprint pushed to
  `phases.discovery.dismissed_findings` — otherwise that field was
  never written

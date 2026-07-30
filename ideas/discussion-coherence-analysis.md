# Coherence Analysis — Conflicting/Stale Decisions Across an Epic's Discussions

## Problem

When working through an epic's discussion phase, decisions change: concluding discussion B routinely invalidates something decided in discussion A. The reopen/triage dance handles the cases the user *notices*; nothing systematically scans for the ones they don't. Those inconsistencies surface late — at specification grouping, when context is cold — slowing spec down and forcing recall of old conversations.

## The Feature

A third sibling analysis (`coherence-analysis`) next to `research-analysis` and `discovery-gap-analysis`. It reads all completed discussions of one epic, finds **unacknowledged conflicts**, **stale references** (prose citing a since-changed decision), and **owned ambiguities**, stages them as findings, and a gate routes approved findings into the existing triage system — `topic triage` reopens the yielding discussion, the note lands in its `## Triage`, drain-triage folds it in at next entry, the conclusion gate forces resolution. Loop until the analysis stages nothing and stamps clean. Epic-only, same-work-unit only.

## Key Design Decisions

- **Full-corpus re-read every stale run** — no delta-focus (LLMs orbit found issues; coherence is a global property). Cost control lives in the checksum gate (analysis doesn't run when nothing changed) and dismissed fingerprints (output-side noise suppression only).
- **Delivery = triage, verbatim** — the gate's approve arm loads `triage-landing.md`. Both conflict and stale-reference findings route through reopen (per `correcting-historical-artifacts.md`'s in-progress rule: corrections to live work flow through the owning unit's phase). Categories differ only in what the reopened session does (re-decide vs repair prose).
- **Topic-shaped findings are not staged** — unowned ambiguities get noted in the cache file only; new topics are gap-analysis's lane.
- **Evidence discipline** — a finding stages only with verbatim quotes from both sides (file + section). No quote, no candidate.
- **Spec-entry soft gate** — informational advisory when the coherence cache is stale or findings are unresolved. Detection stays at epic boot; the spec boundary only surfaces it.
- **Minimum inputs = 2** — with fewer than 2 completed discussions the cache reads `absent`, the analysis never fires, and features (1 discussion) never show the spec advisory. Only the coherence kind sets `minInputs`.

## Shape

- Kind: `coherence-analysis`; inputs: completed discussion files only, sorted.
- Manifest home: `phases.discovery.coherence_analysis_cache` (`checksum`, `generated`, `input_files`).
- Cache file: `.workflows/{wu}/.state/coherence-analysis.md`; staging file: `.workflows/{wu}/.state/coherence-analysis-candidates.md`.
- Gate state: `analysis_staging.coherence-analysis.candidates.{slug}.status` — existing vocab (`pending|approved|skipped|resolved`), analysis-name-agnostic guard unchanged.
- Dismissed findings: `phases.discovery.dismissed_findings` string[] (untyped, like `dismissed`), entries `{docA}|{docB}|{slug}` (sorted doc basenames; single-doc findings `{doc}|{slug}`).
- Gateway line grows a third field: `analysis_caches: research_analysis=…, gap_analysis=…, coherence_analysis=…`.
- `new_arrivals` tracker grows `coherence_analysis: []` — collects **topic names reopened** by approved findings.
- Findings gate: a findings-flavoured sibling of `analysis-approval-gate.md` (`coherence-findings-gate.md`) — approve lands via `triage-landing.md`, skip pushes a dismissed fingerprint.
- Orchestrator: new `## D. Run Coherence Analysis if Stale` in `topic-discovery.md` after gap analysis; coherence does not participate in Dedupe Sources (it writes no map items).
- No migration needed: absent cache on existing epics reads `stale` once ≥2 discussions complete, `absent` otherwise — first boot after upgrade self-heals.

## Delivery

Stack of 2 (engine substrate → prose + surfacing) + a third PR for the prose-test case, plus this design-log branch (PR'd early, merged last).

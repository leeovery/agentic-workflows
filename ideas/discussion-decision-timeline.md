# Discussion Decision Timeline — Derive the True Decision at Spec Time

## Problem

A discussion document has a truth slot (each subtopic's Decision section) and a history slot (Journey), but no *temporal* structure for revision. Decisions get revisited — triage entries land, sessions reopen, re-decisions happen — and each revisit edits the document in an unprescribed way. After two or three revisits the decision history is murky: at specification time it is hard to derive the *true* (current) decision, and the reader has to reconstruct chronology from prose. The coherence-analysis loop (stack #638) sharpens this: it systematically reopens discussions to re-decide, and nothing defines where a re-decision lands.

## Idea

A dated, append-only **decision log** per subtopic — the timeline. Initial entry when the subtopic first reaches `decided`; a new entry per revision carrying what changed, why, and what triggered it (e.g. the triage entry it resolves). The latest entry is the true decision; earlier entries are lineage, never edited.

Consumers:

- **Specification extraction** reads the latest entry per subtopic as the decision, with lineage attached — no chronology reconstruction.
- **Coherence analysis** compares latest decision entries across documents instead of full prose — sharper findings ("coherence of decisions, not alignment of documents" made structural) and a much smaller context load on large epics.
- **The reopen/re-decide loop** gets a defined landing shape: a triage-driven re-decision appends an entry instead of an ad-hoc edit.

## Open Questions

- Shape: dated entries inside the subtopic's Decision section, or a separate per-subtopic log section?
- Does the timeline stay prose-only, or does the map/manifest gain a surface (e.g. decision revision count, last-decided date)?
- How do existing documents migrate — backfill on next reopen, or leave legacy docs timeline-less?
- Conclusion-gate interaction: does re-completing a reopened discussion require the new entry, the way the gate forces triage resolution?

## Relationship to Coherence Analysis

Additive, not a replacement. Coherence analysis stays the detector; the timeline gives it a cleaner comparison surface and gives spec a legible truth. Decision-layer anchoring (findings never target journey prose) ships with the stack independently of this idea.

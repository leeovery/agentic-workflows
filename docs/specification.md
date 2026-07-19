# Specification

The specification is the golden document. Plans are built from it, and plans drive implementation: if a detail is not in the spec, it will not reach the plan, and it will not get built. Worse, an implementing agent may hallucinate to fill the gap. The phase exists to produce a document robust enough that an agent or human could pick it up cold, plan it, and write the code.

The spec's position on the firmness gradient follows from that: discovery is soft, [discussion](research-and-discussion.md) hardens decisions through convergence, and the specification is where they become golden. Everything below is machinery to make that hardening trustworthy.

## Grouping: which discussions become which specs

For a feature or bugfix there is one topic, so the spec's sources are given: the discussion, or the investigation. For an epic the specification entry runs a **consolidation analysis** over every completed discussion first, reading each in full and measuring coupling on three axes: data coupling (shared structures), behavioral coupling (one's implementation requires another), and conceptual coupling (facets of the same problem). Tightly coupled discussions group into one spec; a standalone discussion becomes a grouping of one. Cross-cutting discussions get flagged for promotion rather than mixed into feature groupings.

The analysis distinguishes two kinds of input a spec can declare:

- **Sources**: discussions (or research files, investigations, even earlier specs) whose content is extracted wholesale. Tracked per source as `pending` until fully extracted, then `incorporated`.
- **Consult references**: a sibling discussion that owes this spec a *correction*, say a decision redesigned elsewhere that supersedes what this grouping's discussion recorded. The receiving spec reads only the named slice and cites it. It never extracts the sibling wholesale. Tracked as `pending` until `addressed`.

A knowledge-base advisory query runs per grouping to surface sibling discussions that may owe corrections the analysis missed. Advisory only: hits become candidate consult references, never auto-added.

The reconcile that persists the analysis respects one invariant: **anchors are preserved**. A specification item the user already started or finished is never regenerated or renamed; freshly proposed groupings map onto anchors when their sources substantially overlap, and only purely-proposed items are freely rebuilt. The analysis is checksum-cached against the discussion set, so it re-runs only when discussion content changes.

## Construction: nothing written without approval

Construction runs one topic at a time through a fixed cycle: exhaustive extraction from sources, synthesize, present, approve, log, commit. Two hard rules govern every iteration:

1. **Stop and wait for explicit approval before any write to the specification.** Present the content exactly as it would appear in the document; the user approves, requests changes, or discusses.
2. **Log verbatim.** What was approved is what gets written. No silent modifications.

The approval gate has an `a`/auto option that persists as `construction_gate_mode: auto` in the manifest: remaining topics log without individual approval stops. Auto removes only the stop, not the discipline; topics still process one at a time, extract → present → log → commit, never the whole spec in one pass.

Two mechanisms guard against the failure modes of long extractions:

- **Context resurfacing.** When extraction for a later topic reveals information affecting already-logged content, the spec interrupts immediately, presents the change as a bordered diff with two lines of context, and asks for approval. This gate stays gated even in auto mode, because it modifies approved content. Better to resurface and hear "already covered" than let a contradiction ship.
- **Narrow consult reads.** Pending consult references are worked during extraction: find the slice hint from the handoff, read only the decisions it points to in the sibling discussion, apply or cite the correction, record what was reconciled in Working Notes, mark it `addressed`.

Epic specs also record cross-spec dependencies after construction, which later feed the planning phase's dependency graph and the epic dashboard's `(blocked: …)` markers.

## Review: two agents, strictly sequential

The review loop dispatches two [sub-agents](agents.md) per cycle, never in parallel:

1. **Input review** compares the spec against its source material: did anything in the discussions fail to reach the document, or arrive distorted?
2. **Gap analysis** reads the spec as a standalone document, as its future consumers will: does it hold together without the discussions open beside it?

Sequential matters: phase 1's findings are applied before phase 2 runs, so gap analysis reviews the corrected document. Each finding lands in a tracking file and goes through user triage. The loop reruns until both agents return clean, with counters guarding the edges: past cycle 3 a gated session asks whether to continue, past cycle 5 even auto mode stops and asks, and a convergence analysis summarises whether cycles are actually reducing findings. The escape hatch belongs to the user; the skill's stated default is to keep reviewing until clean.

## Completion

Completion is a checklist with checkpoints, not a vibe:

- every source `incorporated`,
- every consult reference `addressed`,
- every tracking file `status: complete`,
- a clean review cycle (or the user explicitly proceeding past the loop),
- user sign-off.

Then `engine topic complete` marks the item and indexes the spec into the [knowledge base](knowledge-base.md). If any source was itself an existing specification, it is superseded (`engine topic supersede`): its status records what absorbed it and its knowledge-base chunks are removed, so retrieval never serves a stale spec.

For epic specs, one more assessment precedes sign-off: is this spec **directly plannable** (concrete deliverables, standalone implementation) or **cross-cutting** (defines how to do things, referenced by other specs, implemented within features that apply it)? Confirmed cross-cutting specs are [promoted](lifecycle-tools.md#promote-epic-spec--cross-cutting-unit) out to their own terminal work unit. Everything else hands off through the [bridge](how-it-fits-together.md#the-bridge) to [planning](planning.md); a cross-cutting work unit's pipeline ends here.

---

*Next: the spec becomes phases, tasks, and acceptance criteria in [planning](planning.md).*

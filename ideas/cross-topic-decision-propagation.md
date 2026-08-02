# Cross-Topic Decision Propagation: Deliver Carry-Notes, Force the Sibling Consult, Lighten Stale-Reference Repair

## The Idea

Three related changes, one seam: decisions stack cleanly *within* a discussion (the dated revision-timeline convention works), but nothing versions or propagates citations *across* documents. A sibling topic citing a since-changed decision only gets corrected when coherence analysis happens to run — and coherence analysis is a backstop, not a delivery mechanism. Close the seam at three points, in value order:

1. **Deliver "cross-topic notes to carry" through triage-landing at conclusion time.**
2. **Harden the KB-consult nudge into a step at cross-topic decision points.**
3. **Add a lighter "repair" arm to the coherence gate for `stale-reference` findings.**

## Evidence (fumi epic, 2026-08-01/02 session)

The first coherence-analysis run over two completed discussions (`note-model`, `storage-and-sync`) staged five findings. All five were real; the split diagnoses the process:

**Three `stale-reference` findings — the system had already recorded the debt, but nothing delivered it.** `storage-and-sync` concluded with an Open Threads line: *"Cross-topic notes to carry: → note-model ('honoured at open' replaced by unfocused/on-blur; …)"*. Those notes sat as prose. `note-model` kept citing `edit_counter` as "load-bearing" (dropped weeks prior with dated supersession), an FSEvents watch v1 doesn't have, and the superseded "honoured at open" rule — all three corrections were *known and written down* in the newer document, with no mechanism to land them in the older one. Coherence analysis eventually turned them into triage entries; the conclude flow could have done it immediately.

**Two `conflict` findings — decisions made mid-session on ground a sibling document had already decided, without consulting it.** A review-finding engagement in `storage-and-sync` added a preset-delete cascade that clears `presetId` on affected notes — directly contradicting `note-model`'s explicitly argued "`preset_id` is never cleared by preset deletion; it dangles and self-rebinds" (itself a review-004 correction). Separately, a state re-partition swept `last_opened` into the Derived (disposable) tier while `note-model` had argued it durable (review-004 F7: "not reconstructible from anything — cannot live in Derived"). In both cases the orchestrator had the knowledge-base nudge available (`knowledge-usage.md` §A trigger 2: "something being discussed might affect or be affected by other parts of the system") and didn't fire it — it's advisory, and mid-review-drain the momentum is on resolving the finding, not checking siblings.

## Change 1 — Conclude-time delivery of carry-notes (highest value, smallest change)

**Where:** `workflow-discussion-process/references/conclude-discussion.md` (the `yes` arm, before or alongside the Summary-population step), reusing `workflow-shared/references/triage-landing.md` verbatim.

When concluding, scan the Summary's Open Threads for cross-topic corrections owed to *existing* topics — the "cross-topic notes to carry" pattern — and offer to land each as a triage entry in its target now, via triage-landing, instead of leaving them as prose. Gate per-note (the same y/auto/skip shape as the analysis gates); a landed note carries the full context the target needs to resolve it from cold.

Notes:

- Only notes that are *corrections owed to a decided sibling* qualify — plain reroutes already land via triage during the session; this catches the ones that accumulate in Summary prose instead.
- Landing reopens (`topic triage` flips `completed → in-progress`), so surface the consequence in the gate copy — the user is choosing to reopen a sibling.
- This makes coherence analysis's `stale-reference` category mostly preventive-redundant, which is the goal: the backstop should be catching misses, not doing routine delivery.

## Change 2 — The sibling consult becomes a step, not a nudge

**Where:** `workflow-discussion-process/references/discussion-session.md` (session loop step 4/5 area) and/or `background-agent-surfacing.md` §D (the raise/engagement flow), plus `workflow-knowledge/references/knowledge-usage.md`.

Current state: the KB nudge is a footnote on Step 5 ("before committing to a direction… run a quick query") and §A of knowledge-usage lists trigger heuristics. Both are advisory and get skipped exactly when they matter — mid-engagement on a review finding, where the decision momentum is highest.

Proposed rule (instruction-only): **before documenting a decision that names a term, field, rule, or classification another topic's decided text owns, the orchestrator must either (a) run a KB query scoped to that term, or (b) cite the sibling's current decision in the new decision's text.** The commit is the enforcement point: an engagement write that re-decides cross-topic ground without a consult line is the thing review agents should flag.

Both fumi conflicts would have been prevented: a query for "preset deletion binding" or "last-opened tier" surfaces the sibling's decided text immediately (both were indexed).

Cost: a query per cross-topic decision moment. Keep the trigger narrow — *terms another document's decision layer owns*, not any shared vocabulary.

## Change 3 — A "repair" arm for stale-reference findings

**Where:** `workflow-shared/references/coherence-findings-gate.md` (§B menu, §C landing), maybe `coherence-analysis.md` (category metadata).

`stale-reference` findings differ from conflicts in kind: the decision layer is already coherent (the supersession is dated and acknowledged in the newer doc); the finding carries its own resolution. The full reopen → drain → re-conclude cycle is the right weight for a conflict (something must be re-decided) but heavy for what is a dated text correction.

Proposed: the gate's menu for `stale-reference` findings gains an `r`/`repair` arm — apply the correction directly to the target artifact as a dated correction marker (the documents' existing in-place convention: *"(Corrected {date} — … see {source}; coherence.)"*), commit with a `(coherence repair)` subject marker, **without** reopening the topic. KB re-index the corrected artifact (the `topic complete` indexing path already exists — needs a re-index entry point that doesn't require a status transition, or reuse `correcting-historical-artifacts.md` if its mechanism fits).

Trade-off to preserve: the reopen path's value is the conclusion gate re-arming as a check that the fix landed properly. Mitigation: repair is only offered for `stale-reference` (never `conflict`), and the applied edit is shown to the user before commit. If that still feels too loose, an alternative is keeping the reopen but marking the triage entry `mechanical: true` so the draining session knows it's a sweep, not a debate.

## Scope

- `workflow-discussion-process/references/conclude-discussion.md` — carry-note delivery gate (Change 1)
- `workflow-shared/references/triage-landing.md` — reused as-is (Change 1)
- `workflow-discussion-process/references/discussion-session.md` + `workflow-knowledge/references/knowledge-usage.md` — consult-before-cross-topic-decision rule (Change 2)
- `workflow-shared/references/coherence-findings-gate.md` (+ `coherence-analysis.md`) — repair arm for stale-references (Change 3)
- Sibling phases: research's conclude flow likely wants Change 1 too; audit `workflow-research-process` for the same Summary-prose carry-note pattern.

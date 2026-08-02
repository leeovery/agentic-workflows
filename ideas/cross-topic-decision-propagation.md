# Cross-Topic Decision Propagation: Detect Misdirected Carry-Notes, Harden the Engagement Consult, Repair Stale References, Fix Gate Commits

## The Idea

Decisions stack cleanly *within* a discussion (the dated revision-timeline convention works), but nothing versions or propagates citations *across* documents. A sibling topic citing a since-changed decision only gets corrected when coherence analysis happens to run — and coherence analysis is a backstop, not a delivery mechanism. Close the seam at three points, in value order, plus one commit-hygiene fix found in the field:

1. **Document review detects content addressed to another topic and routes it through triage.**
2. **The KB sibling-consult becomes a hard step in the high-momentum engagement flows, with an auditable trace line.**
3. **The coherence gate gains a "repair" arm for `stale-reference` findings, on corrigendum plumbing.**
4. **The coherence findings gate must not exit with a dirty tree.**

Defence in depth: Change 2 is prevention at decision time, Change 1 is delivery at conclusion time, Change 3 is cheap repair at backstop time. They are complementary, not redundant — a perfect consult still leaves the sibling's text stale (consult cites the sibling, it doesn't fix it), so Change 1 is needed regardless, and Change 3 catches whatever leaks past both.

## Evidence (fumi epic, 2026-08-01/02 session)

The first coherence-analysis run over two completed discussions (`note-model`, `storage-and-sync`) staged five findings. All five were real; the split diagnoses the process:

**Three `stale-reference` findings — the system had already recorded the debt, but nothing delivered it.** `storage-and-sync` concluded with an Open Threads line: *"Cross-topic notes to carry: → note-model ('honoured at open' replaced by unfocused/on-blur; …)"*. Those notes sat as prose. `note-model` kept citing `edit_counter` as "load-bearing" (dropped weeks prior with dated supersession), an FSEvents watch v1 doesn't have, and the superseded "honoured at open" rule — all three corrections were *known and written down* in the newer document, with no mechanism to land them in the older one.

**Two `conflict` findings — decisions made mid-session on ground a sibling document had already decided, without consulting it.** A review-finding engagement in `storage-and-sync` added a preset-delete cascade that clears `presetId` on affected notes — directly contradicting `note-model`'s explicitly argued "`preset_id` is never cleared by preset deletion; it dangles and self-rebinds" (itself a review-004 correction). Separately, a state re-partition swept `last_opened` into the Derived (disposable) tier while `note-model` had argued it durable (review-004 F7: "not reconstructible from anything — cannot live in Derived"). In both cases the KB nudge was available (`knowledge-usage.md` §A trigger 2) and didn't fire — it's advisory, and mid-review-drain the momentum is on resolving the finding, not checking siblings.

**Additionally, the session ended on the epic menu with a dirty work tree** after the coherence findings gate finished — the gate has at least one exit path that clears state without committing (Change 4).

## Change 1 — Document review detects misdirected knowledge (highest value)

**Key reframe from discussion:** the *"cross-topic notes to carry"* prose section is not a convention to bless — it's a **symptom of a miss**. Fumi's session invented it because the triage instructions got lost in a busy, polluted context; the correct behaviour was to reroute via triage at the moment the correction was known. So: no template change, no sanctioned prose intermediate. Mid-session reroute (`F. Off-Topic Concerns` → `triage-landing.md`) stays the only sanctioned delivery path — a correction owed to a sibling *is* a concern belonging to that sibling, and the existing path handles it. What's missing is the safety net for when context pollution makes the session write prose instead.

**Where:** `workflow-discussion-process/references/document-review.md` (the mandatory pre-conclusion reconciliation pass) — a new check category alongside undocumented substance, accuracy drift, and revision landing:

> **Misdirected knowledge** — content addressed to another topic: carry-notes, "X should be told", corrections owed to a decided sibling. Anything structured like passing knowledge to another document rather than recording this topic's own ground.

Each hit is offered for landing through `workflow-shared/references/triage-landing.md` (reused verbatim), gated per-note (the y/auto/skip shape), then the prose is cleaned up — the document ends coherent, with the knowledge in the sibling's triage queue instead of stranded prose. Timing is pre-conclusion by construction, since document review already runs before the conclude gate.

Notes:

- Gate copy must surface the consequence: landing reopens the sibling (`topic triage` flips `completed → in-progress`), which also regresses the epic's phase aggregation — spec-entry readiness can flip back. Correct behaviour, but the user is choosing it.
- This makes coherence analysis's `stale-reference` category mostly preventive-redundant, which is the goal: the backstop should catch misses, not do routine delivery.
- Audit `workflow-research-process/references/document-review.md` for the same category — research sessions can strand carry-notes the same way.

## Change 2 — Hard consult in the engagement flows, with a trace line

**The trigger problem:** "terms another document's decision layer owns" is not locally checkable — knowing ownership requires the very query in question. The orchestrator that skipped the advisory nudge won't recognise an ownership trigger either. Two fixes, both needed:

**(a) Narrow by moment, not by term.** Both fumi conflicts happened mid-review-finding engagement. Make the consult a mandatory step in the high-momentum flows specifically — the review-finding engagement (`workflow-shared/references/background-agent-surfacing.md` §D) and the triage drain (`workflow-shared/references/drain-triage.md`) — before an engagement's decision is documented. The general session loop keeps the soft nudge (`knowledge-usage.md` §A / the SKILL.md footnote).

**(b) Make the artifact auditable.** The enforceable trace is a one-line citation in the decision block — *"Sibling check: {topic} — {what its decided text says}"* or *"Sibling check: no overlap found"*. A review agent or document review can verify a **line exists**; it cannot verify a query *should have fired*. Without the line, enforcement is judgment on judgment.

**Trigger wording (locally checkable):** a decision that names an entity, field, rule, or classification **this topic's own document didn't introduce** — introduction is checkable against the current file; ownership isn't.

Both fumi conflicts would have been prevented: a query for "preset deletion binding" or "last-opened tier" surfaces the sibling's decided text immediately (both were indexed).

**Link to Change 1:** when the consult surfaces sibling text that the current decision supersedes, the session reroutes the correction right then via the existing off-topic path — Change 1's document-review check is the safety net, not the primary route. The engagement-flow prose should say this explicitly.

## Change 3 — A "repair" arm for stale-reference findings, on corrigendum plumbing

`stale-reference` findings differ from conflicts in kind: the decision layer is already coherent (the supersession is dated and acknowledged in the newer doc); the finding carries its own resolution. The full reopen → drain → re-conclude cycle is right for a conflict (something must be re-decided) but heavy for a dated text correction.

**Where:** `workflow-shared/references/coherence-findings-gate.md` (§B menu, §C landing), maybe `coherence-analysis.md` (category metadata).

The gate's menu for `stale-reference` findings gains an `r`/`repair` arm — apply the correction directly to the target artifact, **without** reopening the topic. Plumbing findings from discussion:

- **Reuse the corrigendum mechanics** from `workflow-shared/references/correcting-historical-artifacts.md`: edit in place + corrigendum block + single-file re-index + scoped commit, no manifest touch. The *"(Corrected {date} — …)"* inline marker fumi's documents used is **not** a shipped convention — fumi invented it; don't mint a second correction dialect.
- **The re-index entry point already exists**: `knowledge index <path>` replaces that file's chunks idempotently with no status transition. No new machinery needed.
- **Register the commit marker with the classifiers.** A `(coherence repair)` commit landing on a completed discussion topic enters the commit-classifier ecosystem — `closing-gates.md`'s meaningful/bookkeeping split, `final-review.md`'s drop lists (discussion *and* research), `review-agent.md`'s "meaningful content committed?" checklist. Unregistered, a repair commit could count as fresh meaningful work and e.g. trigger a review cycle. This is the edge-enumeration work.

Guardrails: repair is offered only for `stale-reference` (never `conflict`), and the applied edit is shown to the user before commit. If that still feels too loose, the fallback is keeping the reopen but marking the triage entry `mechanical: true` so the draining session knows it's a sweep, not a debate.

## Change 4 — The coherence findings gate must commit what it writes

Observed: after finding review completed, the session landed on the epic menu with a dirty work tree. The gate's only commit is in §B's "no pending block remains" arm. Likely culprits, to be verified against the actual exit path before fixing:

- The **K=0 arm** (§A) deletes `analysis_staging.coherence-analysis` from the manifest and returns without committing.
- Host-side writes around the gate — the staging file (`.state/coherence-analysis-candidates.md`) and the cache stamp — may land outside any commit depending on the exit path.

Audit every exit path of `coherence-findings-gate.md` (and the host in `topic-discovery-dispatch.md`) for uncommitted writes; each path that mutates state must leave a clean tree.

## Scope

- `workflow-discussion-process/references/document-review.md` — misdirected-knowledge check category + triage landing (Change 1); audit research's `document-review.md` for the same
- `workflow-shared/references/triage-landing.md` — reused as-is (Change 1)
- `workflow-shared/references/background-agent-surfacing.md` §D + `workflow-shared/references/drain-triage.md` + `workflow-knowledge/references/knowledge-usage.md` — hard consult step + trace line (Change 2)
- `workflow-shared/references/coherence-findings-gate.md` (+ `coherence-analysis.md`) — repair arm on corrigendum plumbing (Change 3); classifier registration in `closing-gates.md`, `final-review.md` (discussion + research), `review-agent.md`
- `workflow-shared/references/coherence-findings-gate.md` §A/§B exit paths + `topic-discovery-dispatch.md` host — commit hygiene (Change 4)

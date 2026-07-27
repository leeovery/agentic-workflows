# Live Spec Drift: Surfacing Upstream Edits to Downstream Phases

## The Idea

When a specification is edited while its owning work unit is still live — reopened, revised, re-completed — the *edit itself* is fully handled: `workflow-specification-entry` reopens the completed item, `spec-construction.md` presents the changes as a diff, and re-completion re-indexes the knowledge base over the same identity automatically (`transitions.cjs`: "chunks stay live until re-completion re-indexes over the same identity"). What is **not** handled is the consequence: nothing tells the downstream phases that their input moved.

Concretely:

- Spec re-completion sets no flag when a `planning.{topic}` (or beyond) item already exists.
- `workflow-planning-entry/references/validate-phase.md` does no staleness check — it only reads the plan's own status.
- Detection *at plan re-entry* is already solved, and well: planning stamps a `spec_commit` baseline at plan initialization, re-stamps it at conclusion, and on any resume — including a reopened completed plan — `spec-change-detection.md` git-diffs the spec and cross-cutting inputs against that baseline and reports unreconciled changes into the session. So the moment someone re-enters planning, drift is caught mechanically.
- But nothing prompts re-entry. The reopened spec itself resurfaces fine (status flips to `in-progress`, phase aggregation and menus show it); the stale plan sitting downstream still reads `completed` and looks done. The detection layer exists with no arrival layer in front of it.

So the failure mode: spec corrected mid-pipeline, plan authored against the old spec silently retains its `completed` status, implementation executes the stale plan. Fixing forward works — plans can be reopened, tasks added, code rewritten, and spec-change detection reconciles the diff the moment planning resumes — but only if someone knows to resume. The whole gap is the nudge.

## The Model That Already Works: Discussion Triage

The discussion reroute/triage system (`engine topic triage`, `drain-triage.md`, `triage-landing.md`) solves the same shape of problem one phase earlier. An off-topic concern lands in the target topic's Triage section, and — critically — **the manifest state changes with it**: a completed discussion is reopened to receive the entry, a missing item is created. When the user returns to the epic menu or discovery map, the affected discussions are right there, visibly in-progress, impossible to miss.

The principle to steal: *content lands with a state change, so menus can't miss it.* Text alone (a note in a file, a diff in git history) is invisible to navigation; a manifest write is not.

A second in-house precedent: discovery briefs' `reconcile_needed` — a brief written or regenerated over in-flight downstream work sets the flag, and it is surfaced non-destructively (`reconcile-advisory.md`) rather than overwriting anything. That is very close to the sketch this idea needs: spec re-completed while downstream items exist → flag the downstream item(s) → render surfaces carry an advisory until the flag clears.

## The Upstream Chain: Should You Even Be Editing the Spec?

Specs are themselves downstream artefacts — they extract from discussions (the `sources.{name}.status: incorporated` gating). So there's a chain question wrapped inside this idea: when a claim in a live spec turns out wrong or shifted, the *right* edit point may not be the spec at all but the discussion that fed it. Triage the concern into that discussion (the existing mechanism — reopens it, surfaces it), re-decide there, and let the correction flow into the spec through the incorporation gate — which resets the spec's position honestly, because a re-completed source discussion marks the extraction stale rather than patching the extraction in place.

But it depends on the state of the work and the nature of the edit:

- A **decision shift** (we now want X, not Y) belongs upstream in the discussion — patching the spec directly leaves the discussion record contradicting the spec it supposedly feeds.
- A **factual correction** (the spec asserts an argv/flag/API shape that is simply wrong, per the situation that spawned idea #22) has no decision to re-litigate; routing it through a discussion is ceremony. Fix the spec, flag downstream.
- Deep in implementation, either may be better handled as fix-forward with the spec corrected after the fact.

The idea should settle a routing rule (or at least a stated default) for which path a mid-pipeline correction takes, not just the flag mechanics.

## What's Worth Figuring Out

1. **The trigger.** Spec re-completion (`topic complete` on a spec item) when downstream phase items exist for the same topic — engine-owned, like the KB re-index already is? Or prose-owned at spec-completion time? Engine-owned can't be forgotten, which is the whole lesson of #22.
2. **The flag and its home.** A `reconcile_needed`-style field on the downstream item(s) (`planning.{topic}`, possibly `implementation.{topic}`). Does it cascade one hop (spec→plan only, and a reconciled plan then flags implementation) or mark everything downstream at once?
3. **Surfacing.** Which render surfaces carry it — epic menu, `workflow-continue-*` dashboards, planning-entry's validate step? Non-destructive advisory per the brief precedent.
4. **Clearing semantics.** Cleared on downstream re-entry? On downstream re-completion? Explicit user dismissal ("the change doesn't affect the plan")? Note the existing rhythm to align with: `spec_commit` is re-stamped only at plan conclusion, so unreconciled changes keep re-reporting on every resume — the flag's clear point should probably match the re-stamp, with the flag's *surface* point (menus) sitting in front of the re-entry that detection already owns.
5. **The routing rule** for the upstream chain (edit the discussion vs edit the spec vs fix forward) — see above. Where is it stated, and does the spec-entry flow actively offer the triage-into-discussion path when the user shows up wanting to change a spec whose sources are discussions?
6. **Cross-unit entry.** You're in unit B when you notice unit A's live spec is wrong. The corrigendum protocol (idea #22, narrowed) redirects you to unit A's own flow — where exactly does that redirect land, and does this idea's surfacing make the hand-off self-evident once you get there?
7. **Family with #26.** The remaining half of idea #26 (auto-route back to review after a reopened implementation re-completes) is the same pattern: *a phase re-ran; adjacent state is now stale; nothing points at it.* A shared mechanism (or at least a shared design) may close both.

## Why It Matters

The pipeline's integrity rests on each phase being able to trust that its input was current when it ran — and on *knowing when that stopped being true*. The system already refuses to let the knowledge base serve stale chunks (re-index on re-completion is engine-owned precisely so it can't be skipped); the same discipline doesn't yet exist one layer up, between phases. Discussion triage proved the fix is cheap: a manifest write at the moment content lands, and the menus do the rest.

## Provenance

Split out of idea #22 (*Editing Historical Phase Artefacts*) during its 2026-07-27 audit. #22 keeps the closed-unit case (corrigendum + re-index protocol for completed work units, where no lifecycle machinery exists to hook); this idea owns the live-unit case, where the machinery exists but the propagation is missing. The audit's verified-mechanics notes above (no staleness flag, no planning-entry check, re-read-on-re-entry-only) are the evidence base.

## Relevant Files

- `skills/workflow-engine/scripts/domain/transitions.cjs` — `topic complete` / `topic reopen` / `topic triage`; where an engine-owned trigger would live.
- `skills/workflow-planning-entry/references/validate-phase.md` — where a staleness check / advisory would surface on re-entry.
- `skills/workflow-planning-process/references/spec-change-detection.md` + `conclude-plan.md` — the existing detection layer (`spec_commit` baseline, diffed on every resume, re-stamped at conclusion) the new flag routes into.
- `skills/workflow-shared/references/reconcile-advisory.md` — the non-destructive advisory pattern to reuse.
- `skills/workflow-shared/references/drain-triage.md`, `triage-landing.md` — the discussion triage mechanism this idea generalises.
- `skills/workflow-specification-process/references/spec-completion.md` — prose-side completion; where a prose-owned trigger would live instead.
- `skills/workflow-continue-epic/references/epic-display-and-menu.md` — the main render surface.
- `ideas/editing-historical-phase-artefacts.md` (#22) — the closed-unit sibling.
- `ideas/review-not-re-offered-after-loopback.md` (#26) — the same staleness pattern at the review boundary.

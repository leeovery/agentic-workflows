# Phase 3 — Inception Process Skill

**Status:** Not started · **Depends on:** Phase 2

## Purpose

Second slice of the original "Inception MVP" — the room behind the door. Implements the conversational inception session itself. Models on `workflow-discussion-process` (conversational + STOP-gated).

After this phase: invoking `/workflow-inception-entry epic {wu}` works end-to-end *if invoked manually* — produces an inception conversation, surfaces topics, infers routing, persists items to the manifest, writes a session log, and bridges back to `/continue-epic`. Real epics still don't go through inception until Phase 4 wires `start-epic`.

## Reference

- [Design](design.md):
  - **Inception Phase — Behaviour** (lines 111-300) — curatorial moves, hard rules, routing inference, initial-session shape, batched-vs-per-item gate model, examples.
  - **Files on disk** (lines 302-318) — directory layout.
  - **Session log shape** (lines 320-355) — initial session-log template.
- `CONVENTIONS.md` — **MANDATORY** before authoring any skill file. Especially the *Skill File Structure*, *Reference File Structure*, *Step Numbering*, and *Stop Gates* sections.
- `skills/workflow-discussion-process/SKILL.md` and references — closest precedent. Same conversational pattern, same gate convention, same step rhythm.
- `skills/workflow-knowledge/references/knowledge-usage.md` and `contextual-query.md` — loaded mid-skill (same pattern as discussion-process).

## What ships

- New skill `workflow-inception-process/` — backbone + 7 references.
- Initial-session flow only. Resume detection routes to a Phase-6 stub (refinement).
- Knowledge-base contextual query at session start (work-unit description as the query).
- Single STOP gate at confirm-and-persist, then batched manifest writes (one `init-phase` + 3 `set`s per surfaced topic) plus session-log finalisation, single commit.
- Bridge invocation at conclusion.

## Files

**New — `skills/workflow-inception-process/`:**

- `SKILL.md` — backbone with steps:
  - Resuming-After-Context-Refresh block (mirrors discussion-process).
  - Step 0: Resume Detection — `inception/session-001.md` exists? Yes → Phase-6 stub, return. No → Step 1.
  - Step 1: Initialize Inception (load `initialize-inception.md`).
  - Step 2: Load Inception Guidelines (load `inception-guidelines.md`).
  - Step 3: Knowledge Usage (load `../workflow-knowledge/references/knowledge-usage.md`).
  - Step 4: Contextual Query (load `../workflow-knowledge/references/contextual-query.md`).
  - Step 5: Session Loop (load `session-loop.md`).
  - Step 6: Confirm and Persist (load `confirm-and-persist.md`).
  - Step 7: Document Review (lighter than discussion's — inception logs are brief by design).
  - Step 8: Compliance Self-Check (load `../workflow-shared/references/compliance-check.md`).
  - Step 9: Conclude Inception (load `conclude-inception.md`).
- `references/inception-guidelines.md` — curatorial mode, hard rules, worked examples per move (decomposition, tentative grouping, coarseness check, anchor-and-return). Direct translation of design.md "Inception Phase — Behaviour" lines 115-130.
- `references/initialize-inception.md` — create `inception/` directory; load template; **no** manifest writes yet (topics get written in confirm-and-persist).
- `references/routing-inference.md` — verbatim from design.md lines 132-182. Cue lists + three worked examples.
- `references/session-loop.md` — conversational rhythm: open → surface → group → infer routing → anchor-and-return → convergence-signal. Topics tracked in working list (in conversation memory + draft session-log section). **Binding manifest writes deferred to confirm-and-persist.**
- `references/confirm-and-persist.md` — render the proposed map; STOP gate; on `yes`: per-topic `init-phase` + `set` (`name`, `summary`, `routing`, `source: inception`); finalise session-001.md; single commit.
- `references/conclude-inception.md` — bridge invocation. **No KB indexing** — inception is not an indexed phase.
- `references/template.md` — initial session-log template per design.md "Session log shape" lines 324-355.

## Out of scope

- Wiring `start-epic` to invoke inception (Phase 4).
- Refinement / re-entry conversation (Phase 6) — stub only.
- Self-healing analyses (Phase 7).
- Imports KB indexing (Phase 8).
- Background agents (review/perspective). Inception is curatorial — no agents.

## Verification

1. Compliance self-check on `workflow-inception-process/SKILL.md` and each reference file.
2. End-to-end manual smoke (direct invocation, since Phase 4 hasn't wired `start-epic` yet):
   ```bash
   cd "$(mktemp -d)" && mkdir -p .workflows
   node /path/to/manifest.cjs init test-epic --work-type epic --description "Building a small SaaS for kitchen ops"
   /workflow-inception-entry epic test-epic
   ```
   Walk a conversation surfacing 2-3 topics with mixed routing. Verify:
   - `phases.inception.items.{topic}` written for each topic with `name`, `summary`, `routing`, `source: inception`.
   - `inception/session-001.md` matches the template shape.
   - One commit captures the persistence step.
   - Bridge fires; user lands at `/continue-epic test-epic`.
3. Run Phase 1's manifest test suite — should still pass.
4. Run the discovery.cjs script against the seeded epic — should not error and should include `inception` in the `phases` output.

## Notes for the implementer

- **Manifest writes batch at confirm-and-persist.** Topics surface into a working list during the conversation; the user confirms the *whole map* once; persistence is one STOP gate → N writes → one commit. This matches the design's "safety scales with destructiveness" rule (adds batch).
- **No background agents.** Inception is curatorial, not investigative. Discussion-process's `review-agent` and `perspective-agents` are not modelled.
- **`inception` is NOT a knowledge-indexed phase.** Indexed phases are research/discussion/investigation/specification. Inception session logs are journey records. `conclude-inception.md` does **not** call `knowledge index`.
- **Don't accidentally re-introduce `cancelled` status handling.** Phase 1's manifest CLI rejects `cancelled` for inception items. Don't copy-paste from discussion-process and forget to strip the cancellation paths.
- **Inception items have a `source` field.** For the initial session, `source: inception`. (Phase 7 will introduce `source: research-analysis`/`gap-analysis`; Phase 9 will introduce `source: split`/`source: elevation`; Phase 10 will introduce `source: direct-start`; Phase 11 migration will introduce `source: migration-seeded`.)

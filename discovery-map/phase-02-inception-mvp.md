# Phase 2 — Inception MVP

**Status:** Not started · **Depends on:** Phase 1

## Purpose

The first user-visible piece. Creates the inception entry and process skills, the bridge continuation back to continue-epic, and rewires `start-epic` to invoke inception. After this phase, new epics go through inception when started — but the discovery map isn't yet visualised in `continue-epic` (that's Phase 3). Inception items are written to the manifest; users navigate through but the UI is transitional.

## Reference

- [Design](design.md) — Inception Phase — Behaviour (curatorial moves, hard rules, routing inference); Initial session subsection; Convention — same conversational pattern as discussion-process; Files on disk; Session log shape.
- `skills/workflow-research-process/SKILL.md` and references — closest precedent to model on.
- `skills/workflow-discussion-process/SKILL.md` and references — second precedent; the conversational convention is the same shape.
- `skills/workflow-research-entry/SKILL.md` — model for inception-entry.
- `skills/workflow-bridge/SKILL.md` and references — pattern for the inception continuation reference.
- `CLAUDE.md` — Skill File Structure (MANDATORY) section for backbone + reference patterns.

## What ships

- New skill `workflow-inception-entry` (model on workflow-research-entry).
- New skill `workflow-inception-process` with initial-session flow only (refinement comes in Phase 4).
- New `inception-guidelines.md` with curatorial moves and routing-inference cues.
- Bridge continuation: inception conclusion → re-invoke `/continue-epic {wu}`.
- `start-epic` Step 3 (Route to First Phase) collapses to "always invoke inception-entry" for new epics.
- `start-epic`'s `i`/`import` route is preserved but routes through inception (full imports machinery comes in Phase 6).

## Files

**New — `skills/workflow-inception-entry/`:**
- `SKILL.md` — backbone (parse args, validate phase, gather context, invoke skill). Pattern: workflow-research-entry.
- `references/validate-phase.md` — first-session vs re-entry detection (manifest-based). For Phase 2, only the first-session branch is wired; re-entry returns a stub until Phase 4.
- `references/gather-context.md` — minimal; reads work-unit description from manifest.
- `references/invoke-skill.md` — handoff to processing skill.

**New — `skills/workflow-inception-process/`:**
- `SKILL.md` — backbone with steps: Resume Detection, Initialize, Load Guidelines, Knowledge Usage / Contextual Query, Session Loop, Document Review, Compliance, Conclude.
- `references/inception-guidelines.md` — curatorial mode, hard rules, routing inference. Treat the design doc's "Inception Phase — Behaviour" section as the source of truth. Worked examples per move (decomposition, tentative grouping, coarseness check, routing dialogue, anchor-and-return).
- `references/initialize-inception.md` — create the inception phase entry; create `inception/` directory; seed context from work-unit description.
- `references/session-loop.md` — conversational rhythm following discussion-process precedent. Topics surface; routing inferred from cues; tentative proposals confirmed.
- `references/routing-inference.md` — cue lists and worked examples (reuse from design doc verbatim).
- `references/confirm-and-persist.md` — render the map at session end; STOP gate; manifest writes; session-log write.
- `references/conclude-inception.md` — final commit; bridge invocation.
- `references/template.md` — initial session-log template (per design doc).

**New — `skills/workflow-bridge/references/inception-continuation.md`:**
- After inception conclusion, plan-mode handoff that re-invokes `/continue-epic {wu}`. Standard epic pattern.

**Modified:**
- `skills/start-epic/SKILL.md` — Step 3 invokes `/workflow-inception-entry epic {wu}`. The user no longer chooses research/discussion/import as a top-level menu (import flows through inception, fully integrated in Phase 6).
- `skills/start-epic/references/route-first-phase.md` — keep file (Phase 10 removes); update to reflect that import goes through inception.
- `skills/continue-epic/scripts/discovery.cjs` — recognise `inception` phase exists in the `phases` structure; no display changes yet, but the script must not error when iterating.
- `skills/workflow-bridge/SKILL.md` — register the new continuation reference.

## Out of scope

- Discovery map render in `continue-epic` (Phase 3).
- Refinement (Phase 4).
- Self-healing analyses (Phase 5).
- Imports machinery beyond preserving the `i`/`import` entry path (Phase 6).
- Topic-splitting/elevation map writes (Phase 7).
- Migration (Phase 9).

## Verification

1. Create a new test epic in a temp directory: `cd $TMPDIR/test-epic && /start-epic`.
2. Provide a description; confirm name; observe that the next phase invoked is inception (not research/discussion).
3. Walk through the inception conversation. Topics should surface conversationally; routing should be inferred from user cues.
4. At session end, confirm:
   - `phases.inception.items.{topic}` written for each topic, with `name`, `summary`, `routing`, `source: inception`.
   - `inception/session-001.md` written with the initial-session log shape.
5. Bridge fires; user lands back at `/continue-epic`.
6. `/continue-epic` does not error (display is transitional — full map render comes in Phase 3).
7. Compliance self-check passes on all new skill files.

## Notes for the implementer

- Inception is **one shape, no flavours** — same skill regardless of greenfield or existing-project epic. Scope emerges from user responses, not a flag.
- **Hard rules** (per design doc): initial spike not exhaustive; no active missing-piece probes; no decisions or investigations. Encode these in `inception-guidelines.md`.
- The session log is a markdown record of the journey, not a transcript. Brief, rationale-focused, event-keyed.
- `inception/` directory is created at first session; session logs accumulate there as `session-NNN.md`.
- The conversational convention follows discussion-process — STOP gates around manifest writes, not around every conversational turn.
- The "import" path through start-epic's existing `i`/`import` should still work in Phase 2 — it can drop into the existing exploration.md path until Phase 6 finalises imports. Don't build full imports machinery here.

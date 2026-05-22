# Phase 2 — Inception Entry Skill + Bridge Plumbing

**Status:** Not started · **Depends on:** Phase 1

## Purpose

First slice of the original "Inception MVP" (split into Phases 2-4 for reviewable size).

Establishes the **inception door**: the entry-point skill that routes incoming work into inception, plus the bridge continuation that routes back out, plus minimal awareness in `continue-epic`'s discovery script. The room behind the door (the actual conversation) lands in Phase 3; wiring `start-epic` to walk through the door lands in Phase 4.

After this phase: `/workflow-inception-entry epic {wu}` is a registered, compliant skill that gathers context and would invoke a processing skill — but the processing skill doesn't exist yet, so end-to-end use isn't possible. **No user-visible behaviour change** — `/start-epic` still routes to research/discussion as it does today.

## Reference

- [Design](design.md) — *Inception Phase — Behaviour* → *Initial session* (lines 184-195) for the entry shape; *Files on disk* (lines 302-318).
- `CONVENTIONS.md` — **MANDATORY** before authoring any skill file. Display rules, Step 0 structure, load directive format, zero-output rule, reference-file structure.
- `skills/workflow-research-entry/SKILL.md` and references — closest precedent. Model the inception-entry skill on this shape.
- `skills/workflow-bridge/SKILL.md` and `references/epic-continuation.md` — pattern for the continuation reference. Inception's continuation is simpler — always re-invokes `/continue-epic {wu}` with no phase-routing computation.
- `skills/continue-epic/scripts/discovery.cjs` — line 5 (`EPIC_PHASES`) needs `inception` added so the iterators don't skip the new phase.

## What ships

- New skill `workflow-inception-entry/` (SKILL.md + 3 references). Models on `workflow-research-entry`.
- New `workflow-bridge/references/inception-continuation.md` — plan-mode handoff that re-invokes `/continue-epic {work_unit}`.
- `workflow-bridge/SKILL.md` — register the new continuation reference (`completed_phase = inception` route).
- `continue-epic/scripts/discovery.cjs` — add `'inception'` to `EPIC_PHASES`. **No display change** — Phase 5 owns the discovery-map render.

## Files

**New — `skills/workflow-inception-entry/`:**

- `SKILL.md` — backbone with Step 0 (initialisation), Step 1 (parse args — `$0`=work_type, `$1`=work_unit, `$2` unused since inception is per-work-unit), Step 2 (check phase entry), Step 3 (validate — first-session vs re-entry), Step 4 (gather context), Step 5 (invoke skill).
- `references/validate-phase.md` — **first-session vs re-entry detection.** Phase 2 only wires the first-session branch. Re-entry emits a "refinement coming in Phase 6" stub and returns. Phase 6 replaces the body.
- `references/gather-context.md` — minimal. Reads work-unit description from manifest. If `imports[]` is non-empty, lists filenames as additional context (Phase 8 broadens this — KB indexing on import).
- `references/invoke-skill.md` — handoff to `workflow-inception-process`. **Note:** the processing skill doesn't exist until Phase 3. For Phase 2, the handoff text is authored against the future skill name; invoking it will error until Phase 3 lands. This is fine — Phase 2's PR is reviewable in isolation, and the entry skill becomes useful when stacked atop Phase 3.

**New — `skills/workflow-bridge/references/inception-continuation.md`:**

- Plan-mode handoff that always re-invokes `/continue-epic {work_unit}`. No phase-routing computation needed (single deterministic outcome).

**Modified:**

- `skills/workflow-bridge/SKILL.md` — Step 2 routing table gains an `inception` branch. Place above the existing epic branch.
- `skills/continue-epic/scripts/discovery.cjs` — line 5: add `'inception'` to `EPIC_PHASES`. Verify `buildEpicDetail` doesn't error on `phases.inception.items.{topic}` shape (status only, no `sources`/`format`).

## Out of scope

- Inception process skill itself (Phase 3).
- Wiring `start-epic` to invoke inception (Phase 4).
- Discovery-map render in `continue-epic` (Phase 5).
- Refinement / re-entry implementation (Phase 6).
- Imports machinery beyond awareness in `gather-context.md` (Phase 8).

## Verification

1. Compliance self-check passes on `workflow-inception-entry/SKILL.md` and each reference file.
2. Direct invocation smoke test:
   ```bash
   cd "$(mktemp -d)" && mkdir -p .workflows
   # Manually init an epic for testing
   node /path/to/skills/workflow-manifest/scripts/manifest.cjs init test-epic --work-type epic --description "Test"
   # Invoke the entry skill (will error at Step 5 because process skill doesn't exist yet — expected for Phase 2)
   /workflow-inception-entry epic test-epic
   ```
   Expected: skill loads, runs Step 0 → Step 4 cleanly, then errors at Step 5 invoking the missing process skill. The error confirms wiring is in place.
3. `continue-epic` does not error on existing epics (which have no `inception` phase):
   ```bash
   node skills/continue-epic/scripts/discovery.cjs
   ```
4. Run existing manifest tests to confirm Phase 1's foundations still pass.

## Notes for the implementer

- **CONVENTIONS.md is mandatory.** Re-read it before authoring `SKILL.md` and references — the conventions are dense and have produced silently non-compliant skills when relied on by memory.
- **Phase 2 is intentionally unreachable end-to-end.** The entry skill exists but invoking it will fail at Step 5 because Phase 3 hasn't shipped yet. This is by design — small, reviewable PRs build on each other.
- **Re-entry is stubbed, not skipped.** `validate-phase.md` has both branches structurally; the re-entry branch points to a Phase-6 placeholder. Phase 6 replaces the body with the real refinement flow. No throwaway code.
- **No background agents.** Inception is curatorial; Phase 3's process skill won't dispatch review/perspective agents either.

# Phase 11 — Documentation Cleanup

**Status:** Not started · **Depends on:** Phase 10 (final phase)

## Purpose

Update project-level documentation to reflect the new phase model. CLAUDE.md, README, and various skill workflow-context tables need refreshing. Compliance checks across all touched skill files. Mark this initiative as done in the index.

## Reference

- [Design](design.md) — Status section.
- `CLAUDE.md` — current Workflow Phases section, Skill Architecture, Key Conventions, etc.
- `README.md` — user-facing phase model documentation.
- `skills/workflow-shared/references/compliance-check.md` — the compliance self-check protocol.

## What ships

- `CLAUDE.md` updated to describe the discovery process (inception + research + discussion as the umbrella) and the new inception phase with its conventions.
- `README.md` updated with the new phase model and any user-facing references.
- Workflow-context tables in skill SKILL.md files updated where they enumerate phases (e.g., research-entry's table that says "Phase 1 of 6" needs to become "Phase 2 of 7" with inception at Phase 1).
- `INDEX.md` in this directory marks all phases as done.
- Compliance self-check passes on every touched skill file.
- Any dangling references to the old behaviour (e.g., `e`/`explore`, `pending_from_research` menu, `surfaced_topics` flow) cleaned up in docs.

## Files

**Modified:**
- `CLAUDE.md`:
  - Workflow Phases section: add inception as the new first phase. Update phase numbers throughout.
  - Skill Architecture section: mention `workflow-inception-entry` and `workflow-inception-process` as members of the entry/process tiers.
  - Key Conventions: document the discovery map concept, hard-delete model, dismissed-list pattern, stacked-PR convention if appropriate.
  - Migrations section: note the new inception migration.
- `README.md`:
  - Phase model and any user-facing references updated.
- Various skill files with workflow-context tables (the "Phase N of 6" markers):
  - `workflow-research-entry/SKILL.md`
  - `workflow-discussion-entry/SKILL.md`
  - `workflow-specification-entry/SKILL.md`
  - `workflow-planning-entry/SKILL.md`
  - `workflow-implementation-entry/SKILL.md`
  - `workflow-review-entry/SKILL.md`
  - `workflow-investigation-entry/SKILL.md` (bugfix-specific; check phase numbering)
  - `workflow-scoping-entry/SKILL.md` (quick-fix; check phase numbering)
  - Renumber to reflect inception at Phase 1 for epics. (Other work types may keep their existing numbering since inception is epic-only — verify and adjust per work type.)
- `discovery-map/INDEX.md` — mark all phases as Done.
- Any other doc with stale references to old patterns.

## Out of scope

- New skill behaviour (everything functional shipped in Phases 1-10).
- Removing legacy file references that have been deprecated but not deleted (e.g., the post-migration legacy `exploration.md` files stay; documentation should describe them as legacy if it mentions them at all).

## Verification

1. Run compliance self-check on all touched skill files. All pass.
2. Manual review of CLAUDE.md and README — accuracy, no stale references, the new phase model reads cleanly.
3. Walk through the full workflow on a fresh test epic end-to-end (`/start-epic` → inception → research/discussion → spec → plan → impl → review). All references to phases are consistent.
4. Walk through the workflow on a migrated legacy epic — works, with appropriate notes about legacy state.
5. Skill workflow-context tables ("Phase N of M") render the correct numbers everywhere.
6. `discovery-map/INDEX.md` shows all phases as Done.

## Notes for the implementer

- **Phase numbering** — for epics, inception is Phase 1, research is Phase 2, etc. (seven phases total). For other work types (feature, bugfix, quick-fix, cross-cutting), inception doesn't apply, so their phase numbering may stay as-is or shift based on whether other phases reorder. Be careful and verify each work type's pipeline.
- **`Stay in your lane` blocks** — many skill files have these in their workflow-context. Update with the new conceptual framing where appropriate (e.g., research-entry's "Stay in your lane" should reference the discovery process and inception).
- **Cross-cutting** — its pipeline (research → discussion → spec) is unchanged. Inception doesn't apply.
- **The design doc** — `discovery-map/design.md` — should remain as the canonical record. Don't delete it. Update `Status` section to reflect implementation complete.
- **The phase docs** — keep them in `discovery-map/`. They serve as historical record of what was built and why.

# Phase 4 — Refinement Session

**Status:** Not started · **Depends on:** Phase 3

## Purpose

Add the re-entry path to inception so users can refine the map after it's been seeded. Wires `f`/`refine` to actually do something. Implements the map editing operations (add, remove, rename, change-routing, edit-summary) with safety scaled to destructiveness.

## Reference

- [Design](design.md) — Refinement session subsection; Map editing operations subsection; Safety scales with destructiveness; Cancellation and Removal section (hard-delete + dismissed list).
- `skills/workflow-discussion-process/references/discussion-session.md` — conversational pattern precedent.
- `skills/workflow-shared/references/background-agent-surfacing.md` — surfacing protocol (Phase 5 will use it; not needed here yet).

## What ships

- Re-entry detection in `workflow-inception-process` routes to refinement-session reference instead of initial-session flow.
- `f`/`refine` from `continue-epic` opens the refinement session.
- Map editing operations work conversationally:
  - **Add** topics — batch confirmation supported (single STOP gate for multiple adds).
  - **Edit summary** — batch supported.
  - **Remove** (only if never-started) — per-item confirmation; hard-delete + dismissed-list write.
  - **Rename** (only if never-started) — per-item confirmation.
  - **Change routing** (only if never-started) — per-item confirmation.
- Mixed batches: additive ops batched, destructive ops per-item.
- Refinement session log written to `inception/session-NNN.md` (refinement template per design doc).
- Show-dismissed-items recovery option in refinement.

## Files

**New — `skills/workflow-inception-process/references/`:**
- `refinement-session.md` — re-entry flow: read state, self-healing check (placeholder/no-op until Phase 5), open refinement, persist, conclude.
- `map-operations.md` — per-operation handling with the editing-rules matrix from the design doc. Validation logic (never-started gate, name collision check). Hard-delete on remove + add to dismissed list.
- `show-dismissed.md` — surface dismissed items with their original source; allow user to re-add.

**Modified:**
- `skills/workflow-inception-process/SKILL.md` — Resume Detection branches to refinement-session for re-entry case.
- `skills/workflow-inception-entry/references/validate-phase.md` — detect re-entry via existing inception phase items; route appropriately.
- `skills/continue-epic/references/epic-display-and-menu.md` — `f`/`refine` invokes `/workflow-inception-entry epic {wu}` (no topic arg, signalling refinement intent).

## Out of scope

- Self-healing analyses (Phase 5 — refinement session loads them but the analyses themselves are not yet rewired).
- Imports interaction (Phase 6 — refinement may eventually offer "remove import" but not in this phase).
- Migration-driven empty-summary back-fill prompt (Phase 9).

## Verification

1. Continue from a Phase 3 test epic.
2. `/continue-epic` → `f`/`refine` → refinement session opens.
3. Add a new topic via natural language ("add offline mode as research") — single STOP gate, manifest written, session log entry added.
4. Add multiple topics in one message ("add A as research, B as discussion, C as research") — single STOP gate showing all three, single commit.
5. Try to remove an in-flight topic — blocked with explanation.
6. Remove a never-started topic — per-item STOP gate; manifest entry deleted; name added to dismissed list.
7. Mixed batch ("remove A, rename B to B2, add C") — destructive ops per-item, additive op can batch (or appear sequentially).
8. Show dismissed items — surfaces previously removed names; user can re-add.
9. Compliance self-check passes on all touched skill files.

## Notes for the implementer

- **Convention is conversational, like discussion-process** — STOP gates around manifest writes, not around every conversational turn.
- **Safety scales with destructiveness** — don't over-engineer with batch UIs for destructive operations; per-item is the rule there.
- **Hard-delete on remove** — the inception item disappears entirely from the manifest. The dismissed list separately blocks re-add. No `cancelled` status field on inception items.
- **Name collision rules** — active map item with same name blocks; dismissed-list match is allowed (removes from dismissed, creates new active item).
- **Routing change for never-started items only** — once a phase item exists, routing is implicit from which phase items are present.
- The refinement session log is keyed by event (changes made) rather than by transcript. Brief.

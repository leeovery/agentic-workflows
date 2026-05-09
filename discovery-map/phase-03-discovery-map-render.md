# Phase 3 — Discovery Map Render in continue-epic

**Status:** Not started · **Depends on:** Phase 2

## Purpose

Make the discovery map visible. Updates `continue-epic`'s state display to show the map at the top, collapses the menu to per-topic entries with auto-routing, surfaces the convergence signal, and tightens recommendation logic. After this phase, users see the full discovery experience for new epics.

## Reference

- [Design](design.md) — Map Render and Menu section in full; Auto-Routing section; Spec Gating (recommendation logic during/after discovery).
- `skills/continue-epic/scripts/discovery.cjs` — current discovery script with `pending_from_research`, `pending_from_gaps`, `next_phase_ready`, gating flags.
- `skills/continue-epic/references/epic-display-and-menu.md` — current display + menu logic.
- `skills/continue-epic/references/display-epic-map.md` — existing pipeline-map view (the `m`/`map` option). Symbol vocabulary (`✓ ◐ ○`) is shared.

## What ships

- Discovery map block at top of `continue-epic` state display, ordered by tier (`→ ◐ ✓ ○ ⊘`) with alphabetical sort within each tier.
- Map summary line with counts (`8 topics — 2 decided · 3 in flight · ...`).
- Convergence signal: `⚑ Discovery in progress — N topics not yet decided` / `✓ Discovery settled — ready for specification`.
- Source provenance shown on a sub-line under each topic when present.
- Per-phase entries collapse to per-topic menu entries with auto-routing (Start research/Start discussion/Continue X — phase).
- Recommendation logic: top discovery item (`→` first, then `◐`) during discovery; build-phase items once settled.
- New menu entries: `f`/`refine` (no behaviour yet — Phase 4 wires it).
- `p`/`pending` removed (map covers it).
- `s`/`spec` continues to operate when applicable but isn't recommended during discovery.

## Files

**Modified:**
- `skills/continue-epic/scripts/discovery.cjs` — compute lifecycle per topic by joining `phases.inception.items.*` with `phases.research.items.*` and `phases.discussion.items.*`. Tier sort, alphabetical within. Map summary. Convergence flag. New menu entry data shape.
- `skills/continue-epic/references/epic-display-and-menu.md` — render the discovery map block, key/legend, menu builder following the design doc render.
- `skills/continue-epic/SKILL.md` — Step 6 (Route Selection) handles new entry forms (`f`/`refine` route to inception-entry).

## Out of scope

- Refinement session itself (Phase 4 — `f`/`refine` menu entry leads here, but Phase 3 only wires the route).
- Self-healing callouts ("3 new topics added") — Phase 5.
- Imports count display ("N imported seeds") — Phase 6.
- Migration callouts — Phase 9.

## Verification

1. Continue from a Phase 2 test epic that has been through inception.
2. `/continue-epic` shows the discovery map at the top with all items in `○ fresh` state.
3. Counts in the summary line are correct.
4. Convergence signal reads `⚑ Discovery in progress`.
5. Menu shows per-topic entries (Start research / Start discussion). No `(recommended)` if no items are `→` or `◐`.
6. Pick a research-routed topic — routes to research-entry with the topic argument.
7. Complete the research; return to `continue-epic`. Topic now shows `→ research complete · ready for discussion`. Menu offers "Start discussion for {topic}" with `(recommended)` mark.
8. Complete the discussion. Topic shows `✓ decided`. If all items decided, convergence signal flips to `✓ Discovery settled`.
9. `s`/`spec` available when applicable; build-phase items recommended after settlement.
10. `m`/`map` (pipeline view) still works as before.

## Notes for the implementer

- The auto-routing rules are mechanical (per design doc): given `routing` + which phase items exist + their statuses, compute the next action. Encode this in the discovery script.
- Stable sort: alphabetical by `name` within each tier. Names are kebab-case in the manifest; titlecase for display.
- `→ ⊘` are new symbols joining the existing `✓ ◐ ○` vocabulary. Update the key/legend appropriately.
- Don't render `⊘` rows for topics that were never started — those are already removed from the manifest (hard-delete). `⊘` is only for cancelled phase work.
- Source provenance (`from kitchen-hardware`, `from gap-analysis`, etc.) shown on a sub-line under the row only when `source != inception`.

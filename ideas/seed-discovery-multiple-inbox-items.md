# Seed Discovery from Multiple Linked Inbox Items

## The Idea

Allow entering Discovery from several related inbox items at once — e.g. three captured bugs that are really facets of one epic, or an idea plus two follow-up notes that belong to the same feature — instead of the one-seed-per-entry model. Discovery reads all selected items as combined seed material; all of them archive together at the confirm trigger.

## Context

Phase 17 makes Discovery the universal entry, with inbox items as one seeding channel. The v1 model is **one seed per entry**: one captured item → the opening description of one work unit, with the item's folder providing the macro pre-seed hint. That's the clean, consistent baseline and what Phase 17 should ship.

But captured items often cluster. A user files three bug reports over a week, then realises they share one underlying defect — or logs an idea and later adds notes that belong to the same feature. Forcing them through one-at-a-time loses the linkage, and re-describing the combined shape by hand defeats the point of having captured them in the first place.

## What I'd Change

- Multi-select in the inbox pickup menu (choose several items before entering Discovery).
- Discovery's opener reads all selected items as combined seed material and sketches the shape it's picking up *across* them.
- Macro pre-seed handling when the selected items disagree (a bug + an idea) → no single folder hint; fall back to `s`/start-style classification and let Discovery shape it.
- At the confirm trigger, **all** selected items archive together — same lifecycle as the single-seed case, applied to the set.

## Relevant Files

- `skills/workflow-start/references/start-from-inbox.md` — inbox pickup menu (would gain multi-select)
- `skills/workflow-discovery-process/…` — opener seed-material handling (read N items, not 1)
- Phase 17 deferred-persistence confirm-trigger — archive the selected set, not a single file

## Implementation Notes

- Depends on Phase 17 landing (Discovery as universal entry + deferred persistence). Don't start before.
- Keep one-seed-per-entry as the default; multi-select is an opt-in affordance, not the common path.
- Mixed-folder selections need a precedence rule for the macro pre-seed — likely: any disagreement → no pre-seed, classify from content.
- Relates to [Inbox Pickup Actions](inbox-pickup-actions.md) (#18) — both reshape the inbox pickup menu; coordinate so they don't collide.

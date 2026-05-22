# Phase 10 — Direct-Entry Auto-Add

**Status:** Not started · **Depends on:** Phase 7 (and Phase 9 for shared name validation if extracted)

## Purpose

When the user picks `d`/`discuss` or `r`/`research` from `continue-epic` and provides a topic name that's not on the map, auto-create the inception item with `source: direct-start` and proceed to the phase entry. The map stays honest without forcing the user through inception for ad-hoc starts.

## Reference

- [Design](design.md) — Auto-Routing — Direct entry on unmapped topics subsection.
- `skills/continue-epic/references/epic-display-and-menu.md` — current `d`/`discuss` and `r`/`research` flows.
- `skills/workflow-research-entry/SKILL.md` — entry skill that gets invoked.
- `skills/workflow-discussion-entry/SKILL.md` — same.
- `skills/workflow-shared/references/topic-name-validation.md` (if extracted in Phase 9) — name validation helper.

## What ships

- `d`/`discuss` and `r`/`research` from `continue-epic`:
  - Prompt for topic name.
  - Validate against active map (block on collision) and dismissed list (allow, remove from dismissed).
  - If topic is on the map already, route to it (resume / continue).
  - If topic is new, create `phases.inception.items.{topic}` inline with `routing: research` (for `r`) or `routing: discussion` (for `d`), `source: direct-start`.
  - Then route to phase-entry skill with the topic.
- The `workflow-research-entry` and `workflow-discussion-entry` skills also auto-create the inception item if invoked with a topic that lacks one (covers any other invocation path that bypasses `continue-epic`).

## Files

**Modified:**
- `skills/continue-epic/references/epic-display-and-menu.md` — `d`/`discuss` and `r`/`research` flows: prompt for name, validate, create inception item if new, then invoke phase-entry.
- `skills/workflow-research-entry/SKILL.md` — when a topic argument is provided but no inception item exists, create one inline with `source: direct-start, routing: research`. Continue with normal flow.
- `skills/workflow-discussion-entry/SKILL.md` — same for `routing: discussion`.

## Out of scope

- Changes to the conversational-content of phase entries (just the manifest write is added).
- Auto-routing inference based on user-provided context at direct-entry time (the user explicitly picked `d`/`discuss` or `r`/`research`, so routing is given).
- Direct-entry from anywhere other than `continue-epic` plus phase entries (e.g., a future "scratch entry" — not in scope).

## Verification

1. Continue from a Phase 9 test epic.
2. From `/continue-epic`, pick `d`/`discuss`; provide a topic name not on the map (e.g., "feedback-mechanisms"). Verify:
   - Inception item created: `phases.inception.items.feedback-mechanisms` with `routing: discussion, source: direct-start`.
   - Discussion entry invoked with the topic.
   - Map render after the session shows the item with provenance "(direct-start)" or similar.
3. Same for `r`/`research`.
4. Try direct-entry with a topic name that exists on the map — falls through to resume/continue (existing behaviour).
5. Try direct-entry with a name in the dismissed list — allowed; dismissed entry removed; new active inception item created.
6. Invoke `/workflow-discussion-entry epic {wu} new-topic` directly (bypass continue-epic) — inception item should still be auto-created for `new-topic`.

## Notes for the implementer

- **Single source of truth for the auto-create logic** — putting it in the entry skills (`workflow-research-entry`, `workflow-discussion-entry`) covers every invocation path. The `continue-epic` flow can do the same logic, or just call into the entry skill which handles it.
- **Keep the user-visible flow simple** — picking `d`/`discuss` for a new topic should feel like "I told you to start a discussion, you started a discussion." The map item is a side effect.
- **`source: direct-start`** is the standard provenance value for these.
- **Don't auto-infer routing from context** at direct-entry — the user picked the verb; that's the routing intent.

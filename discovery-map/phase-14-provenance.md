# Phase 14 — Two-Tier Provenance for Inception Items

**Status:** Not started · **Depends on:** Phase 13 (documentation cleanup)

## Purpose

Inception items today carry a one-line `summary` field. That's enough for the discovery-map render — a compact descriptor — but not enough for the moment the user picks the topic up for discussion or research, possibly weeks later. The session opens blank. The "why was this surfaced?" context lives elsewhere (analysis cache files, the user's memory) and isn't surfaced.

This phase adds a `description` field — one or two paragraphs — alongside `summary`. Map renders keep using `summary`; entry skills load `description` as opening context for the session. Every surface that writes an inception item gets updated to populate both fields.

This also closes a gap left open by Phase 10: direct-entry items (`source: direct-start`) currently write no summary at all. After this phase, they derive both `summary` and `description` from the user's opening framing in the entry skill — no extra prompt.

## Reference

- [Design](design.md) — map rendering rules, source classification, lifecycle joins.
- Phase 10 — `skills/workflow-shared/references/ensure-inception-item.md` is the direct-entry write path; this phase replaces its "no summary" line with derivation from the opening exchange.
- Phase 7 — `skills/workflow-shared/references/research-analysis.md` and `discussion-gap-analysis.md` are the analysis write paths.
- Phase 9 — topic-split (`workflow-research-process/references/topic-splitting.md`) and topic-elevation (`workflow-discussion-process/references/discussion-session.md`) are the split/elevation write paths.

## What ships

### Data model

- New field on every inception item: `description` (string, paragraph or two). Nullable — existing items pre-Phase-14 don't have it.
- `summary` keeps its existing meaning (one-line map descriptor).
- Manifest CLI doesn't need changes — the field is opaque key/value.

### Write surfaces (all six)

Each surface generates `description` at the same time it generates `summary`. The source material differs per surface:

| Surface | `summary` source | `description` source |
|---|---|---|
| Initial inception session | session conversation | session conversation |
| Refinement Add | user input / Claude proposal | same |
| `research-analysis` | analysis output excerpt | analysis output (richer extract from the cache) |
| `discussion-gap-analysis` | analysis output excerpt | analysis output (richer extract from the cache) |
| Topic split | extracted thread content | extracted thread content |
| Topic elevation | elevation context | elevation context |
| Direct-entry | user's response to "what do you want to discuss/research?" | same |

For direct-entry specifically:
- `workflow-shared/references/ensure-inception-item.md` adds two arguments — `summary` and `description` — both derived by the calling entry skill before invocation.
- `workflow-discussion-entry` and `workflow-research-entry` ask the opening question (current behaviour), derive name + summary + description from the response, then invoke `ensure-inception-item` with all three.

### Read surface (entry skills)

When a user starts research or discussion on a topic that already has an inception item with a `description`:
- `workflow-discussion-entry` loads `description` as opening context for the session.
- `workflow-research-entry` does the same.
- The processing skill receives the description in its initial framing prompt so the session opens grounded.

For topics where `description` is null (legacy items, or items that have never had it populated), entry skills fall back to current behaviour: open with the standard question. No regression.

### Optional: Phase 11 legacy-recovery integration

If Phase 11's `legacy-recovery.md` reference ships (likely already merged by the time this phase runs), it can be updated here to also derive `description` from the same source files it reads for `summary`. The walkthrough already reads research/discussion files; deriving two paragraphs instead of one paragraph is a free extension. Update the batch review prompt to show both fields side by side.

## Files

**New:** none — additive field, no new files.

**Modified:**
- `skills/workflow-inception-process/SKILL.md` and references — initial inception session writes `description` alongside `summary`.
- `skills/workflow-inception-process/references/map-operations.md` — refinement Add writes both fields; Edit Summary becomes Edit Summary + Description (or two separate ops).
- `skills/workflow-shared/references/research-analysis.md` — write `description`.
- `skills/workflow-shared/references/discussion-gap-analysis.md` — write `description`.
- `skills/workflow-research-process/references/topic-splitting.md` — write `description` on the new item.
- `skills/workflow-discussion-process/references/discussion-session.md` — write `description` on topic-elevation.
- `skills/workflow-shared/references/ensure-inception-item.md` — accept `summary` and `description` arguments, write both.
- `skills/workflow-discussion-entry/...` and `skills/workflow-research-entry/...` — derive summary + description from opening question, pass to `ensure-inception-item`.
- `skills/workflow-discussion-entry/...` and `skills/workflow-research-entry/...` — load `description` as opening context when topic already has one.
- `skills/continue-epic/references/legacy-recovery.md` (if present) — extend the walkthrough to derive description from research/discussion files; update the batch review prompt.

**Tests:**
- Coverage for the new field landing on every write surface.
- Coverage for entry skills loading description as opening context.
- Coverage for fallback when description is null.

## Out of scope

- Indexing description content into the KB. That's Phase 15.
- Migrating existing items to back-fill description. Direct-entry items pre-Phase-14 will have null description forever unless the user edits via refinement. Acceptable — the field is additive and fallback works.
- Changing the map render. `summary` stays the one-liner; `description` is never rendered in the map.

## Verification

1. Each write surface populates `description` in fresh manifest tests.
2. Entry skills load description as opening context (e2e smoke).
3. Fallback works for null description (e2e smoke on legacy item).
4. Compliance self-check on every touched skill file.
5. No regression on existing summary writes.

## Notes for the implementer

- **The field is opaque to the manifest CLI.** No schema change needed. Just write the key.
- **Direct-entry derivation is the trickiest part.** The entry skill has to do two things from one user response: extract a topic name (already does this) AND generate summary + description. Probably best as a single Claude turn that emits all three structured outputs, then the skill writes them.
- **Description length isn't enforced.** Paragraph or two is the target; if Claude produces three sentences or six, that's fine. Map render doesn't show it, so length doesn't bleed into UI.
- **Legacy-recovery update is small but worth doing in the same phase.** Otherwise migrated items get summaries but not descriptions, and the user has to do another pass via refinement to populate descriptions.

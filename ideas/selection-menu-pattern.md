# Selection Menu Display Pattern

## The Idea

Normalise how items are displayed and selected across all skill menus. Two patterns currently coexist and should converge on one.

## Context

When a skill presents items for the user to select by number, there are two approaches in use:

**Pattern A — Tree display + separate numbered menu:** Items are shown in a `└─` tree for visual context, then re-listed as numbered options in a selection prompt below. The tree and menu show the same items twice.

**Pattern B — Single numbered display:** Items are shown once with numbers in the display block. The selection prompt references those numbers ("enter number", "pick from the list above"). No duplication.

Pattern B is dominant (~95% of selection menus), but Pattern A appears in at least one place (section G of `epic-display-and-menu.md` — Manage Pending). The inconsistency was introduced during the pending discussion status feature but the underlying question applies to all menus.

## Possible Directions

- Standardise on Pattern B everywhere — numbered display, reference back. Simpler, no duplication, consistent with existing convention.
- Standardise on Pattern A where items have rich sub-detail (tree with `└─` children) that doesn't fit a numbered list well. Use Pattern B for flat lists.
- Formalise the choice in CLAUDE.md Display & Output Conventions so future skills follow whichever pattern is chosen.

## Relevant Files

- `skills/continue-epic/references/epic-display-and-menu.md` — section G uses Pattern A
- `skills/continue-epic/references/select-epic.md` — Pattern B
- `skills/continue-*/references/select-*.md` — all Pattern B
- `skills/workflow-specification-entry/references/display-specs-menu.md` — Pattern B
- `skills/workflow-specification-entry/references/display-groupings.md` — Pattern B
- `skills/workflow-start/references/active-work.md` — Pattern B
- `skills/workflow-discussion-entry/references/display-options.md` — Pattern B

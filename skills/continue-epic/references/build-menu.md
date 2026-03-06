# Build Menu

*Reference for **[continue-epic](../SKILL.md)***

---

Build and display the interactive menu for the selected epic, then process the user's selection.

## Menu Construction

Build a numbered menu with three sections:

**Section 1 — In-progress items** (always first):
- Any item with status `in-progress` in any phase
- Format: `Continue "{topic:(titlecase)}" — {phase} (in-progress)`

**Section 2 — Next-phase-ready items:**
- From `next_phase_ready` in discovery output
- Concluded spec with no plan: `Start planning for "{topic:(titlecase)}" — spec concluded`
- Concluded plan with no implementation: `Start implementation of "{topic:(titlecase)}" — plan concluded`
- Completed implementation with no review: `Start review for "{topic:(titlecase)}" — implementation completed`
- Unaccounted discussions (from `unaccounted_discussions`): `Start specification — {N} discussion(s) not yet in a spec`
  - Only show if `gating.can_start_specification` is true (at least one concluded discussion)

**Section 3 — Standing options:**
- `Start new discussion topic` (always present)
- `Start new research` (always present)
- `Resume a concluded topic` (only shown when `concluded` items exist)

All sub-menus include a "Back" option as the last numbered item.

**Phase-forward gating:**
- No "Start planning" unless `gating.can_start_planning` is true
- No "Start implementation" unless `gating.can_start_implementation` is true
- No "Start review" unless `gating.can_start_review` is true
- No "Start specification" unless `gating.can_start_specification` is true

## Display Menu

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
What would you like to do?

1. Continue "{topic}" — {phase} (in-progress)
2. Start planning for "{topic}" — spec concluded
3. Start new discussion topic
4. Start new research
5. Resume a concluded topic

Select an option (enter number):
· · · · · · · · · · · ·
```

Recreate with actual items from discovery. Blank line between sections.

**STOP.** Wait for user response.

## Process Selection

Store the selected action and topic for routing in **Step 6**.

→ Return to **[the skill](../SKILL.md)**.

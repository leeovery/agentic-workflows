# Produce Review

*Reference for **[workflow-review-process](../SKILL.md)***

---

Aggregate QA findings into a review document using the **[template.md](template.md)**.

Write the review to `.workflows/{work_unit}/review/{topic}/report.md`. The review is always per-plan.

**QA Verdict** (from Step 4):
- **Approve** — All acceptance criteria met, no blocking issues
- **Request Changes** — Missing requirements, broken functionality, inadequate tests
- **Comments Only** — Minor suggestions, non-blocking observations

### Categorizing Recommendations

When writing the `## Recommendations` section, read the NON-BLOCKING NOTES from all `report-*.md` files and group them by their category tags:

- `[quickfix]` → `### Quick-fixes`
- `[idea]` → `### Ideas`
- `[bug]` → `### Bugs`

If a note lacks a category tag, categorize based on content: mechanical/cosmetic → quickfix, needs discussion/design → idea, broken behavior → bug.

Only include subsections that have at least one item. Number items sequentially across all subsections (do not reset numbering per category). Omit the entire `## Recommendations` section if there are no non-blocking notes.

### Commit and Continue

Commit: `review({work_unit}): complete review`

Your review feedback can be:
- Addressed by implementation (same or new session)
- Delegated to an agent for fixes
- Overridden by user ("ship it anyway")

You produce feedback. User decides what to do with it.

→ Return to caller.

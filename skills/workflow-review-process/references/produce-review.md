# Produce Review

*Reference for **[workflow-review-process](../SKILL.md)***

---

Aggregate QA findings into a review document using the **[template.md](template.md)**.

Write the review to `.workflows/{work_unit}/review/{topic}/report.md`. The review is always per-plan.

**QA Verdict** (from Step 4):
- **Approve** — All acceptance criteria met, no blocking issues
- **Request Changes** — Missing requirements, broken functionality, inadequate tests
- **Comments Only** — Minor suggestions, non-blocking observations

Commit: `review({work_unit}): complete review`

Present the review to the user.

Your review feedback can be:
- Addressed by implementation (same or new session)
- Delegated to an agent for fixes
- Overridden by user ("ship it anyway")

You produce feedback. User decides what to do with it.

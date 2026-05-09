# Inception Session Log Template

*Reference for **[workflow-inception-process](../SKILL.md)***

---

Standard structure for the initial inception session log. Location: `.workflows/{work_unit}/inception/session-001.md`.

The log is **journey-focused and brief**. The manifest holds the structured data (topics, summaries, routing); the log captures the rationale — the description as-of-session, why each topic was named, why each was routed, anything considered and discarded. Refinement sessions get their own `session-NNN.md` files (out of scope for this phase).

**This is a guide, not a form.** Drop sections that did not apply (e.g., no "Considered and Discarded" if nothing was). Two paragraphs of prose are fine if the session was light; a handful of short sections are fine if it was heavy.

## Template

```markdown
# Inception Session 001 — Initial Framing

Date: {YYYY-MM-DD}
Work unit: {work_unit}

## Description (as of session)

{The work-unit description at session time — captured because the
description can evolve, and we want to know what framing the
session worked from.}

## Imports

- imports/{filename}.md
- ...

## Topics Identified

### {topic-name}

- Routing: {research|discussion}
- Why: {one-line rationale — what cue drove the routing}

### {topic-name}

- Routing: {research|discussion}
- Why: ...

## Considered and Discarded

- {item} — {reason}

## Conclusion

{N} topics seeded. {Optional: suggested first stop with reasoning.}
```

## Usage Notes

**When creating** (Step 1):

1. Ensure the inception directory exists: `.workflows/{work_unit}/inception/`
2. Create the file: `.workflows/{work_unit}/inception/session-001.md`
3. Populate the header (date, work unit) and the **Description (as of session)** section from the handoff.
4. Populate the **Imports** section if the handoff lists any; omit the section entirely if there are none.
5. Leave **Topics Identified**, **Considered and Discarded**, and **Conclusion** as placeholders to fill in during the session.

**During the session** (Step 5):

- Append to **Topics Identified** as topics surface and tentative routing is agreed. The on-disk draft is the recovery surface for context refresh — keep it current at natural pauses, not after every exchange.
- Note items the user raised and then dropped under **Considered and Discarded** (with the reason).
- Commit the draft at natural breaks. Do not hold the working list only in conversation memory — context compaction is lossy.

**At confirm-and-persist** (Step 6):

- Reconcile the draft against the proposed map the user just approved. Add or remove topic entries to match. Populate the **Conclusion** with the topic count and any suggested first stop.
- Drop the **Imports** or **Considered and Discarded** sections if they remained empty.

**Anti-patterns**:

- No transcript-style content. The log is rationale, not dialogue.
- No decisions or option weighing. That belongs in discussion. The "Why" line is one sentence per topic — what cue drove the routing.
- No investigation. The log records what was framed, not what was uncovered.

→ Return to caller.

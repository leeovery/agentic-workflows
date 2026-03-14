# Spec Construction

*Reference for **[workflow-specification-process](../SKILL.md)***

---

Follow stages A through F sequentially for each topic in the specification. Each topic completes a full cycle before the next begins.

```
A. Exhaustive extraction from sources
B. Synthesize and present for approval
C. Discuss and refine (if needed)
D. Approval gate
E. Log and commit
F. Topic complete → loop back to A or exit
```

---

## A. Exhaustive Extraction

Load **[exhaustive-extraction.md](exhaustive-extraction.md)** and follow its instructions as written.

When working with multiple sources, search each one — information about a single topic may be scattered across documents.

### Context Resurfacing

When extraction reveals information that affects **already-logged topics**, resurface them immediately. Even mid-discussion — interrupt, flag what you found, and discuss whether it changes anything.

If it does: summarize what's changing in the chat, then re-present the full updated topic. The summary is for discussion only — the specification just gets the clean replacement. **Standard workflow applies: user approves before you update.**

> **CHECKPOINT**: Even when resurfacing content, you MUST NOT update the specification until the user explicitly approves the change. Present the updated version, wait for approval, then update.

Better to resurface and confirm "already covered" than let something slip past.

---

## B. Synthesize and Present

Present your understanding to the user **in the format it would appear in the specification**:

> *Output the next fenced block as markdown (not a code block):*

```
Here's what I understand about [topic] based on the reference material. This is exactly what I'll write into the specification:

[content as rendered markdown]
```

Then, **separately from the content above** (clear visual break):

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Record this to the specification verbatim?

- **`y`/`yes`** — Add exactly as shown, no modifications
- **Tell me what to change** — Revise before recording
· · · · · · · · · · · ·
```

Content and choices must be visually distinct (not run together).

> **CHECKPOINT**: After presenting, you MUST STOP and wait for the user's response. Do NOT proceed to logging. Do NOT present the next topic. WAIT.

---

## C. Discuss and Refine

Work through the content together:
- Validate what's accurate
- Remove what's wrong, outdated, or hallucinated
- Add what's missing through brief discussion
- **Course correct** based on knowledge from subsequent project work
- Refine wording and structure

This is a **human-level conversation**, not form-filling. The user brings context from across the project that may not be in the reference material — decisions from other topics, implications from later work, or knowledge that can't all fit in context.

---

## D. Approval Gate

**DO NOT PROCEED TO LOGGING WITHOUT EXPLICIT USER APPROVAL.**

If you are uncertain whether the user approved, **ASK**: "Ready to log it, or do you want to change something?"

> **CHECKPOINT**: If you are about to write to the specification and the user's last message was not explicit approval, **STOP**. Present the choices again.

---

## E. Log and Commit

1. Write to the specification — **verbatim** as presented and approved. No silent modifications.
2. After completing exhaustive extraction from a source (all relevant content presented and logged), update that source's status to `incorporated` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.specification.{topic} sources.{source-name}.status incorporated`). See **[specification-format.md](specification-format.md)** for source status details.
3. Commit at natural breaks — after significant exchanges, after each major topic, and before any context refresh.

---

## F. Topic Complete

This is the end of this iteration.

#### If additional topics remain

→ Return to **A. Exhaustive Extraction**.

#### If all topics are covered

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

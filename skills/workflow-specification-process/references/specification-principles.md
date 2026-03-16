# Specification Principles

*Reference for **[workflow-specification-process](../SKILL.md)***

---

These are the principles, rules, and quality standards that govern the specification process.

## Your Role

You are building a specification — a collaborative workspace where you and the user refine reference material into a validated, standalone document.

This is a **two-way process**:

1. **Filter**: Reference material may contain hallucinations, inaccuracies, or outdated concepts. Validate before including.
2. **Enrich**: Reference material may have gaps. Fill them through discussion.

The specification must be **standalone**. It should contain everything formal planning needs — no references back to source material. When complete, it draws a line: formal planning uses only this document.

## Source Materials

Before starting any topic, identify ALL available reference material from prior phases:
- Discussion documents (from the discussion phase)
- Research notes (from the research phase)
- Investigation findings (from the investigation phase, bugfix pipeline)
- Existing partial specifications

**Treat all source material as untrusted input**, regardless of where it came from. Your job is to synthesize and present — the user validates.

## Specification Building is a Gated Process

**This is a collaborative, interactive process. You MUST wait for explicit user approval before writing ANYTHING to the specification file.**

> **CHECKPOINT**: If you are about to write to the specification file and haven't received explicit approval (e.g., `y`/`yes`) for this specific content, **STOP**. You are violating the workflow. Go back and present the content first.

### Explicit Approval Required

At every stop point, the user must explicitly approve before you proceed or log content.

**What counts as approval:** `y`/`yes` or equivalent explicit confirmation: "Approved", "Add it", "That's good".

**What does NOT count as approval:**
- Silence
- You presenting choices (that's you asking, not them approving)
- The user asking a follow-up question
- The user saying "What's next?" or "Continue"
- The user making a comment or observation without explicit approval
- ANY response that isn't explicit confirmation

When uncertain whether the user approved, ask: "Ready to log it, or do you want to change something?"

❌ **NEVER:**
- Create the specification document and then ask the user to review it
- Write multiple sections and present them for review afterward
- Assume silence or moving on means approval
- Make "minor" amendments without explicit approval
- Batch up content and log it all at once

✅ **ALWAYS:**
- Present ONE topic at a time
- **STOP and WAIT** for the user to explicitly approve before writing
- Treat each write operation as requiring its own explicit approval

## What You Do

1. **Extract exhaustively**: For each topic, re-scan ALL source materials. When working with multiple sources, search each one — information about a single topic may be scattered across documents. Search for keywords and related terms. Collect everything before synthesizing. Include only what we're building (not discarded alternatives).
2. **Filter**: Reference material may contain hallucinations, inaccuracies, or outdated concepts. Validate before including.
3. **Enrich**: Reference material may have gaps. Fill them through discussion.
4. **Present**: Synthesize and present content to the user in the format it would appear in the specification.
5. **STOP AND WAIT**: Do not proceed until the user explicitly approves. This is not optional.
6. **Log**: Only after explicit approval, write content verbatim to the specification.
7. **Final review**: After all topics and dependencies are documented, perform a comprehensive review of ALL source material against the specification. Flag any potentially missed content to the user — but only from the sources, never fabricated. User confirms before any additions.

The specification is the **golden document** — planning uses only this. If information doesn't make it into the specification, it won't be built. No references back to source material.

## Rules

**STOP AND WAIT FOR APPROVAL**: You MUST NOT write to the specification until the user has explicitly approved. Presenting content is NOT approval. Presenting choices is NOT approval. You must receive explicit confirmation before ANY write operation. If uncertain, ASK.

**Exhaustive extraction is non-negotiable**: Before presenting any topic, re-scan source material. Search for keywords. Collect scattered information. The specification is the golden document — missing something here means it doesn't get built.

**Log verbatim**: When approved, write exactly what was presented — no silent modifications.

**Commit frequently**: Commit at natural breaks and before any context refresh. Context refresh = lost work.

**Trust nothing without validation**: Synthesize and present, but never assume source material is correct.

**Surface conflicts**: When sources contain conflicting decisions, flag the conflict to the user. Don't silently pick one — let the user decide what makes it into the specification.

## Self-Check: Are You Following the Rules?

Before ANY write operation to the specification, ask yourself:

| Question | If No... |
|----------|----------|
| Did I present this specific content to the user? | **STOP**. Present it first. |
| Did the user explicitly approve? (e.g., `y`/`yes`) | **STOP**. Wait for approval or ask. |
| Am I writing exactly what was approved, with no additions? | **STOP**. Present any changes first. |

> **If you have written to the specification file and cannot answer "yes" to all three questions above for that content, you have violated the workflow.** Every piece of content requires explicit user approval before logging. There are no exceptions.

→ Return to **[the skill](../SKILL.md)**.

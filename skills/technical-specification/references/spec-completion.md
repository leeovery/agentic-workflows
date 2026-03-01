# Assess Type & Conclude

*Reference for **[technical-specification](../SKILL.md)***

---

## A. Determine Specification Type

Before asking for sign-off, assess whether this is a **feature** or **cross-cutting** specification. See **[specification-format.md](specification-format.md)** for type definitions.

**Feature specification** — Something to build:
- Has concrete deliverables (code, APIs, UI)
- Can be planned with phases, tasks, acceptance criteria
- Results in a standalone implementation

**Cross-cutting specification** — Patterns/policies that inform other work:
- Defines "how to do things" rather than "what to build"
- Will be referenced by multiple feature specifications
- Implementation happens within features that apply these patterns

Present your assessment to the user:

> *Output the next fenced block as a code block:*

```
Type Assessment

This specification appears to be a {feature/cross-cutting} specification.

{Brief rationale — e.g., "It defines a caching strategy that will inform how
multiple features handle data retrieval, rather than being a standalone piece
of functionality to build."}

  Feature specs      — proceed to planning and implementation
  Cross-cutting specs — referenced by feature plans, no own implementation plan
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Confirm type assessment
- **Comment** — Suggest a different classification
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `comment`

Discuss the user's suggested classification, re-assess, and re-present the assessment display and prompt above.

#### If `yes`

→ Proceed to **B. Verify Tracking Files Complete**.

---

## B. Verify Tracking Files Complete

Before proceeding to sign-off, confirm that all review tracking files across all cycles have `status: complete`:

- `review-input-tracking-c{N}.md` — should be marked complete after each Phase 1
- `review-gap-analysis-tracking-c{N}.md` — should be marked complete after each Phase 2

If any tracking file still shows `status: in-progress`, mark it complete now.

> **CHECKPOINT**: Do not proceed to sign-off if any tracking files still show `status: in-progress`. They indicate incomplete review work.

---

## C. Sign-Off

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Conclude specification and mark as concluded
- **Comment** — Add context before concluding
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `comment`

Discuss the user's context, apply any changes, then re-present the sign-off prompt above.

#### If `yes`

→ Proceed to **D. Update Frontmatter and Conclude**.

---

## D. Update Frontmatter and Conclude

Update the specification frontmatter:

```yaml
---
topic: {topic-name}
status: concluded
type: feature  # or cross-cutting, as confirmed
date: YYYY-MM-DD  # Use today's actual date
review_cycle: {N}
finding_gate_mode: gated
---
```

Specification is complete when:
- All topics have validated content
- All sources are marked as `incorporated`
- At least one review cycle completed with no findings, OR user explicitly chose to proceed past the re-loop prompt
- All review tracking files marked `status: complete`
- Type has been determined and confirmed
- User confirms the specification is complete
- No blocking gaps remain

Commit: `spec({topic}): conclude specification`

---

## E. Handle Source Specifications

If any of your sources were **existing specifications** (as opposed to discussions, research, or other reference material), these have now been consolidated into the new specification.

1. Mark each source specification as superseded by updating its frontmatter:
   ```yaml
   status: superseded
   superseded_by: {new-specification-name}
   ```
2. Inform the user which files were updated
3. Commit: `spec({topic}): mark source specifications as superseded`

---

## F. Pipeline Continuation

Check the specification frontmatter for `work_type`.

#### If `work_type` is set (`feature`, `bugfix`, or `greenfield`)

This specification is part of a pipeline. Invoke the `/workflow-bridge` skill:

```
Pipeline bridge for: {topic}
Work type: {work_type from artifact frontmatter}
Completed phase: specification

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

#### If `work_type` is not set

> *Output the next fenced block as a code block:*

```
Specification concluded: {topic}

The specification is ready for planning. Run /start-planning to begin.
```

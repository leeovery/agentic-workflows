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

  Feature specs      — standalone, directly actionable
  Cross-cutting specs — referenced by feature specs, no own action plan
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

→ Proceed to **D. Update Manifest and Conclude**.

---

## D. Update Manifest and Conclude

Update the specification metadata via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase specification --topic {topic} status concluded
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase specification --topic {topic} type {type}  # feature or cross-cutting, as confirmed in Section A
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase specification --topic {topic} date $(date +%Y-%m-%d)
```

Specification is complete when:
- All topics have validated content
- All sources are marked as `incorporated`
- At least one review cycle completed with no findings, OR user explicitly chose to proceed past the re-loop prompt
- All review tracking files marked `status: complete`
- Type has been determined and confirmed
- User confirms the specification is complete
- No blocking gaps remain

Commit: `spec({work_unit}): conclude specification`

---

## E. Handle Source Specifications

If any of your sources were **existing specifications** (as opposed to discussions, research, or other reference material), these have now been consolidated into the new specification.

1. Mark each source specification as superseded via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase specification --topic {source-topic} status superseded
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase specification --topic {source-topic} superseded_by {topic}
   ```
2. Inform the user which topics were updated
3. Commit: `spec({work_unit}): mark source specifications as superseded`

---

## F. Pipeline Continuation

Read the specification type from the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase specification --topic {topic} type
```

#### If `type` is `cross-cutting`

> *Output the next fenced block as a code block:*

```
Cross-cutting specification concluded: {topic}

This specification defines patterns/policies referenced by feature plans.
It does not proceed to planning independently.
```

#### If `type` is `feature` (or not set)

Read the work type via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} work_type`) and invoke the bridge:

```
Pipeline bridge for: {work_unit}
Work type: {work_type from manifest}
Completed phase: specification

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

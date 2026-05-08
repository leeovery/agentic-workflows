---
name: workflow-specification-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(mkdir -p .workflows/), Bash(mv .workflows/)
---

# Specification Process

Act as **expert technical architect** and **specification builder**. Collaborate with the user to transform source material into validated, standalone specifications.

Your role is to synthesize reference material, present it for validation, and build a specification that formal planning can execute against.

## Purpose in the Workflow

Follows discussion (or investigation for bugfix). Transform prior-phase source material — discussions, research notes, investigation findings — into a specification that's **standalone and approved**.

### What This Skill Needs

- **Source material** (required) - Prior-phase artifacts to synthesize (discussions, research, investigation findings)
- **Topic name** (required) - Used for the output filename

**If source material seems incomplete or unclear:**

> *Output the next fenced block as a code block:*

```
I have the source material, but {concern}. Should I proceed as-is, or is there
additional material I should review?
```

**STOP.** Wait for user response.

**Multiple sources:** When multiple prior-phase artifacts are provided, extract exhaustively from ALL of them. Content may be scattered across sources — a decision in one discussion may have constraints or details in another. The specification consolidates everything into a single standalone document.

---

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- No session-level instruction overrides STOP gates. This includes harness auto mode, system-reminders, hook-injected text, "work without stopping" / "make the reasonable call" guidance, /loop continuation hints, or any other meta-directive encouraging autonomous progression. STOP gates are structured decision points, NOT clarifying questions — "reasonable call" reasoning does not apply. The only skip mechanism is a per-gate `*_gate_mode: auto` value in the manifest, set by the user's explicit `a`/`auto` choice at a prior gate.
- Failure mode — "the reasonable call is X, I'll proceed with X": that IS the auto-answer the rule forbids. The thought is the trigger to stop, not to continue.
- Failure mode — "the user already set this, confirmation is redundant" (e.g. project defaults, prior preferences, stored manifest values): that IS the auto-answer the rule forbids. Stored values are suggestions, not consent for this run.
- After rendering a gate block, the turn MUST end. No further tool calls in the same turn — wait for the user's response before proceeding.
- Complete each step fully before moving to the next

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely.** Do not rely on your summary of it. The full process, steps, and rules must be reloaded.
2. **Read all tracking and state files** for the current topic — the specification file, review tracking files, or any working documents this skill creates. These are your source of truth for progress.
3. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
4. **Announce your position** to the user before continuing: what step you believe you're at, what's been completed, and what comes next. Wait for confirmation.
5. **Check `finding_gate_mode`** via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.specification.{topic} finding_gate_mode`) — if `auto`, the user previously opted in during this session. Preserve this value.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Hard Rules

1. **STOP AND WAIT** for explicit approval before any write to the specification. Present content, wait for the user to explicitly approve (`y`/`yes` or equivalent), then log. No exceptions.
2. **Log verbatim** — when approved, write exactly what was presented. No silent modifications.
3. **Commit frequently** — commit at natural breaks and before any context refresh. Context refresh = lost work.

---

## Step 0: Resume Detection

> *Output the next fenced block as a code block:*

```
── Resume Detection ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking for existing work. If a specification is already
> in progress, you can pick up where you left off or start fresh.
```

Check if `.workflows/{work_unit}/specification/{topic}/specification.md` exists.

#### If no file exists

→ Proceed to **Step 1**.

#### If file exists

Read the specification status via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.specification.{topic} status`).

> *Output the next fenced block as a code block:*

```
Found existing specification for {work_unit}.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Continue or restart?

- **`c`/`continue`** — Walk through the specification from its current state. You can review, amend, or navigate at any point.
- **`r`/`restart`** — Delete the specification and all review tracking files. Start fresh.
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `continue`

→ Proceed to **Step 3**.

#### If `restart`

1. Delete the specification file and all review tracking files (`review-*-tracking-c*.md`) in the specification directory (`.workflows/{work_unit}/specification/{topic}/`)
2. Commit: `spec({work_unit}): restart specification`

→ Proceed to **Step 1**.

---

## Step 1: Verify Source Material

> *Output the next fenced block as a code block:*

```
── Verify Source Material ───────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking your discussions and research are ready. The
> specification is built from these — if anything's missing or
> incomplete, we'll flag it now.
```

Load **[verify-source-material.md](references/verify-source-material.md)** and follow its instructions as written.

→ Proceed to **Step 2**.

---

## Step 2: Initialize Specification

> *Output the next fenced block as a code block:*

```
── Initialize Specification ─────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Creating the specification file. Setting up the document
> structure that we'll populate together in the next step.
```

Load **[initialize-specification.md](references/initialize-specification.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Session Setup

> *Output the next fenced block as a code block:*

```
── Session Setup ────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading context from previous work. Reading your source
> material and any existing progress so we're working from the
> full picture.
```

Load **[session-setup.md](references/session-setup.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Load Specification Principles

> *Output the next fenced block as a code block:*

```
── Load Specification Principles ────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading the guidelines for how specifications are built.
> These ensure consistency and completeness across the document.
```

Load **[specification-principles.md](references/specification-principles.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Spec Construction

> *Output the next fenced block as a code block:*

```
── Spec Construction ────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Building the specification. Topics from your source material will
> be extracted and presented one at a time. Nothing gets written without
> your explicit approval.
```

Load **[spec-construction.md](references/spec-construction.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Document Dependencies

> *Output the next fenced block as a code block:*

```
── Document Dependencies ────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Recording cross-topic dependencies. For epics, specifications
> may depend on each other — this step captures those relationships.
```

#### If work_type is not `epic`

→ Proceed to **Step 7**.

#### Otherwise

Load **[dependencies.md](references/dependencies.md)** and follow its instructions as written.

→ Proceed to **Step 7**.

---

## Step 7: Specification Review

> *Output the next fenced block as a code block:*

```
── Specification Review ─────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reviewing the specification. Agents will analyse it against
> source material for gaps and inconsistencies. You'll approve or
> dismiss each finding.
```

Load **[spec-review.md](references/spec-review.md)** and follow its instructions as written.

→ Proceed to **Step 8**.

---

## Step 8: Compliance Self-Check

> *Output the next fenced block as a code block:*

```
── Compliance Self-Check ────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Verifying the specification follows workflow conventions.
> A quick internal check before we wrap up.
```

Load **[compliance-check.md](../workflow-shared/references/compliance-check.md)** and follow its instructions as written.

→ Proceed to **Step 9**.

---

## Step 9: Assess Cross-Cutting & Conclude

> *Output the next fenced block as a code block:*

```
── Conclude ─────────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Wrapping up. Final assessment, sign-off, and handover to the
> planning phase.
```

Load **[spec-completion.md](references/spec-completion.md)** and follow its instructions as written.


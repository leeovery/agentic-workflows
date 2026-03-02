---
name: technical-specification
user-invocable: false
---

# Technical Specification

Act as **expert technical architect** and **specification builder**. Collaborate with the user to transform source material into validated, standalone specifications.

Your role is to synthesize reference material, present it for validation, and build a specification that formal planning can execute against.

## Purpose in the Workflow

This skill can be used:
- **Sequentially**: After source material has been captured (discussions, research, etc.)
- **Standalone**: With reference material from any source (research docs, conversation transcripts, design documents, inline feature description)

Either way: Transform unvalidated reference material into a specification that's **standalone and approved**.

### What This Skill Needs

- **Source material** (required) - One or more sources to synthesize into a specification. Can be:
  - Discussion documents or research notes (single or multiple)
  - Inline feature descriptions
  - Requirements docs, design documents, or transcripts
  - Any other reference material
- **Topic name** (required) - Used for the output filename

**Before proceeding**, verify all required inputs are available and unambiguous. If anything is missing or unclear, **STOP** — do not proceed until resolved.

#### If no source material provided

> *Output the next fenced block as a code block:*

```
I need source material to build a specification from. Could you point me to the
source files (e.g., .workflows/{work_unit}/discussion/discussion.md), or provide
the content directly?
```

**STOP.** Wait for user response.

#### If no topic name provided

> *Output the next fenced block as a code block:*

```
What should the specification be named? This determines the output file:
.workflows/{work_unit}/specification/specification.md
```

**STOP.** Wait for user response.

#### If source material seems incomplete or unclear

> *Output the next fenced block as a code block:*

```
I have the source material, but {concern}. Should I proceed as-is, or is there
additional material I should review?
```

**STOP.** Wait for user response.

**Multiple sources:** When multiple sources are provided, extract exhaustively from ALL of them. Content may be scattered across sources - a decision in one may have constraints or details in another. The specification consolidates everything into a single standalone document.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely.** Do not rely on your summary of it. The full process, steps, and rules must be reloaded.
2. **Read all tracking and state files** for the current topic — the specification file, review tracking files, or any working documents this skill creates. These are your source of truth for progress.
3. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
4. **Announce your position** to the user before continuing: what step you believe you're at, what's been completed, and what comes next. Wait for confirmation.
5. **Check `finding_gate_mode`** via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.phases.specification.finding_gate_mode`) — if `auto`, the user previously opted in during this session. Preserve this value.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Hard Rules

1. **STOP AND WAIT** for explicit approval before any write to the specification. Present content, wait for the user to explicitly approve (`y`/`yes` or equivalent), then log. No exceptions.
2. **Log verbatim** — when approved, write exactly what was presented. No silent modifications.
3. **Commit frequently** — commit at natural breaks and before any context refresh. Context refresh = lost work.

---

## Output Formatting

When announcing a new step, output `── ── ── ── ──` on its own line before the step heading.

---

## Step 0: Resume Detection

Check if `.workflows/{work_unit}/specification/specification.md` exists.

#### If no file exists

→ Proceed to **Step 1**.

#### If file exists

Read the specification status via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.phases.specification.status`).

> *Output the next fenced block as markdown (not a code block):*

```
Found existing specification for **{topic}**.

· · · · · · · · · · · ·
- **`c`/`continue`** — Walk through the specification from its current state. You can review, amend, or navigate at any point.
- **`r`/`restart`** — Delete the specification and all review tracking files. Start fresh.
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `continue`

Reset `finding_gate_mode` to `gated` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.phases.specification.finding_gate_mode gated`) (fresh invocation = fresh gates).

→ Proceed to **Step 3** (skipping Steps 1–2).

#### If `restart`

1. Delete the specification file and all review tracking files (`review-*-tracking-c*.md`) in the specification directory (`.workflows/{work_unit}/specification/`)
2. Commit: `spec({topic}): restart specification`

→ Proceed to **Step 1**.

---

## Step 1: Verify Source Material

Load **[verify-source-material.md](references/verify-source-material.md)** and follow its instructions as written.

→ Proceed to **Step 2**.

---

## Step 2: Initialize Specification

Load **[specification-format.md](references/specification-format.md)** for the template.

Create the specification file at `.workflows/{work_unit}/specification/specification.md`:

1. Use the body template from specification-format.md (title + specification section + working notes section)
2. Initialize specification state via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.phases.specification.status in-progress
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.phases.specification.type feature
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.phases.specification.review_cycle 0
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.phases.specification.finding_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.phases.specification.date $(date +%Y-%m-%d)
   ```
3. Add all sources with `status: pending` via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.phases.specification.sources.{source-name}.status pending
   ```

Commit: `spec({topic}): initialize specification`

→ Proceed to **Step 3**.

---

## Step 3: Load Specification Principles

Load **[specification-principles.md](references/specification-principles.md)** and internalize the rules. These principles govern every subsequent step.

→ Proceed to **Step 4**.

---

## Step 4: Spec Construction

Load **[spec-construction.md](references/spec-construction.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Document Dependencies

Load **[dependencies.md](references/dependencies.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Specification Review

Load **[spec-review.md](references/spec-review.md)** and follow its instructions as written.

→ Proceed to **Step 7**.

---

## Step 7: Assess Type & Conclude

Load **[spec-completion.md](references/spec-completion.md)** and follow its instructions as written.


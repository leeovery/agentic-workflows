---
name: workflow-investigation-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs)
---

# Investigation Process

Act as **expert debugger** tracing through code, **documentation assistant** capturing findings, AND **collaborative advisor** presenting analysis and discussing fix direction with the user. These are equally important — the investigation drives understanding, the documentation preserves it, and the collaboration validates findings and aligns on approach. Dig deep: trace code paths, challenge assumptions, explore related areas. Then capture what you found.

## Purpose in the Workflow

Investigation combines:
- **Symptom gathering**: What's broken, how it manifests, reproduction steps
- **Code analysis**: Tracing paths, finding root cause, understanding blast radius

The output becomes source material for a specification focused on the fix approach.

### What This Skill Needs

- **Topic** (required) - Bug identifier or short description
- **Bug context** (optional) - Initial symptoms, error messages, reproduction steps
- **Work type** - Always "bugfix" for investigation

---

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- Claude Code's harness auto mode does NOT permit skipping STOP gates or selecting menu options on the user's behalf — including the `a`/`auto` opt-in. The only skip mechanism is the manifest `auto` field, scoped to the specific gate it was set on for the current topic.
- Complete each step fully before moving to the next

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely.** Do not rely on your summary of it. The full process, steps, and rules must be reloaded.
2. **Read the investigation file** at `.workflows/{work_unit}/investigation/{topic}.md` — this is your source of truth for what's been discovered.
3. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
4. **Announce your position** to the user before continuing: what you've found so far, what's still to investigate, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Hard Rules

The investigation file is your memory. Context compaction is lossy — what's not on disk is lost.

**Write to the file at natural moments:**

- Symptoms are gathered
- A code path is traced
- Root cause is identified
- Each significant finding

**After writing, git commit.** Commits let you track and recover after compaction. Don't batch — commit each time you write.

**Create the file early.** After understanding the initial symptoms, create the investigation file with the symptoms section.

**On length**: Investigations can vary widely. Capture what's needed to fully understand the bug. Don't summarize prematurely — document the trail.

---

## Step 0: Resume Detection

> *Output the next fenced block as a code block:*

```
── Resume Detection ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking for an existing investigation. If one exists,
> you can pick up where you left off or start fresh.
```

Check if the investigation file exists at `.workflows/{work_unit}/investigation/{topic}.md`.

#### If no file exists

→ Proceed to **Step 1**.

#### If file exists

Read the file.

> *Output the next fenced block as markdown (not a code block):*

```
Found existing investigation for **{topic:(titlecase)}**.

· · · · · · · · · · · ·
- **`c`/`continue`** — Pick up where you left off
- **`r`/`restart`** — Delete the investigation file and start fresh
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `continue`

→ Proceed to **Step 2**.

#### If `restart`

1. Delete the investigation file
2. Commit: `investigation({work_unit}): restart investigation`

→ Proceed to **Step 1**.

---

## Step 1: Initialize Investigation

> *Output the next fenced block as a code block:*

```
── Initialize Investigation ─────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Creating the investigation file and recording the initial
> bug context.
```

Load **[initialize-investigation.md](references/initialize-investigation.md)** and follow its instructions as written.

→ Proceed to **Step 2**.

---

## Step 2: Knowledge Usage

> *Output the next fenced block as a code block:*

```
── Knowledge Usage ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading the usage guide for the knowledge base so
> proactive querying is available throughout the investigation.
```

Load **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Symptom Gathering

> *Output the next fenced block as a code block:*

```
── Symptom Gathering ────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Gathering detailed symptoms — reproduction steps, error
> messages, affected areas, and environmental context.
```

Load **[symptom-gathering.md](references/symptom-gathering.md)** and use its questions to gather symptoms from the user.

Document symptoms in the investigation file as you gather them. Commit after each significant addition.

When symptoms are sufficiently understood to begin code analysis:

→ Proceed to **Step 4**.

---

## Step 4: Contextual Query

> *Output the next fenced block as a code block:*

```
── Contextual Query ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking the knowledge base for prior investigations or
> related work that matches the symptoms just gathered.
```

Load **[contextual-query.md](../workflow-knowledge/references/contextual-query.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Code Analysis

> *Output the next fenced block as a code block:*

```
── Code Analysis ────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Tracing the bug through the codebase — following code
> paths, checking state, and narrowing down the root cause.
```

Load **[analysis-patterns.md](references/analysis-patterns.md)** and use its techniques to trace the bug through the code.

Document findings in the investigation file as you analyze. Commit after each significant finding.

→ Proceed to **Step 6**.

---

## Step 6: Root Cause Synthesis

> *Output the next fenced block as a code block:*

```
── Root Cause Synthesis ─────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Synthesising findings into a clear root cause statement,
> contributing factors, and fix direction.
```

Synthesize findings into a clear root cause:

1. **Root cause statement**: Clear, precise description of the bug's cause
2. **Contributing factors**: What conditions enable the bug?
3. **Why it wasn't caught**: Testing gaps, edge cases, etc.
4. **Fix direction**: High-level approach (detailed in specification)

Document in the investigation file and commit.

*Knowledge-base nudge — if the root cause pattern feels familiar, query the knowledge base before moving on. A matching prior investigation can confirm the diagnosis or surface a related bug. See **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)**.*

→ Proceed to **Step 7**.

---

## Step 7: Root Cause Validation

> *Output the next fenced block as a code block:*

```
── Root Cause Validation ────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Validating the root cause analysis against the codebase
> to confirm the diagnosis is correct.
```

Load **[synthesis-agent.md](references/synthesis-agent.md)** and follow its instructions as written.

→ Proceed to **Step 8**.

---

## Step 8: Findings Review & Fix Discussion

> *Output the next fenced block as a code block:*

```
── Findings Review ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Presenting the investigation findings and discussing
> the fix approach with you.
```

Load **[findings-review.md](references/findings-review.md)** and follow its instructions as written.

→ Proceed to **Step 9**.

---

## Step 9: Compliance Self-Check

> *Output the next fenced block as a code block:*

```
── Compliance Self-Check ────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Verifying the investigation file follows workflow conventions.
```

Load **[compliance-check.md](../workflow-shared/references/compliance-check.md)** and follow its instructions as written.

→ Proceed to **Step 10**.

---

## Step 10: Conclude Investigation

> *Output the next fenced block as a code block:*

```
── Conclude Investigation ───────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Wrapping up. Final confirmation before marking the
> investigation as complete.
```

Load **[conclude-investigation.md](references/conclude-investigation.md)** and follow its instructions as written.

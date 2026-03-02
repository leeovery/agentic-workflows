---
name: technical-investigation
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.js)
---

# Technical Investigation

Act as **expert debugger** tracing through code, **documentation assistant** capturing findings, AND **collaborative advisor** presenting analysis and discussing fix direction with the user. These are equally important — the investigation drives understanding, the documentation preserves it, and the collaboration validates findings and aligns on approach. Dig deep: trace code paths, challenge assumptions, explore related areas. Then capture what you found.

## Purpose in the Workflow

This skill is the first phase of the **bugfix pipeline**:
Investigation → Specification → Planning → Implementation → Review

Investigation combines:
- **Symptom gathering**: What's broken, how it manifests, reproduction steps
- **Code analysis**: Tracing paths, finding root cause, understanding blast radius

The output becomes source material for a specification focused on the fix approach.

### What This Skill Needs

- **Topic** (required) - Bug identifier or short description
- **Bug context** (optional) - Initial symptoms, error messages, reproduction steps
- **Work type** - Always "bugfix" for investigation

**Before proceeding**, confirm the required input is clear. If anything is missing or unclear, **STOP** and resolve with the user.

#### If no topic provided

> *Output the next fenced block as a code block:*

```
What bug would you like to investigate? Provide:
- A short identifier or name for tracking
- What's broken (expected vs actual behavior)
- Any error messages or symptoms observed
```

**STOP.** Wait for user response.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely.** Do not rely on your summary of it. The full process, steps, and rules must be reloaded.
2. **Read the investigation file** at `.workflows/{work_unit}/investigation/investigation.md` — this is your source of truth for what's been discovered.
3. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
4. **Announce your position** to the user before continuing: what you've found so far, what's still to investigate, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Output Formatting

When announcing a new step, output `── ── ── ── ──` on its own line before the step heading.

---

## Investigation Discipline

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

Check if `.workflows/{work_unit}/investigation/investigation.md` already exists.

#### If the file exists

Read it. Announce what's been documented so far and what phase the investigation is in (symptoms, analysis, root cause, or findings review). Ask the user whether to continue or restart.

**STOP.** Wait for user response.

#### If the file does not exist

→ Proceed to **Step 1**.

---

## Step 1: Initialize Investigation

1. Create the investigation directory: `.workflows/{work_unit}/investigation/`
2. Load **[template.md](references/template.md)** — use it to create `.workflows/{work_unit}/investigation/investigation.md`
3. Populate the Symptoms section with any context already gathered
4. Set investigation status via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.phases.investigation.status in-progress
   ```
5. Commit the initial file

→ Proceed to **Step 2**.

---

## Step 2: Symptom Gathering

Load **[symptom-gathering.md](references/symptom-gathering.md)** and use its questions to gather symptoms from the user.

Document symptoms in the investigation file as you gather them. Commit after each significant addition.

When symptoms are sufficiently understood to begin code analysis:

→ Proceed to **Step 3**.

---

## Step 3: Code Analysis

Load **[analysis-patterns.md](references/analysis-patterns.md)** and use its techniques to trace the bug through the code.

Document findings in the investigation file as you analyze. Commit after each significant finding.

→ Proceed to **Step 4**.

---

## Step 4: Root Cause Synthesis

Synthesize findings into a clear root cause:

1. **Root cause statement**: Clear, precise description of the bug's cause
2. **Contributing factors**: What conditions enable the bug?
3. **Why it wasn't caught**: Testing gaps, edge cases, etc.
4. **Fix direction**: High-level approach (detailed in specification)

Document in the investigation file and commit.

→ Proceed to **Step 5**.

---

## Step 5: Findings Review & Fix Discussion

Load **[findings-review.md](references/findings-review.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Conclude Investigation

Load **[conclude-investigation.md](references/conclude-investigation.md)** and follow its instructions as written.

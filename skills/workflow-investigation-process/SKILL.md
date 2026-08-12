---
name: workflow-investigation-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(mkdir -p .workflows/.cache/), Bash(ls .workflows/.cache/), Bash(git log), Bash(git blame), Bash(git diff), Bash(git bisect), Bash(grep), Bash(rm .workflows/.cache/), Bash(rm -rf .workflows/.cache/)
hooks:
  SessionEnd:
    - hooks:
        - type: command
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" session cleanup'
---

# Investigation Process

Act as **expert debugger** tracing through code, **documentation assistant** capturing findings, AND **collaborative advisor** involving the user from investigation plan to fix direction. These are equally important — the investigation drives understanding, the documentation preserves it, and the collaboration validates findings and aligns on approach. Dig deep: trace code paths, challenge assumptions, explore related areas. Then capture what you found.

## Purpose in the Workflow

Investigation combines:
- **Symptom gathering**: What's broken, how it manifests, reproduction steps
- **Code analysis**: Tracing paths, finding root cause, understanding blast radius
- **Fix direction**: Agreeing what the fix should do, validated against the root cause

The user collaborates throughout — the investigation plan, the findings, and the fix direction are each agreed, not announced. The output becomes source material for a specification focused on the fix approach.

### What This Skill Needs

- **Topic** (required) - Bug identifier or short description
- **Bug context** (optional) - Initial symptoms, error messages, reproduction steps
- **Work type** — Always "bugfix" for investigation

---

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely, then re-load [framework.md](../workflow-shared/references/framework.md).** Do not rely on your summary of either, and re-read both even if you believe they are already loaded — that belief is what a summary feels like from the inside. The full process, steps, and rules must be reloaded.
2. **Read the investigation file** at `.workflows/{work_unit}/investigation/{topic}.md` — this is your source of truth for what's been discovered. The hypothesis ledger in its Analysis section shows exactly where the analysis stands.
3. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
4. **Announce your position** to the user before continuing: what you've found so far, what's still to investigate, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Hard Rules

The investigation file is your memory. Context compaction is lossy — what's not on disk is lost.

**Write to the file at natural moments:**

- Symptoms are gathered
- The investigation plan is agreed
- A hypothesis changes status
- A code path is traced
- Root cause is identified
- Fix direction is agreed
- Each significant finding

**After writing, commit** (`node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "investigation({work_unit}): {what changed}"`). Commits let you track and recover after compaction. Don't batch — commit each time you write.

**Draft decisions to cache.** Anything still under discussion — fix options, validation output — lives in `.workflows/.cache/{work_unit}/investigation/{topic}/` until agreed. The investigation file records only what is agreed; a crash mid-discussion loses nothing.

**Create the file early.** After understanding the initial symptoms, create the investigation file with the symptoms section.

**On length**: Investigations can vary widely. Capture what's needed to fully understand the bug. Don't summarize prematurely — document the trail.

---

## Step 0: Resume Detection

Refresh the tmux session label — a no-op unless the user opted in and this session runs inside tmux:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs session label {work_unit} investigation {topic}
```

Check if the investigation file exists at `.workflows/{work_unit}/investigation/{topic}.md`.

#### If no file exists

Set `resumed` = `false`.

→ Proceed to **Step 1**.

#### If file exists

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Resume Detection`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> An in-progress investigation file exists for this topic — choose whether to pick it up or start fresh.
```

Load **[resume-detection.md](../workflow-shared/references/resume-detection.md)** with artifact = `investigation`, file = `.workflows/{work_unit}/investigation/{topic}.md`, continue_step = `Step 2`, restart_targets = `the investigation file and the phase cache directory (rm -rf .workflows/.cache/{work_unit}/investigation/{topic}/ — content and agent state together)`, commit = `investigation({work_unit}): restart investigation`.

Set `resumed` from where the reference returns: `true` for **Step 2**, the earlier session's symptoms still standing; `false` for **Step 1**, its file deleted and rebuilt.

→ On return, proceed as the reference directed.

---

## Step 1: Initialize Investigation

Load **[initialize-investigation.md](references/initialize-investigation.md)** and follow its instructions as written.

→ On return, proceed to **Step 2**.

---

## Step 2: Knowledge Usage

Load **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)** and follow its instructions as written.

→ On return, proceed to **Step 3**.

---

## Step 3: Symptom Gathering

#### If `resumed` is `true`

An earlier session already interviewed the user — don't re-interview. Fold in anything new they have mentioned this session (commit if the file changed).

Then surface the triage queue — a gap routed here by a paused specification arrives as a queued concern; an empty queue is a no-op. Load **[rerouted-concerns.md](../workflow-shared/references/rerouted-concerns.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `investigation` — enter **A. Check**.

→ On return, proceed to **Step 4**.

#### Otherwise

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Symptom Gathering`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Gathering detailed symptoms — reproduction steps, error messages, affected areas, and environmental context.
```

Read what the Symptoms section already holds — initialisation seeded it from the carrier, and that is the user's own account. Ask what it does not answer, and confirm rather than re-ask where it is thin. Putting a question they have already answered back to them reads as not having listened.

Load **[symptom-gathering.md](references/symptom-gathering.md)** and use its questions to gather symptoms from the user.

Document symptoms in the investigation file as you gather them. Commit after each significant addition.

Then surface the triage queue — an empty queue is a no-op. Load **[rerouted-concerns.md](../workflow-shared/references/rerouted-concerns.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `investigation` — enter **A. Check**.

When symptoms are sufficiently understood to begin code analysis:

→ On return, proceed to **Step 4**.

---

## Step 4: Contextual Query

Load **[contextual-query.md](../workflow-knowledge/references/contextual-query.md)** and follow its instructions as written.

→ On return, proceed to **Step 5**.

---

## Step 5: Investigation Plan

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Investigation Plan`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Forming hypotheses and agreeing where to look and how collaboratively to work — or re-confirming the existing plan when resuming — before deep tracing begins.
```

Load **[investigation-plan.md](references/investigation-plan.md)** and follow its instructions as written.

→ On return, proceed to **Step 6**.

---

## Step 6: Code Analysis

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Code Analysis`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Tracing the bug through the codebase — following code paths, checking state, and narrowing down the root cause.
```

Load **[analysis-patterns.md](references/analysis-patterns.md)** for tracing techniques and **[analysis-checkpoints.md](references/analysis-checkpoints.md)** for the collaboration protocol — both govern this step.

Trace the bug through the code along the agreed plan. Document findings in the investigation file as you analyze, keep the hypothesis ledger current, and commit after each significant finding.

When the root cause is identified and every hypothesis is resolved:

→ On return, proceed to **Step 7**.

---

## Step 7: Root Cause Synthesis

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Root Cause Synthesis`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Synthesising findings into a clear root cause statement, contributing factors, and blast radius.
```

Synthesize findings into a clear root cause:

1. **Root cause statement**: Clear, precise description of the bug's cause
2. **Contributing factors**: What conditions enable the bug?
3. **Why it wasn't caught**: Testing gaps, edge cases, etc.
4. **Blast radius**: What's directly affected; what shares the code or pattern

Do not draft fix direction here — it is explored with the user after the findings are signed off.

Document in the investigation file and commit.

*Knowledge-base nudge — if the root cause pattern feels familiar, query the knowledge base before moving on. A matching prior investigation can confirm the diagnosis or surface a related bug. See **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)**.*

→ Proceed to **Step 8**.

---

## Step 8: Root Cause Validation

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Root Cause Validation`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Offering an independent validation pass on the root cause before the findings are presented.
```

Load **[root-cause-validation.md](references/root-cause-validation.md)** and follow its instructions as written.

→ On return, proceed to **Step 9**.

---

## Step 9: Findings Sign-off

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Findings Sign-off`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Presenting the investigation findings for your sign-off before we explore the fix.
```

Load **[findings-signoff.md](references/findings-signoff.md)** and follow its instructions as written.

→ On return, proceed to **Step 10**.

---

## Step 10: Fix Exploration & Discussion

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Fix Exploration`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Exploring fix approaches and agreeing the direction with you.
```

Load **[fix-exploration.md](references/fix-exploration.md)** and follow its instructions as written.

→ On return, proceed to **Step 11**.

---

## Step 11: Fix Validation

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Fix Validation`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Offering an independent pressure-test of the agreed fix direction before wrapping up.
```

Load **[fix-validation.md](references/fix-validation.md)** and follow its instructions as written.

→ On return, proceed to **Step 12**.

---

## Step 12: Compliance Self-Check

Load **[compliance-check.md](../workflow-shared/references/compliance-check.md)** and follow its instructions as written.

→ On return, proceed to **Step 13**.

---

## Step 13: Conclude Investigation

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Conclude Investigation`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Wrapping up. Final confirmation before marking the investigation as complete.
```

Load **[conclude-investigation.md](references/conclude-investigation.md)** and follow its instructions as written.

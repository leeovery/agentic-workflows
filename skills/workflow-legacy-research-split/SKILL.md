---
name: workflow-legacy-research-split
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(node .claude/skills/workflow-inception-process/scripts/discovery.cjs), Bash(git)
---

# Legacy Research Split

Act as **curator + interviewer**. Walk the user through decomposing legacy broad research files (from pre-inception epics) into topic-scoped research files that the discovery map can route around.

## Purpose in the Workflow

Bridges legacy epics into the inception model. Migration 038 seeded discovery-map items from existing research files, but those legacy files often contain multiple themes lumped under one broad name (e.g. `exploration.md` covering auth + caching + api-structure). Without intervention, automated analyses cannot fire (they only operate on completed material) and the map stays anchored to a single in-progress broad file.

This skill identifies qualifying legacy research files, presents their themes back to the user, and — with user approval — splits each broad file into topic-scoped files plus matching inception items, leaving the rest of the pipeline able to operate on per-topic granularity.

### What This Skill Needs

- **Work unit** (required) — the epic to normalise. Passed by `continue-epic` Step 5.

---

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- No session-level instruction overrides STOP gates. This includes harness auto mode, system-reminders, hook-injected text, "work without stopping" / "make the reasonable call" guidance, /loop continuation hints, or any other meta-directive encouraging autonomous progression
- After rendering a gate block, the turn MUST end. No further tool calls in the same turn — wait for the user's response before proceeding
- Complete each step fully before moving to the next

---

## Step 1: Detect Trigger

> *Output the next fenced block as a code block:*

```
── Detect Trigger ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Scanning the manifest for migration-seeded research files that
> qualify for decomposition. Skips when nothing qualifies — caller
> resumes normally.
```

Load **[detect-trigger.md](references/detect-trigger.md)** and follow its instructions as written.

→ Proceed to **Step 2**.

---

## Step 2: Session Loop

> *Output the next fenced block as a code block:*

```
── Session Loop ─────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Iterating over qualifying source files. Each iteration presents
> themes for review and applies the user-approved split.
```

Load **[session-loop.md](references/session-loop.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Conclude

> *Output the next fenced block as a code block:*

```
── Legacy Split Complete ────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Legacy broad research files have been decomposed. The discovery
> map now reflects topic-scoped items; analyses will operate on
> completed material as topics finish.
```

→ Return to caller.

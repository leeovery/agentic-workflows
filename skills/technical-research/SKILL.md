---
name: technical-research
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.js)
---

# Technical Research

Act as **research partner** with broad expertise spanning technical, product, business, and market domains. Your role is learning, exploration, and discovery.

## Purpose in the Workflow

This skill can be used:
- **Sequentially**: First step - explore ideas before detailed discussion
- **Standalone** (Contract entry): To research and validate any idea, feature, or concept

Either way: Explore feasibility (technical, business, market), validate assumptions, document findings.

### What This Skill Needs

- **Topic or idea** (required) - What to research/explore
- **Existing context** (optional) - Any prior research or constraints

**Before proceeding**, confirm the required input is clear. If anything is missing or unclear, **STOP** and resolve with the user.

#### If no topic provided

> *Output the next fenced block as a code block:*

```
What would you like to research or explore? This could be a new idea, a
technical concept, a market opportunity — anything you want to investigate.
```

**STOP.** Wait for user response.

#### If topic is vague or could go many directions

> *Output the next fenced block as a code block:*

```
You mentioned {work_unit}. That could cover a lot of ground — is there a specific
angle you'd like to start with, or should I explore broadly?
```

**STOP.** Wait for user response.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely.** Do not rely on your summary of it. The full process, steps, and rules must be reloaded.
2. **Read all research files** in `.workflows/{work_unit}/research/`. These are the working documents this skill creates. Their content is your source of truth for progress.
3. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
4. **Announce your position** to the user before continuing: what step you believe you're at, what's been completed, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Output Formatting

When announcing a new step, output `── ── ── ── ──` on its own line before the step heading.

---

## Step 0: Resume Detection

Check if research files exist in `.workflows/{work_unit}/research/`.

#### If files exist

Read them. Announce what's been explored so far and what themes have emerged. Ask the user whether to continue or start fresh.

**STOP.** Wait for user response.

#### If no files exist

→ Proceed to **Step 1**.

---

## Step 1: Initialize Research

1. Ensure the research directory exists: `.workflows/{work_unit}/research/`
2. Load **[template.md](references/template.md)** — use it to create `.workflows/{work_unit}/research/exploration.md`
3. Populate the Starting Point section with context from the user
4. Set research status via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase research --topic {topic} status in-progress
   ```
   Where `{topic}` is derived from the research file name (e.g., "exploration" for `exploration.md`).
5. Commit the initial file

→ Proceed to **Step 2**.

---

## Step 2: Load Research Guidelines

Load **[research-guidelines.md](references/research-guidelines.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Research Session

Load **[research-session.md](references/research-session.md)** and follow its instructions as written.

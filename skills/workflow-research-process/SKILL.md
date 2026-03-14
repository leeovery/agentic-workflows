---
name: workflow-research-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.js)
---

# Research Process

Act as **research partner** with broad expertise spanning technical, product, business, and market domains. Your role is learning, exploration, and discovery.

## Purpose in the Workflow

First phase in the pipeline — explore feasibility (technical, business, market), validate assumptions, and document findings before discussion begins.

### What This Skill Needs

- **Topic** (required) - What to research/explore
- **Output path** (required) - Research file path from the handoff
- **Work type** (required) - `epic` or `feature`. Determines file strategy and convergence behaviour
- **Context** (optional) - Prior research, constraints, starting direction

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

Check if the research file exists at the handoff's Output path.

#### If no file exists

→ Proceed to **Step 1**.

#### If file exists

Read the file.

> *Output the next fenced block as markdown (not a code block):*

```
Found existing research for **{topic:(titlecase)}**.

· · · · · · · · · · · ·
- **`c`/`continue`** — Pick up where you left off
- **`r`/`restart`** — Delete the research file and start fresh
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `continue`

→ Proceed to **Step 2**.

#### If `restart`

1. Delete the research file
2. Commit: `research({work_unit}): restart research`

→ Proceed to **Step 1**.

---

## Step 1: Initialize Research

1. Load **[template.md](references/template.md)** — use it to create the research file at the Output path from the handoff (e.g., `.workflows/{work_unit}/research/{resolved_filename}`)
2. Populate the Starting Point section with context from the handoff. If restarting (no Context in handoff), create with a minimal Starting Point — the session will gather context naturally
3. Register in manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js init-phase {work_unit}.research.{topic}
   ```
4. Commit the initial file

→ Proceed to **Step 2**.

---

## Step 2: File Strategy

Load **[file-strategy.md](references/file-strategy.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Research Guidelines

Load **[research-guidelines.md](references/research-guidelines.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Research Session

Read `work_type` from the manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} work_type
```

#### If work_type is `feature`

Load **[feature-session.md](references/feature-session.md)** and follow its instructions as written.

#### If work_type is `epic`

Load **[epic-session.md](references/epic-session.md)** and follow its instructions as written.

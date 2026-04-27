---
name: workflow-research-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs)
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
3. **Check agent cache.** Scan `.workflows/.cache/{work_unit}/research/` for any files with `status: pending` or `status: read` in their frontmatter. These are background agent results that may need surfacing or have been partially processed.
4. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
5. **Announce your position** to the user before continuing: what step you believe you're at, what's been completed, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Step 0: Resume Detection

> *Output the next fenced block as a code block:*

```
── Resume Detection ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking for existing research on this topic. If found,
> you can pick up where you left off or start fresh.
```

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

> *Output the next fenced block as a code block:*

```
── Initialize Research ──────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Creating the research file and seeding it with initial
> context from the handoff.
```

Load **[initialize-research.md](references/initialize-research.md)** and follow its instructions as written.

→ Proceed to **Step 2**.

---

## Step 2: File Strategy

> *Output the next fenced block as a code block:*

```
── File Strategy ────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Determining how research files are organized for this
> work type — single file or multiple topics.
```

Load **[file-strategy.md](references/file-strategy.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Research Guidelines

> *Output the next fenced block as a code block:*

```
── Research Guidelines ──────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading the guidelines that shape how research is
> conducted and documented.
```

Load **[research-guidelines.md](references/research-guidelines.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Knowledge Usage

> *Output the next fenced block as a code block:*

```
── Knowledge Usage ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading the usage guide for the knowledge base so
> proactive querying is available throughout the phase.
```

Load **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Contextual Query

> *Output the next fenced block as a code block:*

```
── Contextual Query ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking the knowledge base for prior work that relates
> to this research topic before the session begins.
```

Load **[contextual-query.md](../workflow-knowledge/references/contextual-query.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Research Session

> *Output the next fenced block as a code block:*

```
── Research Session ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Starting the research session. This is open-ended exploration
> — follow threads, surface options, and document findings.
> No decisions needed at this stage.
```

Load **[route-session.md](references/route-session.md)** and follow its instructions as written.

*Knowledge-base nudge — if a thread feels familiar, or you're about to re-tread ground that might have been covered in another work unit, run a quick query before proceeding. See **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)**.*

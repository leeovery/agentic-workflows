---
name: workflow-discussion-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs)
---

# Discussion Process

Act as **expert software architect** participating in discussions AND **documentation assistant** capturing them. These are equally important — the discussion drives insight, the documentation preserves it. Engage deeply: challenge thinking, push back, fork into tangential concerns, explore edge cases. Then capture what emerged.

## Purpose in the Workflow

Follows research (or starts the pipeline for features). Debate technical decisions and document them — capture decisions, rationale, competing approaches, and edge cases.

### What This Skill Needs

- **Topic** (required) - What technical area to discuss/document
- **Context** (optional) - Prior research, constraints, existing decisions
- **Seed concerns** (optional) - Initial subtopics or architectural questions to explore

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely.** Do not rely on your summary of it. The full process, steps, and rules must be reloaded.
2. **Read the discussion file** at `.workflows/{work_unit}/discussion/{topic}.md`. This is the only working document this skill creates. The Discussion Map section is your primary progress indicator — it shows which subtopics are decided, exploring, converging, or pending.
3. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
4. **Announce your position** to the user before continuing: render the current Discussion Map, state what step you believe you're at, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Step 0: Resume Detection

> *Output the next fenced block as a code block:*

```
── Resume Detection ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking for an existing discussion file. If one exists,
> you can pick up where you left off or start fresh.
```

Check if the discussion file exists at `.workflows/{work_unit}/discussion/{topic}.md`.

#### If no file exists

→ Proceed to **Step 1**.

#### If file exists

Read the file.

> *Output the next fenced block as markdown (not a code block):*

```
Found existing discussion for **{topic:(titlecase)}**.

· · · · · · · · · · · ·
- **`c`/`continue`** — Pick up where you left off
- **`r`/`restart`** — Delete the discussion file and start fresh
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `continue`

→ Proceed to **Step 2**.

#### If `restart`

1. Delete the discussion file
2. Commit: `discussion({work_unit}): restart discussion`

→ Proceed to **Step 1**.

---

## Step 1: Initialize Discussion

> *Output the next fenced block as a code block:*

```
── Initialize Discussion ────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Creating the discussion file and seeding the Discussion Map
> with initial subtopics from your context.
```

Load **[initialize-discussion.md](references/initialize-discussion.md)** and follow its instructions as written.

→ Proceed to **Step 2**.

---

## Step 2: Load Discussion Guidelines

> *Output the next fenced block as a code block:*

```
── Load Discussion Guidelines ───────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading the guidelines that shape how the discussion
> is structured and documented.
```

Load **[discussion-guidelines.md](references/discussion-guidelines.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Knowledge Usage

> *Output the next fenced block as a code block:*

```
── Knowledge Usage ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading the usage guide for the knowledge base so
> proactive querying is available throughout the discussion.
```

Load **[knowledge-usage.md](../workflow-shared/references/knowledge-usage.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Contextual Query

> *Output the next fenced block as a code block:*

```
── Contextual Query ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking the knowledge base for prior work that relates
> to this discussion topic before the session begins.
```

Load **[contextual-query.md](../workflow-shared/references/contextual-query.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Discussion Session

> *Output the next fenced block as a code block:*

```
── Discussion Session ───────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Discussion starting. I'll track our conversation on a Discussion
> Map. You can lead wherever you want — I'll challenge thinking,
> explore edge cases, and capture decisions as we go.
```

Load **[discussion-session.md](references/discussion-session.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Final Gap Review

> *Output the next fenced block as a code block:*

```
── Final Gap Review ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Before concluding, checking whether a fresh review is needed
> to catch any gaps that may have emerged since the last review.
```

Load **[final-review.md](references/final-review.md)** and follow its instructions as written.

→ Proceed to **Step 7**.

---

## Step 7: Document Review

> *Output the next fenced block as a code block:*

```
── Document Review ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reconciling the session conversation against the discussion file
> to catch substance that was discussed but never captured.
```

Load **[document-review.md](references/document-review.md)** and follow its instructions as written.

→ Proceed to **Step 8**.

---

## Step 8: Compliance Self-Check

> *Output the next fenced block as a code block:*

```
── Compliance Self-Check ────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Verifying the discussion file follows workflow conventions.
```

Load **[compliance-check.md](../workflow-shared/references/compliance-check.md)** and follow its instructions as written.

→ Proceed to **Step 9**.

---

## Step 9: Conclude Discussion

> *Output the next fenced block as a code block:*

```
── Conclude Discussion ──────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Wrapping up. Final confirmation before marking the
> discussion as complete.
```

Load **[conclude-discussion.md](references/conclude-discussion.md)** and follow its instructions as written.

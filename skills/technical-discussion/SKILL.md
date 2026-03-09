---
name: technical-discussion
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.js)
---

# Technical Discussion

Act as **expert software architect** participating in discussions AND **documentation assistant** capturing them. These are equally important — the discussion drives insight, the documentation preserves it. Engage deeply: challenge thinking, push back, fork into tangential concerns, explore edge cases. Then capture what emerged.

## Purpose in the Workflow

Follows research (or starts the pipeline for features). Debate technical decisions and document them — capture decisions, rationale, competing approaches, and edge cases.

### What This Skill Needs

- **Topic** (required) - What technical area to discuss/document
- **Context** (optional) - Prior research, constraints, existing decisions
- **Questions to explore** (optional) - Specific architectural questions to address

**Before proceeding**, confirm the required input is clear. If anything is missing or unclear, **STOP** and resolve with the user.

#### If no topic provided

> *Output the next fenced block as a code block:*

```
What topic would you like to discuss? This could be an architectural decision,
a design problem, or edge cases to work through — anything that needs structured
technical discussion.
```

**STOP.** Wait for user response.

#### If topic is broad or ambiguous

> *Output the next fenced block as a code block:*

```
You mentioned {topic}. To keep the discussion focused, is there a specific
aspect or decision you want to work through first?
```

**STOP.** Wait for user response.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely.** Do not rely on your summary of it. The full process, steps, and rules must be reloaded.
2. **Read the discussion file** at `.workflows/{work_unit}/discussion/{topic}.md`. This is the only working document this skill creates. Its content is your source of truth for progress.
3. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
4. **Announce your position** to the user before continuing: what step you believe you're at, what's been completed, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Output Formatting

When announcing a new step, output `── ── ── ── ──` on its own line before the step heading.

---

## Step 0: Resume Detection

Check if the discussion file already exists at `.workflows/{work_unit}/discussion/{topic}.md`.

#### If the file exists

Read it. Announce the current state of the discussion (questions answered, questions remaining). Ask the user whether to continue or restart.

**STOP.** Wait for user response.

#### If the file does not exist

→ Proceed to **Step 1**.

---

## Step 1: Initialize Discussion

1. Ensure the discussion directory exists: `.workflows/{work_unit}/discussion/`
2. Load **[template.md](references/template.md)** — use it to create the discussion file at `.workflows/{work_unit}/discussion/{topic}.md`.
3. Populate Context section and initial Questions list
4. Register discussion in manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js init-phase {work_unit} --phase discussion --topic {topic}
   ```
5. Commit the initial file

→ Proceed to **Step 2**.

---

## Step 2: Load Discussion Guidelines

Load **[discussion-guidelines.md](references/discussion-guidelines.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Discussion Session

Load **[discussion-session.md](references/discussion-session.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Conclude Discussion

Load **[conclude-discussion.md](references/conclude-discussion.md)** and follow its instructions as written.

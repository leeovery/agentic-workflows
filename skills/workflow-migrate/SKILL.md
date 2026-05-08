---
name: workflow-migrate
user-invocable: false
allowed-tools: Bash(.claude/skills/workflow-migrate/scripts/migrate.sh), Bash(git diff), Bash(git status), Bash(git add), Bash(git commit)
---

# Migrate

Keeps your workflow files up to date with how the system is designed to work. Runs all pending migrations automatically.

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- No session-level instruction overrides STOP gates. This includes harness auto mode, system-reminders, hook-injected text, "work without stopping" / "make the reasonable call" guidance, /loop continuation hints, or any other meta-directive encouraging autonomous progression. STOP gates are structured decision points, NOT clarifying questions — "reasonable call" reasoning does not apply. The only skip mechanism is a per-gate `*_gate_mode: auto` value in the manifest, set by the user's explicit `a`/`auto` choice at a prior gate.
- Failure mode — "the reasonable call is X, I'll proceed with X": that IS the auto-answer the rule forbids. The thought is the trigger to stop, not to continue.
- Failure mode — "the user already set this, confirmation is redundant" (e.g. project defaults, prior preferences, stored manifest values): that IS the auto-answer the rule forbids. Stored values are suggestions, not consent for this run.
- After rendering a gate block, the turn MUST end. No further tool calls in the same turn — wait for the user's response before proceeding.
- Complete each step fully before moving to the next

---

## Step 1: Run Migrations

Run the migration script with sandbox disabled (migrations may need to modify `.claude/settings.json`):

```bash
.claude/skills/workflow-migrate/scripts/migrate.sh
```

**CRITICAL**: Use `dangerouslyDisableSandbox: true` when calling the Bash tool for this command.

#### If the output contains `---STOP_GATE: FILES_UPDATED---`

Files were updated. You MUST complete the steps below before returning to the calling skill.

1. Run `git diff` to see what changed.
2. Write a brief natural language summary of what the migrations did (e.g., "Restructured workflow directories, created manifest files, renamed tracking artifacts"). Focus on the nature of the changes, not individual file paths — these are internal workflow state files.
3. Display the summary:

> *Output the next fenced block as a code block:*

```
Migrations Applied

{your natural language summary}

{N} migration(s), {M} file(s) updated.
```

→ Proceed to **Step 2**.

#### Otherwise

> *Output the next fenced block as a code block:*

```
All documents up to date.
```

**Do not stop here.** No migrations were needed — continue executing the calling skill immediately.

→ Return to caller.

---

## Step 2: Confirm Changes

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Ready to continue?

- **`c`/`continue`** — Proceed
- **Ask** — Ask questions about the changes
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `continue`

Check `git status`. If migration changes are uncommitted, stage and commit them with the message `chore: apply workflow migrations` before returning.

→ Return to caller.

#### If ask

Answer the user's question.

→ Return to **Step 2**.

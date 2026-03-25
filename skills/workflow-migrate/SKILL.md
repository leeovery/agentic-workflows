---
name: workflow-migrate
user-invocable: false
allowed-tools: Bash(.claude/skills/workflow-migrate/scripts/migrate.sh), Bash(git diff), Bash(git status), Bash(git add), Bash(git commit)
---

# Migrate

Keeps your workflow files up to date with how the system is designed to work. Runs all pending migrations automatically.

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

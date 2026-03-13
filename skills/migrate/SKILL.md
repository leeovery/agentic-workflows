---
name: migrate
user-invocable: false
allowed-tools: Bash(.claude/skills/migrate/scripts/migrate.sh)
---

# Migrate

Keeps your workflow files up to date with how the system is designed to work. Runs all pending migrations automatically.

## Instructions

Run the migration script with sandbox disabled (migrations may need to modify `.claude/settings.json`):

```bash
.claude/skills/migrate/scripts/migrate.sh
```

**CRITICAL**: Use `dangerouslyDisableSandbox: true` when calling the Bash tool for this command.

#### If files were updated

The script will list which files were updated. Present the list and a prompt:

> *Output the next fenced block as a code block:*

```
{list from script output}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Migrations applied. Review with `git diff` if needed.

- **`c`/`continue`** — Proceed
- **Ask** — Ask questions about the changes
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `continue`:**

→ Return to the calling skill.

**If ask:**

Answer the user's question, then re-display the prompt above.

**STOP.** Wait for user response.

#### If no updates needed

> *Output the next fenced block as a code block:*

```
All documents up to date.
```

→ Return to the calling skill.

## Notes

- This skill is run automatically at the start of every workflow skill
- Migrations are tracked in `.workflows/.state/migrations` (one migration ID per line)
- The orchestrator skips entire migrations once recorded — individual scripts don't track
- To force re-running all migrations, delete the tracking file
- Each migration is idempotent - safe to run multiple times

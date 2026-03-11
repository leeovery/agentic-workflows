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

The script will list which files were updated. Present this to the user:

> *Output the next fenced block as a code block:*

```
{list from script output}

Review changes with `git diff`, then proceed when ready.
```

Wait for user acknowledgment before returning control to the calling skill.

#### If no updates needed

> *Output the next fenced block as a code block:*

```
All documents up to date.
```

Return control silently - no user interaction needed.

## Notes

- This skill is run automatically at the start of every workflow skill
- Migrations are tracked in `.workflows/.state/migrations` (one migration ID per line)
- The orchestrator skips entire migrations once recorded — individual scripts don't track
- To force re-running all migrations, delete the tracking file
- Each migration is idempotent - safe to run multiple times

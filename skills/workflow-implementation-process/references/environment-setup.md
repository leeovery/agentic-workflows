# Environment Setup

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

## IMPORTANT

Run these commands EXACTLY as written, one step at a time.
Do NOT modify commands based on other project documentation (CLAUDE.md, etc.).
Do NOT parallelize steps - execute each command sequentially.
Complete ALL setup steps before proceeding to implementation work.

---

Before starting implementation, ensure the environment is ready. This step runs once per project (or when setup changes).

## Setup Document Location

Look for: `.workflows/.state/environment-setup.md`

This file contains natural language instructions for setting up the implementation environment. It's project-specific.

#### If setup document exists

Read and follow the instructions. Common setup tasks include:

- Installing language extensions (e.g., PHP SQLite extension)
- Copying environment files (e.g., `cp .env.example .env`)
- Generating application keys
- Running database migrations
- Setting up test databases
- Installing project dependencies

Execute each instruction and verify it succeeds before proceeding.

#### If setup document is missing

Ask the user:

> "No environment setup document found. Are there any setup instructions I should follow before implementing?"

If they provide instructions, offer to save them:

> "Would you like me to save these instructions to `.workflows/.state/environment-setup.md` for future sessions?"

If they say no setup is needed, create `.workflows/.state/environment-setup.md` with "No special setup required." and commit. This prevents asking the same question in future sessions.

#### If no setup is required

If the environment setup document contains only "No special setup required" (or similar), skip environment setup and proceed directly to reading the plan.

## Plan Format Setup

Some plan formats require specific tools. Check the plan's `format` field and load the format's about file for setup instructions:

```
../../workflow-planning-process/references/output-formats/{format}/about.md
```

Each format's about.md contains prerequisites and installation instructions.

## Example Setup Document

````markdown
# Environment Setup

Instructions for setting up the implementation environment.

## First-Time Setup

1. Copy environment file:
   ```bash
   cp .env.example .env
   ```

2. Generate application key:
   ```bash
   php artisan key:generate
   ```

3. Set up test database:
   ```bash
   touch database/testing.sqlite
   php artisan migrate --env=testing
   ```

## Claude Code on the Web

Additional setup for web-based Claude Code sessions:

1. Install PHP SQLite extension:
   ```bash
   sudo apt-get update && sudo apt-get install -y php-sqlite3
   ```

## Verification

Run tests to verify setup:
```bash
php artisan test
```
````

# Environment Setup

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

**IMPORTANT**: Run setup commands EXACTLY as written, one step at a time. Do NOT modify commands based on other project documentation (CLAUDE.md, etc.). Do NOT parallelize steps — execute each command sequentially. Complete ALL setup steps before proceeding to implementation work.

---

Before starting implementation, ensure the environment is ready. This step runs once per project (or when setup changes).

Look for: `.workflows/.state/environment-setup.md`

This file contains natural language instructions for setting up the implementation environment. It's project-specific.

#### If setup document exists and contains setup instructions

Read and follow the instructions. Common setup tasks include:

- Installing language extensions (e.g., PHP SQLite extension)
- Copying environment files (e.g., `cp .env.example .env`)
- Generating application keys
- Running database migrations
- Setting up test databases
- Installing project dependencies

Execute each instruction and verify it succeeds before proceeding.

→ Return to **[the skill](../SKILL.md)**.

#### If setup document exists and states `No special setup required`

→ Return to **[the skill](../SKILL.md)**.

#### If setup document is missing

> *Output the next fenced block as a code block:*

```
No environment setup document found. Are there any setup instructions
I should follow before implementing?
```

**STOP.** Wait for user response.

If they provide instructions, save them to `.workflows/.state/environment-setup.md` and follow them.

If they say no setup is needed, create `.workflows/.state/environment-setup.md` with "No special setup required." and commit. This prevents asking the same question in future sessions.

→ Return to **[the skill](../SKILL.md)**.

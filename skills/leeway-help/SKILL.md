---
name: leeway-help
user-invocable: false
allowed-tools: Bash(node .claude/skills/leeway-engine/scripts/engine.cjs *)
---

# Help

Explain how the workflows work: the walk through the system, the reference cards, and the glossary every answer is written from.

## Purpose in the Workflow

Project-level and outside the pipeline — no work unit, no phases, no session label. The walk is also leeway's to reach, from the start menu's help, its `w/walk` row, and from the first-run offer: leeway loads **[walk.md](references/walk.md)** across the skill boundary, without invoking this skill.

**Stay in your lane**: explain the system, never do the work. Nothing here reads or writes a work unit, and a question about what the user should build belongs to the phase that holds it.

---

## Step 0: Initialisation

Nothing to initialise: migrations and the knowledge base are leeway's, and help is no place to work, so it takes no session label. Any argument is ignored — the entry is the home.

→ Proceed to **Step 1**.

---

## Step 1: Help Home

Load **[home.md](references/home.md)** and follow its instructions as written.

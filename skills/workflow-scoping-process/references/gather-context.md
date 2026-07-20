# Gather Context

*Reference for **[workflow-scoping-process](../SKILL.md)***

---

Gather targeted context about the mechanical change. Read the work's seed and the manifest description first, then fill gaps.

## A. Read Existing Context

→ Load **[seed-context.md](../../workflow-shared/references/seed-context.md)** and follow its instructions as written.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit} description
```

#### If the seed and description already capture what, where, and why

→ Return to caller.

#### Otherwise

→ Proceed to **B. Targeted Questions**.

## B. Targeted Questions

> *Output the next fenced block as a code block:*

```
Scoping: {topic:(titlecase)}

A few questions to scope this change:

- What exactly is being changed? (pattern, syntax, API)
- Where in the codebase? (files, directories, packages)
- Why? (deprecation, consistency, modernisation)
- Any exceptions or areas to exclude?
```

**STOP.** Wait for user response.

Ask one follow-up only if gaps remain — 2 exchanges total at most, since a quick-fix should be explainable in a sentence or two.

→ Return to caller.

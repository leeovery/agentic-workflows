# Gather Context

*Reference for **[workflow-scoping-process](../SKILL.md)***

---

Gather targeted context about the mechanical change. Read the work's seed and the manifest description first, then fill gaps.

## A. Read Existing Context

→ Load **[seed-context.md](../../workflow-shared/references/seed-context.md)** and follow its instructions as written.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit} description
```

Read the discovery session log's **Exploration** — single-phase work has exactly one log, at `.workflows/{work_unit}/discovery/sessions/session-001.md`; discovery's shaped context is the carrier's second half. A logless quick-fix has none.

#### If the carrier — seed, description, and exploration — already captures what, where, and why

→ Return to caller.

#### Otherwise

→ Proceed to **B. Targeted Questions**.

## B. Targeted Questions

The carrier has already answered some of these. Emit only the questions it leaves open, dropping any bullet it already covers — a question the user has already answered reads as not having listened.

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

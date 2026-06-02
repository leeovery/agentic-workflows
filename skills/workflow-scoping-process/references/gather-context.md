# Gather Context

*Reference for **[workflow-scoping-process](../SKILL.md)***

---

Gather targeted context about the mechanical change. Read the work's seed and the manifest description first, then fill gaps.

## A. Read Existing Context

→ Load **[../../workflow-shared/references/seed-context.md](../../workflow-shared/references/seed-context.md)** and follow its instructions as written.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit} description
```

If the seed and description already capture what, where, and why — skip to the complexity check. Otherwise, ask targeted questions.

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

If answers are clear and complete, proceed. If gaps remain, ask one follow-up — no more than 2 exchanges total. Quick-fixes should be explainable in a sentence or two.

→ Return to caller.

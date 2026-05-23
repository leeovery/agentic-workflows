# Select Output Format

*Reference for **[workflow-scoping-process](../SKILL.md)***

---

Select the plan output format using the same project-default logic as the planning skill.

## A. Check Format Recommendation

Read the project default `plan_format` via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get project.defaults.plan_format
```

#### If output is empty (no project default)

→ Proceed to **B. Select Format**.

#### Otherwise

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Project default format is **{format}**. Use the same format?

- **`y`/`yes`** — Use {format}
- **`n`/`no`** — See all available formats
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

→ Return to caller.

**If `no`:**

→ Proceed to **B. Select Format**.

---

## B. Select Format

→ Load **[../../workflow-planning-process/references/output-formats.md](../../workflow-planning-process/references/output-formats.md)** and follow its instructions as written.

→ Return to caller.

# Complexity Check

*Reference for **[workflow-scoping-process](../SKILL.md)***

---

Assess whether this change is genuinely quick-fix material. Evaluate against these criteria:

- **Mechanical**: Is the change well-defined and repetitive? (find-and-replace, API rename, syntax update)
- **Narrowly scoped**: Can it be expressed as 1-2 tasks?
- **No design decisions**: Does it avoid architectural trade-offs or competing approaches?
- **No new behaviour**: Does it preserve existing behaviour (just change how it's expressed)?
- **Existing test coverage**: Can correctness be verified by running existing tests?

## A. Evaluate

If all criteria are met — proceed without comment.

→ Return to caller.

## B. Complexity Warning

If any criterion fails, surface the concern:

> *Output the next fenced block as a code block:*

```
Complexity Check

This change may be more involved than a quick-fix:

  • {specific concern — e.g., "Requires design decisions about the new API surface"}
  • {additional concern if applicable}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
How would you like to proceed?

- **`c`/`continue`** — Continue as quick-fix anyway
- **`f`/`feature`** — Promote to feature (full pipeline)
- **`b`/`bugfix`** — Promote to bugfix (investigation pipeline)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `continue`

→ Return to caller.

#### If `feature`

Update the work type in the manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit} work_type feature
```

Commit: `workflow({work_unit}): promote quick-fix to feature`

Invoke `/workflow-discussion-entry feature {work_unit}`.

**STOP.** Do not proceed — terminal condition.

#### If `bugfix`

Update the work type in the manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit} work_type bugfix
```

Commit: `workflow({work_unit}): promote quick-fix to bugfix`

Invoke `/workflow-investigation-entry bugfix {work_unit}`.

**STOP.** Do not proceed — terminal condition.

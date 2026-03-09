# Manage Work Unit

*Reference for **[workflow-start](../SKILL.md)***

---

Manage an in-progress work unit's lifecycle. Self-contained two-step flow. Uses the numbered in-progress items already displayed by the caller.

## A. Select

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which work unit would you like to manage? (enter number from list above, or **`b`/`back`** to return)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If user chose `b`/`back`:**

→ Return to caller.

**If user chose a number:**

Store the selected work unit. → Proceed to **B. Action Menu**.

## B. Action Menu

Check if the selected work unit's implementation phase is concluded or completed (via manifest CLI or discovery data).

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**{selected.name:(titlecase)}** ({selected.work_type})

@if(implementation_concluded_or_completed)
- **`d`/`done`** — Mark as concluded
@endif
- **`x`/`cancel`** — Mark as cancelled
- **`b`/`back`** — Return

Or ask a question about this work unit.
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If user chose `d`/`done`:**

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {selected.name} status concluded
```

> *Output the next fenced block as a code block:*

```
"{selected.name:(titlecase)}" marked as concluded.
```

→ Return to caller to redisplay main view (re-run discovery, re-render from top).

**If user chose `x`/`cancel`:**

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {selected.name} status cancelled
```

> *Output the next fenced block as a code block:*

```
"{selected.name:(titlecase)}" marked as cancelled.
```

→ Return to caller to redisplay main view (re-run discovery, re-render from top).

**If user chose `b`/`back`:**

→ Return to caller.

**If user asked a question:**

Answer the question, then redisplay the action menu (section B).

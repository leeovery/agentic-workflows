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

#### If user chose `b`/`back`

→ Return to caller.

#### If user chose a number

Store the selected work unit. → Proceed to **B. Action Menu**.

## B. Action Menu

Determine whether to show the `d`/`done` option. Check if at least one topic has completed implementation.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {selected.name} phases.implementation
```

#### If the result is `false`

Set `implementation_completed` = false.

#### If the result is `true`

Get the work type:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {selected.name} work_type
```

**If work type is `feature` or `bugfix`:**

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {selected.name} --phase implementation status
```

**If the result is `completed`:**

Set `implementation_completed` = true.

**If work type is `epic`:**

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {selected.name} --phase implementation
```

Parse the JSON output.

**If any item in the `items` object has `"status": "completed"`:**

Set `implementation_completed` = true.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**{selected.name:(titlecase)}** ({selected.work_type})

@if(implementation_completed)
- **`d`/`done`** — Mark as concluded
@endif
- **`x`/`cancel`** — Mark as cancelled
- **`b`/`back`** — Return
- **Ask** — Ask a question about this work unit
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user chose `d`/`done`

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {selected.name} status concluded
```

> *Output the next fenced block as a code block:*

```
"{selected.name:(titlecase)}" marked as concluded.
```

→ Return to caller to redisplay main view (re-run discovery, re-render from top).

#### If user chose `x`/`cancel`

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {selected.name} status cancelled
```

> *Output the next fenced block as a code block:*

```
"{selected.name:(titlecase)}" marked as cancelled.
```

→ Return to caller to redisplay main view (re-run discovery, re-render from top).

#### If user chose `b`/`back`

→ Return to caller.

#### If user asked a question

Answer the question, then redisplay the action menu (section B).

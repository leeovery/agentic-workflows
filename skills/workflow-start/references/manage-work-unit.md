# Manage Work Unit

*Reference for **[workflow-start](../SKILL.md)***

---

Manage an in-progress work unit's lifecycle. Self-contained four-step flow. Uses the numbered in-progress items already displayed by the caller.

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

Store the selected work unit.

→ Proceed to **B. Implementation Check**.

## B. Implementation Check

Default `implementation_completed` = false.

Check whether the implementation phase exists:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {selected.name} phases.implementation
```

#### If the result is `false`

→ Proceed to **D. Action Menu**.

#### If the result is `true`

→ Proceed to **C. Completion Check**.

## C. Completion Check

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {selected.name} --phase implementation --topic "*" status
```

This returns all topic statuses in the implementation phase.

#### If any result has `"value": "completed"`

Set `implementation_completed` = true.

→ Proceed to **D. Action Menu**.

#### Otherwise

→ Proceed to **D. Action Menu**.

## D. Action Menu

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**{selected.name:(titlecase)}** ({selected.work_type})

@if(implementation_completed)
- **`d`/`done`** — Mark as completed
@endif
@if(selected.work_type == 'feature')
- **`p`/`pivot`** — Convert to epic (enables multiple topics)
@endif
- **`c`/`cancel`** — Mark as cancelled
- **`b`/`back`** — Return
- **Ask** — Ask a question about this work unit
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user chose `d`/`done`

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {selected.name} status completed
```

> *Output the next fenced block as a code block:*

```
"{selected.name:(titlecase)}" marked as completed.
```

→ Return to caller to redisplay main view (re-run discovery, re-render from top).

#### If user chose `p`/`pivot`

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {selected.name} work_type epic
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**{selected.name:(titlecase)}** converted from feature to epic.

- **`c`/`continue`** — Continue working on this epic now
- **`b`/`back`** — Return to previous view
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If user chose `c`/`continue`:**

Invoke the `/continue-epic` skill. This is terminal — do not return to the caller.

**If user chose `b`/`back`:**

→ Return to caller to redisplay main view (re-run discovery, re-render from top).

#### If user chose `c`/`cancel`

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

Answer the question, then redisplay the action menu (section D).

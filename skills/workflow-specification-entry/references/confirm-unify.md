# Confirm: Unify All

*Reference for **[confirm-and-handoff.md](confirm-and-handoff.md)***

---

Unify folds every completed discussion into the unified spec as a full **source**, so any cross-grouping consult reference is absorbed by wholesale extraction. There is no separate consult-reference block on the unify path.

"Existing specifications to incorporate" lists only materialized specs (status not `proposed`) — reconcile removed the other proposed items as deletes when the unified item was created, so only started/completed specs are superseded.

## A. Display Confirmation

#### If existing specifications will be superseded

> *Output the next fenced block as a code block:*

```
Creating specification: Unified

Sources:
  • {discussion-name}
  • {discussion-name}
  ...

Existing specifications to incorporate:
  • .workflows/{work_unit}/specification/{topic}/specification.md → will be superseded
  • .workflows/{work_unit}/specification/{topic}/specification.md → will be superseded

Output: .workflows/unified/specification/unified/specification.md
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Proceed?
- **`y`/`yes`**
- **`n`/`no`**
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

→ Proceed to **B. Handle Response**.

#### If no existing specifications

> *Output the next fenced block as a code block:*

```
Creating specification: Unified

Sources:
  • {discussion-name}
  • {discussion-name}
  ...

Output: .workflows/unified/specification/unified/specification.md
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Proceed?
- **`y`/`yes`**
- **`n`/`no`**
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

→ Proceed to **B. Handle Response**.

---

## B. Handle Response

#### If user confirms (y)

**If existing specifications will be superseded:**

→ Load **[unify-with-incorporation.md](handoffs/unify-with-incorporation.md)** and follow its instructions as written.

**Otherwise:**

→ Load **[unify.md](handoffs/unify.md)** and follow its instructions as written.

#### If user declines (n)

→ Return to caller.

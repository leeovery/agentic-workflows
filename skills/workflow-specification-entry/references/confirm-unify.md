# Confirm: Unify All

*Reference for **[confirm-and-handoff.md](confirm-and-handoff.md)***

---

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

#### If user confirms (y)

#### If existing specifications will be superseded

→ Load **[unify-with-incorporation.md](handoffs/unify-with-incorporation.md)** and follow its instructions as written.

#### Otherwise

→ Load **[unify.md](handoffs/unify.md)** and follow its instructions as written.

#### If user declines (n)

Re-display the previous menu (the display that led to this confirmation). The user can make a different choice.

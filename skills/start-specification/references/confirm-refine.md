# Confirm: Refine Specification

*Reference for **[confirm-and-handoff.md](confirm-and-handoff.md)***

---

> *Output the next fenced block as a code block:*

```
Refining specification: {Title Case Name}

Existing: .workflows/{work_unit}/specification/specification.md (concluded)

All sources extracted:
  • {discussion-name}
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

→ Load **[continue.md](handoffs/continue.md)** and follow its instructions.

#### If user declines (n)

#### If single discussion (no menu to return to)

> *Output the next fenced block as a code block:*

```
Understood. You can run /start-discussion to continue working on
discussions, or re-run this command when ready.
```

**STOP.** Do not proceed — terminal condition.

#### If groupings or specs menu

Re-display the previous menu (the display that led to this confirmation). The user can make a different choice.

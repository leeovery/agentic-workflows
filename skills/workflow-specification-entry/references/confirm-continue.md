# Confirm: Continue Specification

*Reference for **[confirm-and-handoff.md](confirm-and-handoff.md)***

---

#### If spec is in-progress with pending sources

> *Output the next fenced block as a code block:*

```
Continuing specification: {Title Case Name}

Existing: .workflows/{work_unit}/specification/{topic}/specification.md (in-progress)

Sources to extract:
  • {discussion-name} (pending)

Previously extracted (for reference):
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

#### If spec is in-progress with all sources extracted

> *Output the next fenced block as a code block:*

```
Continuing specification: {Title Case Name}

Existing: .workflows/{work_unit}/specification/{topic}/specification.md (in-progress)

All sources extracted:
  • {discussion-name}
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

#### If spec is completed with pending sources

> *Output the next fenced block as a code block:*

```
Continuing specification: {Title Case Name}

Existing: .workflows/{work_unit}/specification/{topic}/specification.md (completed)

New sources to extract:
  • {discussion-name} (pending)

Previously extracted (for reference):
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

#### If spec is completed with pending sources

→ Load **[continue-completed.md](handoffs/continue-completed.md)** and follow its instructions.

#### Otherwise

→ Load **[continue.md](handoffs/continue.md)** and follow its instructions.

#### If user declines (n)

#### If single discussion (no menu to return to)

> *Output the next fenced block as a code block:*

```
Understood. Continue working on discussions, or re-run this
command when ready.
```

**STOP.** Do not proceed — terminal condition.

#### If groupings or specs menu

Re-display the previous menu (the display that led to this confirmation). The user can make a different choice.

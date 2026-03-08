# Confirm: Create Specification

*Reference for **[confirm-and-handoff.md](confirm-and-handoff.md)***

---

#### If no source discussions have individual specs

> *Output the next fenced block as a code block:*

```
Creating specification: {Title Case Name}

Sources:
  • {discussion-name}
  • {discussion-name}

Output: .workflows/{work_unit}/specification/{topic}/specification.md
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Proceed?
- **`y`/`yes`**
- **`n`/`no`**
· · · · · · · · · · · ·
```

#### If any source discussion has an individual spec

Note the supersession (`has_individual_spec: true`):

> *Output the next fenced block as a code block:*

```
Creating specification: {Title Case Name}

Sources:
  • {discussion-name} (has individual spec — will be incorporated)
  • {discussion-name}

Output: .workflows/{work_unit}/specification/{topic}/specification.md

After completion:
  .workflows/{work_unit}/specification/{source-topic}/specification.md → marked as superseded
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

#### If any source discussions have individual specs

→ Load **[create-with-incorporation.md](handoffs/create-with-incorporation.md)** and follow its instructions.

#### Otherwise

→ Load **[create.md](handoffs/create.md)** and follow its instructions.

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

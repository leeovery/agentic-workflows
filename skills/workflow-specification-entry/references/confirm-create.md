# Confirm: Create Specification

*Reference for **[confirm-and-handoff.md](confirm-and-handoff.md)***

---

## A. Display Confirmation

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

**STOP.** Wait for user response.

→ Proceed to **B. Handle Response**.

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

→ Proceed to **B. Handle Response**.

---

## B. Handle Response

#### If user confirms (y)

**If any source discussions have individual specs:**

→ Load **[create-with-incorporation.md](handoffs/create-with-incorporation.md)** and follow its instructions as written.

**Otherwise:**

→ Load **[create.md](handoffs/create.md)** and follow its instructions as written.

#### If user declines (n)

**If single discussion (no menu to return to):**

> *Output the next fenced block as a code block:*

```
Understood. Continue working on discussions, or re-run this
command when ready.
```

**STOP.** Do not proceed — terminal condition.

**If groupings or specs menu:**

→ Return to the display menu that initiated this confirmation.

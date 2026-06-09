# Confirm: Unify All

*Reference for **[confirm-and-handoff.md](confirm-and-handoff.md)***

---

**Consult references** — if any grouping folded into the unified spec owes consult references (a `**Consult**` line in the consolidation-analysis doc, or a `consult_references` entry on a spec), append this block to the confirmation below, after the sources listing; omit it when there are none:

> *Output the next fenced block as a code block:*

```
Consult references (read narrowly — do not extract):
  • {ref-topic} — {slice hint}
```

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

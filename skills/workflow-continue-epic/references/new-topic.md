# New Topic

*Reference for **[epic-display-and-menu](epic-display-and-menu.md)***

---

The `d` and `r` doors start a topic the map does not hold yet: the topic is named and lands on the map before the handoff carries it. The caller provides `phase` — `discussion` or `research`.

## A. Ask for the Name

#### If `phase` is `discussion`

> *Output the next fenced block as markdown (not a code block):*

```
What topic would you like to discuss?
```

**STOP.** Wait for user response.

→ Proceed to **B. Check the Name**.

#### If `phase` is `research`

> *Output the next fenced block as markdown (not a code block):*

```
What topic would you like to research?
```

**STOP.** Wait for user response.

→ Proceed to **B. Check the Name**.

---

## B. Check the Name

Kebab-case the name the response gives, store as `{topic}`.

A name already on the map is not a new topic — its menu row is the way in. Fetch the gate:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render direct-entry-gate {work_unit}.{phase}.{topic}
```

#### If the output is empty

Silently derive `summary` (one line) and `description` (one or two paragraphs) from the user's response — values for the map row, never rendered; the derivation is part of the turn that took the name, with no stop of its own.

→ Load **[ensure-discovery-item.md](../../workflow-shared/references/ensure-discovery-item.md)** with work_type = `epic`, work_unit = `{work_unit}`, topic = `{topic}`, routing = `{phase}`, summary = `{summary}`, description = `{description}`.

→ On return, return to caller.

#### Otherwise

Emit both sections verbatim per their markers.

→ Return to caller for **A. State Display and Menu**.

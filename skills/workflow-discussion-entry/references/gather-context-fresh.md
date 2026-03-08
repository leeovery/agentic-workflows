# Gather Context: Fresh Topic

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

Ask each question below **one at a time**. After each, **STOP** and wait for the user's response before proceeding.

---

## Topic Name

**If topic is already known** (new entry with topic resolved), skip this section entirely and proceed to **Core Problem**.

Based on the user's description, suggest a topic name in kebab-case. This becomes `{topic}` for all subsequent references.

> *Output the next fenced block as a code block:*

```
Suggested topic name: {topic}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Is this name okay?

- **`y`/`yes`** — Use this name
- **something else** — Suggest a different name
· · · · · · · · · · · ·
```

**STOP.** Wait for user response before proceeding.

---

## Core Problem

> *Output the next fenced block as a code block:*

```
New discussion: {topic}

What's the core problem or decision we need to work through?
```

**STOP.** Wait for user response before proceeding.

---

## Constraints

> *Output the next fenced block as a code block:*

```
Any constraints or context I should know about?
```

**STOP.** Wait for user response before proceeding.

---

## Codebase

> *Output the next fenced block as a code block:*

```
Are there specific files in the codebase I should review first?

(Or "none" if not applicable)
```

**STOP.** Wait for user response before proceeding.

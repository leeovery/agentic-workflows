# Gather Context

*Reference for **[workflow-research-entry](../SKILL.md)***

---

## Research Scope

#### If work_type is `epic` and no topic resolved

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Do you have a specific topic to research, or explore openly?

- **`s`/`specific`** — Name a focused topic to research
- **`e`/`explore`** — Open exploration, follow tangents, see where it goes
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `specific`:**

> *Output the next fenced block as a code block:*

```
What topic would you like to research?
```

**STOP.** Wait for user response.

User provides topic name → `resolved_filename = {topic:(kebabcase)}.md`

**If `explore`:**

`resolved_filename = exploration.md`

#### If work_type is `feature`

No question needed. `resolved_filename = {topic}.md`

#### If topic already resolved

Epic with topic provided via `$2` argument. `resolved_filename = {topic}.md`

---

Ask each question below **one at a time**. After each, **STOP** and wait for the user's response before proceeding.

---

## Seed Idea

> *Output the next fenced block as a code block:*

```
What's on your mind?

- What idea or topic do you want to explore?
- What prompted this - a problem, opportunity, curiosity?
```

**STOP.** Wait for user response.

---

## Current Knowledge

> *Output the next fenced block as a code block:*

```
What do you already know?

- Any initial thoughts or research you've done?
- Constraints or context I should be aware of?
```

**STOP.** Wait for user response.

---

## Starting Point

> *Output the next fenced block as a code block:*

```
Where should we start?

- Technical feasibility? Market landscape? Business model?
- Or just talk it through and see where it goes?
```

**STOP.** Wait for user response.

---

## Final Context

> *Output the next fenced block as a code block:*

```
Any constraints or context I should know about upfront?

(Or "none" if we're starting fresh)
```

**STOP.** Wait for user response.

# Gather Context

*Reference for **[workflow-research-entry](../SKILL.md)***

---

## A. Research Scope

#### If work_type is `epic` and no topic resolved

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Do you have a specific topic to research, or explore openly?

- **`e`/`explore`** — Open exploration, follow tangents, see where it goes
- **`s`/`specific`** — Name a focused topic to research
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `explore`:**

`resolved_filename = exploration.md`

→ Proceed to **B. Seed Idea**.

**If `specific`:**

> *Output the next fenced block as a code block:*

```
What topic would you like to research?
```

**STOP.** Wait for user response.

User provides topic name → `resolved_filename = {topic:(kebabcase)}.md`

→ Proceed to **B. Seed Idea**.

#### If work_type is `feature`

No question needed. `resolved_filename = {topic}.md`

→ Proceed to **B. Seed Idea**.

#### If topic already resolved

Epic with topic provided via `$2` argument. `resolved_filename = {topic}.md`

→ Proceed to **B. Seed Idea**.

---

## B. Seed Idea

Ask each question below **one at a time**. After each, **STOP** and wait for the user's response before proceeding.

> *Output the next fenced block as a code block:*

```
What's on your mind?

- What idea or topic do you want to explore?
- What prompted this - a problem, opportunity, curiosity?
```

**STOP.** Wait for user response.

→ Proceed to **C. Current Knowledge**.

---

## C. Current Knowledge

> *Output the next fenced block as a code block:*

```
What do you already know?

- Any initial thoughts or research you've done?
- Constraints or context I should be aware of?
```

**STOP.** Wait for user response.

→ Proceed to **D. Starting Point**.

---

## D. Starting Point

> *Output the next fenced block as a code block:*

```
Where should we start?

- Technical feasibility? Market landscape? Business model?
- Or just talk it through and see where it goes?
```

**STOP.** Wait for user response.

→ Proceed to **E. Final Context**.

---

## E. Final Context

> *Output the next fenced block as a code block:*

```
Any constraints or context I should know about upfront?

(Or "none" if we're starting fresh)
```

**STOP.** Wait for user response.

→ Return to caller.

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

`topic = exploration`

`resolved_filename = {topic}.md`

→ Proceed to **B. Seed Idea**.

**If `specific`:**

> *Output the next fenced block as a code block:*

```
What topic would you like to research?
```

**STOP.** Wait for user response.

User provides topic name → set `topic` to the kebab-cased response, `resolved_filename = {topic}.md`.

→ Proceed to **B. Seed Idea**.

#### If work_type is `feature` or `cross-cutting`

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

→ Proceed to **F. Ensure Inception Item**.

---

## F. Ensure Inception Item

The no-topic-epic path enters this reference with no inception item written and bypasses Step 2 on exit, so the auto-create must run here. The shared reference is idempotent: when Step 2 already ran the load on a topic-resolved path, the existence check in the shared reference returns true and F is a no-op; for non-epic work_types, the gate returns immediately.

→ Load **[ensure-inception-item.md](../../workflow-shared/references/ensure-inception-item.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`, routing = `research`.

→ Return to caller.

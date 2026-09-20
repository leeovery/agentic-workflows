# Help Home

*Reference for **[workflow-help](../SKILL.md)***

---

Where help opens: the walk, the reference cards, a question, and the way back to the start menu.

## A. Display and Menu

Fetch the home and emit its `TITLE` section verbatim as markdown, then its `MENU: walkthrough home` section verbatim as markdown (not a code block):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render walkthrough-home
```

**STOP.** Wait for user response.

→ Proceed to **B. Handle Selection**.

## B. Handle Selection

#### If `walk`

→ Load **[walk.md](walk.md)** with origin = `help`.

→ On return, return to **A. Display and Menu**.

#### If `topics`

→ Load **[topics.md](topics.md)**.

→ On return, return to **A. Display and Menu**.

#### If `back`

→ Load **[start-menu.md](../../workflow-start/references/start-menu.md)**.

#### If the user asks a question

Answer it per **[answering-how-it-works.md](../../workflow-shared/references/answering-how-it-works.md)** — the menu it puts back is the home's, re-fetched with the call at **A. Display and Menu**.

→ Return to **B. Handle Selection**.

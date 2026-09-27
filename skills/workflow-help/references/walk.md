# The Walk

*Reference for **[workflow-help](../SKILL.md)** — loaded by workflow-start when its first-run offer is taken, and by the help home.*

---

Eight screens, one at a time, each ending on its own menu. `screen` starts at 1.

**Parameters** (provided by caller via Load directive):

- `origin` — `first-run` (workflow-start's Step 0.3) or `help` (the help home)

## A. Render the Screen

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render walkthrough-screen --screen {screen} --from {origin}
```

Emit the response's sections in the order they arrive — the `TITLE`, the `DISPLAY: walkthrough prose` and `DISPLAY: walkthrough diagram` sections, which alternate and repeat, then the `MENU: walkthrough screen` section — each verbatim per its marker.

**STOP.** Wait for user response.

→ Proceed to **B. Route the Answer**.

## B. Route the Answer

#### If `next`

Add one to `screen`.

→ Return to **A. Render the Screen**.

#### If `back`

**If `screen` is 1:**

→ Return to caller.

**Otherwise:**

Take one off `screen`.

→ Return to **A. Render the Screen**.

#### If `skip`

→ Return to caller.

#### If `stop`

→ Return to caller.

#### If `done`

→ Return to caller.

#### If the user asks a question

Answer it per **[answering-how-it-works.md](../../workflow-shared/references/answering-how-it-works.md)** — the menu it puts back is this screen's alone, never the whole screen again: the call at **A. Render the Screen** with `--menu-only` added. A question about ground a later screen covers gets a short answer that says which screen it belongs to.

→ Return to **B. Route the Answer**.

#### If tell me

Screen 8's closing prompt: the user has said what they are likely to start with. Answer it per **[answering-how-it-works.md](../../workflow-shared/references/answering-how-it-works.md)**, in a few ordinary sentences — the kind of work it sounds like, the phases it will visit, and where their own attention will go — in the words the screens have already used, never an engine term. The menu it puts back is this screen's alone, as for a question.

→ Return to **B. Route the Answer**.

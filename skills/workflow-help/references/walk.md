# The Walk

*Reference for **[workflow-help](../SKILL.md)** — loaded by workflow-start's first-run offer and by the help home.*

---

Eight screens, one at a time, each ending on its own menu. `screen` starts at 1.

**Parameters** (provided by caller via Load directive):

- `origin` — `first-run` (workflow-start's Step 0.2: screen 1 is the offer, and its answer is recorded) or `help` (the help home: a re-read, nothing recorded)

## A. Render the Screen

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render walkthrough-screen --screen {screen} --from {origin}
```

Emit the response's sections in the order they arrive, each per its own marker: the `TITLE` verbatim as markdown, each `DISPLAY: walkthrough prose` section verbatim as markdown (not a code block), each `DISPLAY: walkthrough diagram` section verbatim as a code block, then the `MENU: walkthrough screen` section verbatim as markdown (not a code block). Prose and diagram sections alternate and repeat — emit each where it arrives, in the form its own marker names.

**STOP.** Wait for user response.

→ Proceed to **B. Route the Answer**.

## B. Route the Answer

#### If `next`

**If `origin` is `first-run` and `screen` is 1:**

The offer is answered — record it before the walk moves on, unless this walk already recorded an answer (a `b/back` from screen 2 comes through here again). If the call answers `ok: false`, surface the error and continue — the offer returns at the next start:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs walkthrough record walked
```

Then add one to `screen`.

→ Return to **A. Render the Screen**.

**Otherwise:**

Add one to `screen`.

→ Return to **A. Render the Screen**.

#### If `back`

**If `screen` is 1:**

→ Return to caller.

**Otherwise:**

Take one off `screen`.

→ Return to **A. Render the Screen**.

#### If `skip`

**If `screen` is 1:**

The offer is declined — record it, unless this walk has already recorded an answer. If the call answers `ok: false`, surface the error and continue — the offer returns at the next start:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs walkthrough record skipped
```

→ Return to caller.

**Otherwise:**

→ Return to caller.

#### If `stop`

→ Return to caller.

#### If `done`

→ Return to caller.

#### If the user asks a question

Answer it per **[answering-how-it-works.md](../../workflow-shared/references/answering-how-it-works.md)**. A question about ground a later screen covers gets a short answer that says which screen it belongs to.

→ Proceed to **C. Put the Menu Back**.

#### If tell me

Screen 8's closing prompt: the user has said what they are likely to start with. Answer it per **[answering-how-it-works.md](../../workflow-shared/references/answering-how-it-works.md)**, in a few ordinary sentences — the kind of work it sounds like, the phases it will visit, and where their own attention will go — in the words the screens have already used, never an engine term.

→ Proceed to **C. Put the Menu Back**.

## C. Put the Menu Back

The menu alone — never the whole screen again:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render walkthrough-screen --screen {screen} --from {origin} --menu-only
```

Emit the `MENU: walkthrough screen` section verbatim as markdown (not a code block).

**STOP.** Wait for user response.

→ Return to **B. Route the Answer**.

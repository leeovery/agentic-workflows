# Reference Cards

*Reference for **[workflow-help](../SKILL.md)***

---

The cards, read one at a time: what a word means, where it is met, and what to do about it.

## A. The Card List

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render walkthrough-topics
```

Read the `DATA` section to reason from — its `CARDS` table gives one `key  name` row per card, and the `name` is the slug the card is fetched by. Never display that section, and never take a slug from a menu label: a card's title does not determine it. Then emit the `TITLE` section verbatim as markdown and the `MENU: walkthrough topics` section verbatim as markdown (not a code block).

**STOP.** Wait for user response.

→ Proceed to **B. Handle the List**.

## B. Handle the List

#### If the user picks a number

Set `slug` from that key's `CARDS` row.

→ Proceed to **C. The Card**.

#### If `back`

→ Return to caller.

#### If the user asks a question

Answer it per **[answering-how-it-works.md](../../workflow-shared/references/answering-how-it-works.md)** — the menu it puts back is the list's, re-fetched with the call at **A. The Card List**.

→ Return to **B. Handle the List**.

## C. The Card

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render walkthrough-topic --name {slug}
```

Emit the response's sections in the order they arrive, each per its own marker: the `TITLE` verbatim as markdown, each `DISPLAY: walkthrough prose` section verbatim as markdown (not a code block), each `DISPLAY: walkthrough diagram` section verbatim as a code block. Then fetch the card's menu:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render walkthrough-topic --name {slug} --menu-only
```

Emit the `MENU: walkthrough card` section verbatim per its marker.

**STOP.** Wait for user response.

→ Proceed to **D. Handle the Card**.

## D. Handle the Card

#### If `topics`

→ Return to **A. The Card List**.

#### If `back`

→ Return to caller.

#### If the user asks a question

Answer it per **[answering-how-it-works.md](../../workflow-shared/references/answering-how-it-works.md)**. Then put this card's menu back — the menu alone, never the whole card again:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render walkthrough-topic --name {slug} --menu-only
```

Emit the `MENU: walkthrough card` section verbatim as markdown (not a code block).

**STOP.** Wait for user response.

→ Return to **D. Handle the Card**.

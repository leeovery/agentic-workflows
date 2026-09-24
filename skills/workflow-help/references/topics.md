# Reference Cards

*Reference for **[workflow-help](../SKILL.md)***

---

The cards, read one at a time: what a word means, where it is met, and what to do about it.

## A. The Card List

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render walkthrough-topics
```

Read the `DATA` section to reason from — its `CARDS` table gives one `key  name` row per card, and the `name` is the slug the card is fetched by. Never display that section, and never take a slug from a menu label: a card's title does not determine it. Then emit the `TITLE` and `MENU: walkthrough topics` sections verbatim per their markers.

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

Emit the response's sections in the order they arrive, each verbatim per its marker: the `TITLE`, then each `DISPLAY: walkthrough prose` and `DISPLAY: walkthrough diagram` section. Then fetch the card's menu:

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

Answer it per **[answering-how-it-works.md](../../workflow-shared/references/answering-how-it-works.md)** — the menu it puts back is this card's alone, never the whole card again, re-fetched with the `--menu-only` call at **C. The Card**.

→ Return to **D. Handle the Card**.

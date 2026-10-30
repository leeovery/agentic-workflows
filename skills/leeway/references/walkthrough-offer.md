# Walkthrough Offer

*Reference for **[workflow-start](../SKILL.md)***

---

Fetch the offer and emit its sections in the order they arrive, each verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render walkthrough-offer
```

**STOP.** Wait for user response.

**If `yes`:**

Record the answer — written and committed in one call. If it fails (`ok: false`), surface the error and continue — the offer returns at the next start:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs walkthrough record walked
```

→ Load **[walk.md](../../workflow-help/references/walk.md)** with origin = `first-run`.

→ On return, return to caller.

**If `skip`:**

Record the decline — written and committed in one call. If it fails (`ok: false`), surface the error and continue — the offer returns at the next start:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs walkthrough record skipped
```

→ Return to caller.

**If ask:**

Answer it per **[answering-how-it-works.md](../../workflow-shared/references/answering-how-it-works.md)** — the menu it puts back is the offer's alone, never the whole offer again: the call above with `--menu-only` added.

**STOP.** Wait for user response.

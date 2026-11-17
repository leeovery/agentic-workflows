# The Walk

*Reference for **[ledger](../SKILL.md)** — loaded by the start when its walkthrough offer is taken, with origin = `first-run`, and by [start-menu.md](start-menu.md) from the start menu's help, with origin = `help`.*

---

The walk's screens, one at a time, each ending on its own menu, from `screen` 1. Fetch a screen:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render walkthrough-screen --screen {screen} --from {origin:[first-run|help]}
```

Its answer moves the walk:
- `next` fetches the screen after it; `back` the one before it, and on screen 1 ends the walk.
- `skip`, `stop` and `done` end the walk.
- A question is answered per **[answering-how-it-works.md](../../ledger-shared/references/answering-how-it-works.md)**, and the menu it puts back is this screen's alone, the call above with `--menu-only` added. A question about ground a later screen covers gets a short answer that says which screen it belongs to.
- **Tell me**, the last screen's own prompt, says what the person is likely to start with. Answer it per the same reference, in a few ordinary sentences — the kind of work it sounds like, the phases it will visit, and where their own attention will go — in the words the screens have used. The menu it puts back is the screen's alone, as for a question.

Once the walk ends, return to the caller.

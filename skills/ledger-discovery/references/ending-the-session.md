# Ending the Session

*Reference for **[ledger-discovery](../SKILL.md)***

---

## The Roadmap Items

In the product's conversation, what the picture and the log hold that the roadmap does not yet — the areas of work the talk settled, and what still stands of the researcher's open questions — is proposed as roadmap items on one screen. An item is coarse, an area of work a piece of work could start from, never a task, and a placeholder, changeable until work starts from it. Nothing reaches the roadmap without the person's yes; with nothing to propose, there is no screen.

Each item is a kebab-case `name`, a one-line `summary` in the product's terms, and the horizon the person named; each item they gave none takes its own pick, as Putting Something Aside says. Write them to `.ledger/.cache/product/discovery/product/roadmap-items.json`, `[{"name", "horizon", "summary", "sources": ["{log}"]}]`, `{log}` the log's path from the state root and `"kind": "bug"` or `"quick-fix"` for those. Draw the proposal:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render roadmap-harvest --file .ledger/.cache/product/discovery/product/roadmap-items.json
```

A change the person asks for changes the file, and the items are drawn again.

## The Close

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs discovery-session close {home} -m "discovery({home}): end the session"
```

Where it commits nothing, answers warnings, or answers `still_open` — the session left open for another conversation still in it — say so in a line. The turn ends.

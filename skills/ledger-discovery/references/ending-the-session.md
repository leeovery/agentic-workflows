# Ending the Session

*Reference for **[ledger-discovery](../SKILL.md)***

---

## The Roadmap Items

In the product's conversation, the capabilities the session named that are not on the roadmap yet, and what still stands of the researcher's open questions, are proposed as roadmap items on one screen. Nothing reaches the roadmap without the person's yes; with nothing to propose, there is no screen.

Each item is a kebab-case `name`, a one-line `summary` in the product's terms, and the horizon the person named; for the items they gave none, the horizon as Putting Something Aside says, `--park` naming them comma-joined. Write them to `.ledger/.cache/product/discovery/product/roadmap-items.json`, `[{"name", "horizon", "summary", "sources": ["{log}"]}]`, `{log}` the log's path from the state root and `"kind": "bug"` or `"quick-fix"` for those. Draw the proposal:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render roadmap-harvest --file .ledger/.cache/product/discovery/product/roadmap-items.json
```

A refusal names what to change: a name already on the roadmap folds into the item there or takes another, and an illegal name or horizon is respelled — a horizon with the person — before it is drawn again.

## The Close

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs discovery-session close {home} -m "discovery({home}): end the session"
```

Where it commits nothing, answers warnings, or answers `still_open` — the session left open for another conversation still in it — say so in a line. The turn ends.

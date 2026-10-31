# Ending the Session

*Reference for **[leeway-discovery](../SKILL.md)***

---

Re-read the log against the conversation and add what is missing. In an epic's discovery, a session in which you changed the topics or their order beyond what the person asked for ends on **Approving the Map** instead, which closes it.

## The Roadmap Items

In the product's conversation, the capabilities the session named that are not on the roadmap yet, and what still stands of the researcher's open questions, are proposed as roadmap items on one screen. Nothing reaches the roadmap without the person's yes; with nothing to propose, there is no screen.

Each item is a kebab-case `name`, a one-line `summary` in the product's terms, and the horizon the person named; for each they gave none, fetch `render horizon-pick --park {name}`, emit its MENU verbatim per its marker, and take the horizon picked, or the one the person names. Write them to `.leeway/.cache/product/discovery/product/roadmap-items.json`, `[{"name", "horizon", "summary", "sources": ["{log}"]}]`, `{log}` the log's path from the state root and `"kind": "bug"` or `"quick-fix"` for those. Draw them over the roadmap and emit its DISPLAY section verbatim per its marker:

```bash
node .claude/skills/leeway-roadmap/scripts/gateway.cjs proposal --file .leeway/.cache/product/discovery/product/roadmap-items.json
```

Its DATA flags each item: one `exists_on_roadmap` folds into the item there or takes another name, and an illegal name or horizon is respelled — a horizon with the person — before the screen. Then fetch the gate and emit its MENU verbatim per its marker:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render roadmap-harvest-gate
```

The answer goes to `gate`. Yes lands them, `roadmap add-batch --file .leeway/.cache/product/discovery/product/roadmap-items.json`; explore goes back to the conversation, and the session carries on; a change the person asks for changes the file, and the items are drawn again.

## The Close

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs discovery-session close {home} -m "discovery({home}): end the session"
```

Where it commits nothing or answers warnings, say what it said in a line. The turn ends.

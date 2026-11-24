# Approving the Map

*Reference for **[ledger-discovery](../SKILL.md)***

---

The map is the epic's topics in their order, foundations first — a bug or a quick-fix the epic started with is never one, but material for the topics it bears on — and what the shaping put beyond the epic, parked on the roadmap. Write the payload to `.ledger/.cache/{home}/discovery/{home}/approve-map-payload.json`, `{"topics": […], "parks": […], "binds": […]}`:
- `topics` — every live topic, in order. One on the map already is `{"name"}` alone; a new one is `{"name", "summary", "description"?, "brief", "from_roadmap"?}`: a kebab-case name, a one-line summary, the path of its brief's draft (Writing a Brief), and the waiting roadmap item it takes in, where it matches one.
- `parks` — `{"name", "summary", "horizon", "sources": ["{log}"], "kind"?}`, `{log}` the log's path from the state root, the horizon the person's, and `"kind": "bug"` or `"quick-fix"` for those.
- `binds` — each roadmap item the epic was started from that became a topic, `{"item", "topic"}`.

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render approve-map {home} --file .ledger/.cache/{home}/discovery/{home}/approve-map-payload.json
```

Where the epic carries points from before, the screen names each point nothing carries yet, no brief, park, direction not taken, message or question citing its id: name each to the person, and put it where their word places it, citing its id there.

Keep shaping takes the person's word back into the conversation: a change to a topic already on the map is made as Changing the Map says, anything else goes into the payload, staged again.

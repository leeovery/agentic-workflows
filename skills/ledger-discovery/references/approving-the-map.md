# Approving the Map

*Reference for **[ledger-discovery](../SKILL.md)***

---

The map is the epic's topics in their order, foundations first, and what the shaping put beyond the epic, parked on the roadmap. Write the payload to `.ledger/.cache/{home}/discovery/{home}/approve-map-payload.json`, `{"topics": […], "parks": […], "binds": […]}`:
- `topics` — every live topic, in order. One on the map already is named alone; a new one is `{"name", "summary", "description"?, "brief", "from_roadmap"?}`: a kebab-case name, a one-line summary, the path of its brief's draft, and the waiting roadmap item it takes in, where it matches one.
- `parks` — `{"name", "summary", "horizon", "sources", "kind"?}`, `sources` the log's path from the state root, the horizon the person's, and `"kind": "bug"` or `"quick-fix"` for those.
- `binds` — each roadmap item the epic was started from that became a topic, `{"item", "topic"}`.

A brief, park, direction not taken or message that carries a point from before cites it by its id; the screen names each point nothing places yet.

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render approve-map {home} --file .ledger/.cache/{home}/discovery/{home}/approve-map-payload.json
```

A refusal names what to fix: fix the payload and stage it again. At the gate, follow the `next` of what the answer ran. Keep shaping takes the person's word back into the conversation: a change to a topic already on the map goes through **[changing-the-map.md](changing-the-map.md)**, anything else into the payload, staged again.

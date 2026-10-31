# Approving the Map

*Reference for **[leeway-discovery](../SKILL.md)***

---

The map is the epic's topics in their order, and what the shaping put beyond the epic, parked on the roadmap. Shape it from the picture as a whole — the log, the conversation and the map as it stands — never from the order things were said. Re-read the log against the conversation first.

## The Topics

A topic is the unit of a future discussion, never of the build: load **[topic-granularity.md](../../leeway-shared/references/topic-granularity.md)** and follow its instructions as written. A surface the talk only touched in passing waits for a later session. A bug or a quick-fix the epic started with is never a topic: it is material for the topics it bears on. Nothing needs to be exhaustive: the map grows as the work goes.

Order the topics by what depends on what, foundations first: a topic whose results other topics rest on comes before them.

Each new topic takes:
- a `name`, a lowercase kebab-case slug, and a `summary`, one line on the capability or behaviour at stake, product first;
- a `description`, two or three sentences on what it covers and why it surfaced;
- a `brief`, the path of its draft under `.leeway/.cache/{home}/discovery/{home}/`, as the skill's **A Brief** says;
- `from_roadmap`, where it matches a waiting roadmap item: it takes the item in, never a twin beside it.

A topic on the map already is named alone. Each roadmap item the epic was started from that became a topic is bound to it, `{"item", "topic"}`.

## The Parks

What the shaping put beyond this epic — the person placed it later, or the log reads that way — goes on the roadmap with the map, never as a topic: `{"name", "summary", "horizon", "sources"}`, at capability grain, `sources` the log's path from the state root, and `"kind": "bug"` or `"quick-fix"` for those. The horizon is the person's: for each park they gave none, fetch `render horizon-pick --park {name}` before the screen, emit its MENU verbatim per its marker, and take the horizon picked, or the one the person names; a pick that refuses has none to offer, so ask in the conversation.

## The Screen

Write the payload to `.leeway/.cache/{home}/discovery/{home}/approve-map-payload.json`, `{"topics": […], "parks": […], "binds": […]}` — every live topic in its order — then stage it and draw the screen, emitting its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render approve-map {home} --file .leeway/.cache/{home}/discovery/{home}/approve-map-payload.json
```

A refusal names what to fix: fix the payload and stage it again. The answer goes to `gate`; follow its `next`, and then the `next` of what it ran. Keep shaping takes the person's word back into the conversation: a change to a topic already on the map goes through **Changing the Map**, anything else into the payload, staged again.

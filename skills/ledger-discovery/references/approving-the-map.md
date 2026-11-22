# Approving the Map

*Reference for **[ledger-discovery](../SKILL.md)***

---

The map is the epic's topics in their order, and what the shaping put beyond the epic, parked on the roadmap. Shape it from the whole of what was explored — the log, the conversation and the map as it stands — never from the order things were said. Re-read the log against the conversation first.

## The Topics

A topic is the unit of a future discussion, never of the build: load **[topic-granularity.md](../../ledger-shared/references/topic-granularity.md)** and follow its instructions as written. A surface the talk only touched in passing waits for a later session. A bug or a quick-fix the epic started with is never a topic: it is material for the topics it bears on. Nothing needs to be exhaustive: the map grows as the work goes.

Order the topics by what depends on what, foundations first: a topic whose results other topics rest on comes before them.

Each new topic takes:
- a `name`, a lowercase kebab-case slug, and a `summary`, one line on the capability or behaviour at stake, product first;
- a `description`, two or three sentences on what it covers and why it surfaced;
- a `brief`, the path of its draft under `.ledger/.cache/{home}/discovery/{home}/`: load **[writing-a-brief.md](writing-a-brief.md)** and follow its instructions as written;
- `from_roadmap`, where it matches a waiting roadmap item: it takes the item in, never a twin beside it.

A topic on the map already is named alone. Each roadmap item the epic was started from that became a topic is bound to it, `{"item", "topic"}`.

## The Parks

What the shaping put beyond this epic — the person placed it later, or the log reads that way — goes on the roadmap with the map, never as a topic: `{"name", "summary", "horizon", "sources"}`, at capability grain, `sources` the log's path from the state root, and `"kind": "bug"` or `"quick-fix"` for those. The horizon is the person's.

## The Points from Before

Where the epic carries points from before (`from before`), each brief cites by its id each point it carries. The screen names every point nothing places yet, no brief, park, direction not taken, message or question citing its id: name each to the person and put it where their word places it — a brief, a message to a started topic (**A Message to a Topic**), a park, or a direction not taken — citing its id there. The record's own superseded entries and false paths are directions it already left, never points to carry, and a reference file is searched, never read whole.

## The Screen

Write the payload to `.ledger/.cache/{home}/discovery/{home}/approve-map-payload.json`, `{"topics": […], "parks": […], "binds": […]}` — every live topic in its order — then stage it and draw the screen:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render approve-map {home} --file .ledger/.cache/{home}/discovery/{home}/approve-map-payload.json
```

A refusal names what to fix: fix the payload and stage it again. At the gate, follow the `next` of what the answer ran. Keep shaping takes the person's word back into the conversation: a change to a topic already on the map goes through **Changing the Map**, anything else into the payload, staged again.

---
name: leeway-roadmap
user-invocable: false
allowed-tools: Bash(node .claude/skills/leeway-engine/scripts/engine.cjs *)
---

The product's roadmap: what waits on each horizon, and the way on from it.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Instructions

Load **[framework.md](../leeway-shared/references/framework.md)** and follow its instructions as written.

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely, then re-load [framework.md](../leeway-shared/references/framework.md).** Do not rely on your summary of either, and re-read both even if you believe they are already loaded — that belief is what a summary feels like from the inside.
2. **Read the state.** Run `node .claude/skills/leeway-engine/scripts/engine.cjs roadmap state` and reason from its response.
3. **Carry on from where the conversation was**, as if the break never happened — no recap and no announcement. Where the person's message is waiting, take it at the step it arrived at, unless it only asks to carry on. Otherwise, where the conversation was at a gate, put the gate back, fetched fresh; elsewhere continue the step it was on.

Do not guess at progress or continue from memory. The engine's state is authoritative — your recollection is not.

---

## The Menu

Fetch the roadmap and emit its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render roadmap
```

The answer goes to `gate`; follow its `next`. An item picked by its number, or asked about, is told by its summary, which the DATA gives. A `next` that draws the start menu, `render start-menu`, hands the conversation to the start menu: Load **[start-menu.md](../leeway/references/start-menu.md)** and follow its instructions as written. A `next` that moves into work goes through the handoff: Load **[handing-off.md](../leeway-shared/references/handing-off.md)** with route = `/{skill} {args}`.

## Working on Items

`w/work` asks which items to work on now. Name what stays waiting on each horizon they come from — "3 items stay waiting in later", "nothing stays waiting in next" — then hand them to discovery as its seeds, `{seeds}` each item as `roadmap:{item}`, comma-joined: Load **[handing-off.md](../leeway-shared/references/handing-off.md)** with route = `/leeway-discovery start none "{seeds}"`.

## Adding an Item

`n/new` asks what the item is and which horizon it goes on. Name it: a kebab-case `{name}`, a one-line `{summary}` in the product's terms, and `--kind` for a bug or a small mechanical change. The horizon is the person's: where they named none, fetch `render horizon-pick --park {name}`, emit its MENU verbatim per its marker, and take the horizon picked, or the one the person names; a pick that refuses has none to offer, so ask in the conversation.

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs roadmap add {name} --horizon "{horizon}" --summary "{summary}" [--kind {kind:[bug|quick-fix]}] --origin roadmap
```

A name already on the roadmap takes another. Say the line its response's `said` holds, then draw the roadmap again (**The Menu**).

## Moving or Archiving an Item

`m/move` asks which item and which horizon, the person's, then `roadmap move {name} --horizon "{horizon}"`; say `Moved "{title}" to {horizon}.` `a/archive` asks which item, then `roadmap archive {name}`; say `Archived "{title}".`, and where its response's `epic_row_cancelled` names a topic, that the topic is cancelled on its epic too. Then draw the roadmap again (**The Menu**).

## Changes Asked in Words

Renaming or rewording an item, bringing an archived one back onto a horizon, and adding, renaming, reordering, merging, splitting or removing an empty horizon are each done at the person's word, with no confirm, and said in one line once done. Then draw the roadmap again (**The Menu**).

- An item renamed or reworded → `roadmap rename {old} {new}`, `roadmap edit {name} --summary "{summary}"`.
- An archived item back → `roadmap move {name} --horizon "{horizon}"`.
- A horizon changed → `roadmap horizon add|rename|reorder|merge|split|remove`.

## Joining an Epic

An item to join an epic in progress joins it as a new topic, through that epic's discovery: say so in a line, then Load **[handing-off.md](../leeway-shared/references/handing-off.md)** with route = `/leeway-discovery none {epic}`.

# Requests at Any Point

*Reference for **[ledger-discussion-process](../SKILL.md)***

---

`{request}` is `backlog`, `postpone`, `cancel` or `move-up`: work its section. `{place}` is `{work_unit}.discussion.{topic}`.

## Backlogging

It goes on the roadmap now, in a unit of any kind. A point of this topic not on the map is asked first. Bring the log up to date and name the item — a kebab-case `{name}` and a one-line `{summary}` saying it in the product's terms. The horizon is the person's: take it from their words; where they named none, fetch `render horizon-pick --park {name}` and take the horizon picked, or the one the person names. Then add the item:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs roadmap add {name} --horizon "{horizon}" --summary "{summary}" --origin park:{work_unit} --source {work_unit}/topics/{topic}
```

A name already on the roadmap takes another. Once it lands, say the line its response's `said` holds. A question moves to the item, closing here, `{"by": "person", "who_moved_whom": "none"}` on stdin:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs ledger move {place} --question {id} --to roadmap:{name}
```

## Postponing the Topic

The topic postponed is this one or another of the epic, `{name}`. A single-topic unit has nothing to postpone: its topic is the unit, and its "not now" is a cancel; say so in a line. Postponing this topic leaves it: bring the log up to date. Another topic of the epic, named, leaves this one as it is.

Where the person named a horizon, fetch the confirm, `render postpone-gate {work_unit}.discovery.{name} --horizon "{horizon}"`; otherwise the pick over the roadmap's horizons, `render horizon-pick {work_unit}.discovery.{name}`. A horizon named in words, or a Comment changing it, leads to the confirm again with it.

The postpone answers `closed_agents`: stop the task behind each one you dispatched with the TaskStop tool.

## Cancelling the Topic

Bring the log up to date, then fetch the confirm: an epic's topic `render cancel-gate {work_unit}.discovery.{topic}`, a single-topic unit `render cancel-gate {work_unit}`.

An epic's cancel answers `closed_agents`: stop the task behind each one you dispatched with the TaskStop tool. Say in a line which experiments went with it, where its `abandoned` names any, and where each wait in `released_waits` stands: the point it held is open again, raised when the topic is reactivated.

A single-topic unit's cancel takes the unit's cache, its agents' rows with it: stop every task you dispatched.

## Moving Up

Suggest going there in a line; only the person's word moves it. Bring the log up to date. Then move, in this conversation: `{home}` is `{work_unit}` for an epic's discovery, or `product` for the product's conversation, the only place a single-topic unit's talk moves up to.

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs enter discovery {home} --move
```

Once it enters, invoke `/ledger-discovery none {work_unit}`, or `/ledger-discovery none none` for the product's conversation; the conversation carries on there.

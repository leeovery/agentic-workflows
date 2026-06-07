# Incoming Landing

*Shared reference. Loaded by `workflow-discussion-process` and `workflow-research-process` when an off-topic concern belongs to a **different** topic.*

---

Lands an off-topic concern in a target topic's `## Incoming` section so the target picks it up when its phase next runs. The landing is **dumb and symmetric**: it writes only the `## Incoming` entry (creating a seed artefact stub when the target has none yet). It never injects into the target's Discussion Map or research threads — folding Incoming into the working map is the consuming session's job (see [drain-incoming.md](drain-incoming.md)).

Epic-only. Single-topic work types (feature, bugfix, quick-fix) have no second topic to route to — their callers handle an off-topic concern by ignoring it, surfacing it to the inbox, or pivoting to an epic, and never load this reference.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic. Always present.
- `target` — the destination topic the concern belongs to (may or may not exist yet).
- `concern` — the off-topic concern as captured.
- `origin` — the topic the concern surfaced in (the current session's topic).
- `phase` — the current phase, `research` or `discussion` (recorded in the entry; also the `routing` for a target that has to be created).
- `session` — the current session number.
- `date` — today's date.

## Incoming Entry Shape

Each landed concern is appended to the target artefact's `## Incoming` section as one subsection, replacing the `(none)` placeholder when it is the first entry. Pin this exact shape — the drain and the conclusion gate detect against it:

```
### {concern}
*From: {origin} · {phase} · session {NNN} · {date}*

{concern as captured}
```

## Behaviour Contract

Target resolution is computed against the **live** discovery map at landing time, never cached — a target elevated earlier in the same session must resolve correctly. Three cases, by the target's current lifecycle:

- **New** (not on the map) — create the target via `create-topic` with `--phase {phase}` and `--source incoming:{origin}`, then create its artefact stub from the template carrying the entry.
- **Fresh** (a discovery item exists but no phase work) — `init-phase` the target's phase per its `routing` and create the artefact stub. `create-topic` is **not** used here — it errors on the existing discovery item.
- **In-flight or decided** (an artefact exists) — append the entry to its `## Incoming`. When the phase item is `completed`, also flip it back to `in-progress` (reopen) so the target recomputes to actionable.

If the resolved target **is the current topic itself**, this is not Incoming — the caller routes it to normal subtopic handling instead and never lands it. Incoming is strictly for a different target.

The full case-by-case procedure and the trigger wiring that loads this reference are specified where the session flows invoke it.

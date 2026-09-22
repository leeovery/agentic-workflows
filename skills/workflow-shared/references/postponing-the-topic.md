# Postponing the Topic

*Shared reference. Loaded by the `## Postponing the Topic` section on the research, discussion, investigation, scoping, specification, planning, implementation, and review processing skills, by discovery's map operations, by the epic menu's postpone sub-view, and by the gap-analysis approval gate.*

---

The caller provides `work_unit`, `name` — the topic that leaves — and the session's own `phase` and `topic`, the literal `none` where the caller is not a session working a topic (the epic menu and the approval gate name neither; discovery's map operations name the phase alone). Postpone says one thing: we are doing this topic later — it leaves the epic whole, waits on the roadmap under the horizon the user names, and comes back by the pull.

Three neighbours it is not:

- **Cancel.** "Not doing this" — the topic stays on the map as the record that it was raised and declined, and its conclusions leave retrieval for good.
- **A park.** An idea surfacing mid-conversation goes to the roadmap through the backlogging door. Postpone takes a topic already on the map, with everything under its name.
- **Research's dead end.** Research that ran and leaves the product nothing to carry forward concludes at its conclude gate: the question was answered, not deferred.

## A. Resolve the Unit

Postpone is topic-level over the Discovery unit — the map row with its research, discussion, and experiments together. Read the work type:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit} work_type
```

#### If work type is `epic`

Set `own` — whether `topic` equals `name` and `phase` is `research` or `discussion`: the session is sitting in the unit that leaves.

→ Proceed to **B. The Horizon**.

#### Otherwise

Tell the user in one line: the topic is the work unit here, so there is nothing to postpone — a feature's "not now" is the work-unit cancel on the start menu's manage view, which hands any roadmap item joined to it back to waiting.

→ Return to caller.

## B. The Horizon

#### If the user named a horizon

A label already on the map, or a new one in their own words — "under Next", "that's a v2 thing". That is `{horizon}`.

→ Proceed to **C. Confirm**.

#### Otherwise

→ Load **[choosing-a-horizon.md](choosing-a-horizon.md)**.

→ On return, proceed to **C. Confirm**.

## C. Confirm

**If `own`:**

Commit anything this session has written and not yet committed, with the phase's own cadence commit — the postpone transaction writes the manifests alone, so the sitting that sent the topic away is committed with the rest of its record rather than left loose. Nothing to commit is fine.

Either way, fetch the confirm — its statement names what goes, which is the whole unit and not only the document in front of the user, and where it lands:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render postpone-gate {work_unit}.discovery.{name} --horizon "{horizon}"
```

#### If the call refuses

The unit cannot be postponed, and the refusal names what holds it — a started specification sourcing its discussion, a live experiment record, a roadmap item already holding the name. Surface the engine's error verbatim in one line; nothing was written.

→ Return to caller.

#### Otherwise

Emit the `MENU: postpone gate` section verbatim per its marker.

**STOP.** Wait for user response.

**If `no`:**

Nothing is recorded. Say so in one line.

→ Return to caller.

**If comment:**

The horizon is all the comment can change — the name is the topic's and the summary is the map row's. Take it as the instruction and settle the horizon again.

→ Return to **B. The Horizon**.

**If `yes`:**

→ Proceed to **D. Postpone**.

## D. Postpone

**If `own`:**

Close this session's background agents first. Read the store:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} {phase} {topic}
```

For each `in_flight` row, stop its running task with the TaskStop tool on the task id this session dispatched it under, then close the row — `agent scan` never promotes an incorporated row, so a report that lands later is ignored:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent incorporate {work_unit} {phase} {topic} {id}
```

Rows in any other status stay as they are, and a scan holding no `in_flight` row needs none of this.

Either way, run the postpone — one command takes the unit (the map row marked, every live research and discussion item under its name stashed and postponed, any proposed grouping over its discussion discarded, the experiment series left as it stands), removes the postponed artifacts' knowledge-base chunks, births or re-waits the roadmap item under the horizon, and commits both manifests:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic postpone {work_unit} {name} --horizon "{horizon}"
```

#### If the response is `ok: false`

Surface the engine's error verbatim in one line — nothing was written.

→ Return to caller.

#### Otherwise

Fetch and emit the receipt — the `DISPLAY: kb warning` advisory (when carried) then the `DISPLAY: confirmation` section — adding `--warn` when the response's `warnings` is non-empty. When the response's `discarded` is non-empty, tell the user in one line which proposed grouping(s) went with the topic; when its `roadmap.reverted_join` is true, say in one line that the topic's own roadmap item is waiting again rather than a new one standing beside it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render topic-receipt {work_unit}.discovery.{name} --verb postpone [--warn]
```

**If `own`:**

Invoke `/workflow-bridge {work_unit} {phase} none postponed`.

**Otherwise:**

→ Return to caller.

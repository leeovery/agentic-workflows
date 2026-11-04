# Cancelling the Topic

*Shared reference. Loaded by the investigation and scoping processing skills when the work under way is called off.*

---

The caller provides `work_unit`, `topic`, and `phase` (the session's own). The user has said to cancel, or the conversation has agreed the topic is not worth pursuing. Cancel says one thing: we are not doing this topic.

Three neighbours it is not:

- **Postpone.** "Doing this later" — the topic leaves whole for the roadmap and comes back by the pull; that is the postponing door.
- **A done-signal.** The work reached its end and the record stands — that is the phase's own conclusion.
- **A sign-off that leaves the topic open.** Nothing is called off; commit what the session has written and end the turn.

## A. Resolve the Unit

Cancel is topic-level — never one phase item. Read the work type:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs manifest get {work_unit} work_type
```

#### If work type is `epic` and `phase` is `discussion`

The unit is the topic — the map row with its discussion and experiments together.

→ Proceed to **B. Confirm**.

#### Otherwise

The topic is the work unit — a feature, bugfix, quick-fix, or cross-cutting unit — so what is called off is the unit itself.

→ Proceed to **D. Cancel the Work Unit**.

## B. Confirm

Write into the document what this sitting discussed and has not yet recorded, as the phase records it — the substance, never the cancel itself, which the transaction records. Then commit anything this session has written and not yet committed, with the phase's own cadence commit: the cancel transaction writes the manifest alone, so an unrecorded conversation that called the topic off is lost with it. Nothing to write means the document already holds what the sitting discussed — a clean working tree does not say so. Nothing to commit is fine.

Fetch the confirm — its statement names exactly what the cancel takes, which is the whole unit and not only the document in front of the user. The gate is the confirmation: the request is never put back to the user in conversation first.

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render cancel-gate {work_unit}.discovery.{topic}
```

#### If the call refuses

The unit cannot be cancelled from here, and the refusal names what holds it. Surface the engine's error verbatim in one line; nothing was written.

→ Return to caller.

#### Otherwise

Emit the `MENU: cancel gate` section verbatim per its marker.

**STOP.** Wait for user response.

**If `no`:**

→ Return to caller.

**If `yes`:**

→ Proceed to **C. Cancel the Unit**.

## C. Cancel the Unit

Close this session's background agents first. Read the store:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs agent scan {work_unit} {phase} {topic}
```

For each `in_flight` row, stop its running task with the TaskStop tool on the task id this session dispatched it under, then close the row — `agent scan` never promotes an incorporated row, so a report that lands later is ignored:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs agent incorporate {work_unit} {phase} {topic} {id}
```

Rows in any other status stay as they are, and a scan holding no `in_flight` row needs none of this.

Run the cancel — one command takes the topic (the map row marked, the discussion item under its name stashed and cancelled, every open experiment record abandoned with the cancellation as its reason), stashes the execution order, removes the cancelled artifacts' knowledge-base chunks, and commits:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs topic cancel {work_unit} discovery {topic}
```

#### If the response is `ok: false`

Surface the engine's error verbatim in one line — nothing was written.

→ Return to caller.

#### Otherwise

Fetch and emit the receipt — the `DISPLAY: kb warning` advisory (when carried) then the `DISPLAY: confirmation` section, each verbatim per its marker — adding `--warn` when the response's `warnings` is non-empty, and `--inbox {n}` when its `inbox` lists the waiting messages the cancel moved, `{n}` their count. When the response's `abandoned` is non-empty, name the experiment records the cancel closed; when `released_waits` is non-empty, say where the ball sits — each waiting point reverts to open, surfaced when the topic is reactivated and that conversation next runs:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render topic-receipt {work_unit}.discovery.{topic} --verb cancel [--warn] [--inbox {n}]
```

Invoke `/leeway-bridge {work_unit} {phase} cancelled`.

## D. Cancel the Work Unit

Write into the document what this sitting discussed and has not yet recorded, as the phase records it — the substance, never the cancel itself, which the transaction records. Then commit anything this session has written and not yet committed, with the phase's own cadence commit. Nothing to write means the document already holds what the sitting discussed — a clean working tree does not say so; nothing to commit is fine. Stop any background task this session launched with the TaskStop tool — the cancel purges the work unit's cache, the agent store with it, so no row is left to close.

Run the cancel — one command sets `status: cancelled`, removes the work unit's chunks from the knowledge base, hands any roadmap item joined to it back to waiting, and commits:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs workunit cancel {work_unit}
```

#### If the response is `ok: false`

Surface the engine's error verbatim in one line — nothing was written.

→ Return to caller.

#### Otherwise

Fetch and emit the receipt — the `DISPLAY: kb warning` advisory (when carried) then the `DISPLAY: confirmation` section, each verbatim per its marker — adding `--warn` when the response's `warnings` is non-empty, and `--inbox {n}` when its `inbox` lists the waiting messages the cancel moved, `{n}` their count:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render workunit-receipt {work_unit} --verb cancel [--warn] [--inbox {n}]
```

**STOP.** Do not proceed — terminal condition.

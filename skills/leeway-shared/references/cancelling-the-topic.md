# Cancelling the Topic

*Shared reference. Loaded by the scoping processing skill when the work under way is called off.*

---

The caller provides `work_unit`, `topic`, and `phase` (the session's own). The user has said to cancel, or the conversation has agreed the topic is not worth pursuing. Cancel says one thing: we are not doing this topic.

Three neighbours it is not:

- **Postpone.** "Doing this later" — the topic leaves whole for the roadmap and comes back by the pull; that is the postponing door.
- **A done-signal.** The work reached its end and the record stands — that is the phase's own conclusion.
- **A sign-off that leaves the topic open.** Nothing is called off; commit what the session has written and end the turn.

## A. Cancel the Work Unit

The topic is the work unit — a bugfix's investigation, a quick-fix's scoping — so what is called off is the unit itself.

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

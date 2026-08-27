# Map Operations

*Reference for **[workflow-discovery](../SKILL.md)***

---

Per-operation handling for **edits to existing map items**. Loaded by [session-loop.md](session-loop.md) when the user names one or more map operations in a conversational turn. Owns parsing, validation, manifest writes, session-log entries (under **Edits**), and commits for these moves.

New topics are not added here — they are synthesised at the harvest from the exploration as a whole. See [topic-synthesis.md](topic-synthesis.md).

State for validation comes from `skills/workflow-discovery/scripts/gateway.cjs` — invoke it via Bash and read the structured output. Never invoke the underlying Node helpers inline.

After all of the user's operations have been processed, return to caller.

## A. Parse Operations

Re-run discovery to pick up state changes since the last invocation (operations applied earlier in the session, or the parent's initial discovery):

```bash
node .claude/skills/workflow-discovery/scripts/gateway.cjs {work_unit}
```

Read `discovery_map` (per-topic `tier`, `lifecycle`, `routing`, `summary`, `source`) and `dismissed`. These drive validation in **B**.

The active-session marker is **not** set here — it is set lazily when an operation first writes the session log (see [template.md](template.md)), so an all-rejected or browse-only session leaves no marker.

Then read the user's most recent message. Extract one or more operations. Recognised intents:

| User phrasing                                              | Operation         | Required values        |
| ---------------------------------------------------------- | ----------------- | ---------------------- |
| *"edit summary of X to Y"*, *"reword X's blurb"*           | Edit summary      | name, new summary      |
| *"edit description of X to Y"*, *"reword X's description"* | Edit description  | name, new description  |
| *"remove X"*, *"drop X"*, *"delete X"*                     | Remove            | name                   |
| *"rename X to Y"*                                          | Rename            | old name, new name     |
| *"change routing of X to discussion"*                      | Change routing    | name, new routing      |
| *"close X as a dead end"*, *"X is a dead end"*, *"mark X handled"* | Close as dead end | name                   |
| *"reopen X"*, *"unhandle X"*                               | Reopen            | name                   |

If the message is ambiguous (e.g. *"fix X"*, *"that one looks wrong"*), ask one clarifying question before proceeding. No STOP gate is needed for clarification — it's part of conversational flow, not a manifest write.

**Group operations** for safety-by-destructiveness:

- **Additive group** — a contiguous run of Edit summary operations *or* a contiguous run of Edit description operations. Each group batches into one STOP gate, one commit, one session-log entry.
- **Destructive group** — a single Remove, Rename, or Change routing operation. Each is its own group of one with its own STOP gate and commit.
- **Marker group** — a single Close as dead end or Reopen operation. Non-destructive (it sets or clears a display/convergence marker only), but still its own group of one with its own STOP gate and commit.

Walk the groups in user order. For mixed batches, each destructive op is its own group; contiguous additive ops in between batch.

→ Proceed to **B. Validate**.

## B. Validate

Apply per-operation validation gates **before** any STOP gate. If validation fails for an operation, surface the rejection with a clear next-step pointer (don't just say "blocked") and remove the operation from its group. Continue with the rest.

**Lifecycle gates** — for destructive (Remove, Rename, Change routing) and marker (Close as dead end, Reopen) operations, look up the operation's target topic in `discovery_map` and read its `lifecycle` field. The operation is allowed only when:

| Operation       | Allowed lifecycles | Disallowed                                                                  |
| --------------- | ------------------ | --------------------------------------------------------------------------- |
| Remove          | `fresh`            | `researching`, `discussing`, `ready_for_discussion`, `decided`, `handled`, `cancelled` |
| Rename          | `fresh`            | all others                                                                  |
| Change routing  | `fresh`            | all others (routing is implicit once a phase item exists)                   |
| Close as dead end | any except `handled`, `cancelled` | `handled`, `cancelled`                                     |
| Reopen          | `handled`          | all others                                                                  |
| Edit summary    | any                | —                                                                           |
| Edit description| any                | —                                                                           |

`cancelled` is also disallowed for Remove because the discovery item is the historical record of the topic ever having existed. Removal is for never-started topics only; cancel-then-vanish would erase the audit trail. The `a/cancel` flow in `/workflow-continue-epic` is the right tool for stopping in-flight work.

`fresh` alone does not guarantee Remove, Rename, or Change routing will succeed — any research or discussion item on record refuses engine-side, including a `triaged` stub of parked rerouted concerns (dump cue `triage=waiting`). Surface the engine's refusal as the rejection.

Close as dead end is non-destructive — it sets a display/convergence marker (`handled` in the manifest), for a topic with nothing to carry forward under its own name. It's allowed from any actionable lifecycle; only an already-closed or `cancelled` topic is rejected. Reopen is its inverse — allowed on `handled` only, clearing the marker.

The engine enforces these same gates — `engine discovery-map` refuses an illegal op with an error naming the blocking lifecycle, so this pre-validation and the write path can never disagree. The rejection displays below stay this file's job, rendered from the pre-check here or from an engine error.

**Destructive-op rejection** — for a Remove, Rename, or Change routing op that fails its gate, render in a code block:

> *Output the next fenced block as a code block:*

```
"{topic}" can't be {removed|renamed|re-routed} from the map —
{lifecycle_phrase}. {recovery_pointer}
```

`{lifecycle_phrase}` examples (derive from the topic's actual research state — superseded research is named as such, never as completed):

- `researching` — `research is in flight on it`
- `discussing` — `discussion is in flight on it`
- `ready_for_discussion` — `research has completed and discussion is queued` (superseded research: `its research was superseded and discussion is queued`)
- `decided` — `discussion has concluded`
- `handled` — `it is closed as a dead end and stays on the map as record`
- `cancelled` — `it has phase work in cancelled state and stays on the map as historical record`

`{recovery_pointer}`: for a `handled` target, `Say "reopen {topic}" to make it actionable again.` For any other disallowed lifecycle, `To stop work on it, use \`a\`/\`cancel\` from the epic menu instead.`

**Marker-op rejection** — for a Close as dead end op on an already-closed or `cancelled` topic, or a Reopen op on a non-`handled` topic, render in a code block:

> *Output the next fenced block as a code block:*

```
"{topic}" can't be {closed as a dead end|reopened} — {marker_phrase}.
```

`{marker_phrase}` examples:

- Close as dead end on `handled` — `it's already closed`
- Close as dead end on `cancelled` — `it's cancelled; reactivate the phase work from the epic menu first`
- Reopen on a non-`handled` lifecycle — `it isn't closed as a dead end, so there's nothing to reopen`

**Name validation** — for each Rename operation, validate the proposed name via the shared reference:

→ Load **[topic-name-validation.md](../../workflow-shared/references/topic-name-validation.md)** with work_unit = `{work_unit}`, proposed_name = `{name}`.

Branch on `result`:

- `collision-active` — rejection already rendered by the reference. Remove the operation from its group.
- `matches-dismissed` — allowed. A Rename target that matches a dismissed name leaves the dismissed entry alone; the new active item simply exists alongside it as historical record.
- `ok` — proceed.

→ On return, proceed to **C. Apply**.

## C. Apply

Walk the validated operation groups in user order. For the next pending group:

#### If the group is one or more Edit summary operations

→ Proceed to **D. Edit Summary**.

#### If the group is a Remove operation

→ Proceed to **E. Remove**.

#### If the group is a Rename operation

→ Proceed to **F. Rename**.

#### If the group is a Change routing operation

→ Proceed to **G. Change Routing**.

#### If the group is one or more Edit description operations

→ Proceed to **H. Edit Description**.

#### If the group is a Close as dead end operation

→ Proceed to **I. Close as Dead End**.

#### If the group is a Reopen operation

→ Proceed to **J. Reopen**.

#### Otherwise (no groups remain)

→ Proceed to **K. Done**.

## D. Edit Summary

One gate covers the whole batch. Write the payload to `.workflows/.cache/{work_unit}/discovery/map-op.json` with the Write tool (`{"items": [{"name": "…", "summary": "…"}]}` — one entry per edit in user order, each carrying the new summary verbatim), then render it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render map-op-gate {work_unit} --op edit-summary --file .workflows/.cache/{work_unit}/discovery/map-op.json
```

Emit the call's DISPLAY and MENU sections verbatim per their markers.

**STOP.** Wait for user response.

#### If `no`

Skip the batch. No manifest writes, no session-log entry, no commit.

→ Return to **C. Apply** for the next group.

#### If `yes`

For each:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discovery-map edit {work_unit} {name} --summary "{new summary}"
```

Append a single batch entry to the session log under **Edits**. The session log may not exist yet (lazy creation — see [template.md](template.md)) — if it doesn't, create it first using the template and the session metadata held since Step 8. If **Edits** currently reads `(none)`, replace it with the bullets:

```markdown
- Edited summary: {name_1} — {short note}
- Edited summary: {name_2} — {short note}
```

Single commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "discovery({work_unit}): edit {N} summary(ies)" --discovery
```

→ Return to **C. Apply** for the next group.

## E. Remove

Write the payload to `.workflows/.cache/{work_unit}/discovery/map-op.json` with the Write tool (`{"name": "…"}`), then render the gate:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render map-op-gate {work_unit} --op remove --file .workflows/.cache/{work_unit}/discovery/map-op.json
```

Emit the call's DISPLAY and MENU sections verbatim per their markers.

**STOP.** Wait for user response.

#### If `no`

Skip this operation. No manifest writes, no session-log entry, no commit.

→ Return to **C. Apply** for the next group.

#### If `yes`

Hard-delete the discovery item and add the name to the dismissed list:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discovery-map remove {work_unit} {name}
```

Append an Edits entry to the session log. If the log doesn't exist yet, create it first from [template.md](template.md). If **Edits** currently reads `(none)`, replace it with the bullet:

```markdown
- Removed: {name} — {short reason}
```

Per-item commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "discovery({work_unit}): remove {name} from map" --discovery
```

→ Return to **C. Apply** for the next group.

## F. Rename

Write the payload to `.workflows/.cache/{work_unit}/discovery/map-op.json` with the Write tool (`{"name": "{old}", "new_name": "{new}"}`), then render the gate:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render map-op-gate {work_unit} --op rename --file .workflows/.cache/{work_unit}/discovery/map-op.json
```

Emit the call's DISPLAY and MENU sections verbatim per their markers.

**STOP.** Wait for user response.

#### If `no`

Skip this operation. No manifest writes, no session-log entry, no commit.

→ Return to **C. Apply** for the next group.

#### If `yes`

Move the item to the new name — every field carries across:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discovery-map rename {work_unit} {old} {new}
```

If the command fails, surface the error and skip the commit — the engine validates before writing, so nothing changed.

Append an Edits entry to the session log. If the log doesn't exist yet, create it first from [template.md](template.md). If **Edits** currently reads `(none)`, replace it with the bullet:

```markdown
- Renamed: {old} → {new} — {short reason}
```

Per-item commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "discovery({work_unit}): rename {old} → {new}" --discovery
```

→ Return to **C. Apply** for the next group.

## G. Change Routing

Write the payload to `.workflows/.cache/{work_unit}/discovery/map-op.json` with the Write tool (`{"name": "…", "from": "{old routing}", "to": "{new routing}"}`), then render the gate:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render map-op-gate {work_unit} --op reroute --file .workflows/.cache/{work_unit}/discovery/map-op.json
```

Emit the call's DISPLAY and MENU sections verbatim per their markers.

**STOP.** Wait for user response.

#### If `no`

Skip this operation. No manifest writes, no session-log entry, no commit.

→ Return to **C. Apply** for the next group.

#### If `yes`

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discovery-map reroute {work_unit} {name} {research|discussion}
```

Append an Edits entry to the session log. If the log doesn't exist yet, create it first from [template.md](template.md). If **Edits** currently reads `(none)`, replace it with the bullet:

```markdown
- Changed routing: {name} → {new routing} — {short reason}
```

Per-item commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "discovery({work_unit}): re-route {name} to {new routing}" --discovery
```

→ Return to **C. Apply** for the next group.

## H. Edit Description

One gate covers the whole batch. Description may span paragraphs — carry a truncated preview (about 140 characters with `…`) in the payload so the STOP gate stays readable; the full description is written verbatim on confirm.

Write the payload to `.workflows/.cache/{work_unit}/discovery/map-op.json` with the Write tool (`{"items": [{"name": "…", "description": "…"}]}` — one entry per edit in user order, each carrying the truncated preview), then render it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render map-op-gate {work_unit} --op edit-description --file .workflows/.cache/{work_unit}/discovery/map-op.json
```

Emit the call's DISPLAY and MENU sections verbatim per their markers.

**STOP.** Wait for user response.

#### If `no`

Skip the batch. No manifest writes, no session-log entry, no commit.

→ Return to **C. Apply** for the next group.

#### If `yes`

For each, write the full description verbatim (not the truncated preview):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discovery-map edit {work_unit} {name} --description "{new description}"
```

Append a single batch entry to the session log under **Edits**. If the log doesn't exist yet, create it first from [template.md](template.md). If **Edits** currently reads `(none)`, replace it with the bullets:

```markdown
- Edited description: {name_1} — {short note}
- Edited description: {name_2} — {short note}
```

Single commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "discovery({work_unit}): edit {N} description(s)" --discovery
```

→ Return to **C. Apply** for the next group.

## I. Close as Dead End

Write the payload to `.workflows/.cache/{work_unit}/discovery/map-op.json` with the Write tool (`{"name": "…"}`), then render the gate:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render map-op-gate {work_unit} --op close --file .workflows/.cache/{work_unit}/discovery/map-op.json
```

Emit the call's DISPLAY and MENU sections verbatim per their markers.

**STOP.** Wait for user response.

#### If `no`

Skip this operation. No manifest writes, no session-log entry, no commit.

→ Return to **C. Apply** for the next group.

#### If `yes`

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discovery-map handle {work_unit} {name}
```

Append an Edits entry to the session log. If the log doesn't exist yet, create it first from [template.md](template.md). If **Edits** currently reads `(none)`, replace it with the bullet:

```markdown
- Closed as dead end: {name} — {short reason}
```

Per-item commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "discovery({work_unit}): close {name} as dead end" --discovery
```

→ Return to **C. Apply** for the next group.

## J. Reopen

Write the payload to `.workflows/.cache/{work_unit}/discovery/map-op.json` with the Write tool (`{"name": "…"}`), then render the gate:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render map-op-gate {work_unit} --op reopen --file .workflows/.cache/{work_unit}/discovery/map-op.json
```

Emit the call's DISPLAY and MENU sections verbatim per their markers.

**STOP.** Wait for user response.

#### If `no`

Skip this operation. No manifest writes, no session-log entry, no commit.

→ Return to **C. Apply** for the next group.

#### If `yes`

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discovery-map unhandle {work_unit} {name}
```

Append an Edits entry to the session log. If the log doesn't exist yet, create it first from [template.md](template.md). If **Edits** currently reads `(none)`, replace it with the bullet:

```markdown
- Reopened: {name} — {short reason}
```

Per-item commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "discovery({work_unit}): reopen {name}" --discovery
```

→ Return to **C. Apply** for the next group.

## K. Done

All operation groups have been processed.

→ Return to caller.

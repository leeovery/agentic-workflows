# Map Operations

*Reference for **[workflow-discovery](../SKILL.md)***

---

Per-operation handling for **edits to existing map items**. Loaded by [session-loop.md](session-loop.md) when the user names one or more map operations in a conversational turn. Owns parsing, validation, manifest writes, session-log entries (under **Edits**), and commits for these moves.

New topics are not added here — they are synthesised at endpoint from the exploration as a whole. See [topic-synthesis.md](topic-synthesis.md).

State for validation comes from `skills/workflow-discovery/scripts/discovery.cjs` — invoke it via Bash and read the structured output. Never invoke the underlying Node helpers inline.

After all of the user's operations have been processed, return to caller.

## A. Parse Operations

Re-run discovery to pick up state changes since the last invocation (operations applied earlier in the session, or the parent's initial discovery):

```bash
node .claude/skills/workflow-discovery/scripts/discovery.cjs {work_unit}
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

If the message is ambiguous (e.g. *"fix X"*, *"that one looks wrong"*), ask one clarifying question before proceeding. No STOP gate is needed for clarification — it's part of conversational flow, not a manifest write.

**Group operations** for safety-by-destructiveness:

- **Additive group** — a contiguous run of Edit summary operations *or* a contiguous run of Edit description operations. Each group batches into one STOP gate, one commit, one session-log entry.
- **Destructive group** — a single Remove, Rename, or Change routing operation. Each is its own group of one with its own STOP gate and commit.

Walk the groups in user order. For mixed batches, each destructive op is its own group; contiguous additive ops in between batch.

→ Proceed to **B. Validate**.

## B. Validate

Apply per-operation validation gates **before** any STOP gate. If validation fails for an operation, surface the rejection with a clear next-step pointer (don't just say "blocked") and remove the operation from its group. Continue with the rest.

**Lifecycle gates** — for destructive operations (Remove, Rename, Change routing), look up the operation's target topic in `discovery_map` and read its `lifecycle` field. The operation is allowed only when:

| Operation       | Allowed lifecycles | Disallowed                                                                  |
| --------------- | ------------------ | --------------------------------------------------------------------------- |
| Remove          | `fresh`            | `researching`, `discussing`, `ready_for_discussion`, `decided`, `cancelled` |
| Rename          | `fresh`            | all others                                                                  |
| Change routing  | `fresh`            | all others (routing is implicit once a phase item exists)                   |
| Edit summary    | any                | —                                                                           |
| Edit description| any                | —                                                                           |

`cancelled` is also disallowed for Remove because the discovery item is the historical record of the topic ever having existed. Removal is for never-started topics only; cancel-then-vanish would erase the audit trail. The `a`/`cancel` flow in `/workflow-continue-epic` is the right tool for stopping in-flight work.

Render the rejection in a code block:

> *Output the next fenced block as a code block:*

```
"{topic}" can't be {removed|renamed|re-routed} from the map —
{lifecycle_phrase}. To stop work on it, use `a`/`cancel` from the
epic menu instead.
```

`{lifecycle_phrase}` examples:

- `researching` — `research is in flight on it`
- `discussing` — `discussion is in flight on it`
- `ready_for_discussion` — `research has completed and discussion is queued`
- `decided` — `discussion has concluded`
- `cancelled` — `it has phase work in cancelled state and stays on the map as historical record`

**Name validation** — for each Rename operation, validate the proposed name via the shared reference:

→ Load **[topic-name-validation.md](../../workflow-shared/references/topic-name-validation.md)** with work_unit = `{work_unit}`, proposed_name = `{name}`.

Branch on `result`:

- `collision-active` — rejection already rendered by the reference. Remove the operation from its group.
- `matches-dismissed` — allowed. A Rename target that matches a dismissed name leaves the dismissed entry alone; the new active item simply exists alongside it as historical record.
- `ok` — proceed.

→ Proceed to **C. Apply**.

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

#### Otherwise (no groups remain)

→ Proceed to **I. Done**.

## D. Edit Summary

Render the proposal once for the whole batch:

> *Output the next fenced block as a code block:*

```
Updating {N} summary(ies):

  • {name_1}: "{new summary}"
  • {name_2}: "{new summary}"
  ...
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Apply?

- **`y`/`yes`**
- **`n`/`no`**
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `no`

Skip the batch. No manifest writes, no session-log entry, no commit.

→ Return to **C. Apply** for the next group.

#### If `yes`

For each:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{name} summary "{new summary}"
```

Append a single batch entry to the session log under **Edits**. The session log may not exist yet (lazy creation — see [template.md](template.md)) — if it doesn't, create it first using the template and the session metadata held since Step 8. If **Edits** currently reads `(none)`, replace it with the bullets:

```markdown
- Edited summary: {name_1} — {short note}
- Edited summary: {name_2} — {short note}
```

Single commit:

```bash
git add -- .workflows/{work_unit}/manifest.json .workflows/{work_unit}/discovery/session-{session_number:03d}.md
git commit -m "discovery({work_unit}): edit {N} summary(ies)"
```

→ Return to **C. Apply** for the next group.

## E. Remove

Render the proposal:

> *Output the next fenced block as a code block:*

```
Remove "{name}" from the map.

  Lifecycle: fresh — no work has started on this topic.
  The name will be added to the dismissed list so analyses
  won't auto-re-propose it.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Confirm removal?

- **`y`/`yes`**
- **`n`/`no`**
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `no`

Skip this operation. No manifest writes, no session-log entry, no commit.

→ Return to **C. Apply** for the next group.

#### If `yes`

Hard-delete the discovery item and add the name to the dismissed list:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.discovery items.{name}
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit}.discovery dismissed "{name}"
```

Append an Edits entry to the session log. If the log doesn't exist yet, create it first from [template.md](template.md). If **Edits** currently reads `(none)`, replace it with the bullet:

```markdown
- Removed: {name} — {short reason}
```

Per-item commit:

```bash
git add -- .workflows/{work_unit}/manifest.json .workflows/{work_unit}/discovery/session-{session_number:03d}.md
git commit -m "discovery({work_unit}): remove {name} from map"
```

→ Return to **C. Apply** for the next group.

## F. Rename

Render the proposal:

> *Output the next fenced block as a code block:*

```
Rename "{old}" → "{new}".

  Lifecycle: fresh — no work has started, no files exist
  under this name. Manifest mutation only.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Confirm rename?

- **`y`/`yes`**
- **`n`/`no`**
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `no`

Skip this operation. No manifest writes, no session-log entry, no commit.

→ Return to **C. Apply** for the next group.

#### If `yes`

Read the always-present fields:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discovery.{old} routing
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discovery.{old} source
```

Use the returned values as `{routing}` and `{source}` in the write commands below.

`summary` and `description` are both optional — migration-seeded, direct-start, and absorption-registered items can land with either or both unset. Probe each before reading:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}.discovery.{old} summary
```

If the output is `true`, read the value:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discovery.{old} summary
```

Use the returned value as `{summary}` in the optional write below.

Repeat for `description`:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}.discovery.{old} description
```

If `true`, read it; use as `{description}` in the optional write below.

Delete the old key, create the new key, write the always-present fields back under the new key:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.discovery items.{old}
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.discovery.{new}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{new} routing {routing}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{new} source {source}
```

If a summary was read above, also write it:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{new} summary "{summary}"
```

If a description was read above, also write it:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{new} description "{description}"
```

If any command fails, surface the error and stop before the commit so the user can recover — a partial rename leaves the manifest in an inconsistent state otherwise.

Append an Edits entry to the session log. If the log doesn't exist yet, create it first from [template.md](template.md). If **Edits** currently reads `(none)`, replace it with the bullet:

```markdown
- Renamed: {old} → {new} — {short reason}
```

Per-item commit:

```bash
git add -- .workflows/{work_unit}/manifest.json .workflows/{work_unit}/discovery/session-{session_number:03d}.md
git commit -m "discovery({work_unit}): rename {old} → {new}"
```

→ Return to **C. Apply** for the next group.

## G. Change Routing

Render the proposal:

> *Output the next fenced block as a code block:*

```
Change routing of "{name}": {old routing} → {new routing}.

  Lifecycle: fresh — no phase work yet, so the routing
  hint is mutable.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Confirm routing change?

- **`y`/`yes`**
- **`n`/`no`**
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `no`

Skip this operation. No manifest writes, no session-log entry, no commit.

→ Return to **C. Apply** for the next group.

#### If `yes`

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{name} routing {research|discussion}
```

Append an Edits entry to the session log. If the log doesn't exist yet, create it first from [template.md](template.md). If **Edits** currently reads `(none)`, replace it with the bullet:

```markdown
- Changed routing: {name} → {new routing} — {short reason}
```

Per-item commit:

```bash
git add -- .workflows/{work_unit}/manifest.json .workflows/{work_unit}/discovery/session-{session_number:03d}.md
git commit -m "discovery({work_unit}): re-route {name} to {new routing}"
```

→ Return to **C. Apply** for the next group.

## H. Edit Description

Render the proposal once for the whole batch. Description may span paragraphs — show a truncated preview (about 140 characters with `…`) in the proposal block so the STOP gate stays readable; the full description is written verbatim on confirm.

> *Output the next fenced block as a code block:*

```
Updating {N} description(s):

  • {name_1}: "{truncated description}"
  • {name_2}: "{truncated description}"
  ...
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Apply?

- **`y`/`yes`**
- **`n`/`no`**
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `no`

Skip the batch. No manifest writes, no session-log entry, no commit.

→ Return to **C. Apply** for the next group.

#### If `yes`

For each, write the full description verbatim (not the truncated preview):

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{name} description "{new description}"
```

Append a single batch entry to the session log under **Edits**. If the log doesn't exist yet, create it first from [template.md](template.md). If **Edits** currently reads `(none)`, replace it with the bullets:

```markdown
- Edited description: {name_1} — {short note}
- Edited description: {name_2} — {short note}
```

Single commit:

```bash
git add -- .workflows/{work_unit}/manifest.json .workflows/{work_unit}/discovery/session-{session_number:03d}.md
git commit -m "discovery({work_unit}): edit {N} description(s)"
```

→ Return to **C. Apply** for the next group.

## I. Done

All operation groups have been processed.

→ Return to caller.

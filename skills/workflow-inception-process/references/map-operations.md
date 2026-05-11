# Map Operations

*Reference for **[workflow-inception-process](../SKILL.md)***

---

Per-operation handling for refinement. Owns parsing, validation, manifest writes, session-log entries, and commits. Loaded by **[refinement-session.md](refinement-session.md)** when the user names one or more changes.

The parent reference owns the conversation shape; this file owns the writes. State for validation comes from `skills/workflow-inception-process/scripts/discovery.cjs` — invoke it via Bash and read the structured output. Never invoke the underlying Node helpers inline.

After all of the user's operations have been processed, return to caller.

## A. Parse Operations

Re-run discovery to pick up state changes since the last invocation (operations applied earlier in the session, or the parent's initial discovery):

```bash
node .claude/skills/workflow-inception-process/scripts/discovery.cjs {work_unit}
```

Read `discovery_map` (per-topic `tier`, `lifecycle`, `routing`, `summary`, `source`) and `dismissed`. These drive validation in **B**.

Then read the user's most recent message. Extract one or more operations. Recognised intents:

| User phrasing                                   | Operation       | Required values                          |
| ----------------------------------------------- | --------------- | ---------------------------------------- |
| *"add X as research"*, *"add Y as discussion"*  | Add             | name, routing                            |
| *"edit summary of X to Y"*, *"reword X's blurb"*| Edit summary    | name, new summary                        |
| *"remove X"*, *"drop X"*, *"delete X"*          | Remove          | name                                     |
| *"rename X to Y"*                               | Rename          | old name, new name                       |
| *"change routing of X to discussion"*           | Change routing  | name, new routing                        |

If routing is omitted on Add, infer from cues in the user's framing (factual unknowns → research; opinion or design → discussion). The proposal is tentative — the STOP gate is where the user flips it.

If the message is ambiguous (e.g. *"fix X"*, *"that one looks wrong"*), ask one clarifying question before proceeding. No STOP gate is needed for clarification — it's part of conversational flow, not a manifest write.

**Group operations** for safety-by-destructiveness:

- **Additive group** — a contiguous run of Add operations *or* a contiguous run of Edit summary operations. Each group batches into one STOP gate, one commit, one session-log entry.
- **Destructive group** — a single Remove, Rename, or Change routing operation. Each is its own group of one with its own STOP gate and commit.

Walk the groups in user order. For mixed batches (e.g. *"remove A, rename B to B2, add C"*), each destructive op is its own group; contiguous additive ops in between batch.

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
| Add             | n/a (new item)     | —                                                                           |

`cancelled` is also disallowed for Remove because the inception item is the historical record of the topic ever having existed. Removal is for never-started topics only; cancel-then-vanish would erase the audit trail. The `a`/`cancel` flow in `/continue-epic` is the right tool for stopping in-flight work.

Render the rejection in a code block:

> *Output the next fenced block as a code block:*

```
"{topic}" can't be {removed|renamed|re-routed} from the map —
{lifecycle_phrase}. To stop work on it, use `a`/`cancel` in
/continue-epic instead.
```

`{lifecycle_phrase}` examples:

- `researching` — `research is in flight on it`
- `discussing` — `discussion is in flight on it`
- `ready_for_discussion` — `research has completed and discussion is queued`
- `decided` — `discussion has concluded`
- `cancelled` — `it has phase work in cancelled state and stays on the map as historical record`

**Name validation** — for each Add and Rename operation, validate the proposed name via the shared reference:

→ Load **[topic-name-validation.md](../../workflow-shared/references/topic-name-validation.md)** with work_unit = `{work_unit}`, proposed_name = `{name}`.

Branch on `result`:

- `format-invalid` or `collision-active` — rejection already rendered by the reference. Remove the operation from its group.
- `matches-dismissed` — allowed. For Add, the **D. Add** flow pulls the name from `dismissed` before writing. For Rename, proceed without pulling (a Rename target that happens to match a dismissed name leaves the dismissed entry alone; the new active item simply exists alongside it as historical record).
- `ok` — proceed.

→ Proceed to **C. Apply**.

## C. Apply

Walk the validated operation groups in user order. For the next pending group:

#### If the group is one or more Add operations

→ Proceed to **D. Add**.

#### If the group is one or more Edit summary operations

→ Proceed to **E. Edit Summary**.

#### If the group is a Remove operation

→ Proceed to **F. Remove**.

#### If the group is a Rename operation

→ Proceed to **G. Rename**.

#### If the group is a Change routing operation

→ Proceed to **H. Change Routing**.

#### Otherwise (no groups remain)

→ Proceed to **I. Done**.

## D. Add

Render the proposal once for the whole batch:

> *Output the next fenced block as a code block:*

```
Adding {N} topic(s):

  • {name_1}  (routing: {research|discussion}, source: inception)
  • {name_2}  (routing: {research|discussion}, source: inception)
  ...
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Add all?

- **`y`/`yes`**
- **`n`/`no`**
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `no`

Skip the batch. No manifest writes, no session-log entry, no commit.

→ Return to **C. Apply** for the next group.

#### If `yes`

For each name in the batch:

1. If the name appears in `dismissed` (from the discovery output read in **A**), pull it:

   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs pull {work_unit}.inception dismissed "{name}"
   ```

2. Initialise the inception item and set its fields:

   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.inception.{name}
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{name} summary "{one-line summary}"
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{name} routing {research|discussion}
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{name} source inception
   ```

   Source is `inception` for refinement-added topics — they are user-curated, indistinguishable from initial-session items for provenance purposes.

3. Append a single batch entry to the session log under **Changes** (one bullet per name). If the section currently reads `(none)`, replace it with the bullets:

   ```markdown
   - Added: {name_1} (routing: {research|discussion}, source: inception) — {short rationale}
   - Added: {name_2} (routing: {research|discussion}, source: inception) — {short rationale}
   ```

4. Single commit covering all adds in the batch:

   ```bash
   git add -- .workflows/{work_unit}/manifest.json .workflows/{work_unit}/inception/session-{NNN}.md
   git commit -m "inception({work_unit}): add {N} topic(s) to map"
   ```

→ Return to **C. Apply** for the next group.

## E. Edit Summary

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
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{name} summary "{new summary}"
```

Append a single batch entry to the session log under **Changes**. If the section currently reads `(none)`, replace it with the bullets:

```markdown
- Edited summary: {name_1} — {short note}
- Edited summary: {name_2} — {short note}
```

Single commit:

```bash
git add -- .workflows/{work_unit}/manifest.json .workflows/{work_unit}/inception/session-{NNN}.md
git commit -m "inception({work_unit}): edit {N} summary(ies)"
```

→ Return to **C. Apply** for the next group.

## F. Remove

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

Hard-delete the inception item and add the name to the dismissed list:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.inception items.{name}
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit}.inception dismissed "{name}"
```

Append a Changes entry to the session log. If the section currently reads `(none)`, replace it with the bullet:

```markdown
- Removed: {name} — {short reason}
```

Per-item commit:

```bash
git add -- .workflows/{work_unit}/manifest.json .workflows/{work_unit}/inception/session-{NNN}.md
git commit -m "inception({work_unit}): remove {name} from map"
```

→ Return to **C. Apply** for the next group.

## G. Rename

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

Read the existing fields, delete the old key, create the new key, re-write the fields:

```bash
saved_summary=$(node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.inception.{old} summary)
saved_routing=$(node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.inception.{old} routing)
saved_source=$(node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.inception.{old} source)

node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.inception items.{old}
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.inception.{new}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{new} summary "$saved_summary"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{new} routing "$saved_routing"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{new} source "$saved_source"
```

If any command fails, surface the error and stop before the commit so the user can recover — a partial rename leaves the manifest in an inconsistent state otherwise.

Append a Changes entry to the session log. If the section currently reads `(none)`, replace it with the bullet:

```markdown
- Renamed: {old} → {new} — {short reason}
```

Per-item commit:

```bash
git add -- .workflows/{work_unit}/manifest.json .workflows/{work_unit}/inception/session-{NNN}.md
git commit -m "inception({work_unit}): rename {old} → {new}"
```

→ Return to **C. Apply** for the next group.

## H. Change Routing

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
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{name} routing {research|discussion}
```

Append a Changes entry to the session log. If the section currently reads `(none)`, replace it with the bullet:

```markdown
- Changed routing: {name} → {new routing} — {short reason}
```

Per-item commit:

```bash
git add -- .workflows/{work_unit}/manifest.json .workflows/{work_unit}/inception/session-{NNN}.md
git commit -m "inception({work_unit}): re-route {name} to {new routing}"
```

→ Return to **C. Apply** for the next group.

## I. Done

All operation groups have been processed.

→ Return to caller.

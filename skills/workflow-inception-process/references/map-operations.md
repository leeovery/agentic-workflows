# Map Operations

*Reference for **[workflow-inception-process](../SKILL.md)***

---

Per-operation handling for refinement. Owns parsing, validation, manifest writes, session-log entries, and commits. Loaded by **[refinement-session.md](refinement-session.md)** when the user names one or more changes.

The parent reference owns the conversation shape; this file owns the writes. After completing the user's batch, return to caller.

## A. Parse Operations

Read the user's most recent message. Extract one or more operations. Recognised intents:

| User phrasing                                   | Operation       | Required values                          |
| ----------------------------------------------- | --------------- | ---------------------------------------- |
| *"add X as research"*, *"add Y as discussion"*  | Add             | name, routing                            |
| *"edit summary of X to Y"*, *"reword X's blurb"*| Edit summary    | name, new summary                        |
| *"remove X"*, *"drop X"*, *"delete X"*          | Remove          | name                                     |
| *"rename X to Y"*                               | Rename          | old name, new name                       |
| *"change routing of X to discussion"*           | Change routing  | name, new routing                        |

If routing is omitted on Add, infer from cues in the user's framing (factual unknowns → research; opinion or design → discussion). The proposal is tentative — the STOP gate is where the user flips it.

If the message is ambiguous (e.g. *"fix X"*, *"that one looks wrong"*), ask one clarifying question before proceeding. No STOP gate is needed for clarification — it's part of conversational flow, not a manifest write.

**Classify operations:**

- **Additive** — Add, Edit summary. Batched.
- **Destructive** — Remove, Rename, Change routing. Per-item.

**Process order:** in the order the user listed them. For pure additive batches, group into a single STOP gate, single commit, single session-log entry covering the batch. For pure destructive batches, per-item. For mixed batches, walk in order — destructive ops gate per-item, the contiguous additive ops in between can batch.

→ Proceed to **B. Validate**.

## B. Validate

Apply per-operation validation gates **before** any STOP gate. If validation fails, surface the rejection with a clear next-step pointer (don't just say "blocked") and skip that operation. Continue with the rest of the batch.

### B.1. Lifecycle gates

For destructive operations (Remove, Rename, Change routing), compute the topic's lifecycle via `computeTopicLifecycle(manifest, topicName)` from `discovery-utils.cjs`. The operation is allowed only when:

| Operation       | Allowed lifecycles | Disallowed                                   |
| --------------- | ------------------ | -------------------------------------------- |
| Remove          | `fresh`            | `researching`, `discussing`, `ready_for_discussion`, `decided`, `cancelled` |
| Rename          | `fresh`            | all others                                   |
| Change routing  | `fresh`            | all others (routing is implicit once a phase item exists) |
| Edit summary    | any                | —                                            |
| Add             | n/a (new item)     | —                                            |

Note: `cancelled` is also disallowed for Remove because the inception item is the historical record of the topic ever having existed. Removal is for never-started topics only; cancel-then-vanish would erase audit trail. The `a`/`cancel` flow in `/continue-epic` is the right tool for stopping in-flight work.

**Rejection messages** — render in a code block, then continue with the rest of the batch:

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

### B.2. Name collision gates

For Add and Rename, the new name is rejected if an **active** map item already uses it (case-sensitive match against `phases.inception.items.{name}`). Render:

> *Output the next fenced block as a code block:*

```
"{name}" is already on the map. Pick a different name or use
edit-summary / change-routing on the existing item.
```

For Add, a name appearing in `phases.inception.dismissed` is **allowed** — it counts as a re-add. The Add flow pulls the name from the dismissed list before creating the new item.

→ Proceed to **C. Apply Operations**.

## C. Apply Operations

Walk the validated operations in user order. For each, render the proposed change, gate per the safety rule, apply via the manifest CLI, append to the session log, and commit.

The session log path is `.workflows/{work_unit}/inception/session-{NNN}.md` (already initialised by the parent reference's **C.1**). Append entries under the **Changes** section in user order. Replace `(none)` with the first entry.

### C.1. Add (additive — batched)

For a contiguous run of Add operations, render the proposal once:

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

Skip the batch. Continue with the next operation in the user's list (if any) or return to caller.

#### If `yes`

For each name in the batch:

1. If the name is in `phases.inception.dismissed`, pull it:

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

3. Append a single batch entry to the session log under **Changes** (one bullet per name):

   ```markdown
   - Added: {name_1} (routing: {research|discussion}, source: inception) — {short rationale}
   - Added: {name_2} (routing: {research|discussion}, source: inception) — {short rationale}
   ```

4. Single commit covering all adds in the batch:

   ```bash
   git add -- .workflows/{work_unit}/manifest.json .workflows/{work_unit}/inception/session-*.md
   git commit -m "inception({work_unit}): add {N} topic(s) to map"
   ```

→ Proceed to the next operation in the user's list.

### C.2. Edit summary (additive — batched)

For a contiguous run of Edit summary operations, render the proposal once:

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

Skip the batch. Continue.

#### If `yes`

For each:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{name} summary "{new summary}"
```

Append a single batch entry to the session log under **Changes**:

```markdown
- Edited summary: {name_1} — {short note}
- Edited summary: {name_2} — {short note}
```

Single commit:

```bash
git add -- .workflows/{work_unit}/manifest.json .workflows/{work_unit}/inception/session-*.md
git commit -m "inception({work_unit}): edit {N} summary(ies)"
```

→ Proceed to the next operation in the user's list.

### C.3. Remove (destructive — per-item)

For each Remove operation:

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

Skip this operation. Continue with the next.

#### If `yes`

Hard-delete the inception item and add the name to the dismissed list:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.inception items.{name}
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit}.inception dismissed "{name}"
```

Append a Changes entry to the session log:

```markdown
- Removed: {name} — {short reason}
```

Per-item commit:

```bash
git add -- .workflows/{work_unit}/manifest.json .workflows/{work_unit}/inception/session-*.md
git commit -m "inception({work_unit}): remove {name} from map"
```

→ Proceed to the next operation in the user's list.

### C.4. Rename (destructive — per-item)

For each Rename operation:

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

Skip this operation. Continue.

#### If `yes`

Read the existing fields, delete the old key, create the new key, re-write the fields:

```bash
summary=$(node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.inception.{old} summary)
routing=$(node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.inception.{old} routing)
source=$(node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.inception.{old} source)

node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.inception items.{old}
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.inception.{new}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{new} summary "$summary"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{new} routing "$routing"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{new} source "$source"
```

If any command fails, surface the error and stop before the commit so the user can recover — the rename is partial otherwise.

Append a Changes entry to the session log:

```markdown
- Renamed: {old} → {new} — {short reason}
```

Per-item commit:

```bash
git add -- .workflows/{work_unit}/manifest.json .workflows/{work_unit}/inception/session-*.md
git commit -m "inception({work_unit}): rename {old} → {new}"
```

→ Proceed to the next operation in the user's list.

### C.5. Change routing (destructive — per-item)

For each Change-routing operation:

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

Skip this operation. Continue.

#### If `yes`

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{name} routing {research|discussion}
```

Append a Changes entry:

```markdown
- Changed routing: {name} → {new routing} — {short reason}
```

Per-item commit:

```bash
git add -- .workflows/{work_unit}/manifest.json .workflows/{work_unit}/inception/session-*.md
git commit -m "inception({work_unit}): re-route {name} to {new routing}"
```

→ Proceed to the next operation in the user's list.

## D. Done

Once all operations in the user's batch have been processed (applied or skipped), return to caller. The parent reference re-prompts with `Anything else?`.

→ Return to caller.

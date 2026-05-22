# Absorb Feature into Epic

*Reference for **[manage-work-unit](manage-work-unit.md)***

---

Merge a feature's discussion into an existing epic as a new topic, then remove the feature entirely.

## A. Select Target Epic

> *Output the next fenced block as markdown (not a code block):*

```
> This will move the feature's discussion, research, and imports into
> the selected epic as a new topic and delete the feature work unit.
> Git history serves as provenance.

· · · · · · · · · · · ·
Select a target epic:

@foreach(epic in available_epics)
- **`{N}`** — {epic.name:(titlecase)}
@endforeach

- **`b`/`back`** — Return
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user chose `b`/`back`

→ Return to caller.

#### If user chose a number

Store the selected epic as `target_epic`.

→ Proceed to **B. Name Topic**.

---

## B. Name Topic

Default topic name = `{selected.name}` (the feature's work unit name).

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Topic name in **{target_epic:(titlecase)}**: **{selected.name}**

- **`y`/`yes`** — Use this name
- **`b`/`back`** — Return
- **Rename** — Enter a different name (kebab-case)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user chose `b`/`back`

→ Return to caller.

#### If user chose `y`/`yes`

Set `topic` = `{selected.name}`.

→ Proceed to **C. Collision Check**.

#### If rename

Set `topic` to the user's input.

→ Proceed to **C. Collision Check**.

---

## C. Collision Check

Check if a discussion topic with this name already exists in the target epic:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {target_epic}.discussion.{topic}
```

#### If `true`

> *Output the next fenced block as a code block:*

```
Topic "{topic}" already exists in {target_epic:(titlecase)}.
Enter a different name (kebab-case):
```

**STOP.** Wait for user response.

Set `topic` to the user's input.

→ Return to **C. Collision Check**.

#### If `false`

→ Proceed to **D. Research Check**.

---

## D. Research Check

Check if the feature has research:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {selected.name}.research
```

#### If `true`

Set `has_research` = true.

Read the research items to get topic names and statuses:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get '{selected.name}.research.*' status
```

Store as `research_items` (list of topic name + status pairs).

For each research item, check for collision in the target epic:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {target_epic}.research.{research_topic}
```

Collisions are resolved by appending `-{selected.name}` (e.g. `exploration` becomes `exploration-{selected.name}`). Store the mapping of original name → target name as `research_moves`.

→ Proceed to **E. Imports Check**.

#### Otherwise

Set `has_research` = false.

→ Proceed to **E. Imports Check**.

---

## E. Imports Check

Check if the feature has imports:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {selected.name} imports
```

#### If `true`

Set `has_imports` = true.

Read the imports list:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {selected.name} imports
```

Store as `imports_entries` (list of `{path, imported_at}` objects). Set `imports_count` to its length.

For each entry, derive the basename from `path` (the filename under `imports/`). Check for collision in the target epic's `imports/` directory:

```bash
test -e .workflows/{target_epic}/imports/<basename>
```

Collisions are resolved by suffixing the stem with `-{selected.name}` before the `.md` extension (e.g. `seed-conversation.md` becomes `seed-conversation-{selected.name}.md`). Store the mapping of original filename → target filename as `imports_moves`, preserving each entry's original `imported_at` timestamp.

→ Proceed to **F. Confirm**.

#### Otherwise

Set `has_imports` = false. Set `imports_count` = 0.

→ Proceed to **F. Confirm**.

---

## F. Confirm

Read the discussion status:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {selected.name}.discussion.{selected.name} status
```

Store the result as `discussion_status`.

> *Output the next fenced block as a code block:*

```
Absorb Summary

  Feature:    {selected.name:(titlecase)}
  Target:     {target_epic:(titlecase)}
  Topic:      {topic}
  Discussion: [{discussion_status}]
@if(has_research)
  Research:   {research_item_count} file(s)
@endif
@if(has_imports)
  Imports:    {imports_count} file(s)
@endif

  Actions:
  • Move discussion file to epic
@if(has_research)
  • Move research file(s) to epic
@endif
@if(has_imports)
  • Move import file(s) to epic
@endif
  • Register topic in epic manifest
  • Remove feature work unit and directory
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Proceed?
- **`y`/`yes`**
- **`n`/`no`**
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user chose `n`/`no`

→ Return to caller.

#### If user chose `y`/`yes`

→ Proceed to **G. Move Discussion**.

---

## G. Move Discussion

```bash
mkdir -p .workflows/{target_epic}/discussion/
```

```bash
mv .workflows/{selected.name}/discussion/{selected.name}.md .workflows/{target_epic}/discussion/{topic}.md
```

Register the discussion topic in the epic manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {target_epic}.discussion.{topic}
```

#### If `discussion_status` is `completed`

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {target_epic}.discussion.{topic} status completed
```

Index the discussion at its new location in the knowledge base:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index .workflows/{target_epic}/discussion/{topic}.md
```

If the index command fails, display the error but do not block — the artifact is already saved:

> *Output the next fenced block as a code block:*

```
⚑ Knowledge indexing warning
  {error details}
  The artifact is saved. Indexing can be retried later.
```

→ Proceed to **H. Move Research**.

#### Otherwise

→ Proceed to **H. Move Research**.

---

## H. Move Research

#### If `has_research` is `true`

For each item in `research_moves` (original_name → target_name):

```bash
mkdir -p .workflows/{target_epic}/research/
mv .workflows/{selected.name}/research/{original_name}.md .workflows/{target_epic}/research/{target_name}.md
```

Register in the epic manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {target_epic}.research.{target_name}
```

**If the original item status was `completed`:**

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {target_epic}.research.{target_name} status completed
```

Index the research at its new location in the knowledge base:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index .workflows/{target_epic}/research/{target_name}.md
```

If the index command fails, display the error but do not block — the artifact is already saved:

> *Output the next fenced block as a code block:*

```
⚑ Knowledge indexing warning
  {error details}
  The artifact is saved. Indexing can be retried later.
```

→ Proceed to **I. Move Imports**.

#### Otherwise

→ Proceed to **I. Move Imports**.

---

## I. Move Imports

#### If `has_imports` is `true`

Ensure the target imports directory exists:

```bash
mkdir -p .workflows/{target_epic}/imports/
```

For each item in `imports_moves` (original_filename → target_filename, with preserved `imported_at`):

```bash
mv .workflows/{selected.name}/imports/<original_filename> .workflows/{target_epic}/imports/<target_filename>
```

Push the entry into the target epic's `imports[]` manifest array, preserving the original timestamp:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {target_epic} imports '{"path":"imports/<target_filename>","imported_at":"<imported_at>"}'
```

Index the import at its new location in the knowledge base:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index .workflows/{target_epic}/imports/<target_filename>
```

If the index command fails, display the error but do not block — the file is already saved at its new location and tracked in the target manifest:

> *Output the next fenced block as a code block:*

```
⚑ Knowledge indexing warning
  {error details}
  The artifact is saved. Indexing can be retried later.
```

→ Proceed to **J. Register Inception Item**.

#### Otherwise

→ Proceed to **J. Register Inception Item**.

---

## J. Register Inception Item

The absorbed topic must exist in the target epic's discovery map. The map is built from `phases.inception.items` — without an inception entry, the topic is invisible to refinement, the continue-epic display, map-summary counts, and the dismissed-list flow.

Routing reflects the work already done on the feature. `summary` and `description` are left unset — `source` defaults to `inception` at render time, and the next `/continue-epic` entry will detect the missing fields and route to `summary-backfill.md` so the user can review derived values.

#### If `has_research` is `true`

Set `routing` to `research`:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {target_epic}.inception.{topic}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {target_epic}.inception.{topic} routing research
```

→ Proceed to **K. Cleanup**.

#### Otherwise

Set `routing` to `discussion`:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {target_epic}.inception.{topic}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {target_epic}.inception.{topic} routing discussion
```

→ Proceed to **K. Cleanup**.

---

## K. Cleanup

Remove the absorbed feature's chunks from the knowledge base (moved files were re-indexed under the epic):

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs remove --work-unit {selected.name}
```

If the remove command fails, display the error but do not block — the absorption itself is already recorded:

> *Output the next fenced block as a code block:*

```
⚑ Knowledge removal warning
  {error details}
  The feature is absorbed. You can run knowledge remove manually later.
```

Remove the feature from the project manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete project.work_units.{selected.name}
```

Remove the feature directory:

```bash
rm -rf .workflows/{selected.name}/
```

Commit: `workflow({selected.name}): absorb into {target_epic}`

→ Proceed to **L. Post-Absorption**.

---

## L. Post-Absorption

> *Output the next fenced block as a code block:*

```
Absorbed into Epic

  Topic "{topic:(titlecase)}" added to {target_epic:(titlecase)}.

  • Discussion: moved
@if(has_research)
  • Research: moved
@endif
@if(has_imports)
  • Imports: moved
@endif
  • Feature: removed
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**{selected.name:(titlecase)}** absorbed into **{target_epic:(titlecase)}**.

- **`c`/`continue`** — Continue {target_epic:(titlecase)} as epic
- **`b`/`back`** — Return to previous view
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user chose `c`/`continue`

Invoke the `/continue-epic` skill.

**STOP.** Do not proceed — terminal condition.

#### If user chose `b`/`back`

→ Return to caller.

# Absorb Feature into Epic

*Reference for **[manage-work-unit](manage-work-unit.md)***

---

Merge a feature's discussion into an existing epic as a new topic, then remove the feature entirely.

## A. Select Target Epic

> *Output the next fenced block as markdown (not a code block):*

```
> This will move the feature's discussion and research into the
> selected epic as a new topic and delete the feature work unit.
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

→ Proceed to **E. Confirm**.

#### Otherwise

Set `has_research` = false.

→ Proceed to **E. Confirm**.

---

## E. Confirm

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

  Actions:
  • Move discussion file to epic
@if(has_research)
  • Move research file(s) to epic
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

→ Proceed to **F. Move Discussion**.

---

## F. Move Discussion

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

→ Proceed to **G. Move Research**.

#### Otherwise

→ Proceed to **G. Move Research**.

---

## G. Move Research

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

→ Proceed to **H. Cleanup**.

#### Otherwise

→ Proceed to **H. Cleanup**.

---

## H. Cleanup

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

→ Proceed to **I. Post-Absorption**.

---

## I. Post-Absorption

> *Output the next fenced block as a code block:*

```
Absorbed into Epic

  Topic "{topic:(titlecase)}" added to {target_epic:(titlecase)}.

  • Discussion: moved
@if(has_research)
  • Research: moved
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

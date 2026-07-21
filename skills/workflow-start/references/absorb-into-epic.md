# Absorb Feature into Epic

*Reference for **[manage-work-unit](manage-work-unit.md)***

---

Merge a feature's discussion into an existing epic as a new topic, then remove the feature entirely. This reference owns the judgment — which epic, what topic name, the user's confirmation; the engine transaction (`workunit absorb`) owns the mechanical tail.

## A. Select Target Epic

> *Output the next fenced block as markdown (not a code block):*

```
> This will move the feature's discussion, research, seed, and imports
> into the selected epic as a new topic and delete the feature work unit.
> Git history serves as provenance.
```

Emit the `MENU: absorb target` section from the caller's `manage {selected.name}` snapshot verbatim as markdown (not a code block). Its numbering follows the snapshot's `available_epics` order.

**STOP.** Wait for user response.

#### If user chose `b`/`back`

→ Return to caller.

#### If user chose a number

Resolve the number against `available_epics` and store the selected epic as `target_epic`.

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
node .claude/skills/workflow-engine/scripts/engine.cjs manifest exists {target_epic}.discussion.{topic}
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

Read the feature's manifest once as a full dump — sections D, E, and F all derive their values from this single read:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {selected.name}
```

Take the feature's research items from `phases.research.items`.

#### If there are no research items

Set `has_research` = false.

→ Proceed to **E. Imports and Seeds Check**.

#### Otherwise

Set `has_research` = true and `research_item_count` to the number of items. Name collisions in the target epic are resolved by the engine (suffixing `-{selected.name}`).

→ Proceed to **E. Imports and Seeds Check**.

---

## E. Imports and Seeds Check

Take the top-level `imports` and `seeds` arrays from the manifest dump.

Default `has_imports` = `false` / `imports_count` = 0, and `has_seeds` = `false` / `seeds_count` = 0 — then, for each non-empty JSON array, set the flag `true` and the count to its length. Filename collisions in the target epic's directories are resolved by the engine; entries move with their original timestamps and seed provenance.

→ Proceed to **F. Confirm**.

---

## F. Confirm

Take the discussion item's status (`phases.discussion.items.{selected.name}.status`) from the manifest dump. Store the result as `discussion_status`.

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
@if(has_seeds)
  Seed:       {seeds_count} file(s) (origin)
@endif
@if(has_imports)
  Imports:    {imports_count} file(s)
@endif

  Actions:
  • Move discussion file to epic
@if(has_research)
  • Move research file(s) to epic
@endif
@if(has_seeds)
  • Move seed file(s) to epic
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

→ Proceed to **G. Absorb**.

---

## G. Absorb

One engine transaction moves the discussion (and any research, imports, and seeds) into the epic, mirrors each item's status, registers the topic on the discovery map (`--backfill` — the next `/workflow-continue-epic` entry routes to `summary-backfill.md` so the user can review derived values), syncs the knowledge base, deletes the feature, and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit absorb {selected.name} --into {target_epic} --topic {topic}
```

The JSON response reports what moved (`discussion`, `research`, `imports`, `seeds` — research topics may carry a collision suffix), `routing`, `committed`, and `warnings`.

#### If the command failed

The refusal names the blocking condition; nothing was touched — relay the error.

**If the error is a topic-name collision:**

→ Return to **B. Name Topic**.

**Otherwise:**

→ Return to caller.

→ Proceed to **H. Post-Absorption**.

---

## H. Post-Absorption

Emit the response's `DISPLAY: kb warning` section when present, then its `DISPLAY: confirmation` section — each verbatim per its marker.

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

Invoke the `/workflow-continue-epic` skill.

**STOP.** Do not proceed — terminal condition.

#### If user chose `b`/`back`

→ Return to caller.

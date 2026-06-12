# Epic State Display and Menu

*Reference for **[workflow-continue-epic](../SKILL.md)***

---

Display the full phase-by-phase breakdown for the selected epic, then present an interactive menu of actionable items. The caller is responsible for providing:
- `work_unit` — the epic's work unit name
- `new_arrivals` (optional) — tracker from `topic-discovery.md` listing topic names added during this boot-up, per analysis. Drives the "new topics added" callout above the Discovery Map. Empty / absent means no callout.

This reference collects the user's selection and returns control to the caller. The caller decides what to do with the selection (invoke a skill directly, enter plan mode, etc.). Sections D–F additionally read per-item state (statuses, completed, cancelled) from the most recent labelled discovery output in context.

---

## A. State Display and Menu

Render the epic snapshot:

```bash
node .claude/skills/workflow-continue-epic/scripts/discovery.cjs view {work_unit}
```

When `new_arrivals` has any names, pass the tracker as a JSON argument instead:

```bash
node .claude/skills/workflow-continue-epic/scripts/discovery.cjs view {work_unit} '{"research_analysis":["{topic}", "{topic}"],"gap_analysis":[]}'
```

The output is one snapshot in three demarcated sections:

- **DATA** — reasoning surface: state flags, `phase_counts` (in-progress / proposed / total per phase), and the `ACTIONS` table — one line per menu key, `key  action  topic  → route`, with `(recommended)` / `(blocked: …)` markers. Reason from it; never display or restate it.
- **DISPLAY** — the dashboard and key. Emit verbatim as a code block. Never redraw, reflow, or trim it.
- **MENU** — the selection menu. Emit verbatim as markdown (not a code block).

Emit the DISPLAY section, then the MENU section. A section is everything beneath its `===` marker up to the next marker — the marker lines themselves are never emitted.

**STOP.** Wait for user response.

→ Proceed to **B. Handle Selection**.

---

## B. Handle Selection

Match the user's input to its `ACTIONS` entry by `key` — a number, or a command option's letter / long form. Every decision below reads the entry's `action` value, never its label text.

#### If the selected entry carries a `(blocked: …)` marker

The item is shown for visibility but not selectable. Explain what blocks it, using the marker's `{dep}:{task} — {reason}` detail:

> *Output the next fenced block as a code block:*

```
"{topic:(titlecase)}" cannot start implementation yet.

Blocking dependencies:
  • {dep_topic}:{internal_id} — {reason}
  • {dep_topic} — {reason}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`u`/`unblock`** — Mark a dependency as satisfied externally
- **`b`/`back`** — Return to menu
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If user chose `unblock`:**

Ask which dependency to mark as satisfied. Update via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.planning.{topic} external_dependencies.{dep_topic}.state satisfied_externally
```

Commit the change.

→ Return to **A. State Display and Menu**.

**If user chose `back`:**

→ Return to **A. State Display and Menu**.

#### If `action` is `view_map`

Load **[display-epic-map.md](display-epic-map.md)** and follow its instructions as written.

→ Return to **A. State Display and Menu**.

#### If `action` is `resume_completed`

→ Proceed to **D. Resume Completed**.

#### If `action` is `cancel_topic`

→ Proceed to **E. Cancel Topic**.

#### If `action` is `reactivate_topic`

→ Proceed to **F. Reactivate Topic**.

#### Otherwise

**Soft gate check** — before routing, check whether the selection conflicts with a phase-completion recommendation. Advisory, not blocking. Read the counts from `phase_counts` in DATA.

| Selected `action` | Condition | Gate message |
|-------------------|-----------|--------------|
| `start_discussion` · `start_discussion_after_research` · `continue_discussion` · `new_discussion` | research items exist with some in-progress | "{N} of {M} research topics still in-progress. Topic analysis works best with all research available." |
| `start_specification` · `continue_specification` · `analyze_discussions` | discussion items exist with some in-progress | "{N} of {M} discussions still in-progress. Grouping analysis works best with all discussions available." |
| `start_planning` · `continue_planning` | specification items exist with some in-progress or proposed | "{N} of {M} specifications not yet completed. Completing all specifications first helps identify cross-cutting dependencies." |
| `start_implementation` · `continue_implementation` | planning items exist with some in-progress | "{N} of {M} plans still in-progress. Task dependencies across plans may be missed." |

**If a soft gate condition matches:**

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
{Gate message}

The system will re-analyse if you revisit later — proceeding
now is safe, but may require rework.

- **`y`/`yes`** — Proceed anyway
- **`b`/`back`** — Return to menu
· · · · · · · · · · · ·
```

Gate messages are self-contained first lines. Compose the count prefix into the message (e.g., "3 of 5 research topics still in-progress. Topic analysis works best with all research available.").

**STOP.** Wait for user response.

**If user chose `back`:**

→ Return to **A. State Display and Menu**.

**If user chose `yes`:**

→ Proceed to **C. Route Selection**.

**If no soft gate condition matches:**

→ Proceed to **C. Route Selection**.

---

## C. Route Selection

Store the selected entry's `action`, `topic`, and `route`. The route is the exact skill invocation for this selection (e.g. `/workflow-discussion-entry epic {work_unit} {topic}`). Entries with route `(internal)` never reach this section — their flows resolve in **B. Handle Selection**.

→ Return to caller.

---

## D. Resume Completed

Display all completed items across all phases and let the user select one to resume.

Using the `completed` items from discovery output, group by phase:

> *Output the next fenced block as a code block:*

```
Completed Topics

@foreach(phase in phases)
@if(phase.completed_items)
  {phase:(titlecase)}
@foreach(item in completed where item.phase == phase)
    └─ {item.name:(titlecase)} [completed]
@endforeach
@endif

@endforeach
```

Only show phases with completed items. Blank line between phase sections.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which topic would you like to resume?

- **`1`** — Resume "{item.name:(titlecase)}" — {item.phase}
- **`2`** — ...
- **`b`/`back`** — Return to menu

Select an option:
· · · · · · · · · · · ·
```

List all completed items across all phases.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If user chose a topic

Store the selected phase and topic. The route is `/workflow-{phase}-entry epic {work_unit} {topic}`.

→ Return to caller.

---

## E. Cancel Topic

Display all non-cancelled, non-promoted items across all phases, grouped by phase.

> *Output the next fenced block as a code block:*

```
Cancellable Topics

@foreach(phase in phases)
@if(phase has non-cancelled, non-promoted items)
  {phase:(titlecase)}
@foreach(item in phase.items where status != cancelled and status != promoted)
    {N}. {item.name:(titlecase)} [{item.status}]
@endforeach
@endif

@endforeach
```

Number all items sequentially across all phases. Only show phases with cancellable items. Blank line between phase sections.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which topic would you like to cancel?

- **`1`** — Cancel "{item_1.name:(titlecase)}" — {item_1.phase} [{item_1.status}]
- **`2`** — ...
- **`b`/`back`** — Return to menu

Select an option:
· · · · · · · · · · · ·
```

Recreate with actual items from discovery.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If user chose a numbered topic

Confirm with the user:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Cancel "{topic:(titlecase)}" in {phase}? This will mark it as
cancelled. You can reactivate it later.

- **`y`/`yes`** — Confirm cancellation
- **`n`/`no`** — Return to menu
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If user chose `no`:**

→ Return to **A. State Display and Menu**.

**If user chose `yes`:**

Run two manifest CLI calls to set cancelled status and preserve previous status:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.{phase}.{topic} previous_status {current_status}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.{phase}.{topic} status cancelled
```

Drop the topic's discovery-map order so reactivation renumbers it cleanly:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.discovery.{topic} order
```

Remove the cancelled topic's chunks from the knowledge base:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs remove --work-unit {work_unit} --phase {phase} --topic {topic}
```

If the remove command fails, display the error but do not block — the cancellation is already recorded:

> *Output the next fenced block as a code block:*

```
⚑ Knowledge removal warning
  {error details}
  The topic is cancelled. You can run knowledge remove manually later.
```

Commit the change.

> *Output the next fenced block as a code block:*

```
Cancelled "{topic:(titlecase)}" in {phase}.
```

→ Return to **A. State Display and Menu**.

---

## F. Reactivate Topic

Display all cancelled items across all phases, grouped by phase.

> *Output the next fenced block as a code block:*

```
Cancelled Topics

@foreach(phase in phases)
@if(phase has cancelled items)
  {phase:(titlecase)}
@foreach(item in phase.items where status == cancelled)
    {N}. {item.name:(titlecase)} [cancelled] (was: {item.previous_status})
@endforeach
@endif

@endforeach
```

Number all items sequentially across all phases. Only show phases with cancelled items. Blank line between phase sections.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which topic would you like to reactivate?

- **`1`** — Reactivate "{item_1.name:(titlecase)}" — {item_1.phase} (was: {item_1.previous_status})
- **`2`** — ...
- **`b`/`back`** — Return to menu

Select an option:
· · · · · · · · · · · ·
```

Recreate with actual items from discovery.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If user chose a numbered topic

Read the `previous_status` via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.{phase}.{topic} previous_status
```

Use the returned value as `{previous_status}` in the next two commands to restore the original status and remove the `previous_status` field:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.{phase}.{topic} status {previous_status}
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.{phase}.{topic} previous_status
```

**If `previous_status` is `completed` and `phase` is one of the indexed phases (research / discussion / investigation / specification):**

Re-index the reactivated topic's artifact into the knowledge base. Resolve the artifact path by phase:
- research: `.workflows/{work_unit}/research/{topic}.md`
- discussion: `.workflows/{work_unit}/discussion/{topic}.md`
- investigation: `.workflows/{work_unit}/investigation/{topic}.md`
- specification: `.workflows/{work_unit}/specification/{topic}/specification.md`

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index {artifact_path}
```

If the index command fails, display the error but do not block — the reactivation is already recorded:

> *Output the next fenced block as a code block:*

```
⚑ Knowledge indexing warning
  {error details}
  The artifact is saved. Indexing can be retried later.
```

Commit the change.

> *Output the next fenced block as a code block:*

```
Reactivated "{topic:(titlecase)}" in {phase}. Status restored to {previous_status}.
```

→ Return to **A. State Display and Menu**.

# Check Dependencies

*Reference for **[validate-dependencies](validate-dependencies.md)***

---

## A. Evaluate Dependencies

Query the external dependencies:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} external_dependencies
```

Evaluate each dependency and collect any that are blocking into a list:

- **`state: satisfied_externally`** — skip, not blocking
- **`state: unresolved`** — add to the blocking list
- **`state: resolved`** — check the dependency topic's implementation status:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.implementation.{dep_topic} status
```

**If status is `completed`:**

Skip, not blocking. A completed implementation satisfies the dependency even if the referenced task was skipped.

**If status is not `completed` or the implementation entry does not exist:**

Read the referenced task's status from the dependency's plan. Read the dep plan's `format` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{dep_topic} format`), load the format's **reading.md** (`../workflow-planning-process/references/output-formats/{format}/reading.md`), and look up the task by `internal_id` — resolving to its external ID via `node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{dep_topic} task_map.{internal_id}` when the format needs one.

- Task status is the format's completed status → skip, not blocking.
- Any other status (open, in-progress, skipped/cancelled), or no plan or task found → add to the blocking list. A skipped or cancelled task does not satisfy a dependency while its implementation is still in progress.

---

#### If the blocking list is empty

> *Output the next fenced block as a code block:*

```
External dependencies satisfied.
```

→ Return to caller.

#### If the blocking list has entries

→ Proceed to **B. Present Blocking Dependencies**.

---

## B. Present Blocking Dependencies

> *Output the next fenced block as a code block:*

```
Missing Dependencies

@foreach(dep in blocking_list where state is unresolved)
  {dep_topic:(titlecase)}
  ├─ {description}
  └─ No plan exists

@endforeach
@foreach(dep in blocking_list where state is resolved)
  {dep_topic:(titlecase)}
  ├─ {description}
  └─ Waiting on {topic}:{internal_id}

@endforeach
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
How would you like to proceed?

- **`s`/`satisfied`** — Mark a dependency as satisfied externally
- **`i`/`implement`** — Exit to implement blocking dependencies first
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `satisfied`:**

→ Proceed to **C. Select Dependency**.

**If `implement`:**

> *Output the next fenced block as a code block:*

```
Implementation Paused

"{topic:(titlecase)}" is blocked until these dependencies are resolved.
Use /workflow-start to navigate to the blocking work.
```

**STOP.** Do not proceed — terminal condition.

---

## C. Select Dependency

**If only one dependency in the blocking list:**

> *Output the next fenced block as a code block:*

```
Automatically proceeding with "{dep_topic:(titlecase)}".
```

Set `selected_topic` = `{dep_topic}`.

→ Proceed to **D. Mark as Satisfied**.

**If multiple dependencies in the blocking list:**

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which dependency has been satisfied?

- **`1`** — {dep_topic:(titlecase)} — {description}
- **`2`** — ...

Select an option:
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

Set `selected_topic` = the chosen dependency's topic.

→ Proceed to **D. Mark as Satisfied**.

---

## D. Mark as Satisfied

Update the selected dependency's state via `engine manifest`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} external_dependencies.{selected_topic}.state satisfied_externally
```

Commit: `impl({work_unit}): mark {selected_topic} dependency as satisfied externally`

→ Return to **A. Evaluate Dependencies**.


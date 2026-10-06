# Check Dependencies

*Reference for **[workflow-implementation-process](../SKILL.md)***

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

Read the referenced task's status from the dependency's plan. Read the dep plan's `format` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{dep_topic} format`), load the format's **reading.md** (`../../workflow-planning-process/references/output-formats/{format}/reading.md`), and look up the task by `internal_id` — resolving to its external ID via `node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{dep_topic} task_map.{internal_id}` when the format needs one.

- Task status is the format's completed status → skip, not blocking.
- Any other status (open, in-progress, skipped/cancelled), or no plan or task found → add to the blocking list. A skipped or cancelled task does not satisfy a dependency while its implementation is still in progress.

---

#### If the blocking list is empty

> *Output the next fenced block as a text code block (```text fence):*

```text
External dependencies satisfied.
```

→ Return to caller.

#### If the blocking list has entries

→ Proceed to **B. Present Blocking Dependencies**.

---

## B. Present Blocking Dependencies

Set `blocking_topics` = the blocking list's dependency topics, comma-separated, in the order they should be offered. The surface reads each one's description and state from the plan's `external_dependencies`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render external-dependency-gate {work_unit}.planning.{topic} --variant blocking --blocking {blocking_topics}
```

Emit the call's DISPLAY and MENU sections verbatim per their markers.

**STOP.** Wait for user response.

**If `satisfied`:**

→ Proceed to **C. Select Dependency**.

**If `implement`:**

> *Output the next fenced block as a properties code block (```properties fence):*

```properties
⚑ "{topic:(titlecase)}" is blocked until these dependencies are resolved
```

> *Output the next fenced block as markdown (not a code block):*

```
> Use /workflow-start to navigate to the blocking work.
```

**STOP.** Do not proceed — terminal condition.

---

## C. Select Dependency

**If only one dependency in the blocking list:**

> *Output the next fenced block as a text code block (```text fence):*

```text
Automatically proceeding with "{dep_topic:(titlecase)}".
```

Set `selected_topic` = `{dep_topic}`.

→ Proceed to **D. Mark as Satisfied**.

**If multiple dependencies in the blocking list:**

Render the pick over `blocking_topics`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render external-dependency-gate {work_unit}.planning.{topic} --variant pick --blocking {blocking_topics}
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

The surface numbers the rows in `blocking_topics` order — set `selected_topic` to the picked row's topic.

→ Proceed to **D. Mark as Satisfied**.

---

## D. Mark as Satisfied

→ Load **[mark-dependency-satisfied.md](../../workflow-shared/references/mark-dependency-satisfied.md)** with work_unit = `{work_unit}`, topic = `{topic}`, dep = `{selected_topic}`.

→ On return, return to **A. Evaluate Dependencies**.


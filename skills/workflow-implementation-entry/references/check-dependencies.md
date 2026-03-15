# Check Dependencies

*Reference for **[validate-dependencies](validate-dependencies.md)***

---

## A. Evaluate Dependencies

Query the external dependencies:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} external_dependencies
```

Evaluate each dependency and collect any that are blocking into a list:

- **`state: satisfied_externally`** — skip, not blocking
- **`state: unresolved`** — add to the blocking list
- **`state: resolved`** — check whether the referenced task has been completed:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.implementation.{dep_topic} completed_tasks
```

**If `internal_id` is in the completed tasks list:**

Skip, not blocking.

**If `internal_id` is not in the list, or the implementation entry does not exist:**

Add to the blocking list.

---

#### If the blocking list is empty

> *Output the next fenced block as a code block:*

```
External dependencies satisfied.
```

→ Return to **[the skill](../SKILL.md)**.

#### If the blocking list has entries

→ Proceed to **B. Present Blocking Dependencies**.

---

## B. Present Blocking Dependencies

> *Output the next fenced block as a code block:*

```
Missing Dependencies

@foreach(dep in blocking_list where state is unresolved)
  {dep_topic:(titlecase)}
  └─ {description}
  └─ No plan exists

@endforeach
@foreach(dep in blocking_list where state is resolved)
  {dep_topic:(titlecase)}
  └─ {description}
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

#### If `satisfied`

→ Proceed to **C. Mark Dependency as Satisfied**.

#### If `implement`

→ Proceed to **D. Exit to Implement**.

---

## C. Mark Dependency as Satisfied

**If only one dependency in the blocking list:**

> *Output the next fenced block as a code block:*

```
Automatically proceeding with "{dep_topic:(titlecase)}".
```

**If multiple dependencies in the blocking list:**

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which dependency has been satisfied?

1. {dep_topic:(titlecase)} — {description}
2. ...

Select an option (enter number):
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

---

Update the selected dependency's state via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} external_dependencies.{dep_topic}.state satisfied_externally
```

Commit: `impl({work_unit}): mark {dep_topic} dependency as satisfied externally`

→ Return to **A. Evaluate Dependencies** to re-check remaining dependencies.

---

## D. Exit to Implement

> *Output the next fenced block as a code block:*

```
Implementation Paused

"{topic:(titlecase)}" is blocked until these dependencies are resolved.
Use /workflow-start to navigate to the blocking work.
```

**STOP.** Do not proceed — terminal condition.

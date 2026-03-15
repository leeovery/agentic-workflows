# Check Dependencies

*Reference for **[validate-dependencies](validate-dependencies.md)***

---

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
- **`i`/`implement`** — Implement the blocking dependencies first
- **`s`/`satisfied`** — Mark a dependency as satisfied externally
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

---

## Escape Hatch

If the user says a dependency has been implemented outside the workflow:

1. Ask which dependency to mark as satisfied
2. Update the dependency's `state` to `satisfied_externally` via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} external_dependencies.{dep_topic}.state satisfied_externally
```

3. Commit the change
4. Re-check dependencies from the top of this reference

→ Return to **[the skill](../SKILL.md)**.

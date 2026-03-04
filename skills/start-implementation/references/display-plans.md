# Display Plans

*Reference for **[start-implementation](../SKILL.md)***

---

Present all discovered plans. Classify each plan into one of three categories based on its state.

**Classification logic:**

A plan is **Implementable** if:
- It has `status: concluded` AND all deps are satisfied (`deps_satisfied: true` or no deps) AND no implementation file or implementation `status: not-started`, OR
- It has an implementation file with `status: in-progress`

A plan is **Implemented** if:
- It has an implementation file with `status: completed`

A plan is **Not implementable** if:
- It has `status: concluded` but deps are NOT satisfied (blocking deps exist)
- It has `status: planning` or other non-concluded status
- It has unresolved deps (`has_unresolved_deps: true`)

**Present the full state:**

Show implementable and implemented plans as numbered tree items.

> *Output the next fenced block as a code block:*

```
Implementation Overview

{N} plans found. {M} implementations in progress.

1. {work_unit:(titlecase)}
   └─ Plan: {plan_status:[concluded]} ({format})
   └─ Implementation: @if(has_implementation) {impl_status:[in-progress|completed]} @else (not started) @endif

2. ...
```

**Tree rules:**

Implementable:
- Implementation `status: in-progress` → `Implementation: in-progress (Phase N, Task M)`
- Concluded plan, deps met, not started → `Implementation: (not started)`

Implemented:
- Implementation `status: completed` → `Implementation: completed`

**Ordering:**
1. Implementable first: in-progress, then new (foundational before dependent)
2. Implemented next: completed
3. Not implementable last (separate block below)

Numbering is sequential across Implementable and Implemented. Omit any section entirely if it has no entries.

**If non-implementable plans exist**, show them in a separate code block:

> *Output the next fenced block as a code block:*

```
Plans not ready for implementation:
These plans are either still in progress or have unresolved
dependencies that must be addressed first.

  • advanced-features (blocked by core-features:core-2-3)
  • reporting (in-progress)
```

> *Output the next fenced block as a code block:*

```
If a blocked dependency has been resolved outside this workflow,
name the plan and the dependency to unblock it.
```

**Key/Legend** — show only statuses that appear in the current display. No `---` separator before this section.

> *Output the next fenced block as a code block:*

```
Key:

  Implementation status:
    in-progress — work is ongoing
    completed   — all tasks implemented

  Blocking reason:
    blocked     — depends on another plan's task
    in-progress — plan not yet concluded
```

---

## Selection

**If single implementable plan and no implemented plans (auto-select):**

> *Output the next fenced block as a code block:*

```
Automatically proceeding with "{work_unit:(titlecase)}".
```

→ Return to **[the skill](../SKILL.md)**.

**If nothing selectable (no implementable or implemented):**

Show "not ready" block only (with unblock hint above).

> *Output the next fenced block as a code block:*

```
Implementation Overview

No implementable plans found.

Complete blocking dependencies first, or finish plans still
in progress with /start-planning. Then re-run /start-implementation.
```

**STOP.** Do not proceed — terminal condition.

**If multiple selectable plans (or implemented plans exist):**

The verb in the menu depends on the implementation state:
- Implementation in-progress → **Continue**
- Not yet started → **Start**
- Completed → **Re-review**

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
1. Continue "Billing" — in-progress (Phase 2, Task 3)
2. Start "Core Features" — not yet started
3. Re-review "User Auth" — completed

Select an option (enter number):
· · · · · · · · · · · ·
```

Recreate with actual work unit names and states from discovery.

**STOP.** Wait for user response.

---

## Unblock Request

#### If the user requests an unblock

1. Identify the plan and the specific dependency
2. Confirm with the user which dependency to mark as satisfied
3. Update the dependency's `state` to `satisfied_externally` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase planning --topic {topic} external_dependencies.{dep-topic}.state satisfied_externally`)
4. Commit the change
5. Re-run classification and re-present this display

→ Return to **[the skill](../SKILL.md)** with selected work unit.

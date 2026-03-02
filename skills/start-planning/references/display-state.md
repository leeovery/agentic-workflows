# Display State and Options

*Reference for **[start-planning](../SKILL.md)***

---

Present everything discovered to help the user make an informed choice.

**Actionable vs. non-actionable:**

A specification is **actionable** for planning if:
- It is a feature spec (not cross-cutting)
- Its status is `concluded`
- It does NOT have `impl_status: completed` (already fully implemented)

Specs with `impl_status: completed` have finished the full workflow and should not be offered for planning work.

**Present the full state:**

> *Output the next fenced block as a code block:*

```
Planning Overview

{N} specifications found. {M} plans exist.

1. {work_unit:(titlecase)}
   └─ Plan: @if(has_plan) {plan_status:[in-progress|concluded]} @else (no plan) @endif
   └─ Spec: concluded
   @if(has_impl && impl_status != completed) └─ Impl: {impl_status} @endif

2. ...
```

**Tree rules:**

Each numbered item shows a feature specification that is **actionable** (not fully implemented):
- Concluded spec with no plan → `Plan: (no plan)`
- Has a plan with `plan_status: planning` → `Plan: in-progress`
- Has a plan with `plan_status: concluded` → `Plan: concluded`
- Has implementation tracking (but not completed) → show `Impl: {impl_status}`

Do NOT include specs with `impl_status: completed` in the numbered list — they go in the "Completed specifications" section.

**If completed specifications exist** (impl_status: completed), show them in a separate code block:

> *Output the next fenced block as a code block:*

```
Completed specifications:
These specifications have been fully implemented.

  • {work_unit} (implementation completed)
```

**If non-plannable specifications exist**, show them in a separate code block:

> *Output the next fenced block as a code block:*

```
Specifications not ready for planning:
These specifications are either still in progress or cross-cutting
and cannot be planned directly.

  • {work_unit} ({type:[feature|cross-cutting]}, {status:[in-progress|concluded]})
```

**Key/Legend** — show only statuses that appear in the current display. No `---` separator before this section.

> *Output the next fenced block as a code block:*

```
Key:

  Plan status:
    in-progress — planning work is ongoing
    concluded   — plan is complete

  Impl status:
    in-progress — implementation work is ongoing
    completed   — implementation is finished

  Spec type:
    cross-cutting — architectural policy, not directly plannable
    feature       — plannable feature specification
```

Omit any section entirely if it has no entries.

**Then prompt based on what's actionable:**

**If multiple actionable items:**

The verb in the menu depends on the plan state:
- No plan exists → **Create**
- Plan is `in-progress` → **Continue**
- Plan is `concluded` → **Review**

Do NOT include specs with `impl_status: completed` in the menu.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
1. Create "Auth Flow" — concluded spec, no plan
2. Continue "Data Model" — plan in-progress
3. Review "Billing" — plan concluded

Select an option (enter number):
· · · · · · · · · · · ·
```

Recreate with actual work units and states from discovery.

**STOP.** Wait for user response.

**If single actionable item (auto-select):**

> *Output the next fenced block as a code block:*

```
Automatically proceeding with "{work_unit:(titlecase)}".
```

**If nothing actionable:**

> *Output the next fenced block as a code block:*

```
Planning Overview

No plannable specifications found.

The planning phase requires a concluded feature specification.
Complete any in-progress specifications with /start-specification,
or create a new specification first.
```

**STOP.** Do not proceed — terminal condition.

# Display Plans

*Reference for **[start-review](../SKILL.md)***

---

Present all discovered plans with implementation status to help the user understand what's reviewable.

**Present the full state:**

Show reviewable plans as numbered tree items.

> *Output the next fenced block as a code block:*

```
Review Overview

{N} plans found. {M} with implementations.

1. {work_unit:(titlecase)}
   └─ Plan: concluded ({format})
   └─ Implementation: {impl_status:[completed|in-progress]}
   └─ Spec: {spec:[exists|missing]}
   └─ Review: @if(review_count > 0) x{review_count} — r{latest_review_version} ({latest_review_verdict}) @else (no review) @endif

2. ...
```

**Tree rules:**

Reviewable (numbered):
- Implementation `status: completed` → `Implementation: completed`
- Implementation `status: in-progress` → `Implementation: in-progress`

Omit any section entirely if it has no entries.

**If non-reviewable plans exist**, show them in a separate code block:

> *Output the next fenced block as a code block:*

```
Plans not ready for review:
These plans have no implementation to review.

  • {work_unit} (no implementation)
```

**Key/Legend** — show only statuses that appear in the current display. No `---` separator before this section.

> *Output the next fenced block as a code block:*

```
Key:

  Implementation status:
    completed   — all tasks implemented
    in-progress — implementation still ongoing

  Review status:
    x{N}        — number of reviews completed
    (no review) — not yet reviewed
```

**Then route based on what's reviewable:**

#### If no reviewable plans

> *Output the next fenced block as a code block:*

```
Review Overview

No implemented plans found.

The review phase requires at least one plan with an implementation.
Run /start-implementation first.
```

**STOP.** Do not proceed — terminal condition.

#### If single reviewable plan

> *Output the next fenced block as a code block:*

```
Automatically proceeding with "{work_unit:(titlecase)}".
Scope: single
```

→ Return to **[the skill](../SKILL.md)** for **Step 8**.

#### If multiple reviewable plans

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
What would you like to do?

- **`s`/`single`** — Review one plan's implementation
- **`m`/`multi`** — Review selected plans
- **`a`/`all`** — Review all implemented plans
@if(has_any_review) - **`analysis`** — Synthesize findings from existing reviews into tasks @endif

Select an option:
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

→ Return to **[the skill](../SKILL.md)** for **Step 7**.

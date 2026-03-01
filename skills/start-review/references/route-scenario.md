# Route Based on Scenario

*Reference for **[start-review](../SKILL.md)***

---

Discovery mode — use the discovery output from Step 1.

Use `state.scenario` from the discovery output to determine the path:

#### If scenario is `no_plans`

No plans exist yet.

> *Output the next fenced block as a code block:*

```
Review Overview

No plans found in .workflows/planning/

The review phase requires a completed implementation based on a plan.
Run /start-planning first to create a plan, then /start-implementation
to build it.
```

**STOP.** Do not proceed — terminal condition.

#### If all_reviewed is true

All implemented plans have been reviewed.

> *Output the next fenced block as a code block:*

```
Review Overview

All {N} implemented plans have been reviewed.

1. {topic:(titlecase)}
   └─ Review: x{review_count} — r{latest_review_version} ({latest_review_verdict})
   └─ Synthesis: @if(has_synthesis) completed @else pending @endif

2. ...
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
All plans have been reviewed.

- **`a`/`analysis`** — Synthesize findings from existing reviews into tasks
- **`r`/`re-review`** — Re-review a plan (creates new review version)

Select an option:
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If analysis:**

→ Return to **[the skill](../SKILL.md)** for **Step 8**.

**If re-review:**

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

#### If scenario is `single_plan` or `multiple_plans`

Plans exist (some may have reviews, some may not).

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

# Initialize Review

*Reference for **[workflow-review-process](../SKILL.md)***

---

## A. Register Phase

Check if review phase is registered in manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.review.{topic}
```

#### If `false`

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js init-phase {work_unit}.review.{topic}
```

→ Proceed to **B. Determine Review Mode**.

#### Otherwise

Phase already registered (e.g. reopened review).

→ Proceed to **B. Determine Review Mode**.

---

## B. Determine Review Mode

Read `completed_tasks` via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.implementation.{topic} completed_tasks
```

Check if `reviewed_tasks` exists:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.review.{topic} reviewed_tasks
```

#### If `reviewed_tasks` does not exist

Set `review_mode` = `full`.

→ Return to **[the skill](../SKILL.md)** for **Step 2**.

#### If `reviewed_tasks` exists

Read `reviewed_tasks`:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.review.{topic} reviewed_tasks
```

Compare `completed_tasks` against `reviewed_tasks`. Any internal ID in `completed_tasks` but not in `reviewed_tasks` is unreviewed.

**If all tasks reviewed and report exists** at `.workflows/{work_unit}/review/{topic}/report.md`:

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

**If all tasks reviewed and no report:**

→ Return to **[the skill](../SKILL.md)** for **Step 5**.

**If unreviewed tasks remain:**

> *Output the next fenced block as a code block:*

```
New Implementation Detected

Review covered {R} of {C} tasks. {U} task(s) not yet reviewed.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Review mode?

- **`i`/`incremental`** — Review only new tasks ({U} tasks)
- **`f`/`full`** — Re-review all tasks
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `incremental`

Set `review_mode` = `incremental` and `unreviewed_tasks` = `[{list of unreviewed internal IDs}]`.

→ Return to **[the skill](../SKILL.md)** for **Step 2**.

#### If `full`

Set `review_mode` = `full`.

→ Return to **[the skill](../SKILL.md)** for **Step 2**.

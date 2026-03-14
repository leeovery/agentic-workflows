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

Check if the review file exists at `.workflows/{work_unit}/review/{topic}/report.md`.

#### If no review file exists

Set `review_mode` = `full`.

→ Return to **[the skill](../SKILL.md)**.

#### If review file exists

Read task lists to determine scope:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.implementation.{topic} completed_tasks
```

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.review.{topic} reviewed_tasks
```

**If `reviewed_tasks` does not exist:**

Set `review_mode` = `full`.

→ Return to **[the skill](../SKILL.md)**.

Read `reviewed_tasks` (now known to exist):

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.review.{topic} reviewed_tasks
```

Compare `completed_tasks` against `reviewed_tasks`. Any internal ID in `completed_tasks` but not in `reviewed_tasks` is unreviewed.

**If no unreviewed tasks (arrays match):**

> *Output the next fenced block as a code block:*

```
Reopening review: {topic:(titlecase)}

All tasks have been reviewed. Starting a full re-review.
```

Clear prior review data:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js delete {work_unit}.review.{topic} reviewed_tasks
```

```bash
rm .workflows/{work_unit}/review/{topic}/report-*.md
```

Commit: `review({work_unit}): clear review data for full re-review`

Set `review_mode` = `full`.

→ Return to **[the skill](../SKILL.md)**.

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

→ Return to **[the skill](../SKILL.md)**.

#### If `full`

Clear prior review data:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js delete {work_unit}.review.{topic} reviewed_tasks
```

```bash
rm .workflows/{work_unit}/review/{topic}/report-*.md
```

Commit: `review({work_unit}): clear review data for full re-review`

Set `review_mode` = `full`.

→ Return to **[the skill](../SKILL.md)**.

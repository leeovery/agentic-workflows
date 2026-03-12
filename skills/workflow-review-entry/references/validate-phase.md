# Validate Phase

*Reference for **[workflow-review-entry](../SKILL.md)***

---

Check if plan and implementation exist and are ready via manifest CLI.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase planning --topic {topic} status
```

#### If plan doesn't exist

> *Output the next fenced block as a code block:*

```
Plan Missing

No plan found for "{topic:(titlecase)}".

A completed plan and completed implementation are required for review.
```

**STOP.** Do not proceed — terminal condition.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase implementation --topic {topic} status
```

#### If implementation doesn't exist

> *Output the next fenced block as a code block:*

```
Implementation Missing

No implementation found for "{topic:(titlecase)}".

A completed implementation is required for review.
```

**STOP.** Do not proceed — terminal condition.

#### If implementation status is not `completed`

> *Output the next fenced block as a code block:*

```
Implementation Not Complete

The implementation for "{topic:(titlecase)}" is not yet completed.
```

**STOP.** Do not proceed — terminal condition.

#### If plan and implementation are both ready

Check if review phase entry exists:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit} --phase review --topic {topic}
```

**If not exists (`false`):**

Store `review_mode = full`. This is a new review.

→ Return to **[the skill](../SKILL.md)**.

**If exists (`true`):**

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase review --topic {topic} status
```

**If status is `completed`:**

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase review --topic {topic} status in-progress
```

→ Proceed to **Detect Incremental Review**.

**If status is `in-progress`:**

→ Proceed to **Detect Incremental Review**.

---

## Detect Incremental Review

The review phase exists from a prior session. Determine whether new tasks have been implemented since the last review.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase implementation --topic {topic} completed_tasks
```

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit} --phase review --topic {topic} reviewed_tasks
```

#### If `reviewed_tasks` does not exist

No prior review tracking. Store `review_mode = full`.

→ Return to **[the skill](../SKILL.md)**.

#### If `reviewed_tasks` exists

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase review --topic {topic} reviewed_tasks
```

Compare `completed_tasks` against `reviewed_tasks`. Any internal ID in `completed_tasks` but not in `reviewed_tasks` is unreviewed.

**If no unreviewed tasks** (arrays match):

> *Output the next fenced block as a code block:*

```
Reopening review: {topic:(titlecase)}

All tasks have been reviewed. Starting a full re-review.
```

Store `review_mode = full`.

Clear prior review data for a clean slate:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js delete {work_unit} --phase review --topic {topic} reviewed_tasks
```

```bash
rm .workflows/{work_unit}/review/{topic}/qa-task-*.md
```

→ Return to **[the skill](../SKILL.md)**.

**If unreviewed tasks exist:**

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

Store `review_mode = incremental` and `unreviewed_tasks = [{list of unreviewed internal IDs}]`.

→ Return to **[the skill](../SKILL.md)**.

#### If `full`

Store `review_mode = full`.

Clear prior review data for a clean slate:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js delete {work_unit} --phase review --topic {topic} reviewed_tasks
```

```bash
rm .workflows/{work_unit}/review/{topic}/qa-task-*.md
```

→ Return to **[the skill](../SKILL.md)**.

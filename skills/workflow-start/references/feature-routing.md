# Feature Routing

*Reference for **[workflow-start](../SKILL.md)***

---

Feature development is topic-centric. A single topic flows through the pipeline: Discussion → Specification → Planning → Implementation → Review. This reference shows in-progress features and offers options to continue or start new.

## Display Feature State

Using the discovery output, check if there are any features in progress.

#### If no features exist

> *Output the next fenced block as a code block:*

```
Features

No features in progress.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Ready to start a new feature.

- **`y`/`yes`** — Start a new feature
- **`n`/`no`** — Go back to work type selection
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

Invoke `start-feature`. It will set `work_type: feature` automatically.

#### If `no`

→ Return to **[the skill](../SKILL.md)** for **Step 2** (work type selection).

#### If features exist

> *Output the next fenced block as a code block:*

```
Features

{feature_count} feature(s) in progress:

1. {topic:(titlecase)}
   └─ {phase_label:(titlecase)}

2. ...
```

Build tree from `features.topics` array. Each topic shows `name` (titlecased) and `phase_label` (titlecased).

## Build Menu Options

Build a numbered menu with all in-progress features plus option to start new. Use `phase_label` from discovery for the description.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
What would you like to do?

1. Continue "Auth Flow" — discussion (in-progress)
2. Continue "Caching" — ready for specification
3. Continue "Notifications" — ready for planning
4. Start new feature

Select an option (enter number):
· · · · · · · · · · · ·
```

Recreate with actual topics and `phase_label` values from discovery.

**STOP.** Wait for user response.

## Route Based on Selection

Parse the user's selection, then follow the instructions below.

#### If `start new feature`

Invoke `/start-feature`. It will set `work_type: feature` automatically.

#### If continuing existing feature

Map `next_phase` to the appropriate skill:

| next_phase | Skill | Work Type | Topic |
|------------|-------|-----------|-------|
| discussion | `/start-discussion` | feature | {topic} |
| specification | `/start-specification` | feature | {topic} |
| planning | `/start-planning` | feature | {topic} |
| implementation | `/start-implementation` | feature | {topic} |
| review | `/start-review` | feature | {topic} |

Skills receive positional arguments: `$0` = work_type, `$1` = topic.

**Example**: `/start-specification feature {topic}` — skill skips discovery, validates topic, proceeds to processing.

Invoke the skill from the table with the work type and topic as positional arguments.

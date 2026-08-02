# Off-Topic Concern — Single-Topic Work

*Reference for **[discussion-session](discussion-session.md)** — loaded when an off-topic concern surfaces on a non-epic.*

---

The caller provides `work_type`, `work_unit`, `topic`, and the `concern` with its discussed context. The concern is already judged off-topic — single-topic work types have no sibling topic to route to, so it is preserved outside this discussion or noted and set aside.

#### If `work_type` is `feature`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**{concern}** is beyond this topic's scope.

- **`l`/`log`** — Capture it as an idea in the inbox for later
- **`p`/`pivot`** — Convert this work to an epic so it can hold the concern as its own topic
- **`i`/`ignore`** — Note it in the Summary and move on
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### Otherwise

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**{concern}** is beyond this topic's scope.

- **`l`/`log`** — Capture it as an idea in the inbox for later
- **`i`/`ignore`** — Note it in the Summary and move on
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `log`:**

Capture the concern via the `workflow-log-idea` skill so it lands in the inbox for later triage.

→ Return to caller for **B. Session Loop**.

**If `pivot`:**

1. Load **[pivot-to-epic.md](../../workflow-shared/references/pivot-to-epic.md)** with work_unit = `{work_unit}`. The work unit is now an epic (conversion committed) with this topic on its discovery map.

2. Derive `proposed_name` — a kebab-case topic name for the concern.

3. Judge `landing_phase` from the concern's nature (an open question needing exploration → `research`; a decision needing making → `discussion`), then load **[triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{proposed_name}`, concern = `{concern}`, origin = `{topic}`, phase = `discussion`, landing_phase = `{landing_phase}`, date = `{today}`. It validates the name against the map and, on a clash, prompts to pick another or cancel. If `result` is `cancelled`, the topic wasn't created — note the concern in the Summary so it isn't lost; otherwise the concern landed as the `{landed_topic}` topic and the delivery committed itself.

> *Output the next fenced block as markdown (not a code block):*

```
> This work is now an epic — continuing here with the current topic.
> The concern is preserved for its own handling later.
```

→ Return to caller for **B. Session Loop**.

**If `ignore`:**

Note the concern in the Summary section for the user to consider separately, and continue.

→ Return to caller for **B. Session Loop**.

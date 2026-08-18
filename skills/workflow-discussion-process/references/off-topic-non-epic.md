# Off-Topic Concern — Single-Topic Work

*Reference for **[discussion-session](discussion-session.md)** — loaded when an off-topic concern surfaces on a non-epic.*

---

The caller provides `work_type`, `work_unit`, `topic`, and the `concern` with its discussed context. The concern is already judged off-topic — single-topic work types have no sibling topic to route to, so it is preserved outside this discussion or noted and set aside.

Write the offer payload to `.workflows/.cache/{work_unit}/discussion/{topic}/off-topic-offer.json` with the Write tool (`{"concern": "…"}` — the concern's short title), then render it (the pivot row is derived from the work type; the discussion variant carries the roadmap park):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render off-topic-offer {work_unit}.discussion.{topic} --file .workflows/.cache/{work_unit}/discussion/{topic}/off-topic-offer.json --variant discussion
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

**If `log`:**

Capture the concern via the `workflow-log-idea` skill so it lands in the inbox for later triage.

→ Return to caller for **B. Session Loop**.

**If `roadmap`:**

Confirm the horizon in conversation (propose from the user's own staging words when they placed it; ask when they didn't), then park — the roadmap is born at the first park, and the verb validates and self-commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs roadmap add {name} --horizon {horizon} --summary "{one-liner}" --origin park:{work_unit} --source {work_unit}/discussion/{topic}.md
```

Note the park in the Summary so the discussion records where the concern went.

→ Return to caller for **B. Session Loop**.

**If `pivot`:**

1. Load **[pivot-to-epic.md](../../workflow-shared/references/pivot-to-epic.md)** with work_unit = `{work_unit}`. The work unit is now an epic (conversion committed) with this topic on its discovery map.

2. Derive `proposed_name` — a kebab-case topic name for the concern.

3. Judge `landing_phase` per **Judging the Landing Phase**, then load **[triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{proposed_name}`, concern = `{concern}`, origin = `{topic}`, phase = `discussion`, landing_phase = `{landing_phase}`, date = `{today}`. It validates the name against the map and, on a clash, prompts to pick another or cancel. If `result` is `cancelled`, the topic wasn't created — note the concern in the Summary so it isn't lost; otherwise the concern landed as the `{landed_topic}` topic and the delivery committed itself.

> *Output the next fenced block as markdown (not a code block):*

```
> This work is now an epic — continuing here with the current topic. The concern is preserved for its own handling later.
```

→ Return to caller for **B. Session Loop**.

**If `ignore`:**

Note the concern in the Summary section for the user to consider separately, and continue.

→ Return to caller for **B. Session Loop**.

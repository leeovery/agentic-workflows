# Feature Research Session

*Reference for **[workflow-research-process](../SKILL.md)***

---

## A. Background Agents

Two types of background agent operate during research, and the topic's triage queue surfaces through a third protocol file. Load their instructions now — they run at the appropriate moments during the session loop.

→ Load **[review-agent.md](review-agent.md)** and follow its instructions as written.

→ Load **[deep-dive-agent.md](deep-dive-agent.md)** and follow its instructions as written.

→ Load **[rerouted-concerns.md](../../workflow-shared/references/rerouted-concerns.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `research` — a protocol, not a step: the session loop's triage check enters its **A. Check**; nothing runs at load time.

---

## B. Session Loop

Focused, single-topic session. No splitting, no multi-file management.

→ Load **[session-loop.md](session-loop.md)** and follow its conversation process.

---

## C. Session Conclusion

When the topic feels well-explored or the user indicates they're done:

→ Proceed to **D. In-Flight Agent Handling**.

---

## D. In-Flight Agent Handling

Before concluding, check for in-flight agents — run `node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} research {topic}` and read the response's `in_flight` list (agents dispatched but not yet returned). An agent dispatched by an earlier session cannot still be running — each row's `created` timestamp tells you which those are; close each (`agent incorporate`), re-scan, and count only this session's.

#### If no agents are in flight

→ Load **[topic-completion.md](topic-completion.md)** and follow its instructions as written.

→ Return to **B. Session Loop**.

#### If agents are still running

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**`◆ There are still {N} background agents working.`**

**`w/wait`**    → Wait for results before concluding
**`p/proceed`** → Conclude now (results will persist in cache for reference)
```

**STOP.** Wait for user response.

**If `wait`:**

Watch for `agent scan` to promote each in-flight row to `pending`. When none remain in flight, delegate surfacing to the shared protocol loaded by review-agent.md and deep-dive-agent.md. The protocol applies the never-dump rules: two-phase surfacing, one finding at a time. Treat the current moment as a natural break — we are at phase conclusion, so the break check will pass.

→ Return to **B. Session Loop**.

**If `proceed`:**

→ Load **[topic-completion.md](topic-completion.md)** and follow its instructions as written.

→ Return to **B. Session Loop**.

---

## E. Off-Topic Concerns

When a concern surfaces that's beyond this topic's scope, a single-topic work type has no other topic to route it to.

Write the offer payload to `.workflows/.cache/{work_unit}/research/{topic}/off-topic-offer.json` with the Write tool (`{"concern": "…"}` — the concern's short title), then render it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render off-topic-offer {work_unit}.research.{topic} --file .workflows/.cache/{work_unit}/research/{topic}/off-topic-offer.json
```

Emit the call's MENU section verbatim per its marker. The pivot option is offered only for a feature — the surface derives that from the work type.

**STOP.** Wait for user response.

**If `log`:**

Capture the concern via the `workflow-log-idea` skill so it lands in the inbox for later triage.

→ Return to **B. Session Loop**.

**If `pivot`:**

1. Load **[pivot-to-epic.md](../../workflow-shared/references/pivot-to-epic.md)** with work_unit = `{work_unit}`. The work unit is now an epic (conversion committed) with this topic on its discovery map.

2. From the context you already have, derive two values: `proposed_name` — a kebab-case topic name for the concern; and `concern` — the concern with the full context discussed about it.

3. Judge `landing_phase` per **Judging the Landing Phase**, then load **[triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{proposed_name}`, concern = `{concern}`, origin = `{topic}`, phase = `research`, landing_phase = `{landing_phase}`, date = `{today}`. It validates the name against the map and, on a clash, prompts to pick another or cancel. If `result` is `cancelled`, the topic wasn't created — note the concern in the research file so it isn't lost; otherwise the concern landed as the `{landed_topic}` topic and the delivery committed itself.

> *Output the next fenced block as markdown (not a code block):*

```
> This work is now an epic — continuing here with the current topic. The concern is preserved for its own handling later.
```

→ Return to **B. Session Loop**.

**If `ignore`:**

Note the concern in the research file for the user to consider separately, and continue.

→ Return to **B. Session Loop**.

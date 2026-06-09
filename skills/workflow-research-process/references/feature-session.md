# Feature Research Session

*Reference for **[workflow-research-process](../SKILL.md)***

---

## A. Background Agents

Two types of background agent operate during research. Load their lifecycle instructions now — apply them at the appropriate moments during the session loop.

→ Load **[review-agent.md](review-agent.md)** and follow its instructions as written.

→ Load **[deep-dive-agent.md](deep-dive-agent.md)** and follow its instructions as written.

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

Before concluding, check for in-flight agents. Scan the cache directory for review or deep-dive files with `status: pending` in their frontmatter.

#### If no agents are in flight

→ Load **[topic-completion.md](topic-completion.md)** and follow its instructions as written.

→ Return to **B. Session Loop**.

#### If agents are still running

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
There are still {N} background agents working.

- **`w`/`wait`** — Wait for results before concluding
- **`p`/`proceed`** — Conclude now (results will persist in cache for reference)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `wait`:**

Check for agent completion. When all agents have returned, delegate surfacing to the shared protocol loaded by review-agent.md and deep-dive-agent.md. The protocol applies the never-dump rules: two-phase surfacing, one finding at a time. Treat the current moment as a natural break — we are at phase conclusion, so the break check will pass.

→ Return to **B. Session Loop**.

**If `proceed`:**

→ Load **[topic-completion.md](topic-completion.md)** and follow its instructions as written.

→ Return to **B. Session Loop**.

---

## E. Off-Topic Concerns

When a concern surfaces that's beyond this topic's scope, a single-topic work type has no other topic to route it to.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**{concern}** is beyond this topic's scope.

- **`l`/`log`** — Capture it as an idea in the inbox for later
@if(work_type == 'feature')
- **`p`/`pivot`** — Convert this work to an epic so it can hold the concern as its own topic
@endif
- **`i`/`ignore`** — Note it in the research file and move on
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `log`:**

Capture the concern via the `workflow-log-idea` skill so it lands in the inbox for later triage.

→ Return to **B. Session Loop**.

**If `pivot`:**

1. Load **[pivot-to-epic.md](../../workflow-shared/references/pivot-to-epic.md)** with work_unit = `{work_unit}`. The work unit is now an epic with this topic on its discovery map.

2. From the context you already have, derive two values: `proposed_name` — a kebab-case topic name for the concern; and `concern` — the concern with the full context discussed about it.

3. Load **[triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{proposed_name}`, concern = `{concern}`, origin = `{topic}`, phase = `research`, date = `{today}`. It validates the name against the map and, on a clash, prompts to pick another or cancel. If `result` is `cancelled`, the topic wasn't created — note the concern in the research file so it isn't lost; otherwise the concern landed as the `{landed_topic}` topic.

4. Commit the conversion and the landing:

   ```bash
   git add -- .workflows/{work_unit}/
   git commit -m "research({work_unit}/{topic}): pivot to epic"
   ```

> *Output the next fenced block as markdown (not a code block):*

```
> This work is now an epic — continuing here with the current topic.
> The concern is preserved for its own handling later.
```

→ Return to **B. Session Loop**.

**If `ignore`:**

Note the concern in the research file for the user to consider separately, and continue.

→ Return to **B. Session Loop**.

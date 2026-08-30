# Experiment Session

*Reference for **[workflow-experiment-process](../SKILL.md)***

---

## A. Protocols

The topic's triage queue and the walk of one experiment each live in a protocol file. Load their instructions now — they run at the appropriate moments during the session loop.

→ Load **[experiment-walk.md](experiment-walk.md)** and follow its instructions as written.

→ Load **[rerouted-concerns.md](../../workflow-shared/references/rerouted-concerns.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `experiment` — a protocol, not a step: the session loop's triage check enters its **A. Check**; nothing runs at load time.

---

## B. The Register

Every session opens on the series register — where each experiment stands, conceived to verdict. Render it and emit its DISPLAY section verbatim per its marker (the surface renders a none-yet line before E1 exists, so a fresh series needs no branch):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render experiment-register {work_unit}.experiment.{topic}
```

→ Proceed to **C. Session Loop**.

---

## C. Session Loop

The session's cadence — not a rigid checklist:

1. **Check for concerns** — follow **A. Check** in **[rerouted-concerns.md](../../workflow-shared/references/rerouted-concerns.md)**. Its offer and raise gates end the turn; an absorb never ends the turn, the protocol itself continues to the next raise.

2. **Work the series** — the register is the position:

   **If a live experiment exists** (any row not `concluded` or `abandoned`): continue its walk — enter **[experiment-walk.md](experiment-walk.md)** at the row's status. One live experiment at a time: the walk runs a record to its terminal before the next is conceived, except where a design deliberately declares parallel arms.

   **If no live experiment exists:** talk through what needs measuring next — the inputs read at initialisation, the last report's learnings, and the conversation supply the candidates. When the next question crystallises and the user confirms it's worth a run, the walk's **A. Conceive** opens the next record. When nothing remains to measure, that's the conclusion signal — see **E. Series Conclusion**.

3. **Document** — writes land in the live experiment's record directory (`design.md`, `report.md`, `data/`) at the moments the walk prescribes. Context compaction is lossy: what's not on disk is lost, so don't hold results in conversation.

4. **Commit after each write** — don't batch; the commit history is the safety net across context refresh:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic experiment/{topic} -m "experiment({work_unit}/{topic}): {what changed}"
   ```

5. **Continue** — follow the series where it leads. A concern beyond this topic's scope routes through **D. Off-Topic Concerns**; the user indicating they're done, or the topic's question holding enough evidence to feed its discussion, routes through **E. Series Conclusion**.

---

## D. Off-Topic Concerns

When a concern surfaces that's beyond this topic's scope:

#### If `work_type` is `epic`

Its home is a sibling topic, existing or new. Hold it with the full context discussed about it:

→ Load **[off-topic-epic.md](../../workflow-shared/references/off-topic-epic.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `experiment`, concern = `{the concern, with its discussed context}`, reason = `off-topic`.

→ On return, return to **C. Session Loop**.

#### Otherwise

A single-topic work type has no other topic to route it to. Write the offer payload to `.workflows/.cache/{work_unit}/experiment/{topic}/off-topic-offer.json` with the Write tool (`{"concern": "…"}` — the concern's short title), then render it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render off-topic-offer {work_unit}.experiment.{topic} --file .workflows/.cache/{work_unit}/experiment/{topic}/off-topic-offer.json --variant experiment
```

Emit the call's MENU section verbatim per its marker. The pivot option is offered only for a feature — the surface derives that from the work type.

**STOP.** Wait for user response.

**If `log`:**

Capture the concern via the `workflow-log-idea` skill so it lands in the inbox for later triage.

→ Return to **C. Session Loop**.

**If `pivot`:**

1. Load **[pivot-to-epic.md](../../workflow-shared/references/pivot-to-epic.md)** with work_unit = `{work_unit}`. The work unit is now an epic (conversion committed) with this topic on its discovery map.

2. From the context you already have, derive two values: `proposed_name` — a kebab-case topic name for the concern; and `concern` — the concern with the full context discussed about it.

3. Judge `landing_phase` per **Judging the Landing Phase**, then load **[triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{proposed_name}`, concern = `{concern}`, origin = `{topic}`, phase = `experiment`, landing_phase = `{landing_phase}`, date = `{today}`. It validates the name against the map and, on a clash, prompts to pick another or cancel. If `result` is `cancelled`, the topic wasn't created — note the concern in the live experiment's report so it isn't lost; otherwise the concern landed as the `{landed_topic}` topic and the delivery committed itself.

> *Output the next fenced block as markdown (not a code block):*

```
> This work is now an epic — continuing here with the current topic. The concern is preserved for its own handling later.
```

→ Return to **C. Session Loop**.

**If `ignore`:**

Note the concern on the live experiment's record — a dated note in its `report.md`, or `design.md` context while the design is still open — for the user to consider separately, and continue. Before any record exists, the inbox (`l/log`) is the durable capture; a concern merely spoken lives only in conversation.

→ Return to **C. Session Loop**.

---

## E. Series Conclusion

→ Load **[topic-completion.md](topic-completion.md)** and follow its instructions as written.

→ On return, return to **C. Session Loop**.

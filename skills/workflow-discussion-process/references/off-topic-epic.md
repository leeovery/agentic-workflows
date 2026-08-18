# Off-Topic Concern — Epic

*Reference for **[discussion-session](discussion-session.md)** — loaded when an off-topic concern surfaces on an epic.*

---

The caller provides `work_unit`, `topic`, and the `concern` with its discussed context. The concern is already judged off-topic for this discussion — on an epic it belongs to a sibling topic, existing or new. Offer the reroute, resolve the target yourself, and land the concern where it belongs.

**If the concern is a staged product capability** — the user placed it beyond this epic (*"that's a v2 thing"*), or your proposed placement is confirmed in conversation: its home is the roadmap, not a sibling topic. Park it (born at the first park; the verb validates and self-commits), note it in the discussion's running record, and continue — capture-weight, never shaping:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs roadmap add {name} --horizon {horizon} --summary "{one-liner}" --origin park:{work_unit} --source {work_unit}/discussion/{topic}.md
```

→ Return to caller for **B. Session Loop**.

**Otherwise:**

→ Proceed to **A. Resolve the Target**.

## A. Resolve the Target

Read the live map:

```bash
node .claude/skills/workflow-discovery/scripts/gateway.cjs {work_unit}
```

You hold the conversation and the map — resolve the target yourself from each topic's name, summary, routing, and lifecycle. The concern's home is the topic whose remit it falls under; when nothing fits, a new kebab-case topic name you derive from the concern. Don't put the reading back on the user. Judge `landing_phase` per **Judging the Landing Phase** in **[triage-landing.md](../../workflow-shared/references/triage-landing.md)** — the concern's nature decides, so the judgement holds whatever the target.

#### If the resolved target is the current topic

It was a detail of this discussion after all, not a reroute: record it as a `pending` subtopic (session loop step 2).

→ Return to caller for **B. Session Loop**.

#### If one home is clear

An existing topic, or the new name when nothing fits. Set `resolution = clear`.

→ Proceed to **B. Offer the Reroute**.

#### Otherwise

Two or more plausible homes and the conversation doesn't settle it. Set `resolution = ambiguous`.

→ Proceed to **B. Offer the Reroute**.

## B. Offer the Reroute

Write the offer payload to `.workflows/.cache/{work_unit}/discussion/{topic}/reroute-offer.json` with the Write tool (`{"concern": "…", "target": "…", "landing_phase": "…"}` — the concern's short title, with `target` and `landing_phase` only when `resolution` is `clear`), then render it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render reroute-offer {work_unit}.discussion.{topic} --file .workflows/.cache/{work_unit}/discussion/{topic}/reroute-offer.json
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

**If `keep`:**

Record it as a `pending` subtopic (session loop step 2).

→ Return to caller for **B. Session Loop**.

**If `reroute` and `resolution` is `clear`:**

A phase appended to the reply overrides `landing_phase`.

→ Proceed to **C. Land It**.

**If `reroute` and `resolution` is `ambiguous`:**

Write the candidates payload to `.workflows/.cache/{work_unit}/discussion/{topic}/reroute-candidates.json` with the Write tool (`{"concern": "…", "landing_phase": "…", "candidates": [{"name": "…", "lifecycle": "…"}]}` — every plausible home, lifecycle from the map read), then render it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render reroute-candidates {work_unit}.discussion.{topic} --file .workflows/.cache/{work_unit}/discussion/{topic}/reroute-candidates.json
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

A chosen candidate is the target; `new` means propose a kebab-case name and confirm it. A phase appended to the selection overrides `landing_phase`.

→ Proceed to **C. Land It**.

## C. Land It

→ Load **[triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{target}`, concern = `{concern}`, origin = `{topic}`, phase = `discussion`, landing_phase = `{landing_phase}`, date = `{today}`. It validates the name against the map and, on a clash, prompts to pick another or cancel.

**If `result` is `cancelled`:**

Nothing landed.

→ Return to caller for **B. Session Loop**.

**Otherwise:**

The concern landed in `{landed_topic}`'s `{landing_phase}` triage queue — the delivery committed itself. The current Discussion Map is unchanged — rerouting sends the concern away from this topic, it doesn't mark it.

**If the response carried `reconcile_flagged` or `sources_staled`:** also tell the user what the landing flagged — on a research landing, `{landed_topic}`'s completed discussion (to reconcile against the reopened research); on a discussion landing, the specification(s) named in `sources_staled`, whose extraction of `{landed_topic}` is now stale.

→ Return to caller for **B. Session Loop**.

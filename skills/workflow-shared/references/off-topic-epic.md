# Off-Topic Concern — Epic

*Shared reference. Loaded by the research and discussion epic sessions when a concern belongs elsewhere on the map.*

---

The caller provides `work_unit`, `topic`, `phase` (`research` or `discussion` — the session's own phase), the `concern` with its discussed context, and `reason` — `off-topic` (the default when omitted: a concern this session judged not its own) or `grown-thread` (a thread grown inside this topic that has earned a topic of its own). Either way the concern's home on an epic is a sibling topic, existing or new. Offer the reroute, resolve the target yourself, and land the concern where it belongs.

**If the concern is a staged product capability** — the user placed it beyond this epic (*"that's a v2 thing"*), or your proposed placement is confirmed in conversation: its home is the roadmap, not a sibling topic. Park it (born at the first park; the verb validates and self-commits), note it in the session's running record, and continue — capture-weight, never shaping:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs roadmap add {name} --horizon {horizon} --summary "{one-liner}" --origin park:{work_unit} --source {work_unit}/{phase}/{topic}.md
```

→ Return to caller for **B. Session Loop**.

**Otherwise:**

→ Proceed to **A. Resolve the Target**.

## A. Resolve the Target

Read the live map:

```bash
node .claude/skills/workflow-discovery/scripts/gateway.cjs {work_unit}
```

You hold the conversation and the map — resolve the target yourself from each topic's name, summary, routing, and lifecycle. The concern's home is the topic whose remit it falls under; when nothing fits, a new kebab-case topic name you derive from the concern. Don't put the reading back on the user. Judge `landing_phase` per **Judging the Landing Phase** in **[triage-landing.md](triage-landing.md)** — the concern's nature decides, so the judgement holds whatever the target.

On a `grown-thread` entry the current topic is never the answer — the thread grew here and a home of its own is the point, so the target is a sibling or the new name by construction.

#### If the resolved target is the current topic

It was a detail of this session's own topic after all, not a reroute — keep it: on `discussion`, record it as a `pending` subtopic (session loop step 2); on `research`, fold it into the research file as a thread.

→ Return to caller for **B. Session Loop**.

#### If one home is clear

An existing topic, or the new name when nothing fits. Set `resolution = clear`.

→ Proceed to **B. Offer the Reroute**.

#### Otherwise

Two or more plausible homes and the conversation doesn't settle it. Set `resolution = ambiguous`.

→ Proceed to **B. Offer the Reroute**.

## B. Offer the Reroute

Write the offer payload to `.workflows/.cache/{work_unit}/{phase}/{topic}/reroute-offer.json` with the Write tool (`{"concern": "…", "target": "…", "landing_phase": "…", "new_target": true, "grown": true}` — the concern's short title, with `target` and `landing_phase` only when `resolution` is `clear`; add `new_target` when the **A** map read showed no such topic, since the landing creates it, and `grown` when `reason` is `grown-thread`, which implies it), then render it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render reroute-offer {work_unit}.{phase}.{topic} --file .workflows/.cache/{work_unit}/{phase}/{topic}/reroute-offer.json
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

**If `keep`:**

Keep it: on `discussion`, record it as a `pending` subtopic (session loop step 2); on `research`, fold it into the research file as a thread.

→ Return to caller for **B. Session Loop**.

**If `reroute` and `resolution` is `clear`:**

A phase appended to the reply overrides `landing_phase`.

→ Proceed to **C. Land It**.

**If `reroute` and `resolution` is `ambiguous`:**

Write the candidates payload to `.workflows/.cache/{work_unit}/{phase}/{topic}/reroute-candidates.json` with the Write tool (`{"concern": "…", "landing_phase": "…", "candidates": [{"name": "…", "lifecycle": "…"}]}` — every plausible home, lifecycle from the map read), then render it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render reroute-candidates {work_unit}.{phase}.{topic} --file .workflows/.cache/{work_unit}/{phase}/{topic}/reroute-candidates.json
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

A chosen candidate is the target; `new` means propose a kebab-case name and confirm it. A phase appended to the selection overrides `landing_phase`.

→ Proceed to **C. Land It**.

## C. Land It

The concern travels with the full context discussed about it — the target picks it up cold. Honour triage-landing's one-ask-per-file rule as you build it: material making several asks the target could accept or reject independently is delivered as separate concerns under this one confirmed reroute.

→ Load **[triage-landing.md](triage-landing.md)** with work_unit = `{work_unit}`, target = `{target}`, concern = `{concern}`, origin = `{topic}`, phase = `{phase}`, landing_phase = `{landing_phase}`, date = `{today}`. It validates the name against the map and, on a clash, prompts to pick another or cancel.

**If `result` is `cancelled`:**

Nothing landed.

→ Return to caller for **B. Session Loop**.

**Otherwise:**

The concern landed in `{landed_topic}`'s `{landing_phase}` triage queue — the delivery committed itself. This session's own record is unchanged — rerouting sends the concern away from this topic, it doesn't mark it.

**If the response carried `reconcile_flagged` or `sources_staled`:** also tell the user what the landing flagged — on a research landing, `{landed_topic}`'s completed discussion (to reconcile against the reopened research); on a discussion landing, the specification(s) named in `sources_staled`, whose extraction of `{landed_topic}` is now stale.

→ Return to caller for **B. Session Loop**.

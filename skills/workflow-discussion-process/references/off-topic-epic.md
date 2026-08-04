# Off-Topic Concern — Epic

*Reference for **[discussion-session](discussion-session.md)** — loaded when an off-topic concern surfaces on an epic.*

---

The caller provides `work_unit`, `topic`, and the `concern` with its discussed context. The concern is already judged off-topic for this discussion — on an epic it belongs to a sibling topic, existing or new. Offer the reroute, resolve the target yourself, and land the concern where it belongs.

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

The user consents knowing the destination: a clear home is named in the offer, with its landing phase, before anything lands.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**{concern}** belongs to a different topic, not this one.
@if(resolution == clear) It reads as {target}'s ground, landing {landing_phase}-side — append a phase to override (e.g. `r discussion`). @endif

- **`r`/`reroute`** — Send it to the topic it belongs to; it picks it up later
- **`k`/`keep`** — Keep it here as a subtopic
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `keep`:**

Record it as a `pending` subtopic (session loop step 2).

→ Return to caller for **B. Session Loop**.

**If `reroute` and `resolution` is `clear`:**

A phase appended to the reply overrides `landing_phase`.

→ Proceed to **C. Land It**.

**If `reroute` and `resolution` is `ambiguous`:**

State the recommendation in the menu:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Where should "{concern}" land?

- **`1`** — {candidate} [{lifecycle}]
- **`2`** — {candidate} [{lifecycle}]
- **`n`/`new`** — Create a new topic for it

It reads as {concern_nature:[an open question — I'd land it research-side|a decision to make — I'd land it discussion-side]}. Reply with an option, appending a phase to override (e.g. `1 discussion`).
· · · · · · · · · · · ·
```

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

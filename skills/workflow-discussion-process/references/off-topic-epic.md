# Off-Topic Concern — Epic

*Reference for **[discussion-session](discussion-session.md)** — loaded when an off-topic concern surfaces on an epic.*

---

The caller provides `work_unit`, `topic`, and the `concern` with its discussed context. The concern is already judged off-topic for this discussion — on an epic it belongs to a sibling topic, existing or new. Offer the reroute, resolve the target yourself, and land the concern where it belongs.

## A. Offer the Reroute

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**{concern}** belongs to a different topic, not this one.

- **`r`/`reroute`** — Send it to the topic it belongs to; it picks it up later
- **`k`/`keep`** — Keep it here as a subtopic
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `keep`:**

Record it as a `pending` subtopic (session loop step 2).

→ Return to caller for **B. Session Loop**.

**If `reroute`:**

→ Proceed to **B. Resolve the Target**.

## B. Resolve the Target

Read the live map:

```bash
node .claude/skills/workflow-discovery/scripts/gateway.cjs {work_unit}
```

You hold the conversation and the map — resolve the target yourself from each topic's name, summary, routing, and lifecycle. The concern's home is the topic whose remit it falls under; when nothing fits, a new kebab-case topic name you derive from the concern. Don't put the reading back on the user.

**If the resolved target is the current topic** — it was a detail of this discussion after all, not a reroute: record it as a `pending` subtopic (session loop step 2).

→ Return to caller for **B. Session Loop**.

**If one home is clear** (an existing topic, or the new name when nothing fits):

Name it in passing as the landing happens — the user corrects you if you've misread.

→ Proceed to **C. Land It**.

**If genuinely ambiguous** — two or more plausible homes and the conversation doesn't settle it:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Where should "{concern}" land?

- **`1`** — {candidate} [{lifecycle}]
- **`2`** — {candidate} [{lifecycle}]
- **`n`/`new`** — Create a new topic for it
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

A chosen candidate is the target; `new` means propose a kebab-case name and confirm it.

→ Proceed to **C. Land It**.

## C. Land It

→ Load **[triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{target}`, concern = `{concern}`, origin = `{topic}`, phase = `discussion`, date = `{today}`. It validates the name against the map and, on a clash, prompts to pick another or cancel.

**If `result` is `cancelled`:**

Nothing landed.

→ Return to caller for **B. Session Loop**.

**Otherwise:**

The concern landed in `{landed_topic}`'s `## Triage`. The current Discussion Map is unchanged — rerouting sends the concern away from this topic, it doesn't mark it. Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "discussion({work_unit}/{topic}): reroute concern to {landed_topic}"
```

→ Return to caller for **B. Session Loop**.

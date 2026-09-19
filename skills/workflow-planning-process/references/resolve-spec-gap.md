# Resolve Specification Gap

*Reference for **[workflow-planning-process](../SKILL.md)** — loaded by [define-phases.md](define-phases.md), [define-tasks.md](define-tasks.md), [author-tasks.md](author-tasks.md), and [process-review-findings.md](process-review-findings.md) when the concluded specification is silent, wrong, or self-contradictory on what the product does.*

---

The plan builds what the specification decided; where it decided nothing, or decided it wrong, the answer goes into the record — never into the plan. `{gap}` is what the specification asserts or omits, the evidence, and what goes wrong for the product's user if the implementer guesses; the caller also names the section or task it surfaced in. `{lane}` is the calling flow's lane — `construction` from phase design, task design, or task authoring, `review` from the findings walk — set by the caller's Load directive; its gate mode field is the one every auto check here reads: `task_list_gate_mode` or `author_gate_mode` for construction, whichever gate the caller is about to render (phase design has none), `finding_gate_mode` for review. `{work_unit}` and `{topic}` are in context from the calling session — `{topic}` names the plan and its specification alike, whose path is `.workflows/{work_unit}/specification/{topic}/specification.md`.

`{doc}` is the source document that owns the ground a decision would land on — read the specification item's sources (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} sources`) and take the one that owns it, a single-topic unit's being the same-named document; `{source_phase}` is that source's own phase, `discussion`, or `investigation` for a bugfix.

The moves, by effort — and derivation is exhausted before any stop: context, the specification's own decisions, sibling artifacts, measurement against the tree. What the record yields is settled and lands silently. The one thing never derived is product intent: the plan never invents what the product does.

## A. Classify

Pick by first match:

#### If the record settles it, or a defensible derivation pins it

A measurement, a convention, a sibling decision, or another section of the specification yields the answer — or first principles over the decisions the record made whittle the fork to one answer you stand behind. The correction route verifies the ground and lands it:

→ Load **[../../workflow-shared/references/correcting-historical-artifacts.md](../../workflow-shared/references/correcting-historical-artifacts.md)** for **B. This Work Unit's Specification** with specification path = `.workflows/{work_unit}/specification/{topic}/specification.md`, correcting_phase = `planning/{topic}`.

Read the verdict it returns.

**If it landed the correction** — its record-settled or derivation arm:

Tell the user in one line what landed and what determined it.

→ Return to caller.

**If the code is wrong and the specification is right:**

The tree does not yet do what the specification decides. From planning that is plan content, not a spec edit: return it to the caller as work the plan must carry — a task, or a criterion on one.

→ Return to caller.

**If it is genuinely open** — product intent, or a call the reference could not stand behind:

→ Proceed to **B. The Exchange**.

**If it returns the entry unsettled** — the specification is live in its own phase, or another session holds it:

Leave it exactly as reported; never re-classify it here. The plan is held either way, so the point goes where it will be worked.

→ Proceed to **D. Route the Gap**.

#### Otherwise

A fork in what the product does that the record does not settle.

→ Proceed to **B. The Exchange**.

## B. The Exchange

**This stop overrides `auto`.** Where `{lane}`'s gate mode holds `auto` — re-read it if it is not current in context (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} {task_list_gate_mode|author_gate_mode|finding_gate_mode}`) — open with the announcement verbatim — **Auto is on — stopping anyway:** this is one of the calls auto never makes for you. Then put the fork to the user in conversation: what the plan needs and cannot build without, what was searched and where the record ran out, the sides as product end states — what the product *is* if that side wins — what each costs the user, and your stance. No engine surface: this is an exchange, not a gate.

**STOP.** Wait for user response.

**If the answer settles it:**

→ Proceed to **C. Land the Decision**.

**If the exchange shows it needs real discussion work** — exploration the record never did, more than a brief exchange gives:

→ Proceed to **D. Route the Gap**.

## C. Land the Decision

The decision's home is `{doc}` — the document that records decisions; the specification records none, and re-aligns to it.

Another session may hold that document. Scan presence — read the `sessions` rows only; the response's deferral section is the analysis dispatch's and is not emitted here:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs presence scan {work_unit}
```

#### If a row matches `{doc}`'s phase and topic with `held` true

The room is occupied, and a plan has one specification and nothing else to work on. The agreed resolution goes to the held session's queue and the plan waits for it.

→ Proceed to **D. Route the Gap** with the agreed resolution as the concern.

#### Otherwise

No row holds `{doc}`.

→ Load **[../../workflow-shared/references/landing-a-resolution.md](../../workflow-shared/references/landing-a-resolution.md)** with work_unit = `{work_unit}`, topic = `{topic}`, doc = `{doc}`, source_phase = `{source_phase}`, resolution = `{the decision the user settled, carrying what it turns on}`.

The document now carries the decision, and that is the record that settles the specification — its correction lands under the record-settled arm, the corrigendum citing the decision:

→ Load **[../../workflow-shared/references/correcting-historical-artifacts.md](../../workflow-shared/references/correcting-historical-artifacts.md)** for **B. This Work Unit's Specification** with specification path = `.workflows/{work_unit}/specification/{topic}/specification.md`, correcting_phase = `planning/{topic}`.

Tell the user in one line what landed where — the decision in the source document, the specification brought into line.

→ Return to caller — construction re-runs its agent against the corrected record before the gate renders, and the review walk re-disposes its finding against it.

## D. Route the Gap

The point goes to the owning document's triage queue — its item reopens, the queued concern survives any context clear, and the reopened session surfaces it and cannot conclude without folding it.

**If the work type is `epic`:**

→ Load **[../../workflow-shared/references/triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{doc}`, concern = `{what the plan needs, the evidence, what was explored, and the agreed resolution where there is one}`, origin = `{topic}`, phase = `planning`, landing_phase = `discussion`, date = `{today}`.

On return, read `result`.

**If `result` is `landed`:**

The delivery committed itself.

→ Proceed to **E. Pause the Plan**.

**If `result` is `cancelled`:**

Nothing was written — the point stays with this session.

→ Return to **B. The Exchange**.

**If the work type is not `epic`:**

Write the concern in the triage entry shape pinned in [triage-landing.md](../../workflow-shared/references/triage-landing.md) — `### {short title}`, `*From: {topic} · planning · {date}*`, then what the plan needs, the evidence, what was explored, and the agreed resolution where there is one — to `.workflows/.cache/{work_unit}/planning/{topic}/gap-concern.md` with the Write tool, then deliver it — the transaction reopens the source item, queues the concern, and commits itself:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic triage {work_unit} {source_phase} {doc} --concern .workflows/.cache/{work_unit}/planning/{topic}/gap-concern.md --slug {kebab-case gap name} -m "planning({work_unit}): gap routed to {doc}"
```

→ Proceed to **E. Pause the Plan**.

## E. Pause the Plan

The landing moved the ground beneath the specification, and the plan is held until the specification settles against what the discussion decides. Commit the session's work:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "planning({work_unit}): pause — gap routed to {doc}" --topic planning/{topic}
```

Fetch the pause gate:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render wait-gate {work_unit}.planning.{topic}
```

Emit the returned sections verbatim per their markers — the blocker naming what is owed, its guidance, then the menu.

**STOP.** Wait for user response.

**If `yes`:**

> *Output the next fenced block as markdown (not a code block):*

```
> Paused with the gap queued — planning resumes once the discussion has decided it and the specification has been brought into line.
```

Invoke `/workflow-bridge {work_unit} planning none paused`.

**If `keep`:**

Planning continues. The conclusion stays shut until the specification lands — the conclude gate meets the wait again.

→ Return to caller.

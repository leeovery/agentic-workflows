# Resolve Specification Gap

*Reference for **[workflow-planning-process](../SKILL.md)** — loaded by [define-phases.md](define-phases.md), [define-tasks.md](define-tasks.md), [author-tasks.md](author-tasks.md), and [process-review-findings.md](process-review-findings.md) when the concluded specification is silent, wrong, or self-contradictory on what the product does, and by implementation's [task-loop.md](../../workflow-implementation-process/references/task-loop.md) when an executor returns `blocked` on a product question.*

---

What gets built is what the specification decided; where it decided nothing, or decided it wrong, the answer goes into the record — never into the plan or the code. `{gap}` is what the specification asserts or omits, the evidence, and what goes wrong for the product's user if the implementer guesses; the caller also names the section or task it surfaced in. From `implementation` it is the question the executor reported and what it found — what the record decides, what the code does, and where the two run out — and `{task}` names the task in flight.

`{lane}` is the calling flow's lane, set by the caller's Load directive — `construction` from phase design, task design, or task authoring, `review` from the findings walk, `implementation` from the task loop's executor block. Its gate mode field is the one every auto check here reads: `task_list_gate_mode` or `author_gate_mode` for construction, whichever gate the caller is about to render (phase design has none), `finding_gate_mode` for review, `task_gate_mode` for implementation. `{phase}` is the lane's own phase — `planning` for construction and review, `implementation` for implementation; `{scope}` is the lane's commit-message scope — `planning` for construction and review, `impl` for implementation — and is used nowhere else.

`{work_unit}` and `{topic}` are in context from the calling session — `{topic}` names the plan, its specification, and the implementation item alike, the specification's path being `.workflows/{work_unit}/specification/{topic}/specification.md`.

`{verdict}` is what this reference answers with — `landed`, `answered`, `stopped`, or `unsettled`; `answered` and `stopped` are the implementation lane's alone. `landed` says the record carries the answer and the specification is in line with it. `answered` says the user gave an answer the record could not take this pass — it is in hand and rides the task. `stopped` says the work halts with nothing in hand, and `unsettled` says nothing was asked and the entry stands. The task loop branches on it after the return; the planning lanes resume their own next line and read nothing.

`{doc}` is the source document that owns the ground a decision would land on — read the specification item's sources (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} sources`) and take the one that owns it, a single-topic unit's being the same-named document; `{source_phase}` is that source's own phase, `discussion`, or `investigation` for a bugfix. A specification with no sources is a quick-fix's: the scoping pass wrote it and no document stands behind it, so `{doc}` is the specification itself, a decision lands there directly, and **D. Route the Gap** is never entered.

The moves, by effort — and derivation is exhausted before any stop: context, the specification's own decisions, sibling artifacts, measurement against the tree. What the record yields is settled and lands silently. The one thing never derived is product intent: neither the plan nor the code invents what the product does.

An entry an earlier settle already landed — its corrigendum present in the specification, or its concern already queued on `{doc}`'s triage queue (`node .claude/skills/workflow-engine/scripts/engine.cjs topic queue {work_unit} {source_phase} {doc}` lists it) — is skipped, and the planning lanes move on to the next entry. From `implementation` the two part:

**If the corrigendum is in the specification:**

The record carries the answer. Set `verdict = landed`.

→ Return to caller.

**If the concern is queued on `{doc}`:**

The record has not settled it — the queued concern is what an answer waits on. Tell the user in one line that the question is still queued on `{doc}` and the work waits for it. Set `verdict = stopped`.

→ Return to caller.

## A. Classify

Pick by first match:

#### If the record settles it, or a defensible derivation pins it

A measurement, a convention, a sibling decision, or another section of the specification yields the answer — or first principles over the decisions the record made whittle the fork to one answer you stand behind. The correction route verifies the ground and lands it:

→ Load **[../../workflow-shared/references/correcting-historical-artifacts.md](../../workflow-shared/references/correcting-historical-artifacts.md)** for **B. This Work Unit's Specification** with specification path = `.workflows/{work_unit}/specification/{topic}/specification.md`, correcting_phase = `{phase}/{topic}`.

Read the verdict it returns.

**If it landed the correction** — its record-settled or derivation arm:

Tell the user in one line what landed and what determined it. Set `verdict = landed`.

→ Return to caller.

**If the code is wrong and the specification is right:**

The tree does not yet do what the specification decides. From construction and review that is plan content, not a spec edit: return it to the caller as work the plan must carry — a task, or a criterion on one. From `implementation` it is the task's own work — the executor builds what the specification decides — so set `verdict = landed`, the answer being that decision.

→ Return to caller.

**If it is genuinely open** — product intent, or a call the reference could not stand behind:

→ Proceed to **B. The Exchange**.

**If it returns the entry unsettled** — the specification is live in its own phase, or another session holds it:

Leave it exactly as reported: never re-classify it here, and route nothing. Tell the user in one line that the specification is out and the entry stands. Set `verdict = unsettled`. A plan is held while its specification is unsettled, and a later run — the next agent return, or the review walk — re-finds the point once it settles; a task in flight takes its answer from the user at the block gate instead.

→ Return to caller.

#### Otherwise

A fork in what the product does that the record does not settle.

→ Proceed to **B. The Exchange**.

## B. The Exchange

**This stop overrides `auto`.** From the planning lanes, where `{lane}`'s gate mode holds `auto` or `bounded` — re-read it if it is not current in context (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.{phase}.{topic} {task_list_gate_mode|author_gate_mode|finding_gate_mode}`) — open with the announcement verbatim — **Auto is on — stopping anyway:** this is one of the calls auto never makes for you. From `implementation` the gate heads itself with that line off `task_gate_mode`: never announce it.

#### If `{lane}` is `implementation`

The executor is stopped at this question, and the gate takes the fork's sides. Render the task's header first:

→ Load **[../../workflow-implementation-process/references/display-task-result.md](../../workflow-implementation-process/references/display-task-result.md)** with result = `blocked`.

Beneath it comes the block — **Blocked on**, **What the executor found**, **Options**, **Recommendation** — composed from the executor's ISSUES and your own reads of the specification and the code, and emitted as markdown (not a code block). This is an engineering stop presented to an engineer: real names, `file:line` where they anchor something, each option's technical shape, product consequence and cost side by side.

→ Load **[../../workflow-implementation-process/references/report-register.md](../../workflow-implementation-process/references/report-register.md)** and follow its **Executor Block** section.

Write the sides to `.workflows/.cache/{work_unit}/implementation/{topic}/block-sides.json` with the Write tool — the Options in the order composed, each summary that option's bold label, the recommended one an object and the rest plain strings:

```json
{"options": [{"summary": "{recommended option's label}", "recommended": true}, "{next option's label}"]}
```

Fetch the gate and emit its MENU section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render executor-block-gate {work_unit}.implementation.{topic} --result blocked --file .workflows/.cache/{work_unit}/implementation/{topic}/block-sides.json
```

**STOP.** Wait for user response.

**If the user picks a numbered side:**

→ Proceed to **C. Land the Decision** with that side as the decision.

**If the comment settles the question** — it names a side, or a direction in words:

→ Proceed to **C. Land the Decision** with what the user named as the decision.

**If the comment shows it needs real discussion work and the specification has sources** — exploration the record never did, more than a brief exchange gives:

→ Proceed to **D. Route the Gap**.

**If the comment shows it needs real discussion work and the specification has no sources:**

A quick-fix has no discussion behind it and nothing to route to — the work has outgrown its type. Say so in one line. The exchange sets the gate aside until the person is ready to move on; to put it back, re-fetch the gate and emit its MENU section verbatim per its marker — the reply takes these branches again:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render executor-block-gate {work_unit}.implementation.{topic} --result blocked --file .workflows/.cache/{work_unit}/implementation/{topic}/block-sides.json
```

**STOP.** Wait for user response.

**If the comment is a question back or feedback:**

Answer it. Where the feedback moves the Options — a side you missed, a cost you read wrong — revise them, re-emit the revised Options, and rewrite the payload. The exchange sets the gate aside until the person is ready to move on; to put it back, re-fetch the gate and emit its MENU section verbatim per its marker — the reply takes these branches again:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render executor-block-gate {work_unit}.implementation.{topic} --result blocked --file .workflows/.cache/{work_unit}/implementation/{topic}/block-sides.json
```

**STOP.** Wait for user response.

#### Otherwise

Compose the fork in product terms: what the work needs and cannot be built without, what was searched and where the record ran out, the sides as product end states — what the product *is* if that side wins — what each costs the user, and your stance. Put it to the user in conversation. No engine surface: this is an exchange, not a gate.

**STOP.** Wait for user response.

**If the answer settles it:**

→ Proceed to **C. Land the Decision**.

**If the exchange shows it needs real discussion work** — exploration the record never did, more than a brief exchange gives:

→ Proceed to **D. Route the Gap**.

## C. Land the Decision

The decision's home is `{doc}` — the document that records decisions; the specification records none, and re-aligns to it. A quick-fix is the exception: no document stands behind its specification, which is its own record — the first branch below is its, and it runs no scan.

Another session may hold `{doc}`. Scan presence — read the `sessions` rows only; the response's deferral section is the analysis dispatch's and is not emitted here:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs presence scan {work_unit}
```

Pick by first match:

#### If the specification has no sources

The decision the user just made is the landed change that settles the specification, and the correction route classifies it record-settled on that ground. Nothing lands in a source document — there is none:

→ Load **[../../workflow-shared/references/correcting-historical-artifacts.md](../../workflow-shared/references/correcting-historical-artifacts.md)** for **B. This Work Unit's Specification** with specification path = `.workflows/{work_unit}/specification/{topic}/specification.md`, correcting_phase = `implementation/{topic}`.

**If it landed the correction:**

Tell the user in one line what the specification now says. Set `verdict = landed`.

→ Return to caller.

**If it returns the entry unsettled** — the specification is live in its own phase, or another session holds it:

Tell the user in one line that the specification is out and the answer rides the task meanwhile. Set `verdict = answered`.

→ Return to caller.

#### If a row matches `{doc}`'s phase and topic with `held` true

The room is occupied. The agreed resolution goes to the held session's queue, and the work waits for the record.

→ Proceed to **D. Route the Gap** with the agreed resolution as the concern.

#### Otherwise

No row holds `{doc}`.

→ Load **[../../workflow-shared/references/landing-a-resolution.md](../../workflow-shared/references/landing-a-resolution.md)** with work_unit = `{work_unit}`, topic = `{topic}`, doc = `{doc}`, source_phase = `{source_phase}`, resolution = `{the decision the user settled, carrying what it turns on}`.

The document now carries the decision, and that decision is the record that settles the specification — the correction route classifies it record-settled, the corrigendum citing it:

→ Load **[../../workflow-shared/references/correcting-historical-artifacts.md](../../workflow-shared/references/correcting-historical-artifacts.md)** for **B. This Work Unit's Specification** with specification path = `.workflows/{work_unit}/specification/{topic}/specification.md`, correcting_phase = `{phase}/{topic}`.

**If it landed the correction:**

Tell the user in one line what landed where — the decision in the source document, the specification brought into line. Set `verdict = landed`.

→ Return to caller — construction re-runs its agent against the corrected record before the gate renders, the review walk re-disposes its finding against it, and the task loop lands the answer on the task in flight.

**If it returns the entry unsettled** — the specification is live in its own phase, or another session holds it:

The decision stands in the record, and the specification takes it when its own session reconciles. Flip this plan's specification extraction stale so that reconciliation happens — no `--except` here: this is the one landing whose own specification must go stale, and a single-topic work type runs it too (the skip in `landing-a-resolution.md` is about sibling specifications, which it has none of). The verb takes a discussion, so a bugfix whose `{doc}` is an investigation flips nothing — its specification is the live session already reading that document:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs sources stale {work_unit} {doc}
```

Say it in one line, keyed on the lane. From the planning lanes: the decision is in the record and the specification takes it when it next runs — the plan is held until it does; set `verdict = unsettled`. From `implementation`: the same, and the answer rides the task in the meantime; set `verdict = answered`.

→ Return to caller — no re-run: the specification did not change.

## D. Route the Gap

The point goes to `{doc}`'s triage queue — its item reopens, the queued concern survives any context clear, and the reopened session surfaces it and cannot conclude without folding it.

#### If the work type is `epic`

→ Load **[../../workflow-shared/references/triage-landing.md](../../workflow-shared/references/triage-landing.md)** with work_unit = `{work_unit}`, target = `{doc}`, concern = `{what the work needs, the evidence, what was explored, the agreed resolution where there is one, and from implementation the task it stopped}`, origin = `{topic}`, phase = `{phase}`, landing_phase = `discussion`, date = `{today}`.

On return, read `result` and `landed_topic`.

**If `result` is `landed`:**

The delivery committed itself, and `{landed_topic}` is the document it landed on — validation may have renamed the target.

→ Proceed to **E. Pause the Work**.

**If `result` is `cancelled` and this section was entered from B. The Exchange:**

Nothing was written — the point stays with this session.

→ Return to **B. The Exchange**.

**If `result` is `cancelled` and this section was entered from C. Land the Decision:**

Nothing was written, and the agreed resolution reached nobody — say so in one line; the held session will not see it. Set `verdict = unsettled` from the planning lanes; from `implementation` the answer is still in hand and rides the task, so set `verdict = answered`.

→ Return to caller.

#### Otherwise

Write the concern in the triage entry shape pinned in [triage-landing.md](../../workflow-shared/references/triage-landing.md) — `### {short title}`, `*From: {topic} · {phase} · {date}*`, then what the work needs, the evidence, what was explored, the agreed resolution where there is one, and from implementation the task it stopped — to `.workflows/.cache/{work_unit}/{phase}/{topic}/gap-concern.md` with the Write tool, then deliver it — the transaction reopens the source item, queues the concern, and commits itself:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic triage {work_unit} {source_phase} {doc} --concern .workflows/.cache/{work_unit}/{phase}/{topic}/gap-concern.md --slug {kebab-case gap name} -m "{scope}({work_unit}): gap routed to {doc}"
```

Set `landed_topic` = `{doc}`.

→ Proceed to **E. Pause the Work**.

## E. Pause the Work

The landing moved the ground beneath the specification, and what is built from it waits until the specification settles against what `{landed_topic}` decides.

#### If `{lane}` is `implementation`

Commit the session's work:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): pause — gap routed to {landed_topic}" --topic implementation/{topic}
```

Say in one line that the concern is queued on `{landed_topic}` and implementation resumes once it has decided: the landing flagged the specification to reconcile against it, and the epic menu and the linear next-phase derivation both route back to the reopened record.

**STOP.** Do not proceed — terminal condition.

#### Otherwise

The plan is held until its specification settles. Commit the session's work:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "planning({work_unit}): pause — gap routed to {landed_topic}" --topic planning/{topic}
```

Fetch the pause gate:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render wait-gate {work_unit}.planning.{topic}
```

**If the output is empty:**

Nothing holds the plan — the specification no longer sources `{landed_topic}`, or it is terminal. Planning continues.

→ Return to caller.

**If sections are returned:**

Emit them verbatim per their markers — the blocker naming what is owed, its guidance, then the menu.

**STOP.** Wait for user response.

**If `yes`:**

> *Output the next fenced block as markdown (not a code block):*

```
> Paused with the gap queued — planning resumes once {landed_topic} has decided it and the specification has been brought into line.
```

Invoke `/workflow-bridge {work_unit} planning none paused`.

**If `keep`:**

Planning continues. The conclusion stays shut until the specification lands — the conclude gate meets the wait again.

→ Return to caller.

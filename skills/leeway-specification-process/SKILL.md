---
name: leeway-specification-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/leeway-engine/scripts/engine.cjs *)
---

# Specification

The work unit's one spec, `spec.md`: the document its build reads and the person reviews line by line, written by area from the ledger's records, every statement citing the entries it comes from; then the phase cut, and ready to build. You orchestrate: named agents sweep the records, write the spec, review it and cut it, each from a brief the engine issues, and never from this conversation. What they find goes to the ledger, the writer or the person, and you bring the person to ready to build. Nothing here decides the product afresh: a gap the spec meets is decided as any call is, and lands on the ledger.

## Arguments

- `$0` — **work_type**: `epic`, `feature` or `bugfix`.
- `$1` — **work_unit**.

## Instructions

Load **[framework.md](../leeway-shared/references/framework.md)** and follow its instructions as written.

## Done When

The person has picked the build's position at ready to build: the engine then holds the spec concluded, its phase cut on the unit's manifest, and the build begun in that position.

## Entering

Every engine call is `node .claude/skills/leeway-engine/scripts/engine.cjs {verb} …`, each verb under **Doors**.

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs enter specification {work_unit}
```

A refusal names the way on: say it in a line. Otherwise read what the DATA names: each `record`, by running its call, the unit's own among them; each `topic log` and `asset`; and those the spec has once it is under way — the `spec`, the `cut` by its call, and while the person's review page is open, its `review page` and the `read back` file its marks go to. Close each `lost` agent with `agent incorporate`; each `landed` report is a review pass's: load **[writing-and-review.md](references/writing-and-review.md)** and follow its instructions as written, from **A Pass's Report**. An `approve the map` call is the sweep's candidates waiting on the person: load **[the-sweep.md](references/the-sweep.md)** and follow its instructions as written, from **Approve the Map**.

Then fetch `checklist show ready-to-build {work_unit}`: its open items say where the spec stands, and **The Spec** takes it on from there. In your own words, say in a line what comes first.

## The Spec

The work runs in order, each piece once the one before it holds:
1. **The sweep** — where `sweep-run` is open, an epic of more than one live topic is swept once before the spec is written: load **[the-sweep.md](references/the-sweep.md)** and follow its instructions as written.
2. **Writing and review** — the writer writes the spec, `spec land` takes it, and review passes read it until one changes nothing (`statements-traced`, `review-settled`): load **[writing-and-review.md](references/writing-and-review.md)** and follow its instructions as written.
3. **The cut** — once the review has settled: load **[phase-cut.md](references/phase-cut.md)** and follow its instructions as written.

A land after the cut — a gap answered, a split — goes through the review's next pass; where `phases-complete` is open again, the cut no longer holds against the spec, and is made again.

The person meets this phase at approve the map after the sweep, at a gap the matrix sends them, and at ready to build. Between those the work runs on: say in a line where it has got to whenever you wait on an agent.

## Doors

- An agent → `brief sweep|spec-writer|phase-cut {work_unit}`, the writer with the wording the person agreed `--wording {file}`; a review pass → `agent dispatch {work_unit} specification {work_unit} --kind spec-review`, then `brief spec-reviewer {work_unit} --agent {dispatch_id}`, the id the dispatch answers; then the Agent call with the agent and the pointer `brief` answers. A pass's report → `agent scan|ack|surface|incorporate {work_unit} specification {work_unit}`.
- The sweep's report → `sweep take {work_unit}`; its candidates → `render approve-map {work_unit} --sweep`, `approve-map strike|unstrike {work_unit} {n}`.
- The spec → `spec land {work_unit}`.
- A gap → `raise {work_unit}.specification --replaces {decision_id} --reason {reason}` where it changes a decision; otherwise `ledger ask {work_unit}.specification`, then `raise {work_unit}.specification --answers {question_id}`; the person's own decision → `ledger decide|replace {work_unit}.specification`; a fact shown wrong → `ledger replace {work_unit}.specification --reason was-wrong`; what relied on it → `ledger affected {work_unit} {topic}`, `ledger hold`.
- The cut → `cut {work_unit}`.
- The review page → `spec page|published|marks|push {work_unit}`.
- The close → `checklist show|done|skip|close ready-to-build {work_unit}`, then `render ready-to-build {work_unit} [--page]`, whose picks run `ready-to-build yes`.
- The split → `render horizon-pick|postpone-gate {work_unit}.discovery.{topic}`, then `topic postpone` as the confirm's yes runs it, and `render topic-receipt`.
- A gate's answer → `gate "{name}" --pick {key}`, or `--typed {key}` for a typed row such as a Comment.

## Closing

Once the cut has landed, ready to build closes on its checklist; `checklist show ready-to-build {work_unit}` lists its items, and the engine checks most of them. Yours:
- `replacements-checked` — each replacement made at the spec holds up against what it replaced, its why says why, and every entry that relied on what it replaced has been confirmed (`ledger hold`) or replaced.
- `invariants-checked` — each invariant in the spec names the hard check that enforces it, or says no check can. One that does neither is a gap (**[writing-and-review.md](references/writing-and-review.md)**).

Mark each as it holds, `checklist done ready-to-build {work_unit} {item}`, or skip it with its reason, `checklist skip ready-to-build {work_unit} {item} --reason "{reason}"`. Close it, `checklist close ready-to-build {work_unit}`, then load **[ready-to-build.md](references/ready-to-build.md)** and follow its instructions as written.

## Backlogging

The person puts an idea, a bug or a fix aside — "roadmap it", "inbox it", "backlog that", "push it back". Load **[backlogging.md](../leeway-shared/references/backlogging.md)** with work_unit = `{work_unit}`, topic = `{work_unit}`, phase = `specification`.

## Splitting the Epic

An epic's outline or the read across its topics grows unwieldy, or the person asks to split it. Load **[ready-to-build.md](references/ready-to-build.md)** and follow its instructions as written, from **The Split**.

## A Change at Ready to Build

The person asks at ready to build for a change to the outline or the phase cut. Load **[ready-to-build.md](references/ready-to-build.md)** and follow its instructions as written, from **A Change Asked For**.

## Comments on the Review Page

The person says they have left comments on the review page, or asks about one. Load **[review-page.md](references/review-page.md)** and follow its instructions as written, from **Reading the Marks**.

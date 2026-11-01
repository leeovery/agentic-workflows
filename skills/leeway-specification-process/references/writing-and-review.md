# Writing and Review

*Reference for **[leeway-specification-process](../SKILL.md)***

---

The writer assembles `spec.md` from the records alone; `spec land` checks it and commits it; a review pass reads what changed against the records and the code; what a pass finds goes to the writer, the ledger or the person; and the loop runs until a pass changes nothing. Each agent is briefed, then called — its `subagent_type` the agent `brief` answers, its prompt the pointer alone — and the work waits on its result. Every change to `spec.md` is the writer's, never yours.

## The Writer

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs brief spec-writer {work_unit}
```

A refused brief names what holds it and the way on — a gap waiting on the person, the raise that puts it to them again; the sweep's calls waiting at approve the map: take it. Once the writer reports, land what it wrote:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs spec land {work_unit}
```

A land refused for what `spec.md` says goes back to the writer: brief it again — the fresh brief carries the refusal — and call it again. A refusal naming another move is that move's: take it. A land lists the lines that do not trace (`invented`); the next pass takes them up. Each gap the writer's status names is a gap (**Gaps**). While the person's review page is open, each land is pushed to it: load **[review-page.md](review-page.md)** and follow its instructions as written, from **Pushing a Change**, where this conversation has not loaded it already.

## A Review Pass

After each land, a pass reads what changed. Dispatch it, then brief it, `--agent` taking the id the dispatch answers, `{dispatch_id}`:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs agent dispatch {work_unit} specification {work_unit} --kind spec-review
node .claude/skills/leeway-engine/scripts/engine.cjs brief spec-reviewer {work_unit} --agent {dispatch_id}
```

A refused brief names the way on — nothing changed since the last pass, or what still waits before one — and you take it.

## A Pass's Report

Once the pass reports, `agent scan {work_unit} specification {work_unit}` takes its report in; one it lists under `refused` does not read, and another pass goes, its brief carrying the refusal. Read the report, then acknowledge it with every finding it holds, `agent ack {work_unit} specification {work_unit} {dispatch_id} --findings {F1,F2}`, or `--clean` where it found none. Take each finding by its lane:
- **rewrite** — the writer's, whole: its next brief carries the report, and the writer judges each finding against the records.
- **gap** — re-derive it from the record; one it holds is a gap (**Gaps**), and once raised, surface it by its label in the report, `{finding}`: `agent surface {work_unit} specification {work_unit} {dispatch_id} {finding}`.
- **fact** — re-derive it from the record: a measurement or the code shows a finding on the ledger wrong. Replace that entry, `ledger replace {work_unit}.specification --replaces {entry_id} --reason was-wrong`, a finding's content with the new result on stdin — the replacement stands on the entry's topic. Then confirm each decision relying on it (`ledger hold`) or replace it, a decision of the person's through `raise --replaces`, and surface the report's finding.

A gap or a fact the record shows wrong, or already answers, is declined: left unsurfaced. Once the rest are surfaced, `agent incorporate {work_unit} specification {work_unit} {dispatch_id}` closes the pass.

Then the writer goes again with what waits for it — the rewrites, and the entries written at the spec since its last brief — and its land takes the next pass. The review has settled once a pass changes nothing and nothing waits: `review-settled` holds.

## Gaps

A gap is a detail the build would meet that no entry decides, two entries that contradict each other, an invariant naming no check, or a why a statement needs that no record holds. It is decided at the spec, as any call is. Decide its route first:
- **It changes a decision already made** — raise the replacement, `raise {work_unit}.specification --replaces {decision_id} --reason {reason}`, which stands on that decision's topic. A replacement answers no question: ask none.
- **It decides something afresh** — its question goes on the ledger, `ledger ask {work_unit}.specification` with `{"text", "by": "claude|review", "who_moved_whom": "none"}` on stdin — `review` for a pass's finding — and is raised, `raise {work_unit}.specification --answers {question_id}`.

Put the question and its rows as the person meets the product — what it does, or what its user meets — never by a spec section's number. Whether it reaches the person is the engine's to decide. Its answer lands at the spec, and the writer's next brief carries it.

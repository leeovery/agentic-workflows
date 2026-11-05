# The Phase Close

*Reference for **[leeway-implementation-process](../SKILL.md)***

---

Phase {N} closes once every task of it is done or closed: its notes for later consolidated, one phase review over its whole change, its stack merged, and its close checklist closed. Its checklist holds the order of what is left — every item is the engine's, and each open one names what stands in the way:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs checklist show phase-close {work_unit} {N}
```

## The Notes

While `notes-consolidated` is open, brief the consolidation agent, then make the Agent call — its `subagent_type` the agent `brief` answers, its prompt the pointer alone — and wait for its status:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs brief consolidation {work_unit} {N}
```

It drops what the code already settled and records the rest as tasks of the phase, which go through the task loop like any other. A note needing the person's call goes through the door for a call (**[outside-the-plan.md](outside-the-plan.md)**, place = `implementation`), parking each written task it bears on. Load **[waiting-on-the-person.md](waiting-on-the-person.md)** and follow its instructions as written.

## The Phase Review

Once every task of the phase is done or closed, the consolidation's among them, and the phase's mutation run made — named by whatever ended its last task (**[the-task-loop.md](the-task-loop.md)**), or else by this brief's refusal — brief each reviewer of the pair, `{letter}` `a` and `b`, and make their Agent calls side by side:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs brief phase-review {work_unit} {N} --letter {letter}
```

A report that does not read — the checklist naming it, or `land phase` refusing it — goes back to its reviewer: its brief again, by SendMessage to its id, which names the report it replaces. A review every reviewer passes leaves the merge. Where one fails, read its findings and judge what the phase owes. Each fix it owes is a task of the phase, written as **[outside-the-plan.md](outside-the-plan.md)** writes one, place = `implementation`; then settle the review, naming them — or naming none where the findings ask nothing of this phase — with why written to `.leeway/.cache/{work_unit}/build/settle.md`:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs task settle {work_unit} --phase {N} --file .leeway/.cache/{work_unit}/build/settle.md [--fixes {task},…]
```

The fix tasks go through the task loop, each passed by its pair; no phase review runs over them again. A finding for a later phase, or a note for later in the review's reports, lands through the doors (**[outside-the-plan.md](outside-the-plan.md)**, place = `implementation`).

## The Merge

Fetch the phase's merge gate:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render phase-merge-gate {work_unit} {N}
```

It is refused where the build runs in auto, where the stack merges with no gate: merge it, `land phase {work_unit} {N}`. Otherwise emit its sections verbatim per their markers, which ends the turn, and take the person's answer to `gate "phase merge"`: its yes's `next` merges the stack. A Comment's change, once confirmed, is a task of the phase through the task loop, and the gate comes again once it is done. A merge refused after the yes names its way on: take it, then run `land phase {work_unit} {N}` again.

## The Close

Close the checklist, `checklist close phase-close {work_unit} {N}`. The first phase's close is refused until the verify setup is recorded: the product running and drivable is that phase's to build.

Then write in the build's log what the phase left for the next.

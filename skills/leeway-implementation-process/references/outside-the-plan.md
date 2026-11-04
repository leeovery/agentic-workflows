# Outside the Plan

*Reference for **[leeway-implementation-process](../SKILL.md)***

---

Something the plan never held has turned up: a bug the person reports, a gap or a find an agent reports beyond its task, a finding a phase review leaves for later. Judge where it goes and land it through one door. No code changes without a task, and a find never corrects the spec, which is concluded: one bearing on a decision lands on the ledger. Write anything a door takes from a file to `.leeway/.cache/{work_unit}/build/`.

## The Doors

- **A task in this phase, or a later one already written** — write its file, then record it and link it after any unfinished task it waits on:

  ```bash
  node .claude/skills/leeway-engine/scripts/engine.cjs task create {work_unit} {N} --file .leeway/.cache/{work_unit}/build/task.md
  node .claude/skills/leeway-engine/scripts/engine.cjs task link {work_unit} {task} --after {task}
  ```

- **A phase not yet written** — held for its task writer, `task note {work_unit} --file {note} --phase {N}`.
- **A note for later** — what lies outside the task, an improvement or an edge beyond its boundary, for the phase's consolidation: `task note {work_unit} --file {note}`. A wrong result in what a task does is never a note: it is a finding, or a fix task.
- **A call, or a question for the person** — `ledger ask {work_unit}.implementation`, then `raise {work_unit}.implementation --answers {question_id}`, each with `--task {task}` and `--parks {task}` where it was met in one. Whether it reaches the person is the engine's to decide. One met in no task parks nothing, so hold what it touches yourself: raise it again with `--parks {task}` for each written task it bears on, and where a danger rides on its answer — work that would be lost or wrong if built first — start nothing that depends on it until it is answered.
- **A decision in the unit's own record that must change** — replaced where it is found, never sent as a message: `raise {work_unit}.implementation --replaces {decision_id} --reason {reason}`, with `--parks {task}` where a task waits on it. Then `ledger affected {work_unit}` lists what relied on it: confirm each entry that still holds, `ledger hold {work_unit}.implementation --entry {id} --after {replacement_id}`, or replace it; whatever was built on the old answer is reworked by tasks.
- **A message to another unit's topic still in discussion** — what this build found, and what that topic is asked to decide, its first line the title, written to `.leeway/.cache/{work_unit}/build/message-{slug}.md`, sent from this unit's topic it bears on — a single-topic unit's its own — then its report emitted per its marker:

  ```bash
  node .claude/skills/leeway-engine/scripts/engine.cjs topic send {unit} {topic} --from {work_unit}.{from_topic} --content .leeway/.cache/{work_unit}/build/message-{slug}.md --slug {slug}
  node .claude/skills/leeway-engine/scripts/engine.cjs render send-report {unit}.{topic} --sent {path}
  ```

- **The inbox or the roadmap** — load **[backlogging.md](../../leeway-shared/references/backlogging.md)** with work_unit = `{work_unit}`, topic = `{work_unit}`, phase = `implementation`.

## A Task's File

A task you write takes the tracker's template, every field there once and none empty: a level-one title on one line; then `## Type` — `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci` or `chore` — `## Problem`, `## Solution` and `## Outcome`, in the product's terms; `## Acceptance scenarios`, a list, a fix task's or a note's carrying the scenario its finding or note gives; and `## Spec reference`, each section it draws on as `§N` or `§N.M`. It names no mechanism the record did not decide. A refusal names every fault: answer them and record it again.

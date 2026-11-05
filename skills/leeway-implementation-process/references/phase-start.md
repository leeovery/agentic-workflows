# The Phase Start

*Reference for **[leeway-implementation-process](../SKILL.md)***

---

Phase {N}'s tasks are written as it starts, against the code the phases before it left, and recorded in the tracker before anything in the phase runs. Its moves:

1. Where the phase is not yet written, write it into the tracker under its name in the cut:

   ```bash
   node .claude/skills/leeway-engine/scripts/engine.cjs task phase {work_unit} {N} --title "{name}"
   ```

2. Brief the task writer, then make the Agent call — its `subagent_type` the agent `brief` answers, its prompt the pointer alone — and wait for its status:

   ```bash
   node .claude/skills/leeway-engine/scripts/engine.cjs brief task-writer {work_unit} {N}
   ```

   It records each task and its links itself. The tasks are its alone: a task that needs changing is changed by an addition (**[outside-the-plan.md](outside-the-plan.md)**, place = `implementation`), never rewritten.

3. Each call its status names — a design several tasks touch, settled as it wrote them — and each gap goes on the ledger as a call made in no task: `ledger ask {work_unit}.implementation`, then `raise {work_unit}.implementation --answers {question_id}`. A raise that waits on the person parks nothing by itself: raise it again for each written task it bears on, `--parks {task}`, so each waits with it. Load **[waiting-on-the-person.md](waiting-on-the-person.md)** and follow its instructions as written. Once a gap is answered, brief the writer again — its brief carries the answer — and it writes the tasks the gap held back.

4. Show the phase's start checklist:

   ```bash
   node .claude/skills/leeway-engine/scripts/engine.cjs checklist show phase-start {work_unit} {N}
   ```

   `tasks-written` and `relies-on-done` are the engine's: the first stays open while a gap holds back the task one of the phase's scenarios goes to, the second until what the phase relies on is done — another unit's delivery among it — and either holds the phase back while other work goes on. Yours is `design-settled`: every design several of the phase's tasks touch is settled, written into each task it touches, and on the ledger, so no two builders settle it apart. Mark it, `checklist done phase-start {work_unit} {N} design-settled`, then close the checklist, `checklist close phase-start {work_unit} {N}`.

The phase's tasks then go into the task loop.

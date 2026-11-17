# The Phase Start

*Reference for **[ledger-implementation-process](../SKILL.md)***

---

Phase {N}'s tasks are written as it starts, against the code the phases before it left, and recorded in the tracker before anything in the phase runs. Its moves:

1. Where the phase is not yet written, write it into the tracker under its name in the cut:

   ```bash
   node .claude/skills/ledger-engine/scripts/engine.cjs task phase {work_unit} {N} --title "{name}"
   ```

2. Brief the task writer, then make the Agent call and wait for its status:

   ```bash
   node .claude/skills/ledger-engine/scripts/engine.cjs brief task-writer {work_unit} {N}
   ```

   It records each task and its links itself. The tasks are its alone: a task that needs changing is changed by an addition (**[outside-the-plan.md](outside-the-plan.md)**, place = `implementation`), never rewritten.

3. Each call its status names — a design several tasks touch, settled as it wrote them — and each gap goes on the ledger as a call made in no task: `ledger ask {work_unit}.implementation`, then `raise {work_unit}.implementation --answers {question_id}`. A raise that waits on the person parks nothing by itself: raise it again for each written task it bears on, `--parks {task}`, so each waits with it. Load **[waiting-on-the-person.md](waiting-on-the-person.md)** and follow its instructions as written. Once a gap is answered, brief the writer again, and it writes the tasks the gap held back.

4. Show the phase's start checklist:

   ```bash
   node .claude/skills/ledger-engine/scripts/engine.cjs checklist show phase-start {work_unit} {N}
   ```

   `design-settled` is yours: every design several of the phase's tasks touch is settled, written into each task it touches, and on the ledger, so no two builders settle it apart. Mark it, `checklist done phase-start {work_unit} {N} design-settled`, then close the checklist, `checklist close phase-start {work_unit} {N}`.

   A conflict the close names is settled with the person, in the conversation.

The phase's tasks then go into the task loop.

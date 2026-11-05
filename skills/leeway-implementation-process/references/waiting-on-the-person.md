# Waiting on the Person

*Reference for **[phase-start.md](phase-start.md)**, **[the-task-loop.md](the-task-loop.md)**, **[phase-close.md](phase-close.md)** and **[leeway-review-process](../../leeway-review-process/SKILL.md)***

---

A question that waits parks its task, and whatever depends on it, while everything else carries on: say so in the one line the raise answers. A parked task waits, its builder idle, until the answer frees it. A question is drawn only once the person says they are ready to discuss it.

When nothing left can go on without an answer, stop: fetch the stop report and emit its sections verbatim per their markers, which ends the turn.

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render build-stop {work_unit}
```

It refuses while anything can go on, naming what: take that on instead. In the review, once every report of the round is in, the stop is your call, for a question the round's settling needs.

# Waiting on the Person

*Reference for **[leeway-implementation-process](../SKILL.md)***

---

A question that waits parks its task, and whatever depends on it, while everything else carries on: say so in the one line the raise answers. A parked task waits, its builder idle, until the answer frees it: the receipt says it builds again, and its builder goes back in the same way. A question is drawn only once the person says they are ready to discuss it.

When nothing left can go on without an answer, stop: fetch the stop report and emit its sections verbatim per their markers, which ends the turn.

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render build-stop {work_unit}
```

It refuses while anything can go on, naming what: take that on instead.

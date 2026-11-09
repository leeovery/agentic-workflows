# Questions Waiting

*Reference for **[leeway-implementation-process](../SKILL.md)**, **[leeway-quick-fix-process](../../leeway-quick-fix-process/SKILL.md)** and **[leeway-review-process](../../leeway-review-process/SKILL.md)***

---

The person is ready to talk about the questions waiting on them: one, several in the order they queued them, or all of them, oldest first. The questions waiting, each with the tasks it parks, are `raise waiting {work_unit}`. The other tasks carry on while you talk.

Take the questions one at a time. For each, say first what it is about, in full and product first, from the work as it stands now, then draw it from its park and emit its sections verbatim per their markers, which ends the turn:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs raise draw {work_unit} Q{n}
```

The answer is the person's, recorded through `raise answer` as the framework says. Show the `receipt` the answer carries, as it is. Each task it says builds again goes back to its builder now: its brief again, `brief builder {work_unit} {task}`, by SendMessage to the builder's id, or through the task loop afresh where it has none — a quick-fix's started again first, `task start {work_unit} {task}`, which puts back what its park set aside. One it says builds again once another task is done — at a quick-fix, done or closed, or parked — waits for `task ready` to name it back; one it says builds again once its pair has read a round waits for that round's reports, and the loop goes on from its pair by them (**[the-task-loop.md](the-task-loop.md)**). Where the receipt names the next question, draw that one; otherwise take the next the person asked for, until none is left.

A question left half-answered still waits; nothing records it. The person may set several aside in one go, or skip one or cancel the rest from the board, which puts a line in the conversation: set aside each such question, by number, in one call, and show its receipt as it is:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs raise aside {work_unit} Q{n} …
```

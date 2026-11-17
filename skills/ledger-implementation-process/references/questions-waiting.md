# Questions Waiting

*Reference for **[ledger-implementation-process](../SKILL.md)**, **[ledger-quick-fix-process](../../ledger-quick-fix-process/SKILL.md)** and **[ledger-review-process](../../ledger-review-process/SKILL.md)***

---

The person is ready to talk about the questions waiting on them: one, several in the order they queued them, or all of them, oldest first. The questions waiting, each with the tasks it parks, are `raise waiting {work_unit}`. The other tasks carry on while you talk.

Take the questions one at a time. For each, say first what it is about, in full and product first, from the work as it stands now, then draw it from its park:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs raise draw {work_unit} Q{n}
```

Show the `receipt` the answer carries, as it is. Each task it says builds again goes back to its builder now, as the task loop takes a task answered `back`: its brief again, `brief builder {work_unit} {task}`, by SendMessage to the builder's id, or through the task loop afresh where it has none. One it says builds again once another task is done — at a quick-fix, done or closed, or parked — waits for `task ready` to name it back; one it says builds again once its pair has read a round waits for that round's reports, and the loop goes on from its pair by them (**[the-task-loop.md](the-task-loop.md)**). Where the receipt names the next question, draw that one; otherwise take the next the person asked for, until none is left.

A question left half-answered still waits; nothing records it. The person may set several aside in one go, or skip one or cancel the rest from the board, which puts a line in the conversation: set aside each such question, by number, in one call, and show its receipt as it is:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs raise aside {work_unit} Q{n} …
```

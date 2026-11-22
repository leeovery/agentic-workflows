# Gates, auto and step

A gate is a stop where Ledger shows a menu and waits. Every row has a key and a word; where the Claude Code mod runs, rows are buttons above the prompt — click to pick, click again to send — and typing a key or plain words always works. A question typed at a gate sets it aside while you talk, and it comes back when you're done.

```
   ◆  a question, stated for the person deciding

      y/yes    → the answer, saying what it does
      b/back   → the way back
      Comment  → a prompt row: say it in your own words
```

Gates come in three kinds. The authority gates always stop, whatever else is going on: starting the work, approving an epic's map, a topic's decision, ready to build, and finish. Product questions, the calls about what the product should do, go through the ask rule: Claude answers most of them the way you would have, learned from your own answers, and asks you where its calls of that kind still miss more often than you allow. A call that would be hard to undo asks sooner, and one that could lose data or weaken security always asks. Routine gates are learned: one you always answer the same way runs on its own with a one-line report in its place, and starts asking again once your answers vary.

When you change one of Claude's calls, you're later asked what its answer would have cost the product — nothing, a fix, or a real loss. Those verdicts are what the ask rule learns from, and while any wait, the start menu has a row for them.

The build runs in one of two positions, chosen at ready to build, auto first. In auto it runs on its own: only the authority gates, danger and the questions that need you reach you, and a question parks only the tasks that depend on it. In step it also stops after each task, with its account, for you to review and try it, and tasks run one at a time. Switch at any time by saying so, or with `a/auto` on step's stop.

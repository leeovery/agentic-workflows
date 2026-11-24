# Decisions From Before Ledger

*Shared reference. Loaded where an entry's DATA names it as `decisions from before`, once the work meets code one of those decisions bears on.*

---

A decision whose entry's `session` is `migration` came across from the documents from before Ledger: it says what they decided, and the migration never read the code for it. The code is the truth of what is built, and it may have moved on since. Code that does not yet do what was decided, in a part the build has not reached, is work still to do. Code that no longer does it, in a part built and changed since, is built otherwise.

## Built Otherwise

Record a finding on the decision, `how` naming the file and what in it shows this. Then weigh which stands, the decision or the code: when the decision's source was written against when the code last changed, from the git history of those lines; whether the change looks deliberate; how easily the call is undone.

- **The code clearly stands, and the call is easy to undo**: it is your call. Raise the decision's replacement with what the code does, citing the finding. The ask rule decides whether it reaches the person, as it does for any call; where it goes ahead, it lands as your call, among those the person sees made without them, and they can replace it.
- **Otherwise** — either could be right, or the decision looks right and the later code wrong: the person decides, before the code changes. Raise the replacement under `--always built-otherwise`, which always asks, parking in the build the task that would change the code. Your lean is your own read of which should stand: one of the proposals, or `keep`.

The person's keep holds the decision, and the build changes the code to match; the work that changes it replaces the finding with what the code does then.

## Doors

Every call is `node .claude/skills/ledger-engine/scripts/engine.cjs {verb} …`, its content one JSON object on stdin through a quoted heredoc (`<<'JSON'`). `{place}` is where the phase writes to the ledger, as its skill names it; `--task` and `--parks` are the build's, naming a task.

- The finding → `ledger find {place} --relies-on {decision} [--task {task}]`, `{"text", "how", "known": "read", "by": "claude", "who_moved_whom": "none"}`.
- Your call → `raise {place} --replaces {decision} --reason new-fact --cause {finding} [--parks {task}]`, `{task}` the one the work is in.
- The person's → `raise {place} --replaces {decision} --reason new-fact --cause {finding} --always built-otherwise [--parks {task}]`, `{task}` the one that would change the code.
- Either raise's call → `{"question", "rows": [{"key", "name", "text", "notice"}], "lean", "why", "sort": "one|several", "mechanism", "product_wide"}`, `lean` a row's key, or `keep` under `--always built-otherwise`.
- The finding, once the code matches the decision kept → `ledger replace {place} --replaces {finding} --reason was-wrong --relies-on {decision} [--task {task}]`, `{"drops": ["{what the finding said}"], "text", "how", "known": "read", "by": "claude", "who_moved_whom": "none"}`.

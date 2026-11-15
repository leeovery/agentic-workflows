# Legacy Files

*Shared reference. Loaded by `leeway`'s `start-menu.md` and by `leeway-continue-epic`, at the row of legacy files.*

---

The row's `asset legacy` answered `places`: each unit, or the product, holding files the migration found no place for, each place's `files` below its `assets/legacy/`. Show the person each place and what its folders hold, and say which look like the record of finished work — a built unit's implementation and review files, a completed quick-fix's plan — and which hold knowledge never brought in: agent reports, research, notes. Offer to keep the first kind whole, a folder or a whole place at once, and go a file at a time only where the person wants something brought in. `{path}` is a file as `files` names it, or the folder holding the files sorted together.

- **Keep it** → `asset keep {place} '{path}'`. Everything naming it follows it to its new path, `moved`'s `to`.
- **Bring it in** — read the file, keep it, then record what it holds that the work will want as findings at the place's `findings_at`, each citing the file at its new path, `{section}` the heading the finding draws on, or the file's name where it has none:

  ```bash
  node .claude/skills/leeway-engine/scripts/engine.cjs ledger find {findings_at} <<'EOF'
  {"text": "{finding}", "how": "{how}", "known": "documented", "cites": [{"path": "{to}", "section": "{section}"}], "by": "claude", "who_moved_whom": "none"}
  EOF
  ```

  A question it leaves open that bears on a topic of the unit still in discussion goes to that topic as a message, written first to `.leeway/.cache/{place}/discovery/message-{slug}.md`:

  ```bash
  node .claude/skills/leeway-engine/scripts/engine.cjs topic send {place} {topic} --from {place}.discovery --content .leeway/.cache/{place}/discovery/message-{slug}.md --slug {slug}
  ```

  With no such topic, it is a finding saying what the file leaves open: ``{file} leaves open whether …``.
- **Discard it** → `asset discard {place} '{path}'`, once the person has said to; the state's history keeps it. Where its `named` is above none, say how many things name it before they say: discarding leaves each pointing at nothing.

Each answer's `left` counts what still waits in the place. The pass ends when nothing is left, or where the person stops; what is left waits on the same row.

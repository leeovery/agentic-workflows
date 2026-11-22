# Legacy Files

*Shared reference. Loaded by `ledger`'s `start-menu.md` and by `ledger-continue-epic`, at the row of legacy files.*

---

The files are what the migration found no place for, below each place's `assets/legacy/`: a unit's, or the product's. From the start menu, `asset legacy` answered `places`, each with its `work_type`, its `status`, its topics `in_discussion` and its `folders`, every folder's `count` of files and how many of them something already `named`. From an epic's menu, `asset legacy {place}` answered that epic alone, in progress, with its `in_discussion`, its `folders` and its `files`. Show the person each place and what its folders hold, sorted by what the read knows. `{path}` is a file as `files` names it, or a folder as `folders` names it, the files below it sorted together.

Take them a file or a folder at a time, reading one only where the person wants something brought in; `asset legacy {place}` lists a place's files. Each ends one of three ways, on the person's word:

- **Keep it** → `asset keep {place} '{path}'`. Everything naming it follows it: a file answers its new path, `to`; a folder, the count it `kept` and `to`, where they went.
- **Bring it in** — read the file, keep it, then record what it holds that the work will want as findings at the place's `findings_at`, which `asset legacy {place}` answered, each citing the file at its `to`, `{section}` the heading the finding draws on, or the file's name where it has none:

  ```bash
  node .claude/skills/ledger-engine/scripts/engine.cjs ledger find {findings_at} <<'EOF'
  {"text": "{finding}", "how": "{how}", "known": "documented", "cites": [{"path": "{to}", "section": "{section}"}], "by": "claude", "who_moved_whom": "none"}
  EOF
  ```

  A question it leaves open that bears on one of the place's topics `in_discussion` goes to that topic as a message: what the file holds, and what the topic is asked to decide. Write it to `.ledger/.cache/{place}/discovery/{place}/message-{slug}.md`, its first line the title, and send it:

  ```bash
  node .claude/skills/ledger-engine/scripts/engine.cjs topic send {place} {topic} --from {place}.discovery --content .ledger/.cache/{place}/discovery/{place}/message-{slug}.md --slug {slug}
  ```

  Draw the report from the send's `message_path`:

  ```bash
  node .claude/skills/ledger-engine/scripts/engine.cjs render send-report {place}.{topic} --sent {message_path}
  ```

  A question bearing on no topic in discussion is a finding saying what the file leaves open: ``{file} leaves open whether …``.
- **Discard it** → `asset discard {place} '{path}'`, once the person has said to; the state's history keeps it. `asset legacy {place}` answers each file's and folder's `dead`: where it is more than 0, say how many things the discard leaves pointing at nothing before they say.

Each answer's `left` counts what still waits in the places it sorted. The pass ends when nothing is left, or where the person stops; what is left waits on the same row.

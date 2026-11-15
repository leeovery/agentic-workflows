# Legacy Files

*Shared reference. Loaded by `leeway`'s `start-menu.md` and by `leeway-continue-epic`, at a row of legacy files, with place = the unit or `product`.*

---

The row's `asset legacy {place}` answered its `files`: what the migration kept, below the place's `assets/legacy/`, of files that had no place in Leeway. Sort them with the person, a file at a time, or a folder at a time where its files belong together. Read each before asking, and say in a line what it holds and what you would do with it. The person picks one of three, and `{path}` is the file as `files` names it, or the folder holding the files sorted together:

- **Bring it in** — what it holds joins the record. Move it first:

  ```bash
  node .claude/skills/leeway-engine/scripts/engine.cjs asset bring {place} '{path}'
  ```

  Then record what each file holds that the work will want: each fact, and each question it leaves open, as a finding at the answer's `findings_at`, citing the file at `{moved}`, the path `moved` gives it now, and `{section}`, the heading the finding draws on, or the file's name where it has none:

  ```bash
  node .claude/skills/leeway-engine/scripts/engine.cjs ledger find {findings_at} <<'EOF'
  {"text": "{finding}", "how": "{how}", "known": "documented", "cites": [{"path": "{moved}", "section": "{section}"}], "by": "claude", "who_moved_whom": "none"}
  EOF
  ```

- **Keep it as is** → `asset keep {place} '{path}'`, the file moved untouched.
- **Discard it** → `asset discard {place} '{path}'`, only once the person has said to; the state's history keeps it.

Each answer's `left` counts what still waits. The pass ends at none, or where the person stops; what is left waits on the same row.

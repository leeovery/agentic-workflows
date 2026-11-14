# Migration Review

*Reference for **[leeway](../SKILL.md)***

---

Files were updated, a migration handed over checks its code could not perform, a migration handed back a notice for the person, or the migration into Leeway has finished and waits on its commit. You MUST complete the steps below before proceeding.

1. **If `migrations.verify` is non-empty:** each entry is a migration the run carried out. Its `info` says what the migration does in any project; its `verify` says what to check in this one. Perform each entry's checks with judgment against the actual files — the migration's code is exact-match and may have missed what it could not recognise — and fix what you find. Your fixes are migration changes: they join the summary and the commit below. An entry marked `made` was checked when the migration stopped before its move: check nothing again, and list it in the summary among what was done, as its `verify` asks.

2. Read where the review stands:

   ```bash
   node .claude/skills/leeway-engine/scripts/engine.cjs migrate review
   ```

   It answers `state`, the state's folder, and `code`, the folder the code side's commit lands in, both absolute.

   **If it answers `reshape`**, the migration into Leeway waits on its commit: the summary is written from `reshape` — `units` moved, `topics` carried, the `directives` done, and `files`, the code files the commit takes, named from `code` — with the files the move left in `.workflows/`, as its addendum in `migrations.verify` names them. Read no diff of the state: while `commits` names `state`, the state branch's first commit takes it whole, and once it names `code` alone, that commit is made.

   **Otherwise**, see what changed on both sides the commit below takes: run `git -C {state} status --short` and `git -C {state} diff HEAD` for the state, and `git -C {code} status --short -- .claude/settings.json .worktreeinclude .gitignore` and `git -C {code} diff HEAD -- .claude/settings.json .worktreeinclude .gitignore` for the files the workflows own in the code tree. Status shows moved and newly-created files that diff cannot (untracked destinations render a move as bare deletions) — read both before summarising.

   **If it answers no `reshape`, nothing changed, and `migrations.notices` is empty** (the migrations skipped everything and verification found nothing to fix):

   > *Output the next fenced block as a text code block (```text fence):*

   ```text
   All documents up to date.
   ```

   **Do not stop here.** Nothing needs review.

   → Return to caller.

3. Write a brief natural language summary of what the migrations did — verification fixes included (e.g., "Restructured workflow directories, created manifest files, recovered a message the converter missed"). Focus on the nature of the changes, not individual file paths — these are internal workflow state files.
4. Write the summary to `{state}/.cache/migrations-applied.json` with the Write tool — `{"summary": "{your natural language summary}", "notices": [{each entry's notice}], "migrations": {N}, "files": {M}}`, each `notice` from `migrations.notices` verbatim, `notices` left out when it is empty; `{N}`/`{M}` from `migrations.output`'s `{N} migration(s) applied, {M} file(s) updated.` line; when it reports no changes, leave both counts out. Fetch the summary and emit its section verbatim per its marker:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render migrations-applied --file {state}/.cache/migrations-applied.json
```

5. Fetch the confirm gate and emit its `MENU: migration gate` section verbatim per its marker:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render migration-gate
```

**STOP.** Wait for user response.

**If `yes`:**

Commit the migration changes — one commit on each side that changed, or, for the migration into Leeway, each commit `reshape` named in `commits`:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs commit --migrations -m "chore: apply workflow migrations"
```

→ Return to caller.

**If ask:**

Answer the user's question. The question sets the gate aside; once the exchange looks settled, ask in conversation whether they are ready to move on, and on yes put it back — fetch the confirm gate again and emit it as above.

**STOP.** Wait for user response.

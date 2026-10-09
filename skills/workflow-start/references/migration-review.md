# Migration Review

*Reference for **[workflow-start](../SKILL.md)***

---

Files were updated, a migration handed over checks its code could not perform, or one handed back a notice for the person. You MUST complete the steps below before proceeding.

1. **If `migrations.verify` is non-empty:** each entry is a migration that ran this boot. Its `info` says what the migration does in any project; its `verify` says what to check in this one. Perform each entry's checks with judgment against the actual files — the migration's code is exact-match and may have missed what it could not recognise — and fix what you find. Your fixes are migration changes: they join the diff, the summary, and the commit below.

2. Run `git status --short -- .workflows .claude/settings.json .worktreeinclude .gitignore` and `git diff HEAD -- .workflows .claude/settings.json .worktreeinclude .gitignore` to see what changed — the paths the commit below takes. Status shows moved and newly-created files that diff cannot (untracked destinations render a move as bare deletions) — read both before summarising.

   **If nothing changed and `migrations.notices` is empty** (the migrations skipped everything and verification found nothing to fix):

   > *Output the next fenced block as a text code block (```text fence):*

   ```text
   All documents up to date.
   ```

   **Do not stop here.** Nothing needs review.

   → Return to caller.

3. Write a brief natural language summary of what the migrations did — verification fixes included (e.g., "Restructured workflow directories, created manifest files, recovered a message the converter missed"). Focus on the nature of the changes, not individual file paths — these are internal workflow state files.
4. Write the summary to `.workflows/.cache/migrations-applied.json` with the Write tool — `{"summary": "{your natural language summary}", "notices": [{each entry's notice}], "migrations": {N}, "files": {M}}`, each `notice` from `migrations.notices` verbatim, `notices` left out when it is empty; `{N}`/`{M}` from `migrations.output`'s `{N} migration(s) applied, {M} file(s) updated.` line; when it reports no changes, leave both counts out. Fetch the summary and emit its section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render migrations-applied --file .workflows/.cache/migrations-applied.json
```

5. Fetch the confirm gate and emit its `MENU: migration gate` section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render migration-gate
```

**STOP.** Wait for user response.

**If `yes`:**

Commit the migration changes:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --migrations -m "chore: apply workflow migrations"
```

→ Return to caller.

**If ask:**

Answer the user's question. The question sets the gate aside; once the exchange looks settled, ask in conversation whether they are ready to move on, and on yes put it back — fetch the confirm gate again and emit it as above.

**STOP.** Wait for user response.

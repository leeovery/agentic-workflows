# Migration Review

*Reference for **[ledger](../SKILL.md)** and **[ledger-keep](../../ledger-keep/SKILL.md)***

---

Files were updated, a migration handed over checks its code could not perform, a migration handed back a notice for the person, or the migration into Ledger has finished and waits on its commit. You MUST complete the steps below before proceeding.

1. **If `migrations.verify` is non-empty:** each entry is a migration the run carried out. Its `info` says what the migration does in any project; its `verify` says what to check in this one. Perform each entry's checks with judgment against the actual files — the migration's code is exact-match and may have missed what it could not recognise — and fix what you find. Your fixes are migration changes: they join the summary and the commit below. A file kept as legacy is no finding: it stays where it was kept, and sorting it is ordinary work after the migration. An entry marked `made` was checked when the migration stopped before its move: check nothing again, and list it in the summary among what was done, as its `verify` asks.

2. Read where the review stands:

   ```bash
   node .claude/skills/ledger-engine/scripts/engine.cjs migrate review
   ```

   It answers `state`, the state's folder, and `code`, the folder the code side's commit lands in, both absolute.

   **If it answers `reshape`**, the migration into Ledger waits on its commit, and its summary is written in parts, from `reshape` and the addenda in `migrations.verify`:
   - `moved` — the `units` moved into `.ledger/`, each unit renamed and each registry entry dropped;
   - `records` — the `records` carried, by count;
   - `corrections` — each of the `corrections`, by its unit: what disagreed, what was found and what was changed;
   - `checks` — each check made before the move, the entries marked `made`, and each fix step 1 made;
   - `legacy` — one line: how many files were kept as legacy, and where, never the files themselves nor a count for each unit (e.g., "{N} files with no place of their own, kept as legacy in each unit's `assets/legacy/`");
   - `code` — what the code commit changes: `files`, named from `code`, and the linter settings left out.

   A part with nothing in it is left out. Read no diff of the state: while `commits` names `state`, the state branch's first commit takes it whole, and once it names `code` alone, that commit is made.

   **Otherwise**, see what changed on both sides the commit below takes: run `git -C {state} status --short` and `git -C {state} diff HEAD` for the state, and `git -C {code} status --short -- .claude/settings.json .worktreeinclude .gitignore` and `git -C {code} diff HEAD -- .claude/settings.json .worktreeinclude .gitignore` for the files Ledger owns in the code tree. Status shows moved and newly-created files that diff cannot (untracked destinations render a move as bare deletions) — read both before summarising.

   **If it answers no `reshape`, nothing changed, and `migrations.notices` is empty** (the migrations skipped everything and verification found nothing to fix):

   > *Output the next fenced block as a text code block (```text fence):*

   ```text
   All documents up to date.
   ```

   **Do not stop here.** Nothing needs review.

   → Return to caller.

3. Write a brief natural language summary of what the migrations did, step 1's fixes among it, the reshape's in its parts (e.g., "Restructured workflow directories, created manifest files, recovered a message the converter missed"). Say only what was done, never what was not (e.g., never "no point was left for you to settle"). Beyond what step 2 names, describe the nature of the changes, not individual file paths — these are Ledger's internal state files.
4. Write the summary to `{state}/.cache/migrations-applied.json` with the Write tool — `{"summary": "{your natural language summary}", "notices": [{each entry's notice}], "migrations": {N}, "files": {M}}`, the reshape's in place of `summary` as `"parts": {"{part}": "{its account}", …}`, each `notice` from `migrations.notices` verbatim, `notices` left out when it is empty; `{N}`/`{M}` from `migrations.output`'s `{N} migration(s) applied, {M} file(s) updated.` line; when it reports no changes, or the summary is the reshape's, leave both counts out. Fetch the summary:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render migrations-applied --file {state}/.cache/migrations-applied.json
```

5. Work the screen `migration-gate` as the boot reference's **A Setup Screen** says.

   → Return to caller.

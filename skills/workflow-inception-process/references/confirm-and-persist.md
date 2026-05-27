# Confirm and Persist

*Reference for **[workflow-inception-process](../SKILL.md)***

---

Persists **new topics** from the working list to the manifest and finalises the session log (replaces the `(none)` Conclusion placeholder so resume detection sees a closed session next time).

Edits to existing items have already committed via [map-operations.md](map-operations.md) during the session loop — they do not pass through the manifest-writes step here, but they may have created the session log file, which still needs Conclusion finalisation.

## A. Persist New Topics

#### If the working list is empty

No new topics surfaced this session.

→ Proceed to **B. Finalise the session log**.

#### Otherwise

For each topic on the working list, in the order the user surfaced them:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs pull {work_unit}.inception dismissed "{topic}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.inception.{topic}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{topic} summary "{one-line summary}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{topic} description "{paragraphs}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{topic} routing {research|discussion}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.inception.{topic} source inception
```

The `pull` is a no-op if the name isn't in the dismissed list — harmless. It exists to support re-adds of previously dismissed names without needing a separate code path.

Derive `summary` and `description` from the same session conversation in the same turn — no separate prompt. The compact `• {topic} — {summary}` form in the working list stays unchanged; description is generated only at persist time.

If any command fails, surface the error and stop before the commit so the user can recover.

Notes:

- `init-phase` creates the item with `status: in-progress` automatically. Inception items have no other valid status — do not pass `status` explicitly.
- The topic name is the manifest dict key (third dot-path segment). There is no separate `name` field to set.
- `summary` is the one-line description from the working list. Quote the value in shell — single quotes if it contains `[]`, `{}`, `~`, or backticks.
- `description` is a paragraph or two of richer context, derived from the same conversation that produced the summary. Entry skills load it as opening context when the user later picks the topic up for research or discussion. Length is not enforced — a paragraph or two is the target, but more or less is fine. Map renders never show it. Quote the value the same way as summary; multi-paragraph content can include embedded newlines.
- `routing` is the value the user agreed to during the session.
- `source: inception` distinguishes user-surfaced topics from later auto-additions (`research-analysis`, `gap-analysis`, `split`, `elevation`, `direct-start`, `migration-seeded`).

→ Proceed to **B. Finalise the session log**.

## B. Finalise the session log

The session log path is `.workflows/{work_unit}/inception/session-{session_number:03d}.md`.

#### If the working list was non-empty (topics persisted in A)

The log file may or may not exist depending on whether a natural-pause write happened during the loop. **Ensure it exists** — if missing, create it from [template.md](template.md) using the session metadata held since Step 1. Populate **Topics Identified** with the new topics in the order they surfaced.

Replace the **Conclusion** `(none)` placeholder with:

```
{N_new} topic(s) added{ and M change(s) applied | (empty if no changes)}. Map now has {T} topics.
```

Compute `{T}` by re-running discovery after the manifest writes in A.

#### If the working list was empty but the log file exists (edits-only session)

Replace the **Conclusion** `(none)` placeholder with:

```
{M} change(s) applied. Map has {T} topics.
```

#### If the log file does not exist (browse-only session, no edits, no new topics)

Nothing to finalise.

→ Return to caller.

→ Proceed to **C. Single commit**.

## C. Single commit

Check `git status`. If the working tree is dirty (manifest writes from **A** and/or session-log finalisation from **B**), commit. Adjust the staged paths and message to what's actually dirty:

- New topics + log finalisation: `inception({work_unit}): seed {N_new} new topic(s) to map`
- Log finalisation only (edits-only session): `inception({work_unit}): finalise session log`

```bash
git add .workflows/{work_unit}/manifest.json .workflows/{work_unit}/inception/session-{session_number:03d}.md
git commit -m "{message}"
```

If `git status` reports nothing to commit (browse-only session with no log file), skip the commit entirely.

→ Return to caller.

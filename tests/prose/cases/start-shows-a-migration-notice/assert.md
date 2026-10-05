The prose should have taken this path:

1. the banner, title, initialisation marker and signpost render, then
   boot runs the pending migration 067 live: it removes
   `showClearContextOnPlanAccept` from the project settings and, since
   the project's last commit carried the key, hands back its notice —
   the boot response reports the change and carries the notice in
   `migrations.notices`; there is nothing to verify
2. Step 0.1 takes the changed branch: the review reads both the status
   and the diff of the paths the workflows own, which show the settings
   file losing the key and the migrations log gaining 067
3. the summary payload is written with the session's own summary of
   what changed and the notice copied verbatim into its `notices` list;
   the summary is fetched from the engine and its section emitted
   verbatim — the person reads that the setting was removed, that the
   workflows no longer use plan mode, and how to add it back
4. the migration confirm gate is fetched and its menu emitted, and the
   walk stops there unanswered

Further claims:

- the notice reaches the person in the engine-rendered summary, never
  paraphrased in its place or left out
- nothing is committed: the migration commit runs only on the gate's
  yes, and the gate is not answered
- the overview never renders — the walk stops before the knowledge gate
  and the start menu

EXPECTED WORLD — the fixture plus, uncommitted:

- `.claude/settings.json` without `showClearContextOnPlanAccept`, every
  other key exactly as it was
- the migrations log recording 067
- `.workflows/.cache/migrations-applied.json` holding a non-empty
  summary and a `notices` list whose one entry is migration 067's
  notice word for word

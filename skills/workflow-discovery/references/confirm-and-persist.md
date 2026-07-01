# Confirm and Persist

*Reference for **[workflow-discovery](../SKILL.md)***

---

Persists the topic set produced by [topic-synthesis.md](topic-synthesis.md) to the manifest, writes the **Topics Identified** section of the session log, clears the active-session marker, finalises the **Conclusion** placeholder, and indexes the finalised log into the knowledge base.

Edits to existing items committed via [map-operations.md](map-operations.md) during the session loop. For edits-only sessions, the manifest-writes step is empty but the marker delete and Conclusion finalisation still run.

## A. Persist New Topics

The topic set was confirmed at the end of [topic-synthesis.md](topic-synthesis.md) and is held in conversation memory as the working list.

#### If the working list is empty

No new topics — this is an edits-only or browse-only session.

→ Proceed to **B. Write Topics Identified**.

#### Otherwise

For each topic on the working list, in synthesised order:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs pull {work_unit}.discovery dismissed "{topic}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs create-discovery-topic {work_unit}.{topic} --routing {research|discussion} --source discovery --summary "{one-line summary}" --description "{paragraphs}"
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery.{topic} brief_path "discovery/briefs/{topic}.md"
```

The `pull` is a no-op if the name isn't in the dismissed list.

Summary and description come from the synthesis — derived from the exploration in topic-synthesis. Single-quote any value containing characters zsh would interpret — backticks, `$`, `[]`, `{}`, `~`. Description may span paragraphs.

If any command fails, surface the error and stop before the commit so the user can recover.

Notes:

- The topic name is the manifest dict key (the `{topic}` path segment). There is no separate `name` field to set.
- `routing` is the value confirmed by the user at the synthesis gate.
- `source: discovery` marks topics the user surfaced during discovery, distinguishing them from items added later with other provenance (e.g. `research-analysis`, `gap-analysis`).
- `brief_path` is an opaque field set by a post-create `set` — never a `create-discovery-topic` builder flag. It records where the topic's brief lives; the brief file itself was written at harvest by [brief-synthesis.md](brief-synthesis.md).

→ Proceed to **B. Write Topics Identified**.

## B. Write Topics Identified

#### If the working list was non-empty (topics persisted in A)

The log file may or may not exist depending on whether an Exploration write or Edits write happened during the loop. **Ensure it exists** — if missing, create it from [template.md](template.md) using the session metadata held since Step 8.

Populate **Topics Identified** with one section per topic, in synthesised order:

```markdown
### {topic-name}

- Routing: {research|discussion}
- Why: {one-line rationale from synthesis}
```

→ Proceed to **C. Clear Marker and Finalise**.

#### If the working list was empty

Leave **Topics Identified** as `(none)`.

→ Proceed to **C. Clear Marker and Finalise**.

## C. Clear Marker and Finalise

Clear the active-session marker so resume detection on the next entry sees a closed session. Skip if the log file does not exist (browse-only session — the marker was never set):

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.discovery active_session
```

Replace the **Conclusion** `(none)` placeholder. Skip if no log file exists.

- New topics + (optional) edits: `{N_new} topic(s) added{ and M edit(s) applied | }. Map now has {T} topics.` (Re-run discovery to compute `{T}`.)
- Edits only, no new topics: `{M} edit(s) applied. Map has {T} topics.`
- Browse only (no log file): no Conclusion to replace.

Check `git status`. If the working tree is dirty (manifest writes from **A**, the marker delete, the Topics Identified write, the Conclusion replacement, the briefs written and reconciled at harvest by [brief-synthesis.md](brief-synthesis.md), or any combination), commit. Stage the manifest, the session log, and the briefs directory (so brief files land in the same commit), then pick the appropriate message:

- New topics: `discovery({work_unit}): synthesise {N_new} new topic(s)`
- Edits only: `discovery({work_unit}): finalise session log`

```bash
git add .workflows/{work_unit}/manifest.json .workflows/{work_unit}/discovery/
git commit -m "{message}"
```

If `git status` reports nothing to commit, skip the commit entirely.

→ Proceed to **D. Index the Session Log**.

## D. Index the Session Log

Index the finalised session log into the knowledge base so this epic's discovery is retrievable by later phases and sibling epics. Skip for a browse-only session (no log file exists):

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index .workflows/{work_unit}/discovery/sessions/session-{session_number:03d}.md
```

Idempotent — re-indexing the same session replaces that session's chunks; distinct sessions coexist under their own identity. No commit — the store lives outside git, like every other indexing call site.

→ Return to caller.

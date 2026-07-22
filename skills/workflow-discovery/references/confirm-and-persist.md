# Confirm and Persist

*Reference for **[workflow-discovery](../SKILL.md)***

---

Persists the topic set produced by [topic-synthesis.md](topic-synthesis.md) to the manifest, writes the **Topics Identified** section of the session log, finalises the **Conclusion** placeholder, and closes the session — the close transaction clears the active-session marker and indexes the finalised log into the knowledge base.

Edits to existing items committed via [map-operations.md](map-operations.md) during the session loop. For edits-only sessions, the manifest-writes step is empty but the Conclusion finalisation and the session close still run.

## A. Persist New Topics

The topic set was confirmed at the end of [topic-synthesis.md](topic-synthesis.md) and is held in conversation memory as the working list.

#### If the working list is empty

No new topics — this is an edits-only or browse-only session.

→ Proceed to **B. Write Topics Identified**.

#### Otherwise

Write the whole topic set to `.workflows/.cache/{work_unit}/discovery/topics.json` with the Write tool — one entry per topic, in synthesised order:

```json
[{"name": "{topic}", "routing": "{research|discussion}", "summary": "{one-line summary}", "description": "{paragraphs}", "brief_path": "discovery/briefs/{topic}.md"}]
```

Set `"force_dismissed": true` on an entry whose name the synthesis DATA flagged `matches_dismissed=true` — the user's confirmation at the synthesis gate is the re-add decision; the engine clears the dismissed entry as part of the add.

Persist the set in one transaction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discovery-map add-batch {work_unit} --file .workflows/.cache/{work_unit}/discovery/topics.json
```

The batch is atomic — a failing entry means nothing was persisted; fix the payload and re-run. Surface any error and stop before the commit so the user can recover.

Notes:

- Each entry's `name` becomes the manifest dict key (the `{topic}` path segment).
- `routing` is the value confirmed by the user at the synthesis gate.
- Batch entries always land with `source: discovery`, marking topics the user surfaced during discovery — distinct from items added later with other provenance (e.g. `research-analysis`, `gap-analysis`).
- The response's `map_total` is `{T}` for the Conclusion line in **C**, and `added` lists every persisted topic — no re-read needed.
- `brief_path` records where the topic's brief lives; the brief file itself was written at harvest by [brief-synthesis.md](brief-synthesis.md).

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

→ Proceed to **C. Finalise and Close**.

#### If the working list was empty

Leave **Topics Identified** as `(none)`.

→ Proceed to **C. Finalise and Close**.

## C. Finalise and Close

Replace the **Conclusion** `(none)` placeholder. Skip if no log file exists (browse-only session).

- New topics + (optional) edits: `{N_new} topic(s) added{ and M edit(s) applied | }. Map now has {T} topics.`
- Edits only, no new topics: `{M} edit(s) applied. Map has {T} topics.`
- No new topics and no edits: `No map changes — exploration captured in the session log. Map has {T} topics.`

`{T}` is the `map_total` carried by every map-operation response — take it from the session's last one. A session with no map operations takes `{T}` from Step 7's discovery output (the map is unchanged).

Pick the commit message:

- New topics: `discovery({work_unit}): synthesise {N_new} new topic(s)`
- Edits only: `discovery({work_unit}): finalise session log`

#### If the log file exists

Close the session — one engine transaction clears the active-session marker (resume detection on the next entry sees a closed session) and indexes the finalised log into the knowledge base so this epic's discovery is retrievable by later phases and sibling epics (idempotent — re-indexing the same session replaces its chunks; distinct sessions coexist under their own identity), then commits. One call covers whatever this session left dirty: the manifest writes from **A**, the Topics Identified write, the Conclusion replacement, and the briefs written and reconciled at harvest by [brief-synthesis.md](brief-synthesis.md):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discovery-session close {work_unit} -m "{message}"
```

Emit the response's `DISPLAY: kb warning` section when present, verbatim per its marker — the session is closed and committed either way.

→ Return to caller.

#### If no log file exists

Browse-only session — the marker was never set and there is nothing to index. Commit whatever the session left dirty; a clean tree reports `committed: null` and is fine:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "discovery({work_unit}): finalise session log"
```

→ Return to caller.

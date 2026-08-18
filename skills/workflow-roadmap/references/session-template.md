# Roadmap Session Log Template

*Reference for **[workflow-roadmap](../SKILL.md)***

---

Structure for `.workflows/.roadmap/sessions/session-{NNN}.md` — the engine allocates `NNN` at open (first = `001`).

One template, all sessions. Sections that don't apply this session write `(none)` rather than disappearing — the empty section is a positive signal it was considered, not missed.

- **Exploration** is **narrative** — a prose record of the conversation, written across the session at natural pauses (genesis backfills the shaping conversation at open). The durable record: read by later sessions' continuity, by the epic entry a pull points at, and indexed into the knowledge base at close.
- **Edits** is **structured** — a deterministic record of roadmap operations applied during the session (each engine op self-commits; the entry mirrors it).
- **Items Sorted** is filled at the harvest, from analysing the exploration as a whole.

## Template

```markdown
# Roadmap Session {NNN}

Date: {YYYY-MM-DD}

## Imports (as of session)

- imports/{filename}.md
- ...

## Map State at Start

{One-line summary: horizons and item counts by state. Write
`(empty — first session)` when no roadmap exists yet.}
Example: `3 horizons · 6 items — 1 in flight · 4 waiting · 1 shipped`

## Exploration

{Prose record of the conversation — the product intent, the
capabilities named, the staging language heard, the soft decisions
and rejected paths with why, the threads left open. Not verbatim.}

## Edits

{Structured per-op entries when the session operates on the map:}
- Added: {name} → {horizon} — {short reason}
- Moved: {name} → {horizon} — {short reason}
- Renamed: {old} → {new} — {short reason}
- Removed: {name} — {short reason}
- Horizon {added|renamed|reordered|merged|split|removed}: {detail}
- Groomed: {inbox slug} → {name} ({horizon})
- Flagged: {name} — {short reason}
- Imported: {filename}

## Items Sorted

### {item-name}

- Horizon: {horizon}
- Why: {one-line rationale — what placed it there}

### {item-name}

- Horizon: {horizon}
- Why: ...

## Conclusion

(none)
```

## Lazy creation and finalisation

On the `open` path the log is **not created at session start** — it is conjured on the first state change (an Exploration pause, a map operation worth recording). Genesis creates it at Step 2, Exploration backfilled. To create it, draft the complete log at `.workflows/.cache/roadmap/session-draft.md` (header, **Imports**, **Map State at Start**, the first content; other sections `(none)`), then open:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs roadmap session open --session-log-file .workflows/.cache/roadmap/session-draft.md
```

The engine allocates the number, resolves any literal `{NNN}` in the draft to it (leave the header as the template writes it), installs the log, and sets `roadmap.active_session`. The response's `session` is authoritative — set `session_number` from it. Later writes edit the installed file directly; commit with `engine commit --roadmap`. Browse-and-bail produces no file.

The `(none)` Conclusion plus the `roadmap.active_session` marker is the resume signal. At finalisation (conclude), replace it with one of:

- `{N} item(s) sorted{ and M edit(s) applied | (empty if no edits)}. Roadmap now has {T} items across {H} horizons.`
- `{M} edit(s) applied. Roadmap has {T} items.`
- `Browse only — no changes. Roadmap has {T} items.`

## Anti-patterns

- **No transcript-style content in Exploration.** It's a prose record, not verbatim dialogue.
- **Don't write to Items Sorted during the loop.** It's filled by the harvest.

→ Return to caller.

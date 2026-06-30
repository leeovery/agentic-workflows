# Discovery Session Log Template

*Reference for **[workflow-discovery](../SKILL.md)***

---

Structure for `.workflows/{work_unit}/discovery/sessions/session-{NNN}.md` where `NNN` is the next zero-padded sequence number after the existing session logs (first = `001`, second = `002`, etc.).

One template, all sessions. Sections that don't apply this session write `(none)` rather than disappearing — the empty section is a positive signal it was considered, not missed.

The session has two distinct flavours of content recorded in two distinct sections:

- **Exploration** is **narrative** — a prose record of the conversation. The writer sets its fidelity and write-timing: an epic writes a running record across the session; single-phase work backfills once at creation. It's the durable record of what got discussed — read downstream, and a hedge against context refresh.
- **Edits** is **structured** — a deterministic record of map-operations applied to existing items during the session. Only meaningful for continuing sessions where the map is non-empty.

**Topics Identified** is filled at the harvest, from analysing the exploration as a whole.

## Template

```markdown
# Discovery Session {NNN}

Date: {YYYY-MM-DD}
Work unit: {work_unit}

## Description (as of session)

{The work-unit description at session time — captured because the
description can evolve, and we want to know what framing the
session worked from.}

## Seed

{The seed (promoted inbox item) the work unit originated from, or
`(none)`.}

- seeds/{filename}.md ({source})

## Imports

- imports/{filename}.md
- ...

## Map State at Start

{One-line summary: total topics and counts by lifecycle. Write
`(empty — first session)` when no map exists yet, or
`(n/a — single-topic work)` for the single-phase work types.}
Example: `8 topics — 2 decided · 3 in flight · 1 ready · 2 fresh`

## Exploration

{Prose record of the conversation — what was explored and what
came of it: the surfaces named, the threads followed, what was
decided or set aside. Not verbatim. For an epic it's written
across the session at natural pauses; for single-phase work it's
backfilled once at creation. Used at the harvest to identify
topics from the picture as a whole.}

## Edits

{Structured per-op entries when continuing sessions edit the
existing map. Format:}
- Removed: {name} — {short reason}
- Renamed: {old} → {new} — {short reason}
- Edited summary: {name} — {short note}
- Edited description: {name} — {short note}
- Changed routing: {name} → {new routing} — {short reason}

## Topics Identified

### {topic-name}

- Routing: {research|discussion}
- Why: {one-line rationale — what cue drove the routing}

### {topic-name}

- Routing: {research|discussion}
- Why: ...

## Conclusion

(none)
```

## Lazy creation and finalisation

The log file is **not created at session start**. It is conjured on the **first state change of any kind**:

- A natural pause in the exploration produces an Exploration entry
- An edit operation is applied to an existing map item
- (Topics Identified is written only at synthesis — not a creation trigger by itself, since synthesis presupposes exploration has happened)

Browse-and-bail produces no file.

When the file is first created, populate the header, **Description (as of session)**, **Seed**, **Imports**, and **Map State at Start** at the same write that adds the first content. Other sections start as `(none)`.

At that same first-creation write, set the active-session marker so it always pairs with an existing log:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.discovery active_session "{session_number:03d}"
```

The caller's own commit step stages and commits this alongside the log.

The `(none)` Conclusion is the **resume-detection signal** in concert with the `phases.discovery.active_session` manifest marker (see [resume-detection](resume-detection.md)). Always replace it at finalisation so the next entry sees a closed state.

At finalisation, replace the `(none)` Conclusion with one of:

- `{N_new} topic(s) added{ and M edit(s) applied | (empty if no edits)}. Map now has {T} topics.` — when topics were synthesised.
- `{M} edit(s) applied. Map has {T} topics.` — when only edits happened (no new topics from synthesis).
- `Browse only — no changes. Map has {T} topics.` — when the log file exists only because of a transient state change later reverted.

## Anti-patterns

- **No transcript-style content in Exploration.** It's a prose record, not verbatim dialogue.
- **Don't write to Topics Identified during the loop.** It's filled by synthesis at the harvest.

→ Return to caller.

# Inception Session Log Template

*Reference for **[workflow-inception-process](../SKILL.md)***

---

Structure for `.workflows/{work_unit}/inception/session-{NNN}.md` where `NNN` is the next zero-padded sequence number after the existing session logs (first = `001`, second = `002`, etc.).

One template, all sessions. Sections that don't apply this session write `(none)` rather than disappearing — the empty section is a positive signal it was considered, not missed. Session 001 will fill **Topics Identified**; later sessions may fill **Topics Identified** (new topics surfaced this session), **Changes** (edits to existing map items), or both.

## Template

```markdown
# Inception Session {NNN}

Date: {YYYY-MM-DD}
Work unit: {work_unit}

## Description (as of session)

{The work-unit description at session time — captured because the
description can evolve, and we want to know what framing the
session worked from.}

## Imports

- imports/{filename}.md
- ...

## Map State at Start

{One-line summary: total topics and counts by lifecycle. Write
`(empty — first session)` when no map exists yet.}
Example: `8 topics — 2 decided · 3 in flight · 1 ready · 2 fresh`

## Topics Identified

### {topic-name}

- Routing: {research|discussion}
- Why: {one-line rationale — what cue drove the routing}

## Changes

- {operation} {target} — {brief note}

## Considered and Discarded

- {item} — {reason}

## Conclusion

(none)
```

## Lazy creation and finalisation

The log file is **not created at session start**. It is conjured on the **first state change of any kind**:

- A new topic settles in the working list (triggers a natural-pause draft write under **Topics Identified**)
- An edit operation is applied to an existing map item (triggers a write under **Changes**)
- An item is dropped after being raised (triggers a write under **Considered and Discarded**)

Browse-and-bail produces no file — if the user opens the session, looks at the map, and exits without any change, nothing is written. This applies equally to session 001 (no topics surfaced before bail) and later sessions.

When the file is first created, populate the header, **Description (as of session)**, **Imports** (if any), and **Map State at Start** at the same time as the first content section. Leave **Conclusion** as `(none)` — that placeholder is the **resume-detection signal**: if a later session entry finds a log whose Conclusion is `(none)`, that session was interrupted (context refresh, user exit) before finalisation.

At finalisation, replace the `(none)` Conclusion with one of:

- `{N} topic(s) added, {M} change(s) applied. Map now has {T} topics.` — when one or more state changes were made.
- `Browse only — no changes. Map has {T} topics.` — when the log file exists only because of a transient state change that was later reverted (rare).

Always replace the Conclusion at finalisation so the next entry sees a clean state.

## Anti-patterns

- No transcript-style content. The log is rationale, not dialogue.
- No decisions or option weighing. That belongs in discussion. The "Why" line is one sentence per topic — what cue drove the routing.
- No investigation. The log records what was framed, not what was uncovered.

→ Return to caller.

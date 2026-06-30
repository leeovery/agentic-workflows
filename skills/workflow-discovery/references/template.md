# Discovery Session Log Template

*Reference for **[workflow-discovery](../SKILL.md)***

---

Structure for `.workflows/{work_unit}/discovery/sessions/session-{NNN}.md` where `NNN` is the next zero-padded sequence number after the existing session logs (first = `001`, second = `002`, etc.).

One template, all sessions. Sections that don't apply this session write `(none)` rather than disappearing — the empty section is a positive signal it was considered, not missed.

The session has two distinct flavours of content recorded in two distinct sections:

- **Exploration** is **narrative**. For an epic it accrues across the session as **medium-fidelity narrative** — the reasoning-moves (ideas, objections, pivots, soft-landings, rejected paths), written at natural pauses and layered down, never edited back. For single-phase work it is a one-paragraph strong-summary backfill of the shaping conversation. Either way it's Claude's durable record — for topic synthesis (epic) or for the first phase's handoff (single-phase) — and for surviving context refresh.
- **Edits** is **structured** — a deterministic record of map-operations applied to existing items during the session. Only meaningful for continuing sessions where the map is non-empty.

**Topics Identified** is filled at endpoint synthesis, from analysing the exploration as a whole.

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

{Epic: medium-fidelity narrative of the exploration — the
reasoning-moves, the leanings and tensions, the soft decisions and
the paths rejected (and why). Not verbatim, not a strong summary.
Grows over the session as natural pauses layer down new entries;
used at harvest to synthesise topics from the picture as a whole.
Single-phase work: a one-paragraph strong-summary backfill of the
shaping conversation.}

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

- **No transcript-style content in Exploration.** It's narrative, not verbatim dialogue.
- **Soft decisions and rejected paths are wanted (epic).** Record the leanings, the tensions, and the paths set aside — in soft language. What still defers downstream is feasibility analysis to a verdict and option-weighing resolved to a conclusion; those belong in research and discussion. (The single-phase backfill carries none of this — it's a strong-summary of the shaping talk.)
- **No investigation.** The log records the journey of the exploration, not the answers to research questions.
- **Don't write to Topics Identified during the loop.** It's filled by synthesis at harvest.

→ Return to caller.

# Refinement Session Log Template

*Reference for **[workflow-inception-process](../SKILL.md)***

---

Structure for `.workflows/{work_unit}/inception/session-{NNN}.md` where `NNN` is the next zero-padded sequence number after the existing session logs (initial = `001`, first refinement = `002`, etc.).

Keep all section headings — write `(none)` under any that have no content rather than removing the section. The empty section is a positive signal it was considered, not missed. The log is brief, rationale-focused, and keyed by event.

## Template

```markdown
# Inception Session {NNN} — Refinement

Date: {YYYY-MM-DD}
Work unit: {work_unit}

## Map State at Start

{One-line summary: total topics and counts by lifecycle.}
Example: `8 topics — 2 decided · 3 in flight · 1 ready · 2 fresh`

## Self-Healing Arrivals

(none)

## Changes

(none)

## Conclusion

(none)
```

## Initialisation vs finalisation

The template is written to disk **at session start** with `(none)` placeholders under **Self-Healing Arrivals**, **Changes**, and **Conclusion**. The header and **Map State at Start** are populated immediately.

- **Self-Healing Arrivals** — populated at session start by **E. Initialise Session Log** if **D. Self-Healing Check** ran analyses and they added items. Format: `- {topic} (added by {analysis}, source: {provenance})`. Leave `(none)` when no analyses ran or none added items.
- **Changes** — when the first operation is applied, the `(none)` placeholder is replaced with the operation bullet(s). Subsequent operations append.
- **Conclusion** — the `(none)` placeholder is replaced **only at finalisation** (after the operations loop ends). The replacement is one of:
  - `{N} changes applied. Map now has {M} topics.` — when one or more changes were applied.
  - `No changes applied — browse only. Map has {M} topics.` — when the user opened refinement, looked, and exited without changes.

The `(none)` Conclusion is the **resume-detection signal**: if a later refinement entry finds a session log whose Conclusion is still `(none)`, that session was interrupted (context refresh, user exit) before finalisation. Always replace it at finalisation so the next entry sees a clean state.

## Anti-patterns

- No transcript-style content. The log is rationale, not dialogue.
- No decisions, options, or trade-offs. That belongs in discussion.
- No investigation. The log records what changed, not what was uncovered.

→ Return to caller.

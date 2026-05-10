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

{Items added by analyses since the last session, if any. Phase 6
leaves this as `(none)` — Phase 7 fills it when analyses run.}

- {topic} (added by {analysis}, source: {provenance})

## Changes

- Added: {topic} (routing: {research|discussion}, source: inception) — {reason}
- Edited summary: {topic} — {short note}
- Renamed: {old} → {new} — {reason}
- Removed: {topic} — {reason}
- Changed routing: {topic} → {new routing} — {reason}

## Conclusion

{N} changes applied. Map now has {M} topics.
```

## Anti-patterns

- No transcript-style content. The log is rationale, not dialogue.
- No decisions, options, or trade-offs. That belongs in discussion.
- No investigation. The log records what changed, not what was uncovered.

→ Return to caller.

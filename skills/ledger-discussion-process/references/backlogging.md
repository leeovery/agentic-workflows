# Backlogging

*Reference for **[ledger-discussion-process](../SKILL.md)***

---

The roadmap is the person's timeline: placed on it, on a horizon they name, the item goes there now, from an epic's topic or a single-topic unit's alike. The inbox holds what is not yet decided, an idea, a bug or a quick-fix, for the person to triage later. Their words say which; where they do not, the choice is theirs. A point of this topic goes on the roadmap: its question on the map, asked first where it is not, moves there, closing here.

## On the Roadmap

Name the item: a kebab-case `{item}`, one the roadmap does not hold yet, and a one-line `{summary}` saying it in the product's terms; `--kind` where it is a bug or a quick-fix. The horizon is the person's: take it from their words; where they named none, fetch `render horizon-pick --park {item}` and take the horizon picked, or the one the person names.

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs roadmap add {item} --horizon '{horizon}' --summary '{summary}' [--kind {kind:[bug|quick-fix]}] --origin park:{work_unit} --source {work_unit}/topics/{topic}
```

Say the line its answer's `said` holds. A question moves to the item, `{"by": "person", "who_moved_whom": "none"}` on stdin:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs ledger move {place} --question {id} --to roadmap:{item}
```

## In the Inbox

An H1 title over what it is, where it came up and why it matters, on stdin:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs inbox capture {kind:[idea|bug|quick-fix]} <<'ITEM'
{text}
ITEM
```

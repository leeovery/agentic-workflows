# Research Document Template

*Reference for **[workflow-research-process](../SKILL.md)***

---

Use this template when creating research documents.

## Template

```markdown
# Research: {Title}

Brief description of what this research covers and what prompted it.

## Starting Point

What we know so far:
- {Initial thoughts or context from the user}
- {Any constraints or existing knowledge}
- {Where we're starting: technical, market, business, etc.}

---

## Incoming

(none)

---

{Content follows - freeform, managed by the skill}
```

## Notes

- The "Starting Point" section captures context from the initial conversation
- The `## Incoming` section holds off-topic concerns routed here from other sessions; it stays `(none)` until something lands. Session start folds any entries into the body as seed threads and resets the section to `(none)` (see [drain-incoming.md](../../workflow-shared/references/drain-incoming.md)). Keep the `## Incoming` heading and the `(none)` placeholder in place
- Content after that is intentionally unstructured - let themes emerge naturally
- The skill handles content organization during sessions
- Research status is tracked in the work unit manifest, not in the document

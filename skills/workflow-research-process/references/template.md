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
```

## Notes

- The "Starting Point" section captures context from the initial conversation
- Content after that is intentionally unstructured - let themes emerge naturally
- The skill handles content organization during sessions
- Research status is tracked in the work unit manifest, not in the document
- **Measured claims**: when a claim about the codebase or toolchain is load-bearing — a conclusion leans on it — measure it in the moment it's written and record the command with the result, the command alone in its span so it re-runs by copy (`` `rg -l 'pattern' | wc -l` → 14 ``). A claim that can't be measured is written as observation, not fact

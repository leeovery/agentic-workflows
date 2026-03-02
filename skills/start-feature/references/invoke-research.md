# Invoke Research

*Reference for **[start-feature](../SKILL.md)***

---

Invoke the [technical-research](../../technical-research/SKILL.md) skill for feature research.

```
Research session for: {topic}
Work type: feature

Initial context from feature interview:
{compiled feature context from gather-feature-context}

Uncertainties to explore:
{list of uncertainties identified in research-gating}

Create research file: .workflows/{topic}/research/{topic}.md

Invoke the technical-research skill.
```

When a research topic is parked as discussion-ready, the processing skill will offer pipeline continuation via workflow-bridge.

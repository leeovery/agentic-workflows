# Route Based on Scenario

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

Use `state.scenario` from the discovery output to determine the path.

#### If scenario is `research_only` or `research_and_discussions`

Research exists and may need analysis.

→ Return to **[the skill](../SKILL.md)** for **Step 4**.

#### If scenario is `discussions_only`

No research exists, but discussions do. Skip research analysis.

→ Return to **[the skill](../SKILL.md)** for **Step 5**.

#### If scenario is `fresh`

No research or discussions exist yet.

Set source="fresh".

> *Output the next fenced block as a code block:*

```
Starting fresh - no prior research or discussions found.

What topic would you like to discuss?
```

**STOP.** Wait for user response.

When user responds, proceed with their topic.

→ Return to **[the skill](../SKILL.md)** for **Step 7**.

# Gather Context

*Reference for **[start-discussion](../SKILL.md)***

---

Route based on the `source` variable set in earlier steps.

#### If source is `bridge`

Bridge mode: topic and work_type were provided by the caller.

Check if research exists for this topic. Read `.workflows/research/{topic}.md` and look for a `> **Discussion-ready**:` marker.

**If research exists with a discussion-ready marker:**

> *Output the next fenced block as a code block:*

```
Starting discussion: {topic:(titlecase)}
Work type: {work_type}

Research context:
{discussion-ready summary extracted from research file}

Anything to add or adjust before we begin, or "go" to proceed:
```

**STOP.** Wait for user response.

Set source="research-bridge".

→ Return to **[the skill](../SKILL.md)**.

**Otherwise:**

> *Output the next fenced block as a code block:*

```
Starting discussion: {topic:(titlecase)}
Work type: {work_type}

What would you like to discuss? Provide some initial context:
- What's the problem or opportunity?
- What prompted this?
- Any initial thoughts or constraints?
```

**STOP.** Wait for user response.

→ Return to **[the skill](../SKILL.md)**.

#### If source is `research`

Load **[gather-context-research.md](gather-context-research.md)** and follow its instructions.

**STOP.** Wait for user response.

→ Return to **[the skill](../SKILL.md)**.

#### If source is `fresh`

Load **[gather-context-fresh.md](gather-context-fresh.md)** and follow its instructions.

**STOP.** Wait for user response.

→ Return to **[the skill](../SKILL.md)**.

#### If source is `continue`

Load **[gather-context-continue.md](gather-context-continue.md)** and follow its instructions.

**STOP.** Wait for user response.

→ Return to **[the skill](../SKILL.md)**.

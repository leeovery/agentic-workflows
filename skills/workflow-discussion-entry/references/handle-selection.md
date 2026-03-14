# Handle Selection

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

Route based on the user's choice from the options display.

#### If user chose `From research`

User chose to start from research (e.g., "research 1", "1", "from research", or a topic name).

Set source="research".

**If user specified a topic inline** (e.g., "research 2", "2", or topic name):
- Identify the selected topic from the numbered list

→ Return to **[the skill](../SKILL.md)**.

**If user just said "from research" without specifying:**

> *Output the next fenced block as a code block:*

```
Which research topic would you like to discuss? (Enter a number or topic name)
```

**STOP.** Wait for user response.

#### If user chose `Continue discussion`

User chose to continue a discussion (e.g., "continue auth-flow" or "continue discussion").

Set source="continue".

**If user specified a discussion inline** (e.g., "continue auth-flow"):
- Identify the selected discussion from the list

→ Return to **[the skill](../SKILL.md)**.

**If user just said "continue discussion" without specifying:**

> *Output the next fenced block as a code block:*

```
Which discussion would you like to continue?
```

**STOP.** Wait for user response.

#### If user chose `Fresh topic`

User wants to start a fresh discussion.

Set source="fresh".

→ Return to **[the skill](../SKILL.md)**.

#### If user chose `refresh`

> *Output the next fenced block as a code block:*

```
Refreshing analysis...
```

Clear the cache metadata from the manifest and delete the cache file:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js delete {work_unit}.research analysis_cache
rm .workflows/{work_unit}/.state/research-analysis.md
```

→ Return to **[the skill](../SKILL.md)** for **Step 4**.

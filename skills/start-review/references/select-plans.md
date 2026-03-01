# Select Plans

*Reference for **[start-review](../SKILL.md)***

---

This step only applies for `single`, `multi`, or `all` scope chosen in Step 6.

#### If scope is `analysis`

Select which reviews to analyze.

#### If multiple reviews exist

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which reviews to analyze?

- **`a`/`all`** — All reviewed plans
- **`s`/`select`** — Choose specific reviews

Select an option:
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

If `select`, present numbered list of reviewed plans for the user to choose from (comma-separated numbers).

→ Return to **[the skill](../SKILL.md)**.

#### If single review exists

Automatically proceed with the only available review.

→ Return to **[the skill](../SKILL.md)**.

#### If scope is `all`

All reviewable plans are included. No selection needed. Each plan will be reviewed independently.

→ Return to **[the skill](../SKILL.md)**.

#### If scope is `single`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which plan would you like to review? (Enter a number from Step 6)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

→ Return to **[the skill](../SKILL.md)**.

#### If scope is `multi`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which plans to include? (Enter numbers separated by commas, e.g. 1,3)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

→ Return to **[the skill](../SKILL.md)**.

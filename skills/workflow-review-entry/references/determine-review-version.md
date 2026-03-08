# Determine Review Version

*Reference for **[workflow-review-entry](../SKILL.md)***

---

Scan the filesystem for existing review directories:

```bash
ls .workflows/{work_unit}/review/{topic}/
```

#### If no review directories exist (or directory doesn't exist)

Set review_version = 1.

#### If review directories exist

Find the latest `r*` directory (e.g., r1, r2, r3). Set review_version = latest + 1.

> *Output the next fenced block as a code block:*

```
Starting review r{review_version} for "{topic:(titlecase)}".
```

→ Return to **[the skill](../SKILL.md)**.

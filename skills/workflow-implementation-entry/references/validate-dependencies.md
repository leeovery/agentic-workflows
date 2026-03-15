# Validate Dependencies

*Reference for **[workflow-implementation-entry](../SKILL.md)***

---

#### If work_type is not `epic`

→ Return to **[the skill](../SKILL.md)**.

#### Otherwise

Check whether external dependencies exist in the manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.planning.{topic} external_dependencies
```

**If `false`:**

→ Return to **[the skill](../SKILL.md)**.

**If `true`:**

→ Load **[check-dependencies.md](check-dependencies.md)** and follow its instructions as written.

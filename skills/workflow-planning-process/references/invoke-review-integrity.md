# Invoke Integrity Review

*Reference for **[plan-review](plan-review.md)***

---

This step invokes the `planning-review-integrity` agent (`../../../agents/planning-review-integrity.md`) to review plan structural quality and implementation readiness.

---

## Invoke the Agent

Invoke `planning-review-integrity` with:

1. **Review criteria path**: `review-integrity.md` (in this directory)
2. **Plan path**: `.workflows/{work_unit}/planning/{topic}/planning.md`
3. **Format reading.md path**: read `format` from manifest (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase planning --topic {topic} format`), load **[output-formats.md](output-formats.md)**, find the matching entry, and pass the format's `reading.md` path
4. **Cycle number**: current `review_cycle` from the manifest (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase planning --topic {topic} review_cycle`)
5. **Topic name**: the topic/work-unit name
6. **Task design path**: `task-design.md`

---

## Expected Result

The agent returns a brief status:

```
STATUS: findings | clean
CYCLE: {N}
TRACKING_FILE: {path to tracking file}
FINDING_COUNT: {N}
```

- `clean`: plan meets structural quality standards. No findings to process.
- `findings`: tracking file contains findings with full fix content for the orchestrator to present to the user.

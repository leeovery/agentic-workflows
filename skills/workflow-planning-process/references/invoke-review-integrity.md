# Invoke Integrity Review

*Reference for **[plan-review](plan-review.md)***

---

This step invokes the `workflow-planning-review-integrity` agent (`../../../agents/workflow-planning-review-integrity.md`) to review plan structural quality and implementation readiness.

---

## Invoke the Agent

Invoke `workflow-planning-review-integrity` with:

1. **Review criteria path**: `review-integrity.md` (in this directory)
2. **Format reading.md path**: read `format` from manifest (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} format`), then pass **[output-formats/{format}/reading.md](output-formats/{format}/reading.md)**
3. **Cycle number**: current `review_cycle` from the manifest (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} review_cycle`)
4. **Topic name**: the topic/work-unit name
5. **Task design path**: `task-design.md`

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

→ Return to caller.

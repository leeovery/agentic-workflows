# Invoke Traceability Review

*Reference for **[plan-review](plan-review.md)***

---

This step invokes the `workflow-planning-review-traceability` agent (`../../../agents/workflow-planning-review-traceability.md`) to analyze plan traceability against the specification.

---

## Invoke the Agent

Invoke `workflow-planning-review-traceability` with:

1. **Review criteria path**: `review-traceability.md` (in this directory)
2. **Specification path**: `.workflows/{work_unit}/specification/{topic}/specification.md`
3. **Plan path**: `.workflows/{work_unit}/planning/{topic}/planning.md`
4. **Format reading.md path**: read `format` from manifest (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} format`), then pass **[output-formats/{format}/reading.md](output-formats/{format}/reading.md)**
5. **Cycle number**: current `review_cycle` from the manifest (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} review_cycle`)
6. **Topic name**: the topic/work-unit name
7. **Task design path**: `task-design.md`

---

## Expected Result

The agent returns a brief status:

```
STATUS: findings | clean
CYCLE: {N}
TRACKING_FILE: {path to tracking file}
FINDING_COUNT: {N}
```

- `clean`: plan is a faithful, complete translation of the specification. No findings to process.
- `findings`: tracking file contains findings with full fix content for the orchestrator to present to the user.

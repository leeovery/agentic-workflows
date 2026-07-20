# Invoke Traceability Review

*Reference for **[plan-review](plan-review.md)***

---

This step invokes the `workflow-planning-review-traceability` agent (`../../../agents/workflow-planning-review-traceability.md`) to analyze plan traceability against the specification.

---

## Invoke the Agent

Invoke `workflow-planning-review-traceability` with:

1. **Review criteria path**: `review-traceability.md` (in this directory)
2. **Specification path**: `.workflows/{work_unit}/specification/{topic}/specification.md`
3. **Planning file path**: `.workflows/{work_unit}/planning/{topic}/planning.md`
4. **Format reading.md path**: **[output-formats/{format}/reading.md](output-formats/{format}/reading.md)** — `format` is already in session context (read during session setup)
5. **Cycle number**: the current cycle number `{N}` the caller recorded in **A. Cycle Initialization**
6. **Topic name**: the topic/work-unit name
7. **Task design path**: `task-design.md`

---

## Expected Result

The agent returns a brief status:

```
STATUS: findings | clean
CYCLE: {N}
TRACKING_FILE: {path to tracking file}
FINDINGS_COUNT: {N}
```

- `clean`: plan is a faithful, complete translation of the specification. No findings to process.
- `findings`: tracking file contains findings with full fix content for the orchestrator to present to the user.

→ Return to caller.

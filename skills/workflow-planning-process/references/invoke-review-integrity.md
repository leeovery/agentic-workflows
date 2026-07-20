# Invoke Integrity Review

*Reference for **[plan-review](plan-review.md)***

---

This step invokes the `workflow-planning-review-integrity` agent (`../../../agents/workflow-planning-review-integrity.md`) to review plan structural quality and implementation readiness.

---

## Invoke the Agent

Invoke `workflow-planning-review-integrity` with:

1. **Review criteria path**: `review-integrity.md` (in this directory)
2. **Planning file path**: `.workflows/{work_unit}/planning/{topic}/planning.md`
3. **Format reading.md path**: **[output-formats/{format}/reading.md](output-formats/{format}/reading.md)** — `format` is already in session context (read during session setup)
4. **Cycle number**: the current cycle number `{N}` the caller recorded in **A. Cycle Initialization**
5. **Topic name**: the topic/work-unit name
6. **Task design path**: `task-design.md`

---

## Expected Result

The agent returns a brief status:

```
STATUS: findings | clean
CYCLE: {N}
TRACKING_FILE: {path to tracking file}
FINDINGS_COUNT: {N}
```

- `clean`: plan meets structural quality standards. No findings to process.
- `findings`: tracking file contains findings with full fix content for the orchestrator to present to the user.

→ Return to caller.

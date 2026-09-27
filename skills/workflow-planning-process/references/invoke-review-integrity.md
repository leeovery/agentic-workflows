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
7. **Earlier cycles' tracking files**: every `review-traceability-tracking-c{M}.md` and `review-integrity-tracking-c{M}.md` beside the plan whose `{M}` is below the current cycle — the paths the caller listed, the settled directions a finding may not reverse. None at cycle 1.

The dispatch runs in the background (`run_in_background: true`) and ends the turn on exactly `The integrity review agent has been dispatched for review cycle {N}.`

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
- `findings`: tracking file contains findings, each carrying its move — a `settled` finding with full fix content, a `choice` with options and no fix.

→ Return to caller.

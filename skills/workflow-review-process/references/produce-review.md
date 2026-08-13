# Produce Review

*Reference for **[workflow-review-process](../SKILL.md)***

---

Aggregate QA findings into a review document using the **[template.md](template.md)**.

Write the review to `.workflows/{work_unit}/review/{topic}/report.md`. The review is always per-plan.

**QA Verdict** (from Step 5):
- **Approve** — All acceptance criteria met, no blocking issues
- **Request Changes** — Missing requirements, broken functionality, inadequate tests
- **Comments Only** — Minor suggestions, non-blocking observations

→ Proceed to **A. Writing the Recommendations**.

---

## A. Writing the Recommendations

The `## Recommendations` section is the prepped action list from **[prep-findings.md](prep-findings.md)**, not a re-reading of the per-task reports. Read `.workflows/.cache/{work_unit}/review/{topic}/actions.json`.

Each action is already resolved: collisions collapsed into one item, corrections applied, conditions from the guards carried in its instruction. Write it as it stands — never re-cluster, re-tag, or re-judge. A second judgment here is a second source of truth, and the two drift.

Group by lane, in this order, omitting any lane with no actions:

- `fix-now` → `### Fix now`
- `consolidation` → `### Consolidation pass`
- `needs-design` → `### Needs design`
- `inbox-bug` → `### Bugs`
- `inbox-idea` → `### Ideas`

Each item carries its intent, the files it touches, and its source ids so it traces back to the verifiers that raised it. An action spanning several files is one item — never split it per file.

```
4. `internal/theme/union.go`, `docs/theming.md` — dedupe persisted rows against `Row.Identity()`
   Both sides move together: the doc's example fence is asserted against the built-in's bytes.
   (from 11-5-2, 14-1-1)
```

Close the section with the drop count and, beneath it, the dropped items with their reasons — the record of what was raised and did not survive, so a reader can see the judgment rather than infer it from silence.

#### If no findings were prepped

Omit the entire `## Recommendations` section.

→ Proceed to **B. Commit and Continue**.

---

## B. Commit and Continue

Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): complete review"
```

Your review feedback can be:
- Addressed by implementation (same or new session)
- Delegated to an agent for fixes
- Overridden by user ("ship it anyway")

You produce feedback. User decides what to do with it.

→ Return to caller.

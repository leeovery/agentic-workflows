# Produce Review

*Reference for **[workflow-review-process](../SKILL.md)***

---

Aggregate QA findings into a review document using the **[template.md](template.md)**.

Write the review to `.workflows/{work_unit}/review/{topic}/report.md`. The review is always per-plan.

**Verdict** — derived by the synthesis stage, never chosen here. Read it from `actions.json`; when no findings were collected the file does not exist and the verdict is **Pass** by the same derivation — nothing outstanding:
- **Pass** — nothing outstanding needs planning. `do-now` work and `out-of-scope` findings do not block: the first is already applied, the second was never part of this specification
- **Fail** — a blocking issue, or an action routed to `replan`. The work is not delivered while something needs going back to plan

→ Proceed to **A. Writing the Findings**.

---

## A. Writing the Findings

The `## Findings` section is the routed action list from **[prep-findings.md](prep-findings.md)**, not a re-reading of the per-task reports. Read `.workflows/.cache/{work_unit}/review/{topic}/actions.json`.

Each action is already resolved: collisions collapsed into one item, corrections applied, conditions from the guards carried in its instruction, and its route decided. Write it as it stands — never re-group, re-route, or re-judge. A second judgment here is a second source of truth, and the two drift.

Group by route, omitting any with no actions:

- `replan` → `### Needs planning` — **these are why the review failed**. Each carries what is wrong, the failure it causes, and how far the fix reaches.
- `do-now` → `### Corrected in this session` — the work is already applied, verified and committed by the time this report is written, so the section records what changed **as the record shows it** — the apply commit and its diff, never merely what a status claimed: the applied count, anything skipped or reverted with its reason (a reverted action is still owed), and the suite's final state.
- `out-of-scope` → `### Out of scope` — held in the manifest for the user's call at a pass, never actioned here. Each names its kind: a feature, a bug worth investigating, or a standalone quick-fix.

Each item carries its summary, the failure it names, the files it touches, and its source ids so it traces back to the verifiers that raised it. An action spanning several files is one item — never split it per file.

Close with `### Discarded` — the count and each discarded item with its reason. The record of what was raised and did not survive, so a reader sees the judgment rather than inferring it from silence.

#### If no findings were prepped

Omit the entire `## Findings` section.

→ Proceed to **B. Commit and Continue**.

---

## B. Commit and Continue

Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): complete review" --topic review/{topic}
```

Your review feedback can be:
- Addressed by implementation (same or new session)
- Delegated to an agent for fixes
- Overridden by user ("ship it anyway")

You produce feedback. User decides what to do with it.

→ Return to caller.

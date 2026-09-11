# Produce Review

*Reference for **[workflow-review-process](../SKILL.md)***

---

Aggregate QA findings into a review document using the **[template.md](template.md)**.

Write the review to `.workflows/{work_unit}/review/{topic}/report.md`. The review is always per-plan.

**Verdict** — derived by the synthesis stage, never chosen here. Read it from `actions.json`; when no findings were collected the file does not exist and the verdict is **Pass** by the same derivation — nothing outstanding:
- **Pass** — nothing outstanding needs planning. `do-now` work and `out-of-scope` findings do not block: the first is already applied — a blocking issue corrected in this session among it — the second was never part of this specification
- **Fail** — an action routed to `replan`, a blocking issue whose remedy spreads among them. The work is not delivered while something needs going back to plan

→ Proceed to **A. Writing the QA Verification**.

---

## A. Writing the QA Verification

**Specification Compliance** is the change-set verification's coverage maps — one sub-heading per section, carrying that section's `COVERAGE` entries as this cycle's `change-set-c{N}-{section-slug}.md` records them (`{N}` as **A. Derive Sections** of **[invoke-change-set-verifiers.md](invoke-change-set-verifiers.md)** derives it), never re-judged or summarised into a sentence: a coverage map is the only evidence an empty findings list can offer, and a paraphrase is not evidence. A section whose agent failed is named as not covered. The change-set files stay authoritative.

**Plan Completion** is the checklist's plan completion check, and its `Criteria not measured` line names what neither layer could settle — the blocks of `.workflows/.cache/{work_unit}/review/{topic}/not-measured.txt`, each criterion quoted with its task suffix — or `none` when the file is absent. Never a checkbox: a criterion nobody measured is disclosed, not ticked. The acceptance-criteria checkbox above that line reads as met except any named below it, and is ticked when every criterion that was settled or measured holds — an unmeasured criterion neither ticks it nor withholds it.

**Blocking Issues** lists only what was not corrected — the `replan` actions in `actions.json` carrying `blocking`, each the criterion unmet or the behaviour broken. A blocking action routed `do-now` was corrected in this session and is named there, never here.

→ Proceed to **B. Writing the Findings**.

---

## B. Writing the Findings

The `## Findings` section is the routed action list from **[prep-findings.md](prep-findings.md)**, not a re-reading of the per-task reports. Read `.workflows/.cache/{work_unit}/review/{topic}/actions.json`.

Each action is already resolved: collisions collapsed into one item, corrections applied, conditions from the guards carried in its instruction, and its route decided. Write it as it stands — never re-group, re-route, or re-judge. A second judgment here is a second source of truth, and the two drift.

Group by route, omitting any with no actions:

- `replan` → `### Needs planning` — **these are why the review failed**. Each carries what is wrong, the failure it causes, and how far the fix reaches; an action carrying `blocking` carries the marker `**blocking**` on its row.
- `do-now` → `### Corrected in this session` — the work is already applied, verified and committed by the time this report is written, so the section records what changed **as the record shows it** — the apply commit and its diff, never merely what a status claimed: the applied count, anything skipped or reverted with its reason (a reverted action is still owed), and the suite's final state. An action carrying `blocking` carries the marker `**blocking** — corrected` on its row: the criterion was unmet or the behaviour broken, and it is delivered now.
- `out-of-scope` → `### Out of scope` — held in the manifest for the user's call at a pass, never actioned here. Each names its kind: a feature, a bug worth investigating, or a standalone quick-fix.

Each item carries its summary, the failure it names, the files it touches, and its source ids so it traces back to the verifiers that raised it — a task's or a section's. An action spanning several files is one item — never split it per file.

Close with `### Discarded` — the count and each discarded item with its reason. The record of what was raised and did not survive, so a reader sees the judgment rather than inferring it from silence.

#### If no findings were prepped

Omit the entire `## Findings` section.

→ Proceed to **C. Commit and Continue**.

---

## C. Commit and Continue

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

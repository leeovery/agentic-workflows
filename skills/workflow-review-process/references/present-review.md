# Present Review

*Reference for **[workflow-review-process](../SKILL.md)***

---

## A. Present Verdict

→ Load **[product-lens.md](../../workflow-shared/references/product-lens.md)** and follow its instructions as written.

By this point the do-now corrections are applied, verified and committed; what remains is the verdict and whatever needs the user. Build the payload from `actions.json` and the apply outcome — on a resume where the cache is gone, rebuild it from the report at `.workflows/{work_unit}/review/{topic}/report.md`, whose sections carry the same content.

Write it with the Write tool to `.workflows/.cache/{work_unit}/review/{topic}/presentation.json`:

```json
{
  "topic": "{topic}",
  "verdict": "pass|fail",
  "corrected": {"applied": 0, "reverted": 0, "suite": "green|red"},
  "replan": [{"summary": "…", "ref": "file:line", "fails": "…"}],
  "out_of_scope": 0,
  "discarded": 0,
  "not_measured": 0
}
```

`corrected` is omitted when nothing was applied; `replan` carries entries only on a fail; `out_of_scope` is the count of findings banked in the manifest; `not_measured` is the count of blocks in `.workflows/.cache/{work_unit}/review/{topic}/not-measured.txt` — omitted or `0` when the file is absent. Each `summary` leads with the behaviour or impact it concerns, mechanism after — reword the report entry where its lead is mechanism. What is listed and what is counted is the surface's rule, not a judgment made here.

Render and emit every section verbatim per its marker — the title, the verdict, and the findings:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render review-presentation {work_unit}.review.{topic} --file .workflows/.cache/{work_unit}/review/{topic}/presentation.json
```

Then render the review summary as a markdown paragraph (not a code block) — a product-lens narrative: what was reviewed, where it stands, and what the outcome means for the product.

→ On return, proceed to **B. Decide the Out-of-Scope Findings**.

---

## B. Decide the Out-of-Scope Findings

A pass closes the review, so findings banked outside this spec are decided here — before the gate, never as an option on it. A fail decides nothing: its findings carry to the next cycle.

#### If the verdict is `fail`

→ Proceed to **C. Review Gate**.

#### Otherwise

Read whether anything is banked:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest exists {work_unit}.review.{topic} out_of_scope
```

**If `true`:**

Load **[decide-out-of-scope.md](decide-out-of-scope.md)** and follow its instructions as written.

→ On return, proceed to **C. Review Gate**.

**If `false`:**

→ Proceed to **C. Review Gate**.

---

## C. Review Gate

Render the gate — `--replan` with the count on a fail:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render review-gate {work_unit}.review.{topic} --verdict {pass|fail} [--replan {N}]
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

#### If `plan`

The failures become tasks and implementation reopens.

→ Return to caller.

#### If `complete`

→ Return to caller.

#### If ask

Answer the question using the review file, the per-task reports, this cycle's change-set files, the specification, and the plan as context. The question sets the gate aside until the person is ready to move on; to put it back:

→ Return to **C. Review Gate**.

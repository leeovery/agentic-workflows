# Present Review

*Reference for **[workflow-review-process](../SKILL.md)***

---

## A. Present Verdict

→ Load **[product-lens.md](../../workflow-shared/references/product-lens.md)** and follow its instructions as written.

Read the review file at `.workflows/{work_unit}/review/{topic}/report.md`.

Build the presentation payload from the report and write it with the Write tool to `.workflows/.cache/{work_unit}/review/{topic}/presentation.json`:

```json
{
  "topic": "{topic}",
  "verdict": "approve|request-changes|comments-only",
  "required_changes": [{"description": "…", "ref": "file:line"}],
  "fix_now": 0,
  "consolidation": "the pass's one-line intent, or omitted",
  "needs_design": [{"description": "…", "ref": "file:line"}],
  "bugs": [{"description": "…", "ref": "file:line"}],
  "ideas": [{"description": "…", "ref": "file:line"}],
  "dropped": 0
}
```

Each `description` leads with the behaviour or impact it concerns, mechanism after — reword the report entry where its lead is mechanism. Which lanes list their items and which report a count is the surface's rule, not a judgment made here.

Render and emit the section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render review-presentation {work_unit}.review.{topic} --file .workflows/.cache/{work_unit}/review/{topic}/presentation.json
```

Then render the review summary as a markdown paragraph (not a code block) — a product-lens narrative: what was reviewed, where it stands, and what the findings mean for the product.

→ On return, proceed to **B. Q&A Loop**.

---

## B. Q&A Loop

Render the gate:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render review-qa-gate {work_unit}.review.{topic}
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

#### If ask a question

Answer the question using the review file, QA task files, specification, and plan as context.

→ Return to **B. Q&A Loop**.

#### If `technical`

→ Load **[technical-lens.md](../../workflow-shared/references/technical-lens.md)** and follow its instructions as written.

Retell the review through the technical lens — the verdict, required changes, and recommendations from `report.md`, mechanism-first, as a markdown narrative (not a code block).

→ Return to **B. Q&A Loop**.

#### If `view`

Render the full content of `.workflows/{work_unit}/review/{topic}/report.md` as markdown (not a code block).

→ Return to **B. Q&A Loop**.

#### If `continue`

→ Return to caller.

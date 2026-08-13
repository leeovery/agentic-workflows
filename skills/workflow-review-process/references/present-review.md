# Present Review

*Reference for **[workflow-review-process](../SKILL.md)***

---

## A. Present Verdict

→ Load **[product-lens.md](../../workflow-shared/references/product-lens.md)** and follow its instructions as written.

Read the review file at `.workflows/{work_unit}/review/{topic}/report.md`.

> *Output the next fenced block as a code block:*

```
Review: {topic}

Verdict: {Approve | Request Changes | Comments Only}
```

Then render the review summary as a markdown paragraph (not a code block) — a product-lens narrative: what was reviewed, where it stands, and what the findings mean for the product.

Read the report's `## Recommendations` lanes. Set `has_recommendations`, and per lane set `fixnow_count`, `has_consolidation`, `has_needsdesign`, `has_bugs`, `has_ideas`, and `dropped_count`.

**A lane is listed only where the user decides something.** `needs-design`, bug and idea items are shown in full — each is a call they own. The `fix-now` lane is a count: it is applied in the next step whatever they say, and listing hundreds of items they will not read is the noise this shape exists to prevent. Consolidation is one line, because it is one scheduled pass.

Each listed `{description}` leads with the behaviour or impact it concerns, mechanism after — reword the report entry where its lead is mechanism.

#### If verdict is `Approve`

> *Output the next fenced block as a code block:*

```
All acceptance criteria met. No blocking issues found.

@if(has_recommendations)
Recommendations (non-blocking):

@if(fixnow_count)
  {fixnow_count} applied in the next step — comment and documentation accuracy, renames, small determinate fixes.
@endif

@if(has_consolidation)
  One consolidation pass scheduled: {description}
@endif

@if(has_needsdesign)
Needs design (a call before it can be built):
  {N}. {description} ({file:line})
@endif

@if(has_bugs)
Bugs (to the inbox):
  {N}. {description} ({file:line})
@endif

@if(has_ideas)
Ideas (to the inbox):
  {N}. {description} ({file:line})
@endif

@if(dropped_count)
  {dropped_count} dropped — reasons in the report.
@endif
@endif
```

Listed items are numbered sequentially across the lanes that carry them, matching the report's numbering.

→ Proceed to **B. Q&A Loop**.

#### If verdict is `Request Changes`

> *Output the next fenced block as a code block:*

```
Required Changes:

  1. {change description}
     {file:line reference if available}

  2. ...

@if(has_recommendations)
Recommendations (non-blocking):

@if(fixnow_count)
  {fixnow_count} applied in the next step — comment and documentation accuracy, renames, small determinate fixes.
@endif

@if(has_consolidation)
  One consolidation pass scheduled: {description}
@endif

@if(has_needsdesign)
Needs design (a call before it can be built):
  {N}. {description} ({file:line})
@endif

@if(has_bugs)
Bugs (to the inbox):
  {N}. {description} ({file:line})
@endif

@if(has_ideas)
Ideas (to the inbox):
  {N}. {description} ({file:line})
@endif

@if(dropped_count)
  {dropped_count} dropped — reasons in the report.
@endif
@endif
```

→ Proceed to **B. Q&A Loop**.

#### If verdict is `Comments Only`

> *Output the next fenced block as a code block:*

```
Comments (non-blocking):

@if(fixnow_count)
  {fixnow_count} applied in the next step — comment and documentation accuracy, renames, small determinate fixes.
@endif

@if(has_consolidation)
  One consolidation pass scheduled: {description}
@endif

@if(has_needsdesign)
Needs design (a call before it can be built):
  {N}. {description} ({file:line})
@endif

@if(has_bugs)
Bugs (to the inbox):
  {N}. {description} ({file:line})
@endif

@if(has_ideas)
Ideas (to the inbox):
  {N}. {description} ({file:line})
@endif

@if(dropped_count)
  {dropped_count} dropped — reasons in the report.
@endif
```

→ Proceed to **B. Q&A Loop**.

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

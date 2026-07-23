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

Check whether the review contains a `## Recommendations` section with categorized subsections (`### Do now`, `### Quick-fixes`, `### Ideas`, `### Bugs`). Set `has_recommendations`, and set `has_donow`, `has_quickfixes`, `has_ideas`, `has_bugs` per subsection present.

Render each recommendation as it appears in the report — a one-line item shows its `file:line`; a clustered item shows its sub-bullets. This detail is what lets the user choose do-now versus surface versus ignore, so never collapse it to a bare title. Each `{description}` leads with the behaviour or impact it concerns, mechanism after — reword the report entry where its lead is mechanism.

#### If verdict is `Approve`

> *Output the next fenced block as a code block:*

```
All acceptance criteria met. No blocking issues found.

@if(has_recommendations)
Recommendations (non-blocking):

@if(has_donow)
Do now (zero-risk — applied on request):
  {N}. {description} ({file:line})
@endif

@if(has_quickfixes)
Quick-fixes (mechanical, logic-touching):
  {N}. {description} ({file:line})
@endif

@if(has_ideas)
Ideas (require a decision):
  {N}. {description} ({file:line})
@endif

@if(has_bugs)
Bugs:
  {N}. {description} ({file:line})
@endif
@endif
```

Items are numbered sequentially across all categories (matching the report's numbering).

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

@if(has_donow)
Do now (zero-risk — applied on request):
  {N}. {description} ({file:line})
@endif

@if(has_quickfixes)
Quick-fixes (mechanical, logic-touching):
  {N}. {description} ({file:line})
@endif

@if(has_ideas)
Ideas (require a decision):
  {N}. {description} ({file:line})
@endif

@if(has_bugs)
Bugs:
  {N}. {description} ({file:line})
@endif
@endif
```

→ Proceed to **B. Q&A Loop**.

#### If verdict is `Comments Only`

> *Output the next fenced block as a code block:*

```
Comments (non-blocking):

@if(has_donow)
Do now (zero-risk — applied on request):
  {N}. {description} ({file:line})
@endif

@if(has_quickfixes)
Quick-fixes (mechanical, logic-touching):
  {N}. {description} ({file:line})
@endif

@if(has_ideas)
Ideas (require a decision):
  {N}. {description} ({file:line})
@endif

@if(has_bugs)
Bugs:
  {N}. {description} ({file:line})
@endif
```

→ Proceed to **B. Q&A Loop**.

---

## B. Q&A Loop

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Any questions before proceeding?

@if(has_donow)
- **`d`/`do-now`** — Apply the zero-risk fixes now
@endif
@if(has_recommendations)
- **`s`/`surface`** — Surface recommendations to inbox
@endif
- **`t`/`technical`** — Retell the review from the code's perspective
- **`v`/`view`** — Show the full review report
- **`c`/`continue`** — Proceed to review actions
- **Ask a question** — Ask about the review findings
· · · · · · · · · · · ·
```

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

#### If `do-now`

→ Proceed to **D. Do Now**.

#### If `surface`

→ Proceed to **C. Surface to Inbox**.

#### If `continue`

→ Return to caller.

---

## C. Surface to Inbox

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which recommendations? (enter numbers, comma-separated, or **`a`/`all`**)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

Parse the selection — individual numbers, comma-separated list, or "all".

For each selected recommendation:

1. Determine its category from the grouped display (do-now or quickfix → `quickfixes/`, idea → `ideas/`, bug → `bugs/`) — a surfaced do-now item is one the user chose to defer rather than apply, so it files as a quick-fix
2. Create the inbox directory:
   ```bash
   mkdir -p .workflows/.inbox/{category}
   ```
3. Generate a kebab-case slug (2-4 words from the core recommendation, e.g., `volatile-marker-test`, `error-mapping-distinction`)
4. Write the file to `.workflows/.inbox/{category}/{YYYY-MM-DD}--{slug}.md` (use today's date):

```markdown
# {Title derived from recommendation}

{Full recommendation description from the review report}

Source: review of {work_unit}/{topic}
```

> *Output the next fenced block as a code block:*

```
Surfaced to inbox:
@foreach(item in surfaced_items)
  • {item.number} → {item.category}/{item.date}--{item.slug}.md
@endforeach
```

Commit — the surfaced files live in `.workflows/.inbox/`, outside the work unit, so use the inbox scope:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --inbox -m "review({work_unit}): surface recommendations to inbox"
```

→ Return to **B. Q&A Loop**.

---

## D. Do Now

> *Output the next fenced block as markdown (not a code block):*

```
> Applying the zero-risk fixes directly. Each touches no
> executable logic, so it ships without the pipeline.
```

Apply every item in the `### Do now` subsection of `report.md`:

1. Make each described edit at its `file:line`. Stay within the scope of the note — no opportunistic changes.
2. Run the project's linters; when any change touched a code or test file, also run the test suite (see the project skills loaded in Step 3 and the topic's configured linters). These are project-specific commands, so they fall outside this skill's allowed-tools and prompt for approval when run.
3. If a change fails verification, revert that single change and re-tag its item `[quickfix]` in `report.md` — leave the rest applied.

Commit the applied changes with raw git — the fixes touch project files outside the work unit, so the scoped helper cannot cover them. Stage the touched files and the work unit (for any report re-tags), then commit:

```bash
git add -- .workflows/{work_unit} {files the fixes touched}
git commit -m "review({work_unit}): apply do-now fixes"
```

> *Output the next fenced block as a code block:*

```
Applied {K} do-now fix(es).@if(deferred_count > 0) {D} deferred to quick-fixes (failed verification).@endif
```

→ Return to **B. Q&A Loop**.

# Assess Cross-Cutting & Conclude

*Reference for **[workflow-specification-process](../SKILL.md)***

---

## A. Cross-Cutting Assessment

#### If work_type is `epic`

Before asking for sign-off, assess whether this specification defines cross-cutting patterns rather than something to build directly.

**Cross-cutting indicators** — Patterns/policies that inform other work:
- Defines "how to do things" rather than "what to build"
- Will be referenced by multiple specifications
- Implementation happens within features that apply these patterns

**Directly plannable indicators** — Something to build:
- Has concrete deliverables (code, APIs, UI)
- Can be planned with phases, tasks, acceptance criteria
- Results in a standalone implementation

Present your assessment to the user:

> *Output the next fenced block as a code block:*

```
Cross-Cutting Assessment

@if(cross_cutting)
This specification appears to be cross-cutting.
@else
This specification is directly plannable — no cross-cutting promotion needed.
@endif

{Brief rationale — e.g., "It defines a caching strategy that will inform how
multiple features handle data retrieval, rather than being a standalone piece
of functionality to build."}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Confirm this assessment?

- **`y`/`yes`** — Confirm assessment
- **Comment** — Suggest a different classification
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If comment:**

Discuss the user's suggested classification and re-assess.

→ Return to **A. Cross-Cutting Assessment**.

**If `yes`:**

Store the confirmed assessment for use in Section F.

→ Proceed to **B. Verify Tracking Files Complete**.

#### Otherwise

No assessment needed — feature, bugfix, and cross-cutting work types always produce directly plannable specifications.

→ Proceed to **B. Verify Tracking Files Complete**.

---

## B. Verify Tracking Files Complete

Before proceeding to sign-off, read `manifest get {work_unit}.specification.{topic} tracking` — every entry across all cycles must be `complete` (`review-input-tracking-c{N}` after each Phase 1, `review-gap-analysis-tracking-c{N}` after each Phase 2).

If any entry is `in-progress`, that file's findings were not fully processed — work them per **[process-review-findings.md](process-review-findings.md)**, then re-verify.

> **CHECKPOINT**: Do not proceed to sign-off while the manifest's `tracking` subtree holds an `in-progress` entry. It indicates incomplete review work.

Also confirm every source is incorporated:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} sources
```

If any show `status: pending`, work them now per **[spec-construction.md](spec-construction.md)** → Exhaustive Extraction — extract the source's relevant content into the specification through the construction cycle, then mark it `incorporated`.

> **CHECKPOINT**: Do not proceed to sign-off while any source is `pending`. Its material has not been extracted into the specification.

Also confirm every consult reference is addressed:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} consult_references
```

If any show `status: pending`, work them now per **[spec-construction.md](spec-construction.md)** → Read Consult References Narrowly — read the sibling slice, apply or cite the correction, record it in Working Notes, then mark `addressed`.

> **CHECKPOINT**: Do not proceed to sign-off while any consult reference is `pending`. The owed correction has not been reconciled.

→ Proceed to **C. Sign-Off**.

---

## C. Sign-Off

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Ready to conclude?

- **`y`/`yes`** — Conclude specification and mark as completed
- **Comment** — Add context before concluding
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If comment

Discuss the user's context and apply any changes.

→ Return to **C. Sign-Off**.

#### If `yes`

→ Proceed to **D. Update Manifest and Conclude**.

---

## D. Update Manifest and Conclude

Mark the specification completed — the engine sets the status and indexes the artifact into the knowledge base — then stamp the date:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} specification {topic}
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} date $(date +%Y-%m-%d)
```

Specification is complete when:
- All topics have validated content
- All sources are marked as `incorporated`
- All consult references are marked as `addressed`
- At least one review cycle completed with no findings, OR user explicitly chose to proceed past the re-loop prompt
- Every manifest `tracking` entry `complete`
- User confirms the specification is complete
- No blocking gaps remain

Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): conclude specification"
```

Emit the `complete` response's `DISPLAY: kb warning` section when present, verbatim per its marker — the warning never blocks.

→ Proceed to **E. Handle Source Specifications**.

---

## E. Handle Source Specifications

If any of your sources were **existing specifications** (as opposed to discussions, research, or other reference material), these have now been consolidated into the new specification.

Only supersede sources whose status is **not** `proposed`. A proposed source is an analyzed grouping with no specification file — absorbing it is a delete handled by reconcile, never a supersede.

1. Supersede each non-proposed source specification — one command sets `status: superseded` and `superseded_by`, and removes the source's chunks from the knowledge base:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic supersede {work_unit} specification {source-topic} --by {topic}
   ```

   If the JSON response's `warnings` is non-empty, display them but do not block — the supersession is already recorded:

   > *Output the next fenced block as a code block:*

   ```
   ⚑ Knowledge removal warning
     {warning}
     The spec is superseded. The removal has been queued and will retry automatically on the next `knowledge remove` or `knowledge compact` call.
   ```

2. Inform the user which topics were updated
3. Commit:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): mark source specifications as superseded"
   ```

→ Proceed to **F. Pipeline Continuation**.

---

## F. Pipeline Continuation

#### If work_type is `epic` and assessment was `cross-cutting`

→ Load **[promote-to-cross-cutting.md](promote-to-cross-cutting.md)** and follow its instructions as written.

#### If work_type is `cross-cutting`

> *Output the next fenced block as markdown (not a code block):*

```
> Specification complete. The specification is the final artifact
> for a cross-cutting concern — the pipeline completes here.
```

Invoke `/workflow-bridge {work_unit} specification`.

#### Otherwise

> *Output the next fenced block as markdown (not a code block):*

```
> Specification complete. The planning phase will break this into
> implementable tasks with dependencies and acceptance criteria.
```

Invoke `/workflow-bridge {work_unit} specification`.

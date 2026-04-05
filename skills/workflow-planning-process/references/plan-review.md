# Plan Review

*Reference for **[workflow-planning-process](../SKILL.md)***

---

Two-part review dispatched to sub-agents. Traceability runs first — its approved fixes are applied before the integrity review begins, so integrity evaluates the corrected plan.

---

## A. Cycle Initialization

Check the `review_cycle` field in the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.planning.{topic} review_cycle
```

#### If `review_cycle` is `0`

Set `review_cycle` to 1 in the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.planning.{topic} review_cycle 1
```

Record the current cycle number — passed to both review agents for tracking file naming (`c{N}`).

→ Proceed to **C. Traceability Review**.

#### If `review_cycle` >= 1

Increment `review_cycle` by 1:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.planning.{topic} review_cycle {N+1}
```

Record the current cycle number — passed to both review agents for tracking file naming (`c{N}`).

→ Proceed to **B. Cycle Gate**.

---

## B. Cycle Gate

Check `finding_gate_mode` via manifest CLI:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.planning.{topic} finding_gate_mode
```

#### If `review_cycle` <= 3

→ Proceed to **C. Traceability Review**.

#### If `review_cycle` > 3 and `finding_gate_mode` is `auto`

Auto mode is active — pass through to review. Section E's safety cap (cycle 5) handles escalation.

→ Proceed to **C. Traceability Review**.

#### If `review_cycle` > 3 and `finding_gate_mode` is `gated` (or not set)

→ Load **[convergence-analysis.md](../../workflow-shared/references/convergence-analysis.md)** with loop_type = `planning-review`, work_unit = `{work_unit}`, topic = `{topic}`.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Continue with review?

- **`p`/`proceed`** — Continue review
- **`s`/`skip`** — Skip review, proceed to completion
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `proceed`:**

→ Proceed to **C. Traceability Review**.

**If `skip`:**

→ Proceed to **F. Completion**.

---

## C. Traceability Review

→ Load **[invoke-review-traceability.md](invoke-review-traceability.md)** and follow its instructions as written.

> **CHECKPOINT**: Do not proceed until the agent has returned its result.

→ Load **[process-review-findings.md](process-review-findings.md)** and follow its instructions as written.

→ Proceed to **D. Plan Integrity Review**.

---

## D. Plan Integrity Review

→ Load **[invoke-review-integrity.md](invoke-review-integrity.md)** and follow its instructions as written.

> **CHECKPOINT**: Do not proceed until the agent has returned its result.

→ Load **[process-review-findings.md](process-review-findings.md)** and follow its instructions as written.

→ Proceed to **E. Re-Loop Prompt**.

---

## E. Re-Loop Prompt

Check `finding_gate_mode` and `review_cycle` via manifest CLI:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.planning.{topic} finding_gate_mode
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.planning.{topic} review_cycle
```

#### If no findings were surfaced in this cycle

→ Proceed to **F. Completion**.

#### If `finding_gate_mode` is `auto` and `review_cycle` < 5

> *Output the next fenced block as a code block:*

```
Review cycle {N} complete — findings applied. Running follow-up cycle.
```

→ Return to **A. Cycle Initialization**.

#### If `finding_gate_mode` is `auto` and `review_cycle` >= 5

→ Load **[convergence-analysis.md](../../workflow-shared/references/convergence-analysis.md)** with loop_type = `planning-review`, work_unit = `{work_unit}`, topic = `{topic}`.

> *Output the next fenced block as a code block:*

```
Fixes applied this cycle may have shifted dependencies, introduced gaps,
or affected other tasks. A follow-up round reviews the corrected plan
with fresh context — 2-3 cycles typically surface anything cascading.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Run another review round?

- **`r`/`reanalyse`** — Run another round (traceability + integrity)
- **`p`/`proceed`** — Proceed to conclusion
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `reanalyse`:**

→ Return to **A. Cycle Initialization**.

**If `proceed`:**

→ Proceed to **F. Completion**.

#### If `finding_gate_mode` is `gated`

→ Load **[convergence-analysis.md](../../workflow-shared/references/convergence-analysis.md)** with loop_type = `planning-review`, work_unit = `{work_unit}`, topic = `{topic}`.

> *Output the next fenced block as a code block:*

```
Fixes applied this cycle may have shifted dependencies, introduced gaps,
or affected other tasks. A follow-up round reviews the corrected plan
with fresh context — 2-3 cycles typically surface anything cascading.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Run another review round?

- **`r`/`reanalyse`** — Run another round (traceability + integrity)
- **`p`/`proceed`** — Proceed to conclusion
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `reanalyse`:**

→ Return to **A. Cycle Initialization**.

**If `proceed`:**

→ Proceed to **F. Completion**.

---

## F. Completion

1. **Verify tracking files are marked complete** — All traceability and integrity tracking files across all cycles must have `status: complete`.

> **CHECKPOINT**: Do not confirm completion if any tracking files still show `status: in-progress`. They indicate incomplete review work.

2. **Commit** all review tracking files: `planning({work_unit}): complete plan review (cycle {N})`

> *Output the next fenced block as a code block:*

```
Plan review complete — {N} cycle(s), all tracking files finalised.
```

→ Return to caller.

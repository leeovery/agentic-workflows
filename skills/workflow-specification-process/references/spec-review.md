# Specification Review

*Reference for **[workflow-specification-process](../SKILL.md)***

---

Two-phase review of the specification. Phase 1 (Input Review) compares against source material. Phase 2 (Gap Analysis) reviews the specification as a standalone document.

**CRITICAL**: Phases are strictly sequential — never dispatch both agents in parallel. Phase 1 findings are applied to the specification before Phase 2 runs, so gap analysis reviews the updated document.

**Why this matters**: The specification is the golden document. Plans are built from it, and those plans inform implementation. If a detail isn't in the specification, it won't make it to the plan, and therefore won't be built. Worse, the implementation agent may hallucinate to fill gaps, potentially getting it wrong. The goal is a specification robust enough that an agent or human could pick it up, create plans, break it into tasks, and write the code.

Load **[review-tracking-format.md](review-tracking-format.md)** — internalize the tracking file format for both phases.

---

## A. Cycle Initialization

Check the `review_cycle` field via `engine manifest` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} review_cycle`).

#### If `review_cycle` is 0 or not set

Set `review_cycle` to 1 via `engine manifest` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} review_cycle 1`).

Record the current cycle number — used for tracking file naming (`c{N}`).

Commit the updated manifest.

→ Proceed to **C. Phase 1 — Input Review**.

#### If `review_cycle` is already set

Increment `review_cycle` by 1 via `engine manifest` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} review_cycle {N}`).

Record the current cycle number — used for tracking file naming (`c{N}`).

Commit the updated manifest.

→ Proceed to **B. Cycle Gate**.

---

## B. Cycle Gate

Check `finding_gate_mode` via `engine manifest` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} finding_gate_mode`).

#### If `review_cycle` <= 3

→ Proceed to **C. Phase 1 — Input Review**.

#### If `review_cycle` > 3 and `finding_gate_mode` is `auto`

Auto mode is active — pass through to review. Section E's safety cap (cycle 5) handles escalation.

→ Proceed to **C. Phase 1 — Input Review**.

#### If `review_cycle` > 3 and `finding_gate_mode` is `gated` (or not set)

**Do NOT skip review autonomously.** This gate is an escape hatch for the user — not a signal to stop. The expected default is to continue running review until no issues are found. Present the choice and let the user decide.

→ Load **[convergence-analysis.md](../../workflow-shared/references/convergence-analysis.md)** with loop_type = `spec-review`, work_unit = `{work_unit}`, topic = `{topic}`.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Continue with review?

- **`p`/`proceed`** — Continue review
- **`s`/`skip`** — Skip review, proceed to completion
· · · · · · · · · · · ·
```

You MUST NOT choose on the user's behalf.

**STOP.** Wait for user response.

**If `proceed`:**

→ Proceed to **C. Phase 1 — Input Review**.

**If `skip`:**

→ Proceed to **F. Completion**.

---

## C. Phase 1 — Input Review

Dispatch the `workflow-specification-review-input` agent via the Task tool:

- **Agent file**: `../../../agents/workflow-specification-review-input.md`
- **Specification path**: the specification file path
- **Source material paths**: resolve source names to file paths. Read source names and work type from the manifest:
  ```bash
  node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} sources
  node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit} work_type
  ```
  Sources returns an object keyed by source name (e.g., `{"auth-design": {"status": "incorporated"}}`). For each source name, construct the source file path based on work type:
  - Bugfix: `.workflows/{work_unit}/investigation/{source-name}.md`
  - Otherwise: `.workflows/{work_unit}/discussion/{source-name}.md`

  Pass all resolved paths to the agent.
- **Topic name**: the current topic
- **Cycle number**: the current cycle number
- **Review tracking format path**: `review-tracking-format.md` (in this references directory)

> **CHECKPOINT**: Do not proceed until the agent has returned its result.

Record its STATUS as `phase_1_status`.

**If the agent created a tracking file**, commit it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): input review cycle {N}"
```

→ Load **[process-review-findings.md](process-review-findings.md)** and follow its instructions as written.

→ Proceed to **D. Phase 2 — Gap Analysis**.

---

## D. Phase 2 — Gap Analysis

Dispatch the `workflow-specification-review-gap-analysis` agent via the Task tool:

- **Agent file**: `../../../agents/workflow-specification-review-gap-analysis.md`
- **Specification path**: the specification file path
- **Topic name**: the current topic
- **Cycle number**: the current cycle number
- **Review tracking format path**: `review-tracking-format.md` (in this references directory)

> **CHECKPOINT**: Do not proceed until the agent has returned its result.

Record its STATUS as `phase_2_status`.

**If the agent created a tracking file**, commit it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): gap analysis cycle {N}"
```

→ Load **[process-review-findings.md](process-review-findings.md)** and follow its instructions as written.

→ Proceed to **E. Re-Loop Prompt**.

---

## E. Re-Loop Prompt

Check `finding_gate_mode` and `review_cycle` via `engine manifest`:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} finding_gate_mode
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} review_cycle
```

#### If `phase_1_status` is `clean` and `phase_2_status` is `clean`

→ Proceed to **F. Completion**.

#### If `finding_gate_mode` is `auto` and `review_cycle` < 5

> *Output the next fenced block as a code block:*

```
Review cycle {N} complete — findings applied. Running follow-up cycle.
```

→ Return to **A. Cycle Initialization**.

#### If `finding_gate_mode` is `auto` and `review_cycle` >= 5

→ Load **[convergence-analysis.md](../../workflow-shared/references/convergence-analysis.md)** with loop_type = `spec-review`, work_unit = `{work_unit}`, topic = `{topic}`.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Run another review cycle?

- **`r`/`reanalyse`** — Run another review cycle (Phase 1 + Phase 2)
- **`p`/`proceed`** — Proceed to completion
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `reanalyse`:**

→ Return to **A. Cycle Initialization**.

**If `proceed`:**

→ Proceed to **F. Completion**.

#### If `finding_gate_mode` is `gated`

→ Load **[convergence-analysis.md](../../workflow-shared/references/convergence-analysis.md)** with loop_type = `spec-review`, work_unit = `{work_unit}`, topic = `{topic}`.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Run another review cycle?

- **`r`/`reanalyse`** — Run another review cycle (Phase 1 + Phase 2)
- **`p`/`proceed`** — Proceed to completion
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `reanalyse`:**

→ Return to **A. Cycle Initialization**.

**If `proceed`:**

→ Proceed to **F. Completion**.

---

## F. Completion

1. **Verify tracking files are marked complete** — All input review and gap analysis tracking files across all cycles must have `status: complete`.

> **CHECKPOINT**: Do not confirm completion if any tracking files still show `status: in-progress`. They indicate incomplete review work.

2. **Commit** all review tracking files:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): complete specification review (cycle {N})"
```

> *Output the next fenced block as a code block:*

```
Specification review complete — {N} cycle(s), all tracking files finalised.
```

→ Return to caller.

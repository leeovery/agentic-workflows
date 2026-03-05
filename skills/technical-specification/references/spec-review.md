# Specification Review

*Reference for **[technical-specification](../SKILL.md)***

---

Two-phase review of the specification. Phase 1 (Input Review) compares against source material. Phase 2 (Gap Analysis) reviews the specification as a standalone document.

**CRITICAL**: Phases are strictly sequential — never dispatch both agents in parallel. Phase 1 findings are applied to the specification before Phase 2 runs, so gap analysis reviews the updated document.

**Why this matters**: The specification is the golden document. Plans are built from it, and those plans inform implementation. If a detail isn't in the specification, it won't make it to the plan, and therefore won't be built. Worse, the implementation agent may hallucinate to fill gaps, potentially getting it wrong. The goal is a specification robust enough that an agent or human could pick it up, create plans, break it into tasks, and write the code.

Load **[review-tracking-format.md](review-tracking-format.md)** — internalize the tracking file format for both phases.

---

## A. Cycle Management

Check the `review_cycle` field via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase specification --topic {topic} review_cycle`).

#### If `review_cycle` is 0 or not set

Set `review_cycle` to 1 via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase specification --topic {topic} review_cycle 1`).

#### If `review_cycle` is already set

Increment `review_cycle` by 1 via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase specification --topic {topic} review_cycle {N}`).

Record the current cycle number — used for tracking file naming (`c{N}`).

Commit the updated manifest.

**If `review_cycle` <= 3:**

→ Proceed to **B. Phase 1 — Input Review**.

#### If `review_cycle` > 3

Check `finding_gate_mode` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase specification --topic {topic} finding_gate_mode`).

**If `finding_gate_mode: auto`:**

Auto mode is active — pass through to review. Section D's safety cap (cycle 5) handles escalation.

→ Proceed to **B. Phase 1 — Input Review**.

**If `finding_gate_mode: gated` (or not set):**

**Do NOT skip review autonomously.** This gate is an escape hatch for the user — not a signal to stop. The expected default is to continue running review until no issues are found. Present the choice and let the user decide.

> *Output the next fenced block as a code block:*

```
Review cycle {N}

Review has run {N-1} times so far. You can continue (recommended if issues
were still found last cycle) or skip to completion.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`p`/`proceed`** — Continue review *(default)*
- **`s`/`skip`** — Skip review, proceed to completion
· · · · · · · · · · · ·
```

**STOP.** Wait for user choice. You MUST NOT choose on the user's behalf.

#### If `proceed`

→ Proceed to **B. Phase 1 — Input Review**.

#### If `skip`

→ Proceed to **E. Completion**.

---

## B. Phase 1 — Input Review

Dispatch the `specification-review-input` agent via the Task tool:

- **Agent file**: `../../../agents/specification-review-input.md`
- **Specification path**: the specification file path
- **Source material paths**: resolve source names to file paths. Read source names and work type from the manifest:
  ```bash
  node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase specification --topic {topic} sources
  node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} work_type
  ```
  Sources returns an object keyed by source name (e.g., `{"auth-design": {"status": "incorporated"}}`). For each source name, construct the source file path based on work type:

  #### If work type is `bugfix`

  `.workflows/{work_unit}/investigation/{source-name}.md`

  #### Otherwise

  `.workflows/{work_unit}/discussion/{source-name}.md`

  Pass all resolved paths to the agent.
- **Topic name**: the current topic
- **Cycle number**: the current cycle number
- **Review tracking format path**: `review-tracking-format.md` (in this references directory)

Wait for the agent to return. Record its STATUS as `phase_1_status`.

**If the agent created a tracking file**, commit it: `spec({work_unit}): input review cycle {N}`

Load **[process-review-findings.md](process-review-findings.md)** and follow its instructions to process findings with the user.

→ Proceed to **C. Phase 2 — Gap Analysis**.

---

## C. Phase 2 — Gap Analysis

Dispatch the `specification-review-gap-analysis` agent via the Task tool:

- **Agent file**: `../../../agents/specification-review-gap-analysis.md`
- **Specification path**: the specification file path
- **Topic name**: the current topic
- **Cycle number**: the current cycle number
- **Review tracking format path**: `review-tracking-format.md` (in this references directory)

Wait for the agent to return. Record its STATUS as `phase_2_status`.

**If the agent created a tracking file**, commit it: `spec({work_unit}): gap analysis cycle {N}`

Load **[process-review-findings.md](process-review-findings.md)** and follow its instructions to process findings with the user.

→ Proceed to **D. Re-Loop Prompt**.

---

## D. Re-Loop Prompt

#### If `phase_1_status` is `clean` and `phase_2_status` is `clean`

→ Proceed to **E. Completion** (nothing to re-analyse).

#### If either status is `findings`

Check `finding_gate_mode` and `review_cycle` via manifest CLI:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase specification --topic {topic} finding_gate_mode
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase specification --topic {topic} review_cycle
```

#### If `finding_gate_mode: auto` and `review_cycle < 5`

> *Output the next fenced block as a code block:*

```
Review cycle {N} complete — findings applied. Running follow-up cycle.
```

→ Return to **A. Cycle Management**.

#### If `finding_gate_mode: auto` and `review_cycle >= 5`

> *Output the next fenced block as a code block:*

```
Review cycle {N}

Auto-review has not converged after 5 cycles — escalating for human review.
```

→ Present the gated re-loop prompt below.

#### If `finding_gate_mode: gated`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`r`/`reanalyse`** — Run another review cycle (Phase 1 + Phase 2)
- **`p`/`proceed`** — Proceed to completion
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `reanalyse`

→ Return to **A. Cycle Management** to begin a fresh cycle.

#### If `proceed`

→ Proceed to **E. Completion**.

---

## E. Completion

1. **Verify tracking files are marked complete** — All input review and gap analysis tracking files across all cycles must have `status: complete`.

> **CHECKPOINT**: Do not confirm completion if any tracking files still show `status: in-progress`. They indicate incomplete review work.

2. **Commit** all review tracking files: `spec({work_unit}): complete specification review (cycle {N})`

> *Output the next fenced block as a code block:*

```
Specification review complete — {N} cycle(s), all tracking files finalised.
```

→ Return to **[the skill](../SKILL.md)** for **Step 7**.

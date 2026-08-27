# Specification Review

*Reference for **[workflow-specification-process](../SKILL.md)***

---

Three-phase review of the specification. Phase 1 (Claims Verification) measures the specification's empirical claims against the working tree. Phase 2 (Input Review) compares against source material. Phase 3 (Gap Analysis) reviews the specification as a standalone document.

**CRITICAL**: Phases are strictly sequential — never dispatch two agents in parallel. Claims run first because a false claim carried faithfully from a source reads to fidelity review as a perfect match — its routing must land before Phase 2 compares; Phase 2 findings are applied before Phase 3 reviews the updated document.

**Why this matters**: The specification is the golden document. Plans are built from it, and those plans inform implementation. If a detail isn't in the specification, it won't make it to the plan, and therefore won't be built. Worse, the implementation agent may hallucinate to fill gaps, potentially getting it wrong. The goal is a specification robust enough that an agent or human could pick it up, create plans, break it into tasks, and write the code.

→ Load **[review-tracking-format.md](review-tracking-format.md)** — internalize the tracking file format for all three phases.

---

## A. Cycle Initialization

Before opening a cycle, read `manifest get {work_unit}.specification.{topic} tracking` — an `in-progress` entry is a prior cycle's tracking file whose findings were never fully processed — and list the `review-*-tracking-c*.md` files beside the specification: a tracking file on disk with no manifest entry is a crash orphan (the session died before recording it) — record it `in-progress`. Work each one now per **[process-review-findings.md](process-review-findings.md)** for that file, claims before input before gap analysis — the order the cycle runs; never open a fresh cycle over live findings.

Check the `review_cycle` field via `engine manifest` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} review_cycle`).

#### If `review_cycle` is 0 or not set

Set `review_cycle` to 1 and record the construction baseline — the word count review growth is measured against at every escalation:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} review_cycle=1 review_baseline_words=$(wc -w < .workflows/{work_unit}/specification/{topic}/specification.md)
```

Record the current cycle number — used for tracking file naming (`c{N}`).

Commit the updated manifest:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): begin review cycle {N}" --topic specification/{topic}
```

→ Proceed to **C. Phase 1 — Claims Verification**.

#### If `review_cycle` is already set

Increment `review_cycle` by 1 via `engine manifest` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} review_cycle {N+1}`).

Record the current cycle number — used for tracking file naming (`c{N}`).

Commit the updated manifest:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): begin review cycle {N}" --topic specification/{topic}
```

→ Proceed to **B. Cycle Gate**.

---

## B. Cycle Gate

Check `finding_gate_mode` via `engine manifest` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} finding_gate_mode`).

#### If `review_cycle` <= 3

→ Proceed to **C. Phase 1 — Claims Verification**.

#### If `review_cycle` > 3 and `finding_gate_mode` is `auto`

Auto mode is active — pass through to review. Section F's safety cap (cycle 5) handles escalation.

→ Proceed to **C. Phase 1 — Claims Verification**.

#### If `review_cycle` > 3 and `finding_gate_mode` is `gated` (or not set)

**Do NOT skip review autonomously.** This gate is an escape hatch for the user — not a signal to stop. The expected default is to continue running review until no issues are found. Present the choice and let the user decide.

→ Load **[convergence-analysis.md](../../workflow-shared/references/convergence-analysis.md)** with loop_type = `spec-review`, work_unit = `{work_unit}`, topic = `{topic}`.

Fetch the gate and emit its section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render spec-review-gate {work_unit}.specification.{topic} --variant continue
```

You MUST NOT choose on the user's behalf.

**STOP.** Wait for user response.

**If `proceed`:**

→ Proceed to **C. Phase 1 — Claims Verification**.

**If `skip`:**

→ Proceed to **G. Completion**.

---

## C. Phase 1 — Claims Verification

Dispatch the `workflow-specification-review-claims` agent via the Task tool:

- **Agent file**: `../../../agents/workflow-specification-review-claims.md`
- **Work unit**: the current work unit
- **Specification path**: the specification file path
- **Source material paths**: resolve source names to file paths. Read source names and work type from the manifest:
  ```bash
  node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} sources
  node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit} work_type
  ```
  Sources returns an object keyed by source name (e.g., `{"auth-design": {"status": "incorporated"}}`). Resolve each source name to its artifact — sources can be incorporated specifications or research files, not only discussions. First match wins:

  1. `{source-name}` is not `{topic}` and a specification item named `{source-name}` exists in the manifest (an incorporated source spec) → `.workflows/{work_unit}/specification/{source-name}/specification.md`
  2. `.workflows/{work_unit}/research/{source-name}.md` exists → that research file
  3. Work type is `bugfix` → `.workflows/{work_unit}/investigation/{source-name}.md`
  4. Otherwise → `.workflows/{work_unit}/discussion/{source-name}.md`

  Pass all resolved paths to the agent.
- **Topic name**: the current topic
- **Cycle number**: the current cycle number
- **Review tracking format path**: `review-tracking-format.md` (in this references directory)

> **CHECKPOINT**: Do not proceed until the agent has returned its result.

Hold its STATUS as `phase_1_status` — carried in context for the branch below, never a manifest write.

**If the agent created a tracking file**, record it in progress (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} tracking.{file stem} in-progress`) and commit it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): claims verification cycle {N}" --topic specification/{topic}
```

→ Load **[process-review-findings.md](process-review-findings.md)** and follow its instructions as written.

→ On return, proceed to **D. Phase 2 — Input Review**.

---

## D. Phase 2 — Input Review

Dispatch the `workflow-specification-review-input` agent via the Task tool:

- **Agent file**: `../../../agents/workflow-specification-review-input.md`
- **Work unit**: the current work unit
- **Specification path**: the specification file path
- **Source material paths**: the paths resolved in **C** — re-resolve via the ladder there when they are no longer in context
- **Topic name**: the current topic
- **Cycle number**: the current cycle number
- **Review tracking format path**: `review-tracking-format.md` (in this references directory)

> **CHECKPOINT**: Do not proceed until the agent has returned its result.

Hold its STATUS as `phase_2_status` — carried in context for the branch below, never a manifest write.

**If the agent created a tracking file**, record it in progress (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} tracking.{file stem} in-progress`) and commit it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): input review cycle {N}" --topic specification/{topic}
```

→ Load **[process-review-findings.md](process-review-findings.md)** and follow its instructions as written.

→ On return, proceed to **E. Phase 3 — Gap Analysis**.

---

## E. Phase 3 — Gap Analysis

Dispatch the `workflow-specification-review-gap-analysis` agent via the Task tool:

- **Agent file**: `../../../agents/workflow-specification-review-gap-analysis.md`
- **Work unit**: the current work unit
- **Specification path**: the specification file path
- **Topic name**: the current topic
- **Cycle number**: the current cycle number
- **Review tracking format path**: `review-tracking-format.md` (in this references directory)

> **CHECKPOINT**: Do not proceed until the agent has returned its result.

Hold its STATUS as `phase_3_status` — carried in context for the branch below, never a manifest write.

**If the agent created a tracking file**, record it in progress (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} tracking.{file stem} in-progress`) and commit it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): gap analysis cycle {N}" --topic specification/{topic}
```

→ Load **[process-review-findings.md](process-review-findings.md)** and follow its instructions as written.

→ On return, proceed to **F. Re-Loop Prompt**.

---

## F. Re-Loop Prompt

Check `finding_gate_mode` and `review_cycle` via `engine manifest`:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} finding_gate_mode
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} review_cycle
```

#### If `phase_1_status`, `phase_2_status`, and `phase_3_status` are all `clean`

→ Proceed to **G. Completion**.

#### If findings were surfaced and `finding_gate_mode` is `auto` and `review_cycle` < 5

> *Output the next fenced block as a code block:*

```
Review cycle {N} complete — findings applied. Running follow-up cycle.
```

→ Return to **A. Cycle Initialization**.

#### If findings were surfaced and `finding_gate_mode` is `auto` and `review_cycle` >= 5

→ Load **[convergence-analysis.md](../../workflow-shared/references/convergence-analysis.md)** with loop_type = `spec-review`, work_unit = `{work_unit}`, topic = `{topic}`.

Fetch the gate and emit its section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render spec-review-gate {work_unit}.specification.{topic} --variant reloop
```

**STOP.** Wait for user response.

**If `reanalyse`:**

→ Return to **A. Cycle Initialization**.

**If `proceed`:**

→ Proceed to **G. Completion**.

#### If findings were surfaced and `finding_gate_mode` is `gated`

→ Load **[convergence-analysis.md](../../workflow-shared/references/convergence-analysis.md)** with loop_type = `spec-review`, work_unit = `{work_unit}`, topic = `{topic}`.

Fetch the gate and emit its section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render spec-review-gate {work_unit}.specification.{topic} --variant reloop
```

**STOP.** Wait for user response.

**If `reanalyse`:**

→ Return to **A. Cycle Initialization**.

**If `proceed`:**

→ Proceed to **G. Completion**.

---

## G. Completion

1. **Verify tracking is complete** — read `manifest get {work_unit}.specification.{topic} tracking`; every entry across all cycles must be `complete`.

> **CHECKPOINT**: Do not confirm completion if the manifest's `tracking` subtree still holds an `in-progress` entry. It indicates incomplete review work.

If any entry is `in-progress`, that file's findings were not fully processed — work them now per **[process-review-findings.md](process-review-findings.md)** for that tracking file, then re-verify. A tracking file on disk with no manifest entry is a crash orphan (the session died before recording it) — record it `in-progress` and process it the same way.

2. **Commit** all review tracking files:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "spec({work_unit}): complete specification review (cycle {N})" --topic specification/{topic}
```

> *Output the next fenced block as a code block:*

```
Specification review complete — {N} cycle(s), all tracking files finalised.
```

→ Return to caller.

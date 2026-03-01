# Plan Review

*Reference for **[technical-planning](../SKILL.md)***

---

Two-part review dispatched to sub-agents. Traceability runs first — its approved fixes are applied before the integrity review begins, so integrity evaluates the corrected plan.

---

## A. Cycle Management

Check the `review_cycle` field in the Plan Index File frontmatter.

#### If `review_cycle` is missing or not set

Add `review_cycle: 1` to the Plan Index File frontmatter.

#### If `review_cycle` is already set

Increment `review_cycle` by 1.

Record the current cycle number — passed to both review agents for tracking file naming (`c{N}`).

→ Proceed to **B. Traceability Review**.

---

## B. Traceability Review

1. Load **[invoke-review-traceability.md](invoke-review-traceability.md)** and follow its instructions to dispatch the agent.
2. **STOP.** Do not proceed until the agent has returned its result.
3. On receipt of result, load **[process-review-findings.md](process-review-findings.md)** and follow its instructions to process the findings with the user.

→ Proceed to **C. Plan Integrity Review**.

---

## C. Plan Integrity Review

1. Load **[invoke-review-integrity.md](invoke-review-integrity.md)** and follow its instructions to dispatch the agent.
2. **STOP.** Do not proceed until the agent has returned its result.
3. On receipt of result, load **[process-review-findings.md](process-review-findings.md)** and follow its instructions to process the findings with the user.

→ Proceed to **D. Re-Loop Prompt**.

---

## D. Re-Loop Prompt

#### If no findings were surfaced in this cycle

→ Proceed to **E. Completion**.

#### If findings were surfaced

Check `finding_gate_mode` and `review_cycle` in the Plan Index File frontmatter.

#### If `finding_gate_mode: auto` and `review_cycle < 5`

Announce (one line, no stop):

> *Output the next fenced block as a code block:*

```
Review cycle {N} complete — findings applied. Running follow-up cycle.
```

→ Return to **A. Cycle Management**.

#### If `finding_gate_mode: auto` and `review_cycle >= 5`

Review has auto-cycled 5 times without converging. Escalating for human review.

→ Present the gated re-loop prompt below.

#### If `finding_gate_mode: gated`

> *Output the next fenced block as a code block:*

```
Fixes applied this cycle may have shifted dependencies, introduced gaps,
or affected other tasks. A follow-up round reviews the corrected plan
with fresh context — 2-3 cycles typically surface anything cascading.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`r`/`reanalyse`** — Run another round of review (traceability + integrity)
- **`p`/`proceed`** — Proceed to conclusion
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `reanalyse`

→ Return to **A. Cycle Management** to begin a fresh cycle.

#### If `proceed`

→ Proceed to **E. Completion**.

---

## E. Completion

1. **Verify tracking files are marked complete** — All traceability and integrity tracking files across all cycles must have `status: complete`.

> **CHECKPOINT**: Do not confirm completion if any tracking files still show `status: in-progress`. They indicate incomplete review work.

2. **Commit** all review tracking files: `planning({topic}): complete plan review (cycle {N})`

> *Output the next fenced block as a code block:*

```
Plan review complete — {N} cycle(s), all tracking files finalised.
```

→ Return to **[the skill](../SKILL.md)** for **Step 8**.

# Prep Findings

*Reference for **[workflow-review-process](../SKILL.md)***

---

The verifiers each saw one task. Nothing upstream knows that six findings target one sentence, that a fix would breach a guard expressed three packages away, or that a finding names a helper the tree does not contain. This step establishes all of that before anything is written or applied.

Every agent here is read-only. They judge; nothing is edited.

## A. Collect the Findings

Read the `report-*.md` files in `.workflows/{work_unit}/review/{topic}/` and collect the FINDINGS entries. Blocking issues are already handled by the verdict and are not prepped.

**When `unreviewed_tasks` is set and the review file already exists** (a later cycle over remediation work), collect only from those tasks' reports — the earlier cycle's findings were already resolved, and re-collecting them would redo decided work. With no review file on disk the cycle never completed: collect from every report, whatever `unreviewed_tasks` holds.

Each finding arrives carrying its scope (`[in-scope]` or `[out-of-scope]`), its blast radius (`[contained]` or `[spreading]`), and the failure it names. Those are the verifier's calls, made with the code open — carry them through untouched.

Give each finding a stable id of `{phase_id}-{task_id}-{n}` — its report's task suffix plus its position in that report's list, so an action always traces back to the verifier that raised it.

Write two payloads with the Write tool:

- `.workflows/.cache/{work_unit}/review/{topic}/findings.txt` — one block per finding, opening with `[{id}]`, carrying the finding verbatim
- `.workflows/.cache/{work_unit}/review/{topic}/findings-index.txt` — the same findings grouped under `### {file}` headings by the file each targets, one summary line each

#### If no findings were collected

→ Return to caller.

#### Otherwise

→ Proceed to **B. Assess**.

---

## B. Assess

Dispatch all three agents in parallel — they are independent and none writes to the tree.

Split the findings across assessor and guards invocations in batches of roughly 100, each batch its own payload file and its own output path. **Relationships is never split** — it exists to see the whole set at once, and a partial view cannot find a collision.

- **Agent path**: `../../../agents/workflow-review-finding-assessor.md` — one per batch
  1. Findings path (its batch) · 2. Code standard path: `.claude/skills/workflow-implementation-process/references/code-quality.md` · 3. Output path: `…/cache/assess-{n}.jsonl` · 4. Work unit and topic

- **Agent path**: `../../../agents/workflow-review-finding-guards.md` — one per batch
  1. Findings path (its batch) · 2. Output path: `…/cache/guards-{n}.jsonl` · 3. Work unit and topic

- **Agent path**: `../../../agents/workflow-review-finding-relationships.md` — exactly one
  1. Index path: `findings-index.txt` · 2. Output path: `…/cache/relationships.json` · 3. Work unit and topic

Keep the guard inventory each guards agent returns in its status — the synthesis stage receives it, and the do-now apply works against it.

If an agent fails, record the failure and continue. A missing assessment makes its findings unresolved, never silently dropped — synthesis routes those to `replan`, where nothing is applied without the planning loop's own review.

> **CHECKPOINT**: Do not proceed until every dispatched agent has returned.

→ Proceed to **C. Synthesise**.

---

## C. Synthesise

Dispatch the synthesis agent once.

- **Agent path**: `../../../agents/workflow-review-finding-synthesis.md`

1. **Findings path** — `findings.txt`
2. **Assessment paths** — every `assess-*.jsonl`, every `guards-*.jsonl`, and `relationships.json`
3. **Guard inventory** — the inventories returned in **B**
4. **Output path** — `.workflows/.cache/{work_unit}/review/{topic}/actions.json`
5. **Work unit** and **topic**

It resolves each finding, collapses the collisions into single actions, routes each survivor, and derives the verdict.

→ Proceed to **D. Record**.

---

## D. Record

Read `actions.json`. It is the input to the review document and to every step that follows.

**Bank the out-of-scope findings.** They are decided only when the review passes, which may be cycles away, and the cache does not survive that long — the manifest does. Push each `out-of-scope` action (its id, summary, kind, fails, and files) onto the durable set:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest push {work_unit}.review.{topic} out_of_scope '{action json}'
```

Commit the durable dirt of verification and prep — the per-task reports and the manifest — so the apply that follows starts from a clean tree and a crash from here forward loses nothing expensive:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): verification and prep" --topic review/{topic}
```

The findings are never rewritten or deleted — the per-task reports stand as the record of what was raised. What prep produces is the layer above them: what survived, what merged, what was corrected, and what was discarded with its reason.

→ Return to caller.

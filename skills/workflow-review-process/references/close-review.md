# Close the Review

*Reference for **[review-actions-loop.md](review-actions-loop.md)** — loaded by every arm that ends the review phase*

---

Every close of the review phase runs through here: the banked out-of-scope set is decided, the item completes, the work commits, and the bridge carries the pipeline on.

**Parameters** (provided by caller via Load directive):

- `completion_message` — the commit message for the completion
- `staging_commit` — the commit message for the cycle's staging material, or `none` when the arm has none

## A. Decide the Out-of-Scope Findings

Nothing outside this spec is discarded silently — the set is decided before the review closes, on every arm that closes it. Read whether anything is banked; the field is present only while findings await a decision, so on the pass path it reads `false` — **[present-review.md](present-review.md)** already decided them:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest exists {work_unit}.review.{topic} out_of_scope
```

#### If `true`

→ Load **[decide-out-of-scope.md](decide-out-of-scope.md)** and follow its instructions as written.

→ On return, proceed to **B. Commit the Staging Material**.

#### Otherwise

→ Proceed to **B. Commit the Staging Material**.

---

## B. Commit the Staging Material

#### If `staging_commit` is `none`

→ Proceed to **C. Complete the Review**.

#### Otherwise

The cycle's staged proposals land under the implementation topic that holds them — the completion commit in **C** covers the manifest:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "{staging_commit}" --topic implementation/{topic} --sweep
```

→ Proceed to **C. Complete the Review**.

---

## C. Complete the Review

Mark the review completed — the engine sets the status:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} review {topic}
```

Commit the completion:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "{completion_message}" --topic review/{topic}
```

**Pipeline continuation** — Invoke `/workflow-bridge {work_unit} review`.

**STOP.** Do not proceed — terminal condition.

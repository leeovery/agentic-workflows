# Apply Do-Now

*Reference for **[workflow-review-process](../SKILL.md)***

---

The `do-now` route is work that is wrong and contained — one edit at one site, which the suite settles: comment and documentation accuracy, identifier renames, small determinate spec violations, defects with an obvious contained fix. It is finished here, in this session, rather than routed through planning.

Low value is not a reason to send work elsewhere. Blast radius is — a fix that takes one edit should not cost a task, a plan phase and a re-review, however small the thing it corrects.

## A. Batch the Actions

Read the `do-now` actions from `.workflows/.cache/{work_unit}/review/{topic}/actions.json`.

Group them into batches by **connected file sets**: any two actions sharing a file belong to the same batch, transitively. An action already spans every file it must touch — synthesis collapsed coupled findings into one action precisely so a bound pair cannot be split — so a batch never holds half of anything.

Keep batches small enough that an applier holds its whole batch and the files it edits.

#### If no `do-now` actions exist

→ Return to caller.

#### Otherwise

→ Proceed to **B. Apply**.

---

## B. Apply

Ensure the working tree is clean before the first batch — `git status`. A dirty tree makes the suite result unattributable.

Dispatch appliers **one batch at a time, in sequence**. Never in parallel: concurrent appliers see each other's half-finished edits, and a build check taken mid-flight proves nothing about the tree.

- **Agent path**: `../../../agents/workflow-review-fix-applier.md`

Each applier receives:

1. **Actions** — its batch, each with intent, files and instruction
2. **Guard inventory** — from the prep stage's guards agents
3. **Work unit** and **topic**

Record each applier's status. An applier reporting a skip, a revert, or a red suite is reporting a result, not failing — carry it forward.

→ Proceed to **C. Verify**.

---

## C. Verify

The appliers each verified their own batch. Run the project's suite once more over the whole tree — a batch green on its own can still be red beside another.

#### If the suite is green

→ Proceed to **D. Commit**.

#### If the suite is red

Diagnose against the diff. Every applied action was assessed for guard risk before it reached this lane, so a failing guard test means either an action was applied without its condition or the breach took a shape the prep stage could not see from the finding's text.

Repair what is clearly repairable, then re-run. **Never edit a test to make it pass** — a guard test is the requirement, and a green suite bought by weakening one is worse than the red.

For anything not clearly repairable, revert that action alone and record it. The rest of the lane stands.

→ Proceed to **D. Commit**.

---

## D. Commit

Commit the applied work:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): apply do-now findings"
```

Report what happened — applied, skipped, reverted, and the suite's final state. Anything reverted or unresolved is not silently dropped: it returns to the review document as an action still owed, so the record shows what was attempted and what remains.

→ Return to caller.

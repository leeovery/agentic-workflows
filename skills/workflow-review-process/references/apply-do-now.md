# Apply Do-Now

*Reference for **[workflow-review-process](../SKILL.md)***

---

The `do-now` route is work that is wrong and contained — one edit at one site, which the suite settles. It is finished here, before the review is presented, because leaving it costs more than doing it: these findings are never re-found on a later cycle, and the remediation that may follow builds on corrected code rather than on files still carrying false claims.

Low value is not a reason to defer. Blast radius is the axis, and everything routed here has none.

## A. Announce

Read the `do-now` actions from `.workflows/.cache/{work_unit}/review/{topic}/actions.json`.

#### If no `do-now` actions exist

→ Return to caller.

#### Otherwise

State in one or two markdown sentences: how many corrections are about to be applied, and their character — low-impact, contained, blast radius minimised — and that the whole body of work is verified and the suite run before anything lands. This is an announcement, not a gate: the user reads it while the work proceeds.

→ Proceed to **B. Apply**.

---

## B. Apply

Ensure the working tree is clean before the first batch — `git status`. A dirty tree makes the verification unattributable.

Group the actions by **connected file sets**: any two actions sharing a file belong to the same set, transitively. An action already spans every file it must touch — synthesis collapsed coupled findings into one action precisely so a bound pair cannot be split — so a set never holds half of anything.

A batch is one or more whole sets. Bundle small sets together — many single-file corrections do not each earn a dispatch, and safety never came from batch size: it comes from the rules that do not bend, a set never split across batches and batches run one at a time. Cap each batch at what an applier can genuinely hold — its actions and every file they touch.

Dispatch appliers **one batch at a time, in sequence**. Never in parallel: concurrent appliers see each other's half-finished edits, and a build check taken mid-flight proves nothing about the tree.

- **Agent path**: `../../../agents/workflow-review-fix-applier.md`

Each applier receives:

1. **Actions** — its batch, each with summary, files, instruction, and the failure it fixes
2. **Guard inventory** — from the prep stage's guards agents
3. **Work unit** and **topic**

Appliers edit and compile-check; they never run the suite and never touch git. Record each applier's status — a skip or a revert is a result, carried forward to the report.

→ Proceed to **C. Verify**.

---

## C. Verify

The corrections were each made alone; nobody has yet seen them together. Dispatch the verifier over the whole uncommitted body of work.

- **Agent path**: `../../../agents/workflow-review-fix-verifier.md`

It receives the action list and the guard inventory, reads the complete diff itself, repairs damage, normalises the artefacts of piecemeal editing, and runs the project's suite. It never commits; anything it cannot repair it reverts and reports, and a reverted action returns to the record as still owed.

> **CHECKPOINT**: Do not proceed until the verifier reports the suite green, or red with every remaining failure named as a reported revert.

→ Proceed to **D. Commit**.

---

## D. Commit

**The record is the outcome.** Before anything is written forward, confirm it: the diff shows the applied work, and a status claiming work the diff does not show is a discrepancy to surface, never to carry into the report.

#### If nothing was applied

Every action was skipped or reverted — there is nothing to commit. Carry that outcome forward honestly: zero applied, each action with its reason, all of it still owed.

→ Return to caller.

#### Otherwise

Commit the work as one body — the code commit takes the paths you name, validates each, and answers with `left_dirty`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --paths {files the fixes touched} -m "review({work_unit}): apply do-now findings" --for {work_unit} review/{topic}
```

Anything in `left_dirty` that these fixes touched is a path you forgot: commit it now with a second `--paths` call before carrying the outcome forward.

Carry the outcome forward for the report and the presentation: applied count, anything skipped or reverted with its reason, and the suite's final state.

→ Return to caller.

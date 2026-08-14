# Route Lanes

*Reference for **[workflow-review-process](../SKILL.md)***

---

Three lanes remain once `fix-now` has been applied. Each has one destination, decided by the synthesis stage — nothing is re-judged here.

## A. File the Inbox Lanes

The inbox holds work that earns its own pass through the pipeline later. Synthesis gates it hard: `inbox-bug` is a defect a user will plausibly hit, `inbox-idea` is a genuine new capability. A refactor is neither, and neither is an edge nobody reaches — those were routed elsewhere before reaching this step.

Read the `inbox-bug` and `inbox-idea` actions from `.workflows/.cache/{work_unit}/review/{topic}/actions.json`.

#### If neither lane carries an action

→ Proceed to **B. Record the Consolidation Pass**.

#### Otherwise

Write one file per action, taking the next available number in its directory:

- `inbox-bug` → `.workflows/.inbox/bugs/{NNN}-{slug}.md`
- `inbox-idea` → `.workflows/.inbox/ideas/{NNN}-{slug}.md`

Each file carries the action's intent, the files it concerns, and where it came from — `{work_unit}` review, and the source finding ids. An item arriving in the inbox months later is read by someone with none of this session's context, so it states the problem rather than referring to it.

→ Proceed to **B. Record the Consolidation Pass**.

---

## B. Record the Consolidation Pass

Duplication worth addressing is worth one deliberate pass over the affected surface, not N separate edits — applying it piecemeal rotates a large body of code for no change in behaviour, against a real risk of breaking what works.

The pass is already recorded in the review document as a single item. Nothing is filed and nothing is scheduled here: it is deliberate work someone picks up with the whole surface in view, and splitting it into inbox items is what turns it back into N separate edits.

→ Proceed to **C. Report**.

---

## C. Report

State what was routed, as one or two markdown sentences — no fence. Name the counts filed to the inbox and split them by kind, say whether a consolidation pass was recorded, and name how many actions still need design, since those are what the next step works through.

Where a lane is empty, it goes unmentioned rather than reported as zero.

→ Return to caller.

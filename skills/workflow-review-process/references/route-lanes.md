# Route Lanes

*Reference for **[workflow-review-process](../SKILL.md)***

---

Once the `do-now` work is applied, one thing remains: the `out-of-scope` findings. Nothing here is re-judged — the synthesis stage already decided what is out of scope, and this step only puts the choice to the user.

## A. Offer the Out-of-Scope Findings

An out-of-scope finding is a genuine improvement this specification never asked for. It is **never filed automatically** — filing costs a whole pass through the pipeline, and whether that is worth spending is the user's call, not the review's. Offering it and being told no is a complete outcome.

Read the `out-of-scope` actions from `.workflows/.cache/{work_unit}/review/{topic}/actions.json`.

#### If no action is out of scope

→ Proceed to **B. Record the Consolidation Pass**.

#### Otherwise

Put the findings to the user with their kind and what each would cost to take up, then file only what they choose, taking the next available number in its directory:

- `bug` → `.workflows/.inbox/bugs/{NNN}-{slug}.md`
- `feature` → `.workflows/.inbox/ideas/{NNN}-{slug}.md`
- `quick-fix` → `.workflows/.inbox/quickfixes/{NNN}-{slug}.md`

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

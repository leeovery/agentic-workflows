# Pull

*Reference for **[workflow-roadmap](../SKILL.md)***

---

The commitment point. Select waiting items, shape them into a work unit, create it fenced, join the items, route into delivery. The unit's seed set stays derivable from the joins — nothing is mirrored onto it; the record crosses as the session-log backfill plus the items' source pointers. The pull takes whole items — wanting half an item means the item is two items; split it on the map first (rename the item to one half, `roadmap add` the other), never inline here.

## A. Select the Working Set

Render the pull working set:

```bash
node .claude/skills/workflow-roadmap/scripts/gateway.cjs pull-set
```

The output arrives in demarcated sections: read `=== DATA` to reason from (the `ITEMS` table resolves selection numbers — never display it); emit the DISPLAY section verbatim as a code block, then the MENU section verbatim as markdown.

**STOP.** Wait for user response.

#### If `back`

→ Return to **[the skill](../SKILL.md)** for **Step 3**.

#### Otherwise

Resolve the selected number(s) through the `ITEMS` table and hold the item names as the **pulled set**.

→ Proceed to **B. Shape the Unit**.

## B. Shape the Unit

Decide the unit's shape with the user. The default is **one epic** — several items become its rough topic shapes, and even one broad item usually opens into several. A **feature** fits only a single pulled item that reads as one coherent, single-topic build; infer its first phase (`discussion` when the material is decision-shaped, `research` when unknowns dominate) and hold it as `routing`.

Compile a one-line `description` for the unit from the pulled items' summaries and the record. Then confirm the shape — state your read and why above the gate, **naming the remainder** so a partial pull is spoken at the moment of choice (*"3 items stay waiting in mvp"*); when the selection is a whole horizon, its name is the natural work-unit name:

Fetch the gate and emit its section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render roadmap-shape-gate
```

**STOP.** Wait for user response.

#### If `yes`

Hold `work_type` (`epic` or `feature`).

Load **[name-resolution.md](../../workflow-discovery/references/name-resolution.md)** and follow its instructions as written — `inbox_seeds` is `none`; the suggestion derives from the `description`. On return, `work_unit` is confirmed and collision-free.

→ On return, proceed to **C. Read the Record**.

#### If adjust

Apply the user's changes to the shape, framing, or pulled set, then re-render the gate.

→ Return to **B. Shape the Unit**.

## C. Read the Record

The items' substance lives in the session logs their `sources` name (the home snapshot's `ITEMS`/`SESSIONS` tables and `engine manifest get project.roadmap.items.{name}.sources` resolve them). Read every named log **not already current in this conversation's context** in full — a same-session pull has nothing to read; a return-visit pull reads the record cold. An item with no `sources` (a pre-commit shaping park) has only its summary — its ground is the live conversation and whatever a KB query surfaces; never invent a record for it.

→ Proceed to **D. Author the Backfill**.

## D. Author the Backfill

Draft the unit's first discovery session log at `.workflows/.cache/{work_unit}/discovery/session-001.md`, following the discovery template ([template.md](../../workflow-discovery/references/template.md)): header, **Description (as of session)** (the compiled `description`), **Seed** `(none)`, **Imports** `(none)`, **Map State at Start** — `(empty — first session)` for an epic, `(n/a — single-topic work)` for a feature. Backfill **Exploration** with the pulled items' slice of the record — their threads, the soft decisions and rejected paths with why, the open questions — drawn from the logs read in **C** and the live conversation. **The fence governs the backfill**: only the pulled items' ground crosses; the rest of the product record stays where it is, reachable by query. Leave **Edits**, **Topics Identified**, and **Conclusion** as `(none)`.

→ Proceed to **E. Create and Join**.

## E. Create and Join

One creation, then the joins (each self-commits):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit create {work_unit} {work_type} --description "{description}" --session-log-file .workflows/.cache/{work_unit}/discovery/session-001.md
node .claude/skills/workflow-engine/scripts/engine.cjs roadmap pull {item} {item} --into {work_unit}
```

A partial pull is never silent — render the post-pull roadmap so the joins and the remainder are visible, emitting the section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render roadmap-view
```

→ Proceed to **F. Route Into Delivery**.

## F. Route Into Delivery

#### If `work_type` is `epic`

The conversation continues into the epic's discovery — a continuation, not a cold open. Hold `pull_continuation` = true and `session_number` = the created log's number (`001`).

Invoke `/workflow-discovery none {work_unit} none` via the Skill tool.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.

#### If `work_type` is `feature`

> *Output the next fenced block as markdown (not a code block):*

```
> Pulled and fenced — entering plan mode to hand the feature to its first phase in a clean context.
```

Invoke `/workflow-bridge {work_unit} discovery {routing}` via the Skill tool.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.

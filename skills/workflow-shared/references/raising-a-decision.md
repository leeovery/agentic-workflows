# Raising a Decision

*Shared reference. Loaded by the proposal walks — `analysis-loop.md`, `review-actions-loop.md`, `consolidation-pass.md` — when the next pending proposal carries a Decision.*

---

A Decision stops the walk because the fork needs discussion — mirrored consequences no investigation reconciles — never because it needs a rubber stamp. This reference owns the whole arm: the staged record stays on disk, and what reaches the screen is a raise composed in product terms, the record's depth one option away. It exits to the caller's loop with the task's row recorded (`approved`/`skipped`), or with the staging rewritten plain for the loop to re-present.

**Parameters** (provided by caller via Load directive):

- `dotpath` — the render and manifest address, `{work_unit}.{phase}.{topic}` form
- `staging_file` — the staged proposal's file
- `payload_path` — the walk's proposed-task payload path, under `.workflows/.cache/`
- `gate_mode` — the walk's gate mode
- `row_address` — this task's staging-status field, relative to `{dotpath}` (e.g. `staging.c{N}.tasks.{n}`)
- `comment_hint` — the Comment option's hint
- `findings_paths` — the findings and report files behind this walk's staging file, for the technical arm

Sections A through D run in order. Always start at **A. Dispose**.

## A. Dispose

The staging proposed; this session disposes. Re-derive the Decision against the bar — it stands only when the fork lives at product level (what the product's user gets or how it behaves, never how the tree achieves it), the costs conflict irreducibly (no measurement, convention, spec entry, or further trace breaks the tie), a side visibly costs the user (a fork every side of which leaves the user well served is a preference, not a decision — settled on whatever convention or precedent leans, an honest call where none does), and the tie-break is the user's — with the context the staging lacked: user rulings, deferrals, ground that has moved — proposals approved earlier in this same walk included. The Stakes line is the staging's argument, never its evidence: a cost it asserts is read against the tree before it counts, and a cost the tree shows hypothetical — a path no input the product actually receives reaches — carries nothing. And a side no informed user would choose is not a side: a fork with one live side is settled.

A surviving Decision whose staged block lacks a Stakes line gains one now, in `{staging_file}`, from this re-derivation.

#### If the Decision falls below the bar

Settle it: investigate or derive, and rewrite the staged proposal in `{staging_file}` — Solution becomes the settled direction with its derivation; the Decision and Stakes lines go. The caller's loop re-presents it as a plain proposal.

→ Return to caller.

#### Otherwise

→ Proceed to **B. Compose the Raise**.

## B. Compose the Raise

Compose the raise before any render, and hold it — nothing reaches the screen until **C. Emission** places it between the two sections. From zero: it reaches a user who last held this corner of the work hours or days ago, so nothing from the session is assumed remembered, and every term is grounded as it arrives. The staged Problem and Solution are the record, never the script — digest them; they reach the screen only through the technical arm. Two beats:

- **What changes for the product, from zero.** The before/after in the user's terms first — what the product does today, what it would do — then one to three devices, chosen for understanding-speed:

  → Load **[making-it-land.md](making-it-land.md)** and follow its instructions as written.

- **The fork as two end states.** Each side stated as what the product *is* if chosen — never the work to do. The mirrored consequence neither side escapes, stated: it is the stop's justification. Any sibling proposal the fork depends on, named. Then your position: the recommendation, carrying the staged Stakes argument; an honest no-lean fork says so plainly and leans on the Stakes for why only the user can break the tie.

#### If the sides cannot be composed as two distinct product end states or the mirrored consequence cannot be stated

The fork is below the bar by construction — composition is the test. Settle it: rewrite the staged proposal in `{staging_file}` — Solution absorbs the settled direction with its derivation; the Decision and Stakes lines go. The caller's loop re-presents it as a plain proposal.

→ Return to caller.

#### Otherwise

→ Proceed to **C. Emission**.

## C. Emission

Write the task's payload to `{payload_path}` with the Write tool — the base fields from the staging proposal exactly as the caller's plain path prescribes (never `outcome`: the engine refuses it beside a decision — the raise carries what the change would look like), plus `"stakes": "…"` (the staged Stakes line) and `"decision": {"question": "…", "options": […]}` — sides in the staged order, the `(recommended)`-marked side as `{"summary": "{side}", "recommended": true}` with the marker stripped, the rest plain strings; the engine orders the recommended side first, so staged order is rendered order and the number the user types indexes it. Then render:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render proposed-task {dotpath} --file {payload_path} --gate {gate_mode} --comment-hint "{comment_hint}"
```

Emit the response in order, in the same turn as the call: the `DISPLAY: proposed task` section verbatim per its marker; then the raise composed at **B**, as conversational markdown between the two sections; then the `MENU: task decision` section verbatim per its marker.

→ Proceed to **D. Response Handling**.

## D. Response Handling

**STOP.** Wait for user response.

**If a numbered side:**

Rewrite the proposal in `{staging_file}` — Solution becomes the settled direction carrying the chosen side, and the Decision and Stakes lines go — then record the approval:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {dotpath} {row_address} approved
```

→ Return to caller.

**If `decline`:**

Record the decline:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {dotpath} {row_address} skipped
```

→ Return to caller.

**If `technical`:**

The record's depth, on request — retell the fork from the staged proposal and the findings behind it (`{findings_paths}`; read what is not in context): mechanism-first, real names with `file:line`, each mechanism tied back to what it produces in the product. A lens shift you drive, never a file dump:

→ Load **[technical-lens.md](technical-lens.md)** and follow its instructions as written.

Then re-run the render at **C. Emission** — the same command, the payload untouched — and re-emit the `DISPLAY: proposed task` and `MENU: task decision` sections, each verbatim per its marker; the raise is not re-composed — the retelling sits above the re-grounded ask.

→ Return to **D. Response Handling**.

**If comment and the revision keeps the fork:**

Revise the staged proposal in `{staging_file}` per the user's words (content only; the marked side stays listed first), and rewrite the payload from it. A decision menu stops for an explicit choice at either gate mode, so the walk's own mode carries — re-render:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render proposed-task {dotpath} --file {payload_path} --gate {gate_mode} --comment-hint "{comment_hint}"
```

Emit the `DISPLAY: proposed task` section verbatim per its marker; then one line reading back how the fork now stands — the exchange that revised it is the ground, and the raise is not re-composed; then the `MENU: task decision` section verbatim per its marker.

→ Return to **D. Response Handling**.

**If comment and the feedback settles the question:**

It settles the same way a chosen side does: rewrite the staged proposal in `{staging_file}` — Solution absorbs the settled direction the user's words carry, and the Decision and Stakes lines go. Record nothing: the settled direction is an interpretation of the user's words, and the caller's loop re-presents it as a plain proposal at an explicit gate.

→ Return to caller.

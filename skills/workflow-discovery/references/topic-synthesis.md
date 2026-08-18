# Topic Synthesis

*Reference for **[workflow-discovery](../SKILL.md)***

---

The harvest ceremony. Analyse the session's exploration as a whole, produce a topic set, and confirm it with the user. Loaded by [session-loop.md](session-loop.md) C when the user pulls the harvest.

## A. Gather Source Material

You have three sources of truth:

1. **The Exploration section** of the active session log at `.workflows/{work_unit}/discovery/sessions/session-{session_number:03d}.md`. Read it now, every time, whatever is already in context.
2. **In-context memory of the conversation.** When not compacted, this carries detail the Exploration summary may have skipped.
3. **The existing discovery map** from Step 7's discovery output. Continuing sessions add to it; first sessions seed it.

Cross-reference all three. The Exploration section is durable; conversation memory is richer-but-volatile; the existing map is the anchor for continuing sessions.

→ Proceed to **B. Identify Surfaces**.

## B. Identify Surfaces

Read out the **distinct surfaces** the exploration named — the parts of the product that have their own user interaction, own decision space, own boundary. These are the candidates for topic-ness; they're not topics yet.

A surface is something like *menu-management*, *kitchen-printers*, *operator-analytics*. It has a clear name, a clear edge, and would warrant its own future research or discussion.

If the exploration touched on a surface only in passing and didn't develop it, note it but don't force it into a topic. Let it surface in a later session if it grows.

→ Proceed to **C. Apply Granularity Rules**.

## C. Apply Granularity Rules

→ Load **[topic-granularity.md](../../workflow-shared/references/topic-granularity.md)** and follow its instructions as written.

Apply the independence test and anti-patterns. Two surfaces that share a domain, data model, user journey, or decision space should merge into one topic. One surface that has independent stakeholders or genuinely separate concerns can split — but resist splitting one product surface into its implementation concerns. The map item is the unit of *future research or discussion*, not the unit of *implementation*.

For continuing sessions, also check: does any new candidate overlap with an existing map item? If so, the exploration likely belongs *inside* that item's future discussion or research, not as a new sibling.

**The harvest sorts two ways.** A candidate the exploration staged beyond this epic — the user placed it (*"that's v2"*) or the record reads that way — is not a topic: set it aside to the **park set** (`{name, horizon, summary}`, capability-grain, the user's own horizon words). Parks not yet confirmed ride to the gate in **E** beside the topic proposal.

#### If no candidates remain and the park set is non-empty

Everything the harvest surfaced stages beyond this epic — nothing routes; the sort is the roadmap's.

→ Proceed to **F. Parks-Only Gate**.

#### If no candidates remain

Every candidate folded into an existing map item, or the exploration surfaced none — there is no proposal to render and nothing to confirm. Tell the user briefly (the exploration itself is captured in the session log). Synthesis outcome: `confirmed`, with an **empty working list** — Step 12 confirm-and-persist finalises and closes the session without new topics.

→ Load **[brief-synthesis.md](brief-synthesis.md)** and follow its instructions as written — with the empty working list, its pass covers the existing map topics this session's exploration materially deepened: their briefs regenerate and in-flight downstream work gets `reconcile_needed`.

→ Return to caller.

#### Otherwise

→ Proceed to **D. Infer Routing**.

## D. Infer Routing

→ Load **[routing-inference.md](routing-inference.md)** and follow its instructions as written.

For each topic in the synthesised set, propose `research` or `discussion` based on cues from how the user framed it during exploration. The proposal is tentative — the user can flip it at the confirmation gate in **E**.

→ On return, proceed to **E. Render Proposal**.

## E. Render Proposal

Write the proposed set to `.workflows/.cache/{work_unit}/discovery/proposed-topics.json` — a JSON array in synthesised order, one object per topic. Names are kebab-case; summaries are the one-liners drawn from the exploration, worded product-first (the capability or behaviour at stake, not the mechanism); routing is the value inferred in **D**:

```json
[
  {"name": "{topic}", "routing": "{research|discussion}", "summary": "{one-line summary}"}
]
```

Then render the proposal:

```bash
node .claude/skills/workflow-discovery/scripts/gateway.cjs map-view {work_unit} --proposed-file .workflows/.cache/{work_unit}/discovery/proposed-topics.json
```

The output arrives in demarcated sections. Read `=== DATA` to reason from (never display it) — it carries a per-name flag row for each proposed topic:

- `exists_on_map=true` — the name collides with an active map item. Fold the exploration into that item or pick a different name (revise the set, rewrite the file, re-run) before rendering the gate.
- `legal_name=false` — dots or slashes break manifest addressing. Rename and re-run.
- `matches_dismissed=true` — the name was previously dismissed. Fine to proceed — confirming at the gate below is the re-add decision; hold the flag for Step 12, which passes `--force-dismissed` on the write.
- `waiting_on_roadmap=true` — the anti-twin rule: a waiting roadmap item already holds this ground, and a fresh topic beside it would strand its record. Never leave it in the working list — move it to the **pull-forward set** when it belongs in this epic (Step 12 lands it as a map topic and writes its join), or drop it from the proposal to leave it waiting.

Emit the `=== DISPLAY` section verbatim **as a code block** — it shows the proposed topics with the existing map unchanged below, so the full picture is visible.

**If the park set is non-empty:** write it to `.workflows/.cache/{work_unit}/discovery/proposed-parks.json` in the shape Step 12 persists as-is — provenance included:

```json
[{"name": "{item}", "horizon": "{horizon}", "summary": "{one-line summary}", "origin": "park:{work_unit}", "sources": ["{work_unit}/discovery/sessions/session-{session_number}.md"]}]
```

Then render the roadmap overlay beneath the topic proposal, emitting its `=== DISPLAY` section verbatim as a code block (its DATA flags follow the same rules — `exists_on_roadmap=true` folds into the existing item or renames):

```bash
node .claude/skills/workflow-roadmap/scripts/gateway.cjs proposal --file .workflows/.cache/{work_unit}/discovery/proposed-parks.json
```

Fetch the gate and emit its section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render synthesis-gate
```

**STOP.** Wait for user response.

#### If `yes`

The sort is confirmed. Hold in conversation memory for Step 12 confirm-and-persist: the **working list** (topics, with any `matches_dismissed` names from the DATA flags — Step 12 passes `--force-dismissed` for those), the **park set**, and the **pull-forward set**. Do not write Topics Identified to the log yet — Step 12 writes the manifest items and the log section together. Synthesis outcome: `confirmed`.

→ Load **[brief-synthesis.md](brief-synthesis.md)** and follow its instructions as written.

→ Return to caller.

#### If `explore`

The user isn't ready to commit — no working list is produced. Synthesis outcome: `explore`.

→ Return to caller.

#### If adjust

Apply the named adjustments to the working set:

- **Split** *"X is really two things — A and B"* — replace the topic with two
- **Merge** *"X and Y are one"* — combine into one topic; propose a unifying name
- **Rename** *"X should be called Z"* — swap the name
- **Re-route** *"Y should be research"* — flip routing
- **Edit summary** *"Y's summary should be ..."* — replace the summary line
- **Re-sort** *"X is this epic after all"* / *"actually Y can wait — v2"* — move between the working list and the park set (a parked item gains its horizon, an unparked one its routing)
- **Drop** *"Forget Z entirely"* — remove from set (note: this means Claude misread the exploration; reflect on what was overweighted)

After applying, rewrite `proposed-topics.json`, re-render the proposal (back to the top of **E**), and ask again. Loop until confirmed or `explore` is chosen.

→ Return to **E. Render Proposal**.

## F. Parks-Only Gate

Reached from **C** when the harvest produced parks and no topics. Write the park set to `.workflows/.cache/{work_unit}/discovery/proposed-parks.json` in the shape Step 12 persists as-is — provenance included:

```json
[{"name": "{item}", "horizon": "{horizon}", "summary": "{one-line summary}", "origin": "park:{work_unit}", "sources": ["{work_unit}/discovery/sessions/session-{session_number}.md"]}]
```

Render the roadmap overlay, emitting its `=== DISPLAY` section verbatim as a code block (its DATA flags follow **E**'s park rules):

```bash
node .claude/skills/workflow-roadmap/scripts/gateway.cjs proposal --file .workflows/.cache/{work_unit}/discovery/proposed-parks.json
```

Fetch the gate and emit its section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render roadmap-parks-gate
```

**STOP.** Wait for user response.

#### If `yes`

Synthesis outcome: `confirmed`, with an **empty working list** and the park set held for Step 12.

→ Load **[brief-synthesis.md](brief-synthesis.md)** and follow its instructions as written — with the empty working list, its pass covers the existing map topics this session's exploration materially deepened.

→ Return to caller.

#### If `explore`

The user isn't ready — no working list, and no parks land. Synthesis outcome: `explore`.

→ Return to caller.

#### If adjust

Apply the changes — move between horizons, rename, re-word summaries, drop. Rewrite `proposed-parks.json` and re-ask.

→ Return to **F. Parks-Only Gate**.

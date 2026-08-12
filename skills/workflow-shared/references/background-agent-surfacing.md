# Background Agent Surfacing

*Shared reference for workflow skills with background agents (review, perspective/synthesis, deep-dive).*

---

This reference defines how to surface findings from background agents. Findings arrive classified by the move they ask of the user, and each class gets the ceremony it earns — a batch for the ones with no choice in them, a scannable screen of made calls for the ones the record settles, a full raise for the ones that need a decision. All lifecycle state lives in the engine's agent store — never in the content files, whose markdown is the report and nothing else.

**Parameters** (provided by caller via Load directive):

- `agent_type` — `review` | `synthesis` | `deep-dive` — human-readable name used in user-facing messages, and the row kind this invocation surfaces
- `work_unit`, `phase`, `topic` — the agent store address

**Lane declaration** — the calling reference's **Lanes** section, already in context, owns this phase's lane semantics: the walked lane's name and heading, and what approving each batch lane does. A caller with no **Lanes** section is all-walk; its raises render under `Needs A Decision`. A batched lane the declaration doesn't carry is walked — a report can only batch what its caller knows how to land.

## The Core Rules

**The ceremony matches the move owed, never the finding's importance.** Five hard rules govern every surfacing interaction:

1. **Two-phase surfacing.** First acknowledge the report exists (micro-menu, no content). Only after the user opts in, start on the lanes.
2. **One open ask per turn.** A surfacing turn ends only on a pending ask — a batch screen awaiting approval, one raised finding awaiting its answer — never after a completed action: an approved screen confirms in a line and rolls into the next screen or lane in the same turn, and a documented walk engagement re-enters **A. Check for Results** as **G** prescribes. Inside the walked lane, one finding per turn, always.
3. **Mid-thread protection.** If you are mid-Q/A with the user, defer the announce menu until the next natural break. A one-line parenthetical is acceptable, but only the first time.
4. **Nothing is applied unseen.** Every item is rendered — numbered, with its two-line reading — before a single edit lands. A lane larger than one screen renders in screens of at most five, and each screen's approval lands only its own items. "There was no choice anyway" is not licence to write first.
5. **Findings move toward the user, never away.** A finding the report placed in a batch moves into the walked lane the moment you find a real choice hiding in it, or the user says it isn't settled. Never the reverse: a walked finding is never demoted into a batch to save a turn.

Natural-break detection is guidance, not hard-enforced.

→ Load **[natural-breaks.md](natural-breaks.md)** and follow its instructions as written.

## LLM Turn Semantics (IMPORTANT)

This protocol runs as a turn-level check, not a long-running state machine. Each invocation runs one `agent scan` and acts on its answer. Turns end at asks, never after actions: once a finding is raised or a batch screen awaits approval, control belongs to the conversation — do NOT wait "inside the protocol" for the user to finish engaging. A completed action is no exit: an approved screen confirms in one line and continues to the next screen or lane in the same turn, and a documented walk engagement re-enters **A. Check for Results** in the same turn, as **G** prescribes. A drain the user deflects out of resumes at the next natural break — every session-loop iteration re-enters here, and the row lists say exactly where things stand.

**The engine store is the only state.** Never track surfacing progress in conversation memory, and never write it anywhere else. Lanes live in the report file, which is durable — re-read it rather than recalling it.

**Coverage guarantee**: the goal is natural flow during engagement AND eventual coverage of every finding. The store ensures nothing is forgotten across turns — every session-loop iteration re-enters this protocol, and at each natural break the next lane or the next finding is taken up. When all findings have been surfaced, the engine incorporates the row.

## A. Check for Results

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} {phase} {topic}
```

Consider only rows whose `kind` matches `{agent_type}` (other kinds belong to their own loaded reference; perspective rows are synthesis inputs and are never surfaced here).

#### If no matching row is `pending` or `acknowledged`

Nothing to surface.

→ Return to caller.

#### If a matching row is `pending`

→ Proceed to **B. First Read** with that row.

#### If a matching row is `acknowledged`

The report was first-read on an earlier iteration; the row carries `announced`, `surfaced`, and `remaining`.

→ Proceed to **C. Decide Action** with that row.

## B. First Read

Read the row's content file completely — `.workflows/.cache/{work_unit}/{phase}/{topic}/{id}.md`. The finding ids come from the agent's returned status block (its `FINDINGS:`/`TENSIONS:` line — the author's own declaration); when that message is no longer in context, fall back to the file's `### {ID}:` section headings. Cross-check the count either way.

Read each finding's **lane** from its report section. Four lanes carry across callers — the batched `apply`, `decide`, and `route`, and the walked one, named by the caller's **Lanes** declaration. A report that declares no lanes is all-walk, as is any single finding whose section names none — an unlabelled finding is never assumed settled. Synthesis tensions are always walked, whatever the report says.

Re-classify before anything renders, in the one permitted direction (core rule 5): an `apply` finding the artifact itself contradicts — a subtopic the map records as open, a fix resting on a decision no section carries — moves to the walked lane and never reaches the batch screen. A `decide` finding is re-derived against the live session — the report was written cold, this conversation wasn't: one whose stated derivation no longer holds (a decision made since the report, ground the session has moved, a dependency on a walked finding still open in this set), whose section carries no derivation at all, or whose call you cannot yourself stand behind, moves to the walked lane. Never move a finding the other way.

#### If the report has no findings (zero-gap case)

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent ack {work_unit} {phase} {topic} {id} --clean
```

The engine incorporates the row. No menu needed — append this single line at the end of your current turn:

> *Output the next fenced block as a code block:*

```
Background {agent_type} returned — nothing new beyond what we've already covered.
```

→ Return to caller.

#### Otherwise

Record the findings on the row:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent ack {work_unit} {phase} {topic} {id} --findings {F1,F2,…}
```

→ Proceed to **C. Decide Action** with the response's row.

## C. Decide Action

The row's `remaining` list is the unsurfaced set; `announced` and `surfaced` route what happens now. A row acknowledged in an earlier sitting arrives here unread — read its report and its lanes as **B** prescribes before rendering anything.

#### If NOT a natural break

Consult the natural-breaks checklist. Route on the row's `announced` flag.

**If `announced` is `false`:**

Append this one-line parenthetical at the end of your current turn, then record it:

> *Output the next fenced block as markdown (not a code block):*

```
*(Background {agent_type} just returned — I'll raise it when we pause.)*
```

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent announce {work_unit} {phase} {topic} {id}
```

→ Return to caller.

**If `announced` is `true`:**

The user already knows the report is waiting. Silent return — no output. The next natural break will pick it up.

→ Return to caller.

#### If a natural break

Route on the row's `surfaced` list: empty means the user has not yet opted in; non-empty means they picked `yes` on a prior iteration and more findings remain.

**If `surfaced` is empty (first time at a break):**

Render the announce menu. `{shape}` is the lane split in one clause, in lane order — the count in each lane and what each asks of the user, e.g. *3 need nothing from you, 5 need a scan, 6 need a call, 2 belong elsewhere*; name only lanes that have findings. Do not describe individual findings, do not summarise, do not preview.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Background {agent_type} returned — {N} finding(s): {shape}.

**`◆ Work through them now?`**

**`y/yes`**   → Start on them
**`l/later`** → Keep pulling on the current thread, I'll raise them at the next pause
```

After rendering the menu, record the announce — skip the call when the row already reads `announced: true`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent announce {work_unit} {phase} {topic} {id}
```

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **D. Route by Lane**.

**If `later`:**

Nothing surfaced yet, so the next natural break re-renders this menu.

→ Return to caller.

**If `surfaced` is non-empty (user already opted in, more findings remain):**

Do not re-ask. The user has already committed to working through the set.

→ Proceed to **D. Route by Lane**.

## D. Route by Lane

Lanes run in a fixed order — **apply, then decide, then the walk, then route**. The cheap lanes clear the deck first — a settled call can close ground a raise would otherwise reopen — and the route batch runs last so that a reroute raised *during* the walk joins the same send.

Intersect the row's `remaining` with each finding's lane, and take the first lane in that order that still holds findings.

#### If the lane is `apply`

→ Proceed to **E. No Decision Needed**.

#### If the lane is `decide`

→ Proceed to **F. Decided From the Record**.

#### If the lane is the walked one

→ Proceed to **G. The Walk**.

#### If the lane is `route`

→ Proceed to **H. Belongs Elsewhere**.

#### If no lane holds findings

The row is drained — the final surface call incorporated it. Close it out loud in this same turn, never silently: one line that the {agent_type}'s findings are worked through, then hand the conversation back where the announce interrupted it — resume the open thread, or when the session was already winding down, say so and name the next move. A caller with its own continuation (the final-review drain at phase conclusion) resumes it on return instead.

→ Return to caller.

## E. No Decision Needed

The remaining `apply` findings land in screens of at most five — the engine refuses more; an approved screen returns here through **D** for the next. The set only ever shrinks — a finding the user promotes leaves this lane for the walk; nothing is ever added.

#### If no `apply` finding remains

The lane emptied — every one applied, or every one promoted out.

→ Return to **D. Route by Lane**.

#### Otherwise

Emit the lane marker on this drain's first screen only — later screens and re-renders skip it:

> *Output the next fenced block as markdown (not a code block):*

```
**`▪ No Decision Needed`**
```

Digest the report — never read it out. Write the payload to the topic's cache directory with the Write tool (`{"lane": "apply", "items": [{"title": "…", "detail": "…"}], "remaining": N}`, one entry per remaining `apply` finding — up to five, `remaining` counting the lane's findings beyond this screen — in the order they should read: `title` is the report's own claim, `detail` is one or two sentences saying what the fix is and which decision determines it), then render it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render finding-batch {work_unit}.{phase}.{topic} --file .workflows/.cache/{work_unit}/{phase}/{topic}/batch-apply.json
```

Emit the call's DISPLAY and MENU sections, each verbatim per its marker — except on a re-entry after an answered question that changed nothing, where the list on screen is still current: emit the MENU section alone. A re-entry whose screen did change (a promotion left survivors) rewrites the payload and re-renders both sections, renumbered.

**STOP.** Wait for user response.

**If `yes`:**

Take the screen's findings one at a time — apply, then commit under that finding's own subject marker (`({id} {finding})`) — before starting the next.

Each fix lands as the **Lanes** declaration's `apply` resolution prescribes.

When every finding on the screen has landed, record them in one call:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent surface {work_unit} {phase} {topic} {id} {F1,F2,…}
```

Confirm in one line total — `All {N} landed.` — never a per-finding recap: the screen the user approved already said what each fix is. Nothing is pending, so the turn continues.

→ Return to **D. Route by Lane**.

**If the user asks about a number:**

Answer it — the report's full section, the sites it touches, why the fix is the one it is.

A user who says a numbered item is not settled has promoted it (core rule 5). Leave it unsurfaced, drop it from this lane, and treat it as walked — the walk raises it once the batches empty. A promotion is held for the length of the engagement, not in the store: abandon the batch before the walk reaches it and the report's own lane is what the next visit reads, which costs a repeat ask, never a silent loss.

The batch is still owed, and nothing has been surfaced — returning to the caller here would re-render the announce menu the user already answered.

→ Return to **E. No Decision Needed**.

**If the user moves on without answering** — they bounce to another subtopic, another finding, or the main thread:

Nothing is applied and nothing is recorded. Follow them; the next natural break re-enters the protocol and re-offers the lane.

→ Return to caller.

## F. Decided From the Record

The remaining `decide` findings land in screens of at most five — the engine refuses more; an approved screen returns here through **D** for the next. Each is a call the record settles, already re-derived against the live session (**B**), presented for a scan and a veto — never for deliberation. The set only ever shrinks: a finding the user pulls to discuss leaves this lane for the walk; nothing is ever added.

#### If no `decide` finding remains

The lane emptied — every one documented, or every one pulled out.

→ Return to **D. Route by Lane**.

#### Otherwise

Emit the lane marker on this drain's first screen only — later screens and re-renders skip it:

> *Output the next fenced block as markdown (not a code block):*

```
**`▪ Decided From the Record`**
```

Digest the report — never read it out. Write the payload to the topic's cache directory with the Write tool (`{"lane": "decide", "items": [{"title": "…", "detail": "…"}], "remaining": N}`, one entry per remaining `decide` finding — up to five, `remaining` counting the lane's findings beyond this screen — in the order they should read: `title` states the call itself as a decision, `detail` is one or two sentences naming the problem and what determined the call), then render it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render finding-batch {work_unit}.{phase}.{topic} --file .workflows/.cache/{work_unit}/{phase}/{topic}/batch-decide.json
```

Emit the call's DISPLAY and MENU sections, each verbatim per its marker — except on a re-entry after an answered question that changed nothing, where the list on screen is still current: emit the MENU section alone. A re-entry whose screen did change (a pull left survivors) rewrites the payload and re-renders both sections, renumbered.

**STOP.** Wait for user response.

**If `yes`:**

Take the screen's findings one at a time — document, then commit under that finding's own subject marker (`({id} {finding})`) — before starting the next.

Each call lands as the **Lanes** declaration's `decide` resolution prescribes, carrying its derivation — the record it names is what a later reader checks the call against.

When every finding on the screen has landed, record them in one call:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent surface {work_unit} {phase} {topic} {id} {F1,F2,…}
```

Confirm in one line total — `All {N} documented.` — never a per-finding recap: the screen the user approved already said what each call is. Nothing is pending, so the turn continues.

→ Return to **D. Route by Lane**.

**If the user names one to talk through** — the Discuss route, or any answer that rejects a call rather than asking about it. A bare number asks; a pull says the move (*discuss 3*) or rejects the call in words:

The finding has left this lane (core rule 5). Leave it unsurfaced, drop it from the lane, and treat it as walked — the walk raises it once the batches empty, derivation on the table. Then check the survivors: any whose derivation rests on the ground the pulled finding reopens leaves with it — a call cannot land ahead of the discussion that could move it. Nothing lands and nothing is recorded; the pull is held for the length of the engagement, not in the store, same as a promotion.

The batch is still owed for whatever survives.

→ Return to **F. Decided From the Record**.

**If the user asks about a number:**

Answer it — the report's full section, the derivation in full, what it rests on. Expanding is not objecting; the screen stands.

The batch is still owed, and nothing has been surfaced.

→ Return to **F. Decided From the Record**.

**If the user moves on without answering** — they bounce to another subtopic, another finding, or the main thread:

Nothing lands and nothing is recorded. Follow them; the next natural break re-enters the protocol and re-offers the lane.

→ Return to caller.

## G. The Walk

This section runs once per invocation and then exits. It never waits in-protocol for the user to finish engaging — that's the conversation's job.

1. Pick the single most contextually relevant walked finding from the row's `remaining`. **Contextual relevance outranks the list order.** When engaging the previous finding built a scene — a worked scenario, a diagram, one corner of the document — prefer remaining findings that live inside it, and exhaust them before opening a new corner: the reconstruction is already paid for. Otherwise, if the current conversation has just touched on a related area, prefer that finding; if nothing is particularly relevant, pick the one with the broadest implications.
2. Record it — the response confirms what remains, and raising the last finding incorporates the row automatically:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs agent surface {work_unit} {phase} {topic} {id} {finding}
   ```
3. Digest the finding from the content file — never read it out — and compose the raise in three beats. A findings walk is a series of cold starts — each raise lands in a corner of the document the user last held fully hours or days ago — so the first beat rebuilds that context rather than referencing it:
   - **Present** — scene reconstruction before any assessment: say where it came from (the background {agent_type}) and what it observed — for a synthesis, the two positions in tension — then rebuild the scene as **Setting the scene** below prescribes. Restate any term borrowed from another subtopic or an earlier decision; never reference it bare. Never use a bare id (`F5`, `T2`) as a label in conversational prose — name the finding by its report title on first mention, or describe it by what it is; ids belong in commit subjects (`(review-003 F5)`) and in-document markers (`(resolves review-003 F5)`), not in the conversation. When earlier findings from this set have been raised, open with a one-line bridge: what the previous one settled — or simply that it was raised, when that engagement predates this session — and how many follow this one (the surface response's `remaining`, counted within this lane).
   - **Position** — your read, only where you genuinely have one: verified it holds, narrower than framed, already covered by a decision made since the report. Skip the beat rather than manufacture a verdict.
   - **Move** — sized to how open the decision is as much as how cold the context: a clear resolution — propose it and name what it costs ("this creates X and Y; I don't see another approach"), never an option survey; genuinely open — sketch the option space in a sentence or two; needs investigation — suggest research or a deep-dive. The move answers the finding's own question, never its bookkeeping: proposing to park, defer, or record the finding as open is not a move — deferral is an outcome the user may choose, never one the raise proposes. A finding promoted on the user's own knowledge is genuinely open by construction — they hold what the document lacks, so the raise asks for it. A finding pulled from the decide screen reopens a made call — put the derivation on the table and ask what it missed. Where the caller's **Lanes** declaration names the walked lane's move, that move closes the raise.
4. Raise it in the current turn, ending in a single question — or, for a finding with one defensible resolution, a stated proposal awaiting the user's response. Either way the turn ends and control returns: one raise per turn, and the next finding waits until this one's outcome is documented — the write-up turn picks it up (below). No bundled follow-ups, no menu.

When this row's `surfaced` list holds no walked finding yet, the raise opens with the walked lane's declared heading as sub-step chrome, so the shift out of the batches is visible. A walk already under way — including one resumed from an earlier session — opens with its bridge instead, never a repeated heading:

> *Output the next fenced block as markdown (not a code block):*

```
**`▪ {lane_heading}`**
```

**Setting the scene** — an example over a description, every time. A reader who can picture the failure can judge the fix; a reader parsing a mechanism description is still building the picture when the ask arrives.

- **The arc**: establish the normal scenario as a concrete instance — the topic's own terms or the product's, named actors, actual values, a real sequence — and show it resolving fine. Then adjust the scenario so it breaks: the adjustment *is* the finding. Technical depth comes after the instance lands, and only as deep as the finding needs.
- **The devices**: a worked example grounded in the topic or the product, a small ASCII diagram where shape or flow helps, a before/after list, a short step-by-step walkthrough. Pick what fits this finding, and vary across the walk — twenty identically shaped raises read as a template, not a colleague.
- **The weight**: structure the raise so it scans — a light heading, a short list, a diagram breaking up the prose — never an unbroken wall of text. Softly shaped, never boilerplate.
- **The cheap path**: within a scene already rebuilt this session, or when the finding set was visible moments ago, a bridge clause replaces the reconstruction.
- **The test**: the user can picture the problem before the ask arrives.

After this, control belongs to the conversation. The user will engage (or deflect, or redirect) naturally. Handle their response as normal discussion — not as protocol-driven routing. An outcome that re-decides previously `decided` ground, or names an entity, field, rule, or classification this topic's artifact didn't define — citation is not definition: a term carried here only by citing a sibling's decision was defined there — requires the sibling consult before it is documented: follow **G. Sibling consult at cross-topic decision points** in **[knowledge-usage.md](../../workflow-knowledge/references/knowledge-usage.md)** — query or cite, and the documented decision carries the `Sibling check:` line either way, its `no overlap found.` form included. When the engagement's outcome is documented and committed — resolved or deflected — the commit subject carries `({id} {finding})`, e.g. `(review-003 F2)`. That commit is a natural break (the landed-commit signal): re-enter **A. Check for Results** in the same turn, so the next raise follows the write-up while the context is warm. When the raise was the row's last — its surface response said nothing remains — there is no re-entry to make: the write-up turn closes the drain as **D**'s drained exit prescribes.

An engagement that concludes the concern belongs to a sibling topic moves the finding to the `route` lane rather than rerouting it now — **H** sends the batch, and one send beats two.

→ Return to caller.

## H. Belongs Elsewhere

The remaining `route` findings — together with any the walk moved here — land in screens of at most five; the engine refuses more, and an approved screen returns here through **D** for the next.

#### If no `route` finding remains

The lane emptied — every one sent, or every one kept here.

→ Return to **D. Route by Lane**.

#### If a delivery was cancelled this turn

The user just declined it — re-rendering now would re-ask. The next natural break re-presents the lane.

→ Return to caller.

#### Otherwise

Emit the lane marker on this drain's first screen only — later screens and re-renders skip it:

> *Output the next fenced block as markdown (not a code block):*

```
**`▪ Belongs Elsewhere`**
```

Judge each finding's `landing_phase` per **Judging the Landing Phase** in **[triage-landing.md](triage-landing.md)**. Write the payload with the Write tool (`{"lane": "route", "items": [{"title": "…", "target": "…", "detail": "…"}], "remaining": N}`, one entry per remaining finding — up to five, `remaining` counting the lane's findings beyond this screen: `title` is the report's own claim, `target` is the owning topic, `detail` is why it is theirs and which queue it lands in), then render it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render finding-batch {work_unit}.{phase}.{topic} --file .workflows/.cache/{work_unit}/{phase}/{topic}/batch-route.json
```

Emit the call's DISPLAY and MENU sections, each verbatim per its marker — except on a re-entry after an answered question that changed nothing, where the list on screen is still current: emit the MENU section alone. A re-entry whose screen did change (a kept finding left survivors) rewrites the payload and re-renders both sections, renumbered.

**STOP.** Wait for user response.

**If `yes`:**

Deliver each finding in turn, with the context built here so its target resolves it from cold. Write no reroute record and leave the Discussion Map untouched — the target's queue is the record.

→ Load **[triage-landing.md](triage-landing.md)** with work_unit = `{work_unit}`, target = `{target}`, concern = `{the finding with the context built here}`, origin = `{topic}`, phase = `{phase}`, landing_phase = `{landing_phase}`, date = `{today}`.

On return, a `result` of `cancelled` means nothing was written for that finding — leave it unsurfaced and re-present it on the next visit. When a landing response carried `reconcile_flagged` or `sources_staled`, also tell the user what it flagged — the target's completed discussion (research landing) or the specification(s) named in `sources_staled` (discussion landing, their extraction now stale). When every delivery has returned, record the landed ids in one call:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent surface {work_unit} {phase} {topic} {id} {F1,F2,…}
```

Confirm in one line total — `All {N} sent.`, or what actually landed when a delivery was cancelled — never a per-delivery recap.

→ Return to **D. Route by Lane**.

**If the user asks about a number:**

Answer it. A finding the user says belongs here is theirs to keep: leave it unsurfaced and treat it as walked.

The batch is still owed, and nothing has been surfaced — returning to the caller here would re-render the announce menu the user already answered.

→ Return to **H. Belongs Elsewhere**.

**If the user moves on without answering** — they bounce to another subtopic, another finding, or the main thread:

Nothing is sent and nothing is recorded. Follow them; the next natural break re-enters the protocol and re-offers the lane.

→ Return to caller.

## Never-Dump Checklist

Before producing any surfacing output, verify:

- □ At most one OPEN ask this turn — one batch screen awaiting approval or one raised finding awaiting its answer; a confirmed screen rolls into the next screen or lane, but nothing ever stacks unanswered
- □ In the walked lane: AT MOST one finding, AT MOST one question — the finding's own, never an ask to park or defer it — and the finding stated self-contained before any position or proposal
- □ In a batch: every item shown before anything is applied, documented, or sent — two lines each, numbered within its screen
- □ No screen holds more than five items — a larger lane paginates, it never dumps
- □ Every `decide` item names what determined it — a call without its derivation is walked, never batched
- □ No finding demoted out of the walked lane — promotion only
- □ No bare id (`F5`, `T2`) as a label in prose — named by report title or described
- □ Not reading the content file verbatim

If any box is unchecked, stop and reframe.

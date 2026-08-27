# Background Agent Surfacing

*Shared reference for workflow skills with background agents (review, perspective/synthesis, deep-dive).*

---

This reference defines how to surface findings from background agents. Findings arrive classified by the move they ask of the user, and each class gets the ceremony it earns — a batch for the ones with no choice in them, a scannable screen of made calls for the ones the record settles, a conversation opened for the ones that need a decision. All lifecycle state lives in the engine's agent store — never in the content files, whose markdown is the report and nothing else.

**Parameters** (provided by caller via Load directive):

- `agent_type` — `review` | `synthesis` | `deep-dive` — human-readable name used in user-facing messages, and the row kind this invocation surfaces
- `work_unit`, `phase`, `topic` — the agent store address

**Lane declaration** — the calling reference's **Lanes** section, already in context, owns this phase's lane semantics: the walked lane's name and heading, and what approving each batch lane does. A caller with no **Lanes** section is all-walk; its raises render under `Needs A Decision`. A batched lane the declaration doesn't carry is walked — a report can only batch what its caller knows how to land.

## The Core Rules

**The ceremony matches the move owed, never the finding's importance.** Five hard rules govern every surfacing interaction:

1. **Two-phase surfacing.** First acknowledge the report exists (micro-menu, no content). Only after the user opts in, start on the lanes.
2. **One open ask per turn.** A surfacing turn ends only on a pending ask — a batch screen awaiting approval, one raised finding awaiting its answer — never after a completed action: an approved screen confirms in a line and rolls into the next screen or lane in the same turn, and a closed walk engagement re-enters **A. Check for Results** as **G** prescribes. Inside the walked lane, one finding per turn, always.
3. **Mid-thread protection.** If you are mid-Q/A with the user, defer the announce menu until the next natural break. A one-line parenthetical is acceptable, but only the first time.
4. **Nothing is applied unseen.** Every item is rendered — numbered, with its two-line reading — before a single edit lands. A lane larger than one screen renders in screens of at most five, and each screen's approval lands only its own items. "There was no choice anyway" is not licence to write first.
5. **Findings move toward the user, never away.** A finding the report placed in a batch moves into the walked lane the moment you find a real choice hiding in it, or the user says it isn't settled. Never the reverse: a walked finding is never demoted into a batch to save a turn.

Natural-break detection is guidance, not hard-enforced.

→ Load **[natural-breaks.md](natural-breaks.md)** and follow its instructions as written.

## LLM Turn Semantics (IMPORTANT)

This protocol runs as a turn-level check, not a long-running state machine. Each invocation runs one `agent scan` and acts on its answer. Turns end at asks, never after actions: once a finding is raised or a batch screen awaits approval, control belongs to the conversation — do NOT wait "inside the protocol" for the user to finish engaging. A completed action is no exit: an approved screen confirms in one line and continues to the next screen or lane in the same turn, and a closed walk engagement re-enters **A. Check for Results** in the same turn, as **G** prescribes. A drain the user steps away from resumes at the next natural break — every session-loop iteration re-enters here, and the row lists say exactly where things stand.

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

Render the announce menu. `shape` is the lane split in one clause, in lane order, each lane's count carrying that lane's own phrase — apply *need nothing from you*, decide *need a scan*, the walk *need a call*, route *belong elsewhere* (e.g. *3 need nothing from you, 5 need a scan, 6 need a call, 2 belong elsewhere*); name only lanes that have findings, and never lend one lane another's phrase — a decide count announced as needing a call reads as decisions still owed when the calls are already made. Do not describe individual findings, do not summarise, do not preview. Write the payload to the topic's cache directory with the Write tool (`{"agent_type": "…", "count": N, "shape": "…"}`), then render it, emitting the section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render finding-announce {work_unit}.{phase}.{topic} --file .workflows/.cache/{work_unit}/{phase}/{topic}/announce.json
```

After emitting the menu, record the announce — skip the call when the row already reads `announced: true`:

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

Take the screen's findings one at a time — each finding's fix is its own edit and its own commit, under that finding's subject marker (`({id} {finding})`), before the next begins; the screen presents them together, the landing never batches them.

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

Take the screen's findings one at a time — each call's write-up is its own edit and its own commit, under that finding's subject marker (`({id} {finding})`), before the next begins; the screen presents them together, the landing never batches them.

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
3. Digest the finding from the content file — never read it out — and compose the raise as an opener, never a case: its whole job is to put the user in front of the problem and say where you stand. Everything else — the report's full case, your own supporting analysis, the costs, secondary consequences — stays back and enters the conversation as responses, when the user's reply calls for it. Two beats:
   - **The problem, made immediately graspable.** Say where it came from (the background {agent_type}) and what it observed — for a synthesis, the two positions in tension — then make the problem land before your position arrives: product perspective first, one to three devices (**Making it land** below), technical depth only as deep as seeing the problem needs. A findings walk is a series of cold starts — each raise lands in a corner of the document the user last held fully hours or days ago — so rebuild what seeing the problem requires, and nothing more. Restate any term borrowed from another subtopic or an earlier decision; never reference it bare. Never use a bare id (`F5`, `T2`) as a label in conversational prose — name the finding by its report title on first mention, or describe it by what it is; ids belong in commit subjects (`(review-003 F5)`) and in-document markers (`(resolves review-003 F5)`), not in the conversation. When earlier findings from this set have been raised, open with a one-line bridge: what the previous one settled — or simply that it was raised, when that engagement predates this session — and how many follow this one (the surface response's `remaining`, counted within this lane).
   - **Your position, always.** Where you stand and the one load-bearing reason that carries it — a clause, not the derivation — at the firmness the answer has actually earned (**The position's firmness** below). Where the position leans against an alternative, that alternative gets **at most one clause naming the kind of cost it carries** — never two costs, never a cost with its consequence spelled out, whether the cost comes from the report or from your own reading. A clause that enumerates or explains has become the case, and the case stays back.
4. Raise it in the current turn, then stop — one raise per turn. **The raise ends by saying where the ball sits.** Its last beat tells the user what kind of reply moves things forward, and takes one of three shapes: a genuine question, where the position turns on something only the user holds; an invitation to push back, where a real choice exists — pointing at the load-bearing reason the opener already gave as what a different reading would have to move, so the invitation belongs to this finding rather than to politeness; or, where nothing needs a call from the user, saying so plainly and offering the pause — they are free to read and weigh in, and a word from them moves the walk on. A dead stop is not an ending: a raise that trails off after its position leaves the user unsure whether a reply is owed or the conversation broke. No menu, no bundled follow-ups, no stock closer: "what do you think?" is never the ask, and a closing beat repeated verbatim across the walk reads as chrome, not a colleague — phrase it from the finding just raised. The beat draws only on what the opener already said — reaching into the held-back depth for a concrete pivot is how the case leaks back in one clause at a time. The raise proposes and never lands: whatever its firmness, nothing is documented until the user has replied, and the next finding waits until this one's outcome is documented — the write-up turn picks it up (below).

When this row's `surfaced` list holds no walked finding yet, the raise opens with the walked lane's declared heading as sub-step chrome, so the shift out of the batches is visible. A walk already under way — including one resumed from an earlier session — opens with its bridge instead, never a repeated heading:

> *Output the next fenced block as markdown (not a code block):*

```
**`▪ {lane_heading}`**
```

**Making it land** — an example over a description, every time: a reader who can picture the failure can judge the fix; a reader parsing a mechanism description is still building the picture when your position arrives.

- **The devices**: a worked example grounded in the topic or the product (often the normal case resolving fine, then the one adjustment that breaks it — the adjustment *is* the finding); a small ASCII diagram where shape or flow helps; a before/after list; a short step-by-step walkthrough; an analogy or simile to another part of the product or codebase, or to an app the user knows. One to three, chosen for understanding-speed, and varied across the walk — twenty identically shaped raises read as a template, not a colleague.
- **The cheap path**: within a scene already rebuilt this session, or when the finding set was visible moments ago, a bridge clause replaces the reconstruction.
- **The test**: the user can picture the problem and knows where you stand — both from a glance.

**The position's firmness** — judged live against the session, never read off the report. Where re-derivation moves the finding itself — it holds, it's narrower than framed, a decision made since the report already covers it — that is part of the position; say it. Then match the register to how determined the answer is:

- **One defensible shape** — the lane asked for a decision and re-derivation can't find one to make: say so openly, propose it plainly — a cost worth knowing rides in a clause — and offer to lock it in unless the user has something to add. Still a presentation, never a demotion: the user sees it whole and can push back before anything lands.
- **A preferred path among real options** — name your pick and its reason; the alternatives get a clause each, enough to push back on — never an option survey. The close points back at the pick's stated reason as what a push-back would have to move — it introduces no new material.
- **Genuinely open** — the user holds what the document lacks (a finding promoted on the user's own knowledge is this by construction): say what you'd need to know and ask for it — the raise's one genuine question lives here.
- **Needs investigation** — a spike or deep-dive beats either of you guessing; suggesting it is the position. Where the caller's **Lanes** declaration names the walked lane's move, that move closes the raise.
- **No lean at all** — rare and honest: say so flat and ask for the user's read. Never manufactured; reach it only when re-derivation truly leaves nothing.

The position answers the finding's own question, never its bookkeeping: proposing to park, defer, or record the finding as open is not a position — deferral is an outcome the user may choose, never one the raise proposes. A finding pulled from the decide screen reopens a made call: put the derivation on the table and ask what it missed.

After this, control belongs to the conversation. The user will engage (or reject, or redirect) naturally. Handle their response as normal discussion — not as protocol-driven routing. Their reply calibrates what comes next: the depth the opener held back — the report's full case, the derivation, the costs — enters as responses, each piece when the direction on the table calls for it. A reply that shows the problem didn't land is re-grounded simpler — a different analogy, a smaller example — never the same explanation again, louder. An outcome that re-decides previously `decided` ground, or names an entity, field, rule, or classification this topic's artifact didn't define — citation is not definition: a term carried here only by citing a sibling's decision was defined there — requires the sibling consult before it is documented: follow **G. Sibling consult at cross-topic decision points** in **[knowledge-usage.md](../../workflow-knowledge/references/knowledge-usage.md)** — query or cite, and the documented decision carries the `Sibling check:` line either way, its `no overlap found.` form included. An engagement ends resolved or rejected (**Rejecting a raise** below). A resolution is documented and committed, the commit subject carrying `({id} {finding})`, e.g. `(review-003 F2)`; a rejection writes nothing *into the artifact*, so no commit of its own carries it — a dismissal's manifest push rides the session's next topic-scoped commit. Either close is a natural break: re-enter **A. Check for Results** in the same turn, so the next raise follows while the context is warm. When the raise was the row's last — its surface response said nothing remains — there is no re-entry to make: the closing turn closes the drain as **D**'s drained exit prescribes.

**Rejecting a raise** — two shapes, and neither writes a word into the artifact: a finding parked in the document as an open note is residue, not an outcome.

- **Not now** — the default reading of any soft no (*skip it*, *not worth it*, *leave that one*). Drop the finding; step 2's `agent surface` call is already its whole record, so the drain has advanced and nothing further is written. Non-suppression is the resurfacing — if the gap is still real, a later review or the gap analysis finds it again; if the ground fills, it never returns.
- **Dismiss** — the user says not to raise it again. Push the finding's ground onto the topic's dismissed list, which every later review dispatch carries as grounds not to report:

  ```bash
  node .claude/skills/workflow-engine/scripts/engine.cjs manifest push {work_unit}.{phase}.{topic} dismissed_grounds "{one-line ground}"
  ```

  The ground is a neutral one-line statement of the territory the finding covered — never its verdict, never the user's reason. The list reads back with `manifest get` and comes off with `manifest pull` whenever the user asks.

Rejection settles interest, never ownership: a finding whose home is a sibling topic still routes, whatever the user makes of it here. An engagement that concludes the concern belongs to a sibling moves the finding to the `route` lane rather than rerouting it now — **H** sends the batch, and one send beats two.

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

Judge each finding's `landing_phase` per **Judging the Landing Phase** in **[triage-landing.md](triage-landing.md)**. Write the payload with the Write tool (`{"lane": "route", "items": [{"title": "…", "target": "…", "detail": "…"}], "remaining": N}`, one entry per remaining finding — up to five, `remaining` counting the lane's findings beyond this screen: `title` is the report's own claim, `target` is the owning topic — or, when no topic on the map owns the finding, the new kebab-case name the report proposed (the landing creates the topic; say so in `detail`), `detail` is why it is theirs and which queue it lands in), then render it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render finding-batch {work_unit}.{phase}.{topic} --file .workflows/.cache/{work_unit}/{phase}/{topic}/batch-route.json
```

Emit the call's DISPLAY and MENU sections, each verbatim per its marker — except on a re-entry after an answered question that changed nothing, where the list on screen is still current: emit the MENU section alone. A re-entry whose screen did change (a kept finding left survivors) rewrites the payload and re-renders both sections, renumbered.

**STOP.** Wait for user response.

**If `yes`:**

Deliver each finding in turn, with the context built here so its target resolves it from cold — honouring triage-landing's one-ask-per-file rule: a finding making several asks the target could accept or reject independently is delivered as separate concerns. Write no reroute record and leave the Discussion Map untouched — the target's queue is the record.

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
- □ In the walked lane: AT MOST one finding, AT MOST one question — a genuine one only the user can answer, never a manufactured invitation, never an ask to park or defer — and the problem made graspable before the position lands
- □ The raise's last beat says where the ball sits — a genuine question, a push-back point drawn from what the opener already said, or a stated nothing-to-decide with the pause offered — never a dead stop after the position, never a stock closer, never new material from the held-back depth
- □ The raise is an opener, not the case — a position with its one load-bearing reason; the report's full case, the derivation, and the costs stay back until the conversation asks. The alternative direction carries at most one clause naming a cost's kind: count the costs named and check none has its consequence spelled out — two, or one explained, is the case
- □ No outcome documented in the raise's own turn — the write-up waits for the user's reply
- □ In a batch: every item shown before anything is applied, documented, or sent — two lines each, numbered within its screen
- □ No screen holds more than five items — a larger lane paginates, it never dumps
- □ Every `decide` item names what determined it — a call without its derivation is walked, never batched
- □ No finding demoted out of the walked lane — promotion only
- □ No bare id (`F5`, `T2`) as a label in prose — named by report title or described
- □ Not reading the content file verbatim

If any box is unchecked, stop and reframe.

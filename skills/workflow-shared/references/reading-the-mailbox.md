# Reading the Mailbox

*Shared reference. Loaded by the session wrappers of `workflow-discussion-process` and `workflow-research-process` (whose session loops enter **A. Check** from their mailbox check each iteration) and by `workflow-investigation-process` at its resumed-session check and conclusion gate.*

---

Raises the current topic's mailbox — messages other topics sent here, one engine-numbered file each, shape pinned in [sending-a-message.md](sending-a-message.md) — one at a time, through conversation. A message leaves the mailbox only after it has been raised, worked with the user, folded into the topic's content as the record of that discussion, and absorbed under its own commit — or forwarded to the topic's other phase-side when its ask turns out to be owed there. An empty mailbox is a no-op. The conclusion gate backstops the whole protocol: the topic cannot conclude while its mailbox holds messages, so nothing is lost however freely the user moves.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the work unit. Always present.
- `topic` — the current topic, whose mailbox is raised.
- `phase` — `discussion`, `research`, or `investigation`. Selects the artefact and the fold shape.

## A. Check

List the topic's mailbox — a fresh read at every consult, never a count carried from resume detection or an earlier iteration; a peer session may have sent a message since:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic mailbox {work_unit} {phase} {topic}
```

Route on the response and the session's state — first match wins. The opt-in and the live message are conversation state: a context refresh loses both — re-offer, never re-assume.

#### If `count` is `0`

No mail waiting. No output.

→ Return to caller.

#### If a raised message is still under discussion

The conversation owns it — its outcome routes through **D. Fold**, and the user moving on parks the mailbox. A parked message is not under discussion: it waits for the natural-break branch below. Nothing to do here.

→ Return to caller.

#### If the opt-in is standing

The previous message's absorb is the natural break.

→ Proceed to **C. Raise One Message**.

#### If this is the session's first consult

**If the sitting resumed existing work** (the artifact predates this session — a resume or reopen; after a context refresh, treat the sitting as resumed):

Waiting messages may bear on the ground the session is about to build on: the offer precedes any session output — render it now, before the first question or thread.

→ Proceed to **B. Offer**.

**If the sitting began at initialization** (a first start or restart — this session created the artifact):

The topic has no conversational ground yet, and an agenda of other topics' messages would seed the session away from its own material. Announce without offering — one line, count only, no titles:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render mail-announce {work_unit}.{phase}.{topic}
```

Emit its `DISPLAY: mail announce` section verbatim per its marker, then open the session from its own material. The first offer waits for a genuine break in the session's own thread — or the user asking for the mailbox; the natural-breaks checklist's just-opened signal never satisfies this deferral.

→ Return to caller.

#### If at a natural break

A message arrived mid-session, the user chose `later` earlier, or the sitting opened fresh with the mailbox announced. Judge the break by the checklist, with two readings of its own: a recent `later` defers the re-offer until the conversation has genuinely moved on — except at the close, the user's signal or, in discussion, the map settling, which is the break a deferred message was waiting for and holds over the `later` — and the just-opened signal does not count here, the announce having spent it; a break in the session's own thread is what qualifies.

→ Load **[natural-breaks.md](natural-breaks.md)** and follow its instructions as written.

**If the checklist defers:**

→ Return to caller.

**Otherwise:**

→ Proceed to **B. Offer**.

#### Otherwise

Mid-thread — never interrupt. The next iteration's check reconsiders.

→ Return to caller.

## B. Offer

Read the first two lines only of each mailbox file — the `### {title}` heading and the `*From: {origin} · {from_phase} · {from_date}*` provenance line — with the Read tool's `limit` set to 2, never a whole-file read: a body read here is a body in context before the user has opted in. Write the agenda payload to `.workflows/.cache/{work_unit}/{phase}/{topic}/mail-offer.json` with the Write tool — one item per mailbox file, keyed by its basename:

```json
{"items": [{"file": "{NNN-slug}.md", "title": "…", "origin": "…", "from_phase": "…", "from_date": "…"}]}
```

Render the offer:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render mail-offer {work_unit}.{phase}.{topic} --file .workflows/.cache/{work_unit}/{phase}/{topic}/mail-offer.json
```

**If the response is `ok: false`** — the mailbox moved beneath the payload (a peer session sent a message): re-run **A. Check**'s mailbox command, rebuild the payload over the fresh mailbox, and render again.

Emit its `DISPLAY: mail agenda` section, then its `MENU: mail offer` section, each verbatim per its marker.

**STOP.** Wait for user response.

**If `yes`:**

The opt-in now stands — it authorises raising each remaining message in turn, never agreement to any message's content, and the user can park the mailbox at any point by saying so.

→ Proceed to **C. Raise One Message**.

**If `later`:**

No opt-in. The check re-offers at a later break; the conclusion gate holds regardless.

→ Return to caller.

## C. Raise One Message

Take the lowest-numbered message still waiting — or whichever the user asks for. Read its mailbox file — `.workflows/{work_unit}/{phase}/.mailbox/{topic}/{NNN-slug}.md` — with the Read tool; `{origin}` is where its provenance line says the message came from — the topic named there, or that topic's phase when the name is this topic's own. The entry is your brief, never the user's display: it reaches the conversation only through the raise you compose from it and the responses that follow, and the raw entry is shown only when the user asks.

**If the entry's ask is owed the topic's other phase-side** — `phase` is `research` or `discussion`, and the ask calls for what the pair's other phase does: a decision owed, or a correction to material the other side's document records, while this session explores; an open question needing exploration while this session decides — offer to forward it before any raise, once per message (a declined or refused offer never re-renders). Write the offer payload to `.workflows/.cache/{work_unit}/{phase}/{topic}/forward-offer.json` with the Write tool — `{"file": "{NNN-slug}.md", "title": "…", "reason": "…"}`, the reason one sentence naming why the ask belongs the other side — then render:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render forward-offer {work_unit}.{phase}.{topic} --file .workflows/.cache/{work_unit}/{phase}/{topic}/forward-offer.json
```

Emit its `MENU: forward offer` section verbatim per its marker.

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **F. Forward to the Other Phase**.

**If `discuss`:**

The ask is worked here after all. Continue with the raise below.

**If `phase` is `discussion`, arm the Discussion Map before raising** — the map tells the truth while the message is live, and routing a correction needs the body just read. Read the subtopic states:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discussion.{topic} subtopics
```

Route on the ground the message reopens — the subtopic its title names (`{title:(kebabcase)}`), or, when its title names no subtopic, the subtopic whose recorded content its ask would rewrite: an ask that corrects or re-decides what a block records routes to that block. An ask that only stands near a recorded decision — whether something more is owed, whether the decision already covers it, what follows from it — rewrites nothing and is new ground of its own, however much its answer leans on that decision. Note the prior state for the fold; `{subtopic}` is the routed ground's name:

- Not on the map — new ground. Add it, then arm it:

  ```bash
  node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map add {work_unit} {topic} {title:(kebabcase)}
  node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map set {work_unit} {topic} {subtopic} exploring
  ```

- `decided` or `deferred` — settled ground is reopening — or `pending` — open ground coming under discussion. Arm it:

  ```bash
  node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map set {work_unit} {topic} {subtopic} exploring
  ```

- `exploring` or `converging` — already live. Leave it.

The raise covers this message alone — for a walked entry, this ask alone: no other waiting message, open item, or finding rides along, and a gap you spot while preparing it is your finding, not the entry's — it parks as a tangent (below), never joins the raise. An entry carrying one ask is one raise. An entry carrying several distinct asks — points the user could accept or reject independently — is walked one ask at a time: a one-line map of what the entry brings (titles only) sits above the raise, beside the bridge where one is owed, then the first unresolved ask is raised alone — on a fresh raise that is the first ask; on a re-raise of a half-walked entry, the first its earlier walk left open; each later ask waits for the one before it to resolve and gets its own raise when its turn comes.

Compose the raise from the entry — or from the ask on the table — digested, never read out, with where it came from as the source:

→ Load **[composing-a-raise.md](composing-a-raise.md)** with source = `message`, origin = `{origin}`.

Raise it in the current turn, then stop: the raise proposes and never lands — nothing is documented until the user has replied. Their reply calibrates what comes next: the depth the raise held back — the entry's full case, its costs, what the origin weighed — enters as responses, each piece when the direction on the table calls for it, and the fold records the outcome. Vary the shape across a mailbox of several messages — identical raises read as a template, not a colleague.

**STOP.** Wait for user response.

Then discuss it as real session material: engage, challenge, connect it to what this topic has already decided. Control belongs to the conversation — this may take one exchange or many, and the loop's other machinery (documenting, commits — and in discussion the dispatch check, whose mailbox box holds while messages remain, so no review launches mid-walk) runs as normal around it. The message on the table is the session's only subject and the only thing the user's agreement can cover: a tangent it surfaces is parked — on the Discussion Map as `pending`, or on the research thread register — and picked up after the mailbox empties, and no question or proposal spans another waiting message, however the user phrases their steer.

**If the discussion reaches an outcome** — a decision, a direction, or the user explicitly parking it as a deferred thread; for a walked entry, when its last ask resolves (earlier asks' outcomes are documented and committed by the loop's machinery as they land):

→ Proceed to **D. Fold**.

**If the user moves on without engaging it** — they bounce to another subtopic, another message, or the main thread:

The message stays in the mailbox and the opt-in is cleared — a half-walked entry keeps its unresolved asks, and its re-raise resumes at the first of them. Follow them; the check re-offers at a later break, and the conclusion gate holds until the mailbox is empty.

→ Return to caller.

## D. Fold

Record the discussion in the topic's content. The fold is an engagement decision point: before its outcome is recorded, follow **G. Sibling consult at cross-topic decision points** in **[knowledge-usage.md](knowledge-usage.md)** — both its triggers apply here.

A cross-topic correction tempts you to write guidance about the documents themselves. Do not: never write rules for how documents cite, edit, or point at each other, and never write lessons about how the topics drifted apart. The fold records only what changed and why, in the topic's own terms.

#### If `phase` is `discussion`

Write the outcome into the document:

- **A pure correction** (the outcome is only that cited material is out of date — nothing new was decided): amend the affected sites in place, each amendment a dated note naming the superseding decision — e.g. *(Amended {date} — this cited {thing}; {origin} retired it on {date})* — striking or rewriting the stale text as each site needs. No dedicated section and no Context block: the dated amendments and the absorb commit are the message's record.
- **The message's own ground** (the subtopic exists only because raising this message added it — this raise's `add`, or an earlier raise of it the user moved on from): create a `## {title}` section whose `### Context` opens with a provenance line (`*From: {origin} · {from_phase} · {from_date}*`) followed by the message's body verbatim — the entry is the record, never a summary of it — then document what the discussion concluded in the section's usual shape.
- **Pre-existing subtopic**: append the provenance line and the message's body verbatim to that subtopic's existing `### Context` — never a new heading of your own — and, where the outcome re-decides the block, land the re-decision as a dated entry on its Decision per the template's revision convention. The Context join and the timeline entry are both this fold's writes — one without the other is half a fold. A map entry whose section was never written has nothing to append to: create the `## {title}` section exactly as the branch above prescribes.

Then set the map state — the fold corrects the record, it never advances the session's own open ground:

- **The message's own ground** → wherever the message's own discussion landed — `decided` with a fully written section when the outcome is a decision.
- **Reopened settled ground** (was `decided` or `deferred` before the message's first raise): the re-decision already landed on the block per the write branch above → set `decided`. An outcome that re-parks previously-`deferred` ground → set `deferred` — the one fold that may write that state: the raise showed the user exactly what is being set aside, and the fold notes the thread in Summary → Open Threads as the defer gate would. If the discussion left the ground genuinely open, leave it `exploring`.
- **The session's own open ground** (was `pending`, `exploring`, or `converging` before any raise of this message): leave it where the arming put it — never `decided` from a fold, however settled the exchange felt. Deciding the session's ground is its own work after the mailbox empties.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map set {work_unit} {topic} {subtopic} {state}
```

→ Proceed to **E. Absorb**.

#### If `phase` is `research`

Fold the message into the freeform body as a `### {title}` section opening with the provenance line, followed by the body verbatim and what the discussion made of it. Then the thread register, the sending topic as the origin:

- **The fold holds the answer** — enter it and mark it learned:
  ```bash
  node .claude/skills/workflow-engine/scripts/engine.cjs research-threads add {work_unit} {topic} {title:(kebabcase)} --question "{the message's question}" --origin "{origin}"
  node .claude/skills/workflow-engine/scripts/engine.cjs research-threads set {work_unit} {topic} {title:(kebabcase)} learned
  ```
- **Research is still owed** — enter it and leave it open:
  ```bash
  node .claude/skills/workflow-engine/scripts/engine.cjs research-threads add {work_unit} {topic} {title:(kebabcase)} --question "{the message's question}" --origin "{origin}"
  ```
- **The slug is already on the register** — nothing enters twice; `research-threads set {work_unit} {topic} {title:(kebabcase)} learned` when the fold holds the answer, otherwise leave it as it stands.

→ Proceed to **E. Absorb**.

#### If `phase` is `investigation`

Fold the message into the investigation file in its own idiom: revise the passages the settled answer touches directly, and where the message opened ground the file never covered, add a `### {title}` section opening with the provenance line, followed by what the investigation made of it.

→ Proceed to **E. Absorb**.

## E. Absorb

Absorb the message — one engine transaction deletes its mailbox file and commits the fold action-scoped under its name, bracketing the message's life in history with the send commit that delivered it. A discussion absorb also names the message's ground — `--subtopic {subtopic}`, the subtopic the raise armed: the engine settles it into the review anchor, so the fold never counts toward review arming and a sitting that only drained the mailbox arms no review (its review duty belongs to the concluding flow). Omit the flag for the other phases. The response answers `remaining` — route on it; never recap the absorbed message on either branch:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic absorb {work_unit} {phase} {topic} --file {NNN-slug}.md [--subtopic {subtopic}] -m "{phase}({work_unit}/{topic}): absorb {NNN-slug} (from {origin})"
```

#### If `remaining` is non-zero

Emit nothing here — no recap, no pause for permission. The absorb is the next raise's natural break: re-enter the check now, in this same turn, and the standing opt-in routes it straight to the next raise — whose bridge, the line above its problem, says what this one settled and how many remain.

→ Return to **A. Check**.

#### If `remaining` is `0`

Emit the clear line — no recap of the walk:

> *Output the next fenced block as a text code block (```text fence):*

```text
Mailbox clear — every message is folded in.
```

**If `phase` is `discussion` and the fold's `discussion-map set` answered `all_decided: true`:**

The map settled on that fold — the closing gates are the offer.

→ Return to caller for **G. Concluding**.

**Otherwise:**

→ Return to caller.

## F. Forward to the Other Phase

Set `other_phase` to the pair's other phase (`research` ↔ `discussion`). One engine transaction owns the forward: it renumbers the file into the other phase's mailbox, parks or reopens that side's item exactly as a send would, and commits action-scoped:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic forward {work_unit} {phase} {other_phase} {topic} --file {NNN-slug}.md -m "{phase}({work_unit}/{topic}): forward {NNN-slug} to {other_phase}"
```

#### If the response is `ok: false`

Surface the engine's error verbatim — it names the recovery path. The message is still in this mailbox; raise it as normal, the offer spent.

→ Return to **C. Raise One Message**.

#### If `remaining` is non-zero

Announce the forward in one line carrying every fact that applies: the message now waits in this topic's `{other_phase}` mailbox, raised when that phase runs; which downstream work the forward flagged, when the response carries `reconcile_flagged` or `sources_staled`; and, when the forward parked the message research-side, that this discussion now waits on that research — it cannot conclude, and cannot be re-entered once this session closes, until the research lands — the menu carries the way in. Nothing about the forwarded message is written into this document: the mailbox file travelled whole, and the announcement is its only trace here. Then re-enter the check now, in this same turn — the forward is the next raise's natural break, and the standing opt-in routes it straight to the next raise.

→ Return to **A. Check**.

#### If `remaining` is `0`

Announce the forward in the same one line, then emit the clear line — no recap of the walk:

> *Output the next fenced block as a text code block (```text fence):*

```text
Mailbox clear — nothing further waiting for this topic.
```

**If `phase` is `discussion` and the last `discussion-map set` this drain ran answered `all_decided: true`:**

The map stands settled — the closing gates are the offer.

→ Return to caller for **G. Concluding**.

**Otherwise:**

→ Return to caller.

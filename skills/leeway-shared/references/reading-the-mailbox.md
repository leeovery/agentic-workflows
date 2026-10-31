# Reading the Mailbox

*Shared reference. Loaded by `leeway-investigation-process` at its resumed-session check and conclusion gate.*

---

Raises the current topic's mailbox — messages other topics sent here, one engine-numbered file each, shape pinned in [sending-a-message.md](sending-a-message.md) — one at a time, through conversation. A message leaves the mailbox only after it has been raised, worked with the user, folded into the topic's content as the record of that discussion, and absorbed under its own commit. An empty mailbox is a no-op. The conclusion gate backstops the whole protocol: the topic cannot conclude while its mailbox holds messages, so nothing is lost however freely the user moves.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the work unit. Always present.
- `topic` — the current topic, whose mailbox is raised.
- `phase` — `investigation`.

## A. Check

List the topic's mailbox — a fresh read at every consult, never a count carried from resume detection or an earlier iteration; a peer session may have sent a message since:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs topic mailbox {work_unit} {topic}
```

Route on the response and the session's state — first match wins.

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

**If the sitting resumed existing work** (the artifact predates this session — a resume or reopen):

Waiting messages may bear on the ground the session is about to build on: the offer precedes any session output — render it now, before the first question or thread.

→ Proceed to **B. Offer**.

**If the sitting began at initialization** (a first start or restart — this session created the artifact):

The topic has no conversational ground yet, and an agenda of other topics' messages would seed the session away from its own material. Announce without offering — one line, count only, no titles:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render mail-announce {work_unit}.{phase}.{topic}
```

Emit its `DISPLAY: mail announce` section verbatim per its marker, then open the session from its own material. The first offer waits for a genuine break in the session's own thread — or the user asking for the mailbox; the natural-breaks checklist's just-opened signal never satisfies this deferral.

→ Return to caller.

#### If at a natural break

A message arrived mid-session, the user chose `later` earlier, or the sitting opened fresh with the mailbox announced. Judge the break by the checklist, with two readings of its own: a recent `later` defers the re-offer until the conversation has genuinely moved on — except at the close, the user's signal, which is the break a deferred message was waiting for and holds over the `later` — and the just-opened signal does not count here, the announce having spent it; a break in the session's own thread is what qualifies.

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
node .claude/skills/leeway-engine/scripts/engine.cjs render mail-offer {work_unit}.{phase}.{topic} --file .workflows/.cache/{work_unit}/{phase}/{topic}/mail-offer.json
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

Take the lowest-numbered message still waiting — or whichever the user asks for. Read its mailbox file — `.leeway/{work_unit}/topics/{topic}/mail/{NNN-slug}.md` — with the Read tool; `{origin}` is where its provenance line says the message came from — the topic named there, or that topic's phase when the name is this topic's own. The entry is your brief, never the user's display: it reaches the conversation only through the raise you compose from it and the responses that follow, and the raw entry is shown only when the user asks.

The raise covers this message alone — for a walked entry, this ask alone: no other waiting message, open item, or finding rides along, and a gap you spot while preparing it is your finding, not the entry's — it parks as a tangent (below), never joins the raise. An entry carrying one ask is one raise. An entry carrying several distinct asks — points the user could accept or reject independently — is walked one ask at a time: a one-line map of what the entry brings (titles only) sits above the raise, beside the bridge where one is owed, then the first unresolved ask is raised alone — on a fresh raise that is the first ask; on a re-raise of a half-walked entry, the first its earlier walk left open; each later ask waits for the one before it to resolve and gets its own raise when its turn comes.

Compose the raise from the entry — or from the ask on the table — digested, never read out, with where it came from as the source:

→ Load **[composing-a-raise.md](composing-a-raise.md)** with source = `message`, origin = `{origin}`.

Raise it in the current turn, then stop: the raise proposes and never lands — nothing is documented until the user has replied. Their reply calibrates what comes next: the depth the raise held back — the entry's full case, its costs, what the origin weighed — enters as responses, each piece when the direction on the table calls for it, and the fold records the outcome. Vary the shape across a mailbox of several messages — identical raises read as a template, not a colleague.

**STOP.** Wait for user response.

Then discuss it as real session material: engage, challenge, connect it to what this topic has already decided. Control belongs to the conversation — this may take one exchange or many, and the loop's other machinery (documenting, commits) runs as normal around it. The message on the table is the session's only subject and the only thing the user's agreement can cover: a tangent it surfaces is parked and picked up after the mailbox empties, and no question or proposal spans another waiting message, however the user phrases their steer.

**If the discussion reaches an outcome** — a decision, a direction, or the user explicitly parking it as a deferred thread; for a walked entry, when its last ask resolves (earlier asks' outcomes are documented and committed by the loop's machinery as they land):

→ Proceed to **D. Fold**.

**If the user moves on without engaging it** — they bounce to another subtopic, another message, or the main thread:

The message stays in the mailbox and the opt-in is cleared — a half-walked entry keeps its unresolved asks, and its re-raise resumes at the first of them. Follow them; the check re-offers at a later break, and the conclusion gate holds until the mailbox is empty.

→ Return to caller.

## D. Fold

Record the discussion in the topic's content. The fold is an engagement decision point: before its outcome is recorded, follow **G. Sibling consult at cross-topic decision points** in **[knowledge-usage.md](knowledge-usage.md)** — both its triggers apply here.

A cross-topic correction tempts you to write guidance about the documents themselves. Do not: never write rules for how documents cite, edit, or point at each other, and never write lessons about how the topics drifted apart. The fold records only what changed and why, in the topic's own terms.

Fold the message into the investigation file in its own idiom: revise the passages the settled answer touches directly, and where the message opened ground the file never covered, add a `### {title}` section opening with the provenance line, followed by what the investigation made of it.

→ Proceed to **E. Absorb**.

## E. Absorb

Absorb the message — one engine transaction deletes its mailbox file and commits the fold action-scoped under its name, bracketing the message's life in history with the send commit that delivered it. The response answers `remaining` — route on it; never recap the absorbed message on either branch:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs topic absorb {work_unit} {phase} {topic} --file {NNN-slug}.md -m "{phase}({work_unit}/{topic}): absorb {NNN-slug} (from {origin})"
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

→ Return to caller.

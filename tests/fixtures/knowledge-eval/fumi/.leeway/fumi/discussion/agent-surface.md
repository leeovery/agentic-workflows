# Discussion: Agent Surface

## Context

The `fumi` CLI and MCP server are two of the four thin clients over the always-on engine's local socket (note windows and the menu-bar manager are the others). This topic decides what those two clients expose: the operation set, how a fumi is addressed, what comes back from a call, and what happens when an agent writes to a fumi a human has open and is typing in.

The north star inherited from discovery: the surface is built for an AI that **lists → reads → reasons → acts on a UID**, not for a human memorising commands. A human using the CLI is a welcome side effect, not the design target.

### Inherited position (soft — from the discovery brief)

- A fumi is a Markdown **body** plus metadata (UID, space, position, tags, float, visible).
- **Verb sketch, not resolved**: *body* — `new`, `read`, `edit` (replace body), `append`; *metadata* — `mv --space N`, `tag`, `pos <preset>`, `float`, `show`/`hide`, `rm`; *discovery* — `list`; *server* — ~~`fumi mcp`~~ *(superseded 2026-09-13 — engine-architecture ships two sibling binaries, `fumi` and `fumi-mcp`, rejecting the subcommand shape by name so the connecting peer's executable path identifies the channel without reading its argv; see Structured Output)*. No `rename` (the title is the derived first line, so editing the body renames). No `pin` (it is `float`).
- **Structured output** for agents, pretty output for humans, native structured returns for MCP — rich enough to reason in one round-trip: UID, derived title, space, tags, float state, position, content preview, timestamps.
- **UID is the currency, title a convenience.** On an ambiguous reference the agent reads candidates and reasons. `new` prints the new UID so calls chain (`id=$(fumi new …)`); stdin piping works (`echo … | fumi new`).
- **Silent create**: a fumi an agent creates on a Space the user is not looking at appears there silently — it never pulls focus.

### Rejected path (carried forward)

- Treating the CLI as a free power-user perk with the GUI as "the product". The licensed unit is the one always-on app, and the CLI and MCP server are inert without it — so there is no piracy surface in shipping them.

### Open on entry

- **Exact command grammar** — verbs, flags, output format. Deliberately deferred from discovery to here.
- **Write-side concurrency** — an agent edits a fumi that is open on screen while the human is typing in it. The engine is single-writer, so nothing corrupts, but last-write-wins can silently clobber in-flight edits. Option space sketched in discovery: append-only for agents (safe, limited) · full-body replace (powerful, riskier) · section-level merge (richer, more to build). Named in discovery as the meatiest real design in this topic.

### References

- [Discovery brief — agent-surface](../discovery/briefs/agent-surface.md)
- [Discussion — engine-architecture](engine-architecture.md) (decided: one engine, four thin clients, single-writer)
- [Discussion — note-model](note-model.md) (decided: UID, derived title, tags, colour)
- [Discussion — search-and-retrieval](search-and-retrieval.md) (in flight: what a search matches, and whether CLI, MCP and manager agree)

---

*Subtopics are documented below as they reach `decided` or accumulate enough exploration to capture. The Discussion Map lives in the manifest.*

---

## Write Concurrency

### Context

The engine already orders simultaneous writes: mutations serialise per note, an open note's editor buffer is the live copy every write goes through whatever channel it arrived on, and nothing locks (`engine-architecture`, Write ordering and the live copy). `note-window` matches it from the presentation side — agent edits arrive as text patches that stream into the buffer, the caret survives, and there is no write-locking during agent activity.

`engine-architecture` then named what it deliberately did not solve and left here:

> *"an agent that does `read` → reason → **replace the whole content** is a lost update no per-operation atomicity can fix, because the two operations are separated by the agent's own thinking."*

The case, in the product's own terms:

```
10:42:03   Claude reads note 01J9… → 400 words
10:42:05   you type three sentences into that note's window
10:42:11   Claude writes back the body it reasoned over — the 400 words, restructured
```

Three sentences gone from the live body. Not lost — every change is snapshotted with attribution, so they are two clicks away in version history. But **nothing on screen says so**: `note-window`'s recency tint marks text that *arrived* and explicitly cannot mark deletions, *"the text isn't there"*. So the one failure this creates is precisely the one the presentation layer is unable to signal.

### Options Considered

**A — agents never send a body.** Write verbs are `append` and a targeted replace (`--old`/`--new`, exact and unique). An agent cannot clobber text it did not read, because it never sends text it read.
- Cons: "restructure this note" stops being expressible.

**B — whole-body write, conditional on what was read.** The agent states the body it saw; the engine refuses if it has moved.
- Cons: an agent cannot land a whole-body write on a note being continuously typed in.

**C — whole-body write, unguarded; version history is the safety net.** Simplest, most consistent with *never block an agent*.
- Cons: the failure is silent by construction, and silent is the one thing the tint cannot fix.

**D — a session declaration.** The agent opens and closes an engagement so the engine knows it is working before bytes arrive. `note-window` parked this here for exactly this problem.
- Cons: it cannot prevent a lost update without locking, and locking is decided against.

### Journey

**A was proposed as the spine with B alongside it, and the user collapsed that.** Their move was to generalise B rather than pair it: *"On read the agent is given a hash or token which matches to the content. On write that token must be provided (forcing read before write always). If the content has moved between read and write (token invalid) then the write is rejected. Another read is forced."* Once a whole-body write is provably based on current content there is nothing left for a string-level replace to protect, so **A stops being a safety mechanism** and survives, if at all, only as ergonomics.

**B's cost was put up as an objection and returned as the point.** A token-guarded whole-body write cannot land while a human types — read, token dies on the next keystroke, write refused, re-read, refused again. The user's answer: *"ofc thats acceptable. thats the whole point!!"* The loop is the mechanism, not a failure of it: the agent retries until the note goes quiet, and *"I couldn't, you're editing it"* is an honest report where a clobber was not.

**`append` was cut, and the reasoning generalises past this subtopic.** It was in the brief's verb sketch and was defended here as the one write that can land while a human types. The user rejected the premise: *"I dont know why we need append, or how it would even work. agents arent always adding content to the end - its not a log. Its a note - meaning the content would be edited at the begining or middle or end."* A verb that only serves end-of-body is a log affordance on a document that is not a log; every real edit an agent makes is somewhere inside the text, which is the read-token-write path anyway. The escape hatch it offered is one the user had already declined to want.

**D separates cleanly and belongs elsewhere.** It cannot solve concurrency without the lock, but `note-window` has a live need it is the only candidate for: the shimmer must fire while an agent is reading, reasoning or calling other tools, and that window *produces no bytes*, so nothing except an explicit engagement signal can drive it. Same mechanism, different job — carried to its own subtopic rather than settled as a concurrency answer.

### Decision

> **A write that replaces existing content requires the read token that came with the content it is replacing. A token that no longer matches is refused, and the agent reads again.**

- **Read hands out a token** alongside the content — the token describes **the live body**, which is the body any write will replace. *(Sharpened 2026-09-13 — this read "the body the agent is about to reason over", which is the same thing in the ordinary case and wrong for a version read; see The token always describes the live body.)*
- **Content writes are conditional.** The token is a required argument; there is no unconditional whole-body write on the surface at all.
- **A stale token is refused, not merged.** The engine does not attempt reconciliation, and the human's keystrokes are never displaced by a write reasoned over text they have since changed.
- **The retry loop is the design.** An agent refused re-reads, re-reasons and tries again, and a note under continuous human editing is one an agent cannot rewrite until the typing stops. Accepted deliberately.
- **No `append`.** Cut from the brief's verb sketch: a note is edited in the middle as readily as the end, so every content change is the same operation.
- **No targeted-replace verb on safety grounds.** If it is ever added it will be for ergonomics, argued on its own terms.

**What this buys, stated as the failure it prevents:** the only way the product could silently delete text a human just typed is an agent writing a body it read before they typed it. That path no longer exists — the write is refused instead. This matters more than it looks because the recency tint cannot mark a deletion, so a clobber would have been invisible at the exact moment visibility was owed.

**Cost, accepted:** an agent working on a note its human is actively editing makes no progress and must say so. `engine-architecture` already established this is the safe direction — the engine always answers rather than waiting — and the alternative is the silent clobber above.

#### `new` carries no read token

**Settled by derivation** — not discussed. Determined by the guard's own purpose together with `engine-architecture`'s intent-shaped rule.

The token exists to prove a write is based on the body the agent reasoned over. A new note has no prior body, so there is nothing for a token to describe and the read-before-write rule cannot apply to it. `engine-architecture` already has the create operation carrying the note's full initial state as one atomic operation — content, Space, colour, float — so nothing is read first by construction.

#### The token is computed over the live copy

**Settled by derivation** — not discussed. Determined by `engine-architecture`'s buffer-as-live-copy rule.

An open note's editor buffer **is** the live copy, and every write to that note goes through it whatever channel it arrived on. A token computed from bundle bytes would therefore describe content the buffer is already ahead of — so a note being typed in would hand out tokens that are stale the moment they are issued, and refuse writes that were never in conflict. The token comes from the same copy the write lands on: the buffer for an open note, the bundle for a closed one.

#### The engine diffs a whole-body write before it reaches an open note *(resolves review-001 F5)*

You are reading a note. Claude fixes one sentence in the third paragraph. Does the note blink and redraw? Does the whole thing light up as new?

note-window decided agent edits arrive as **text patches** that stream into the open note, with the caret **held** rather than following incoming text, and the recency tint marking *"what you have not seen yet"*. That was settled when an agent write was expected to be small. This topic then made every content write carry the **whole body** — cutting the targeted replace and `append` — and the sibling check above asserted note-window's patch model *"is adopted, not re-decided"* without saying how it survives.

> **It survives because the engine makes it: the wire carries a whole body, and the engine diffs it against the live buffer before applying. What reaches the note is still a patch.**

**The engine is the only party that can.** It holds both sides — the live buffer (its own decided rule: an open note's buffer *is* the live copy every write goes through) and the incoming body. A client has neither.

**Rejected — tint the whole note on any agent write.** It would be the honest rendering of *"the whole body arrived"*, and it destroys the tint exactly where it earns its keep: a large restructure is when the user most needs to see **what** moved, and a uniformly glowing note says nothing. When an agent genuinely does rewrite everything, the diff is the whole note anyway — correctly, that time.

**Cost, named:** the engine derives a diff on every content write rather than applying what it was handed.

*Sibling check: note-window — its decided text holds agent edits arriving as text patches that stream into the buffer, the caret held rather than followed, no write-locking during agent activity, and the recency tint marking unseen text and unable to mark deletions. All four hold unchanged under this rule, which is what the earlier sibling check claimed without establishing; nothing there is revised. engine-architecture — its rule that an open note's editor buffer is the live copy every write goes through is what makes the diff possible and is relied on, not revised.*

#### The token always describes the live body *(resolves review-002 F1)*

*"Undo what you just did to that note."* Claude looks at the version list, picks the one from before its edit, and reverts — and two rules appeared to disagree about which read earned the token. A revert is a content write, so it takes one; a token comes from a read; and `read --version` is a read, which would mint a token describing four hundred words no longer in the note, refusing every revert.

> **A read returns a token for the **live** body, whatever content the call was asked for. `read --version X` returns X's text and the live token together.**

The user's correction, which dissolves the seam rather than patching it: *"View returns a token which hashes the live version. It doesn't matter if the agent edits the live version by updating the version or directly editing the text with an overwrite. It's still a write. No difference effectively. Just a different door."*

So there is no version-specific rule to write. A revert is a write to the live note, it replaces the live body, and the token describes the live body — the same guard, reached through a different door. **One call:** `read --version X`, then `edit --version X` with the token that came back.

**A proposal to hang the token off `list --versions` was wrong twice over** and is recorded because the second reason generalises: `list` enumerates **many** notes, so there is no single note for a write token to describe — a write token can only ride on a call scoped to one note. The first reason was that it invented a version-specific path where the existing rule already covered the case.

#### A write returns no token — a token comes only from a read *(resolves review-001 F1)*

Claude tidies a long note in three passes: read, write, then read all four hundred words again before the second change, because the token it held described the body it just replaced. Whether that second read is required was never stated.

> **It is. A token comes from a read and from nowhere else. A successful write returns no token.**

**Returning one was argued for and is wrong on the guard's own terms.** The case was that a token minted for the body the write just produced is current by construction, so nothing about staleness detection changes and a round trip disappears — and that materialisation makes it more than convenience, since the engine **rewrites the content the agent sent**, leaving the agent unable to know the current body even in principle.

That last point reverses on inspection. If the engine rewrote what the agent sent, **the agent's picture of the note is already wrong** — and handing it a token there gives it a valid licence to write over content it has never read. The guard exists so that a write is based on content the agent **reasoned over**; a post-write token satisfies the mechanism while defeating the purpose.

**And one rule beats two.** *A token comes from a read* has no conditional path, no question about which responses carry one, and nothing to get wrong. The user's position throughout: *"read then write. nice and simple."*

**`new` is unaffected** — it carries no token in (nothing exists to describe) and returns none out. The first edit of a just-made note reads first, like every other edit.

#### Metadata verbs carry no read token

**Settled by derivation** — not discussed. Determined by what the guard protects.

`mv`, colour, the geometry axes, `float`, `show`/`hide` each set one field to one value. A second writer arriving mid-flight overwrites a value — and that value is not text a human authored, so there is nothing recoverable to destroy and the guard has nothing to protect. The lost update the token answers is specific to **content**, where a write replaces bytes someone typed. Requiring a content read before moving a note to another Space would make an agent fetch four hundred words to earn the right to change one field.

*Sibling check: engine-architecture — its decided text holds mutations serialising per note, an open note's editor buffer as the live copy every write goes through, and the read-reason-replace lost update as explicitly out of its scope and this topic's to answer; this answers it and revises nothing there. note-window — its decided text holds no write-locking during agent activity, agent edits arriving as text patches, the caret held rather than followed, and the recency tint unable to mark deletions; the token guard adds no lock (a refusal is not a block on the human) and the tint's blind spot is the argument for it, so nothing there is revised. Its parked session declaration is carried to its own subtopic rather than answered here. note-model — its decided text holds tags as inline body content with placement the user's choice; that is why tagging is a content write and lands on this path, and nothing there is revised.*

---

## Command Grammar

### Context

*From: note-window · discussion · 2026-07-29*

The verb set, and what each verb may do. `engine-architecture` closed the operation set's *shape* — a closed, named set with typed arguments, intent-shaped rather than field-shaped, no query language and no runtime catalogue — and left *which verbs exist and what they are called* here.

The first material to arrive was a constraint rather than a question. note-window settled delete across the whole product: **every delete from every origin — corner menu, menu bar, manager, agent `rm`, sync arrival — is a soft delete**, and a note can only be hard-deleted once it is already in Recently Deleted. There is no path that skips the bin.

> So **`rm` on the agent surface is a soft delete, and permanent deletion is not exposed to the CLI or MCP at all.**

Binding, and the reasoning is note-window's platform line — *reversible → no prompt; irreversible → confirm*. A permanent delete's confirm **is** the user's consent to something unrecoverable; an agent cannot give that consent on their behalf, and a `--force` flag is a way of skipping a confirm rather than of giving one. `rm` is safe to expose precisely because it is reversible.

**A property this gates, worth not breaking:** because hard delete sits behind soft delete, a note that vanishes from the screen is always one already showing its explained, read-only deleted state. No sequence exists in which a live note being typed into disappears under the cursor. Any future verb that could hard-delete directly would lose that.

### Decision — agents can restore a note

> **The un-delete action is exposed. The agent surface is symmetric on delete: what an agent can soft-delete, it can return from Recently Deleted.**

*(The verb is **`restore`** — settled under Verb Naming, where note-window's **Put Back** reservation is held not to transfer to a surface on which two labels are never on screen together.)*

The case that decided it:

```
you:     "clear out the scratch notes from this morning"
Claude:  rm 01J9…  rm 01JA…  rm 01JB…
you:     "not that last one, I need it"
```

Without `restore` the agent's answer is *"open Recently Deleted and put it back yourself"* — it made the mess and hands over the broom. Worse, the act it cannot perform is **the reversal of its own reversible act**, and that reversibility is the entire reason exposing `rm` was safe.

- **The blast radius is bounded by the constraint above.** `restore` can only touch notes already in Recently Deleted, so the worst an agent can do is return something the user meant to discard — visible on screen, and undone by the same soft delete.
- **Rejected — asymmetric (delete only, recovery always the human's gesture in the bin).** The argument was that Recently Deleted is the user's own review surface and an agent reaching into it makes that surface shared. Real, and outweighed: it makes the one cleanup an agent most obviously owes the user the one thing it cannot do.

### Decision — `list` and `search` are two operations

> **`list` enumerates with filters. `search` matches text. They are not one operation with an optional term.**

Collapsing them was argued and is tempting: `engine-architecture` treated them as one question when it drew the thin-client line — its worked example put `fumi ls --tag work --space 3` alongside the manager's search box, both hitting the projection — and `search-and-retrieval` has search as a single facility taking a scope and a match style. Filters and a match term are both narrowing, and one operation means one tool for an agent to choose.

**Rejected on completeness.** A tag filter is exact and always whole; a search runs against an index that rebuilds in the background and can be **legitimately incomplete** — which is precisely why the Response Envelope now carries indexing state on every answer. One operation that is sometimes authoritative and sometimes not is a seam an agent will get wrong, and it would get it wrong silently, in the direction of reporting that something does not exist.

Two operations keep the distinction in the caller's hands: an agent choosing `list` has chosen an exact answer, and an agent choosing `search` has chosen one that may be partial and is told so.

*Sibling check: search-and-retrieval — its decided text holds search as one facility for every caller with the widenings as parameters, and results legitimately incomplete during a never-blocking rebuild. Adopted: this splits the **agent-facing verbs**, not the facility — both call the same engine-side search/query machinery, which is where that document's one-facility rule lives. Nothing there is revised. engine-architecture — its rule that filtering, sorting and searching are all engine-side with clients translating arguments is adopted, not revised; two verbs over one engine facility is exactly a client argument choice.*

### The verb set, assembled *(resolves review-003 F4)*

`engine-architecture` closed the operation set's shape and left *"which verbs exist and what they are called"* here. The verbs were named across nine subtopics as each needed them and never gathered. Assembling is not a new decision — it is the move the code vocabulary already made and said why: *"drawing the set is assembly, and it is recorded because nothing had assembled it."*

```
new        make a fumi — content, Space, colour, geometry, float, --open
read       this note — content · a version's content · --versions
edit       replace the body (token) · --version <id> to revert (token)
rm         soft delete — UID only
restore    put it back from Recently Deleted
list       the library — filters, cursor-paginated, total
search     text — widenings, cursor-paginated, total
spaces     enumerate Spaces
displays   enumerate displays
geometry   one operation, three axes — Size · Position · Display
colour     set the colour role
float      on | off
visible    on | off
```

Two calls fell out of the assembly, each closing an inconsistency the fragments had been hiding.

#### Property verbs take a value; action verbs do not

> **`show`/`hide` are retired in favour of `visible on | off`.**

Three boolean idioms were running at once — `float … on`, the brief's `show`/`hide` pair, and `--open false`. The rule that sorts them is what the verb **names**:

- **An action** — `new`, `read`, `edit`, `rm`, `restore`, `list`, `search`, `spaces`, `displays` — takes no state argument. Doing it *is* the operation.
- **A property** — `colour`, `float`, `visible`, `geometry` — takes the value being set.

`--open false` is untouched: it is a flag on an action, not a property verb.

**This matters more on the MCP surface than at a shell**, for the reason Verb Naming already gave: tool names are read by a model choosing between them, and a pair of verbs that set one field in opposite directions is two tools where one would do.

#### `spaces` splits into `spaces` and `displays`

> **Two enumeration verbs, each returning one kind of row.**

`spaces` had been decided as returning *"each Space's UUID alongside its ordinal, display and type"* and then, under display addressing, displays as well. That is the fault already fixed in `list --versions` — one verb returning two row shapes — and the rule settled there governs: **a verb's coherence is its subject.** A Space and a display are different subjects with different rows.

#### A count corrected

The MCP decision priced one-tool-per-verb at *"this surface's thirteen operations"* × ~650 tokens ≈ 8.5k. The set is **also** thirteen, but not the same thirteen — that count had `show` and `hide` as two and no `displays`. The figure moves by nothing that bears on the argument, and the decision it supported stands.

**What remains specification's:** each verb's flag spellings, the page size and default orderings, the token's representation, and exit-code granularity. The set and its names are this document's; the shapes of the arguments are not all settled here and are marked so in Current State.

### Decision — `rm` takes a UID only

note-model flagged this when it handed the grammar over: *"whether a title argument is accepted at all on destructive operations"*.

> **`rm` accepts a UID and nothing else. Every other verb takes a title where it takes a UID.**

The user's ground: *"more explicit."* A delete is the one operation where being sure which note is meant is worth a round trip.

**Consistency was argued for and lost.** Titles match exactly after normalisation with no fuzzy or substring matching, so a title either resolves to one note or fails as ambiguous — there is no silent misfire, and `rm` is reversible anyway, which is why it is on the surface at all. The residual risk is narrow but real: *the one note that happened to match, when the user meant a different one they had forgotten shared that title.*

**Requiring a UID means the agent has seen the note before deleting it** — a `list`, a `search` or a `read` stands between intent and deletion, which is exactly the loop this surface is built around. The cost is one carve-out for an agent to remember, on the verb where remembering is cheapest because the consequence is the most visible.

*Sibling check: note-model — its decided text holds UID as the reliable handle and a title as a convenience when unambiguous, and it explicitly left the destructive-operation question here. Answered, not revised; the identity semantics it owns are untouched.*

### Decision — a title resolves against the set the verb acts on *(resolves review-003 F8)*

*"Put back my standup note."* `restore` accepts a title — `rm` is the only carve-out — and the note it must find is in Recently Deleted, which `list` excludes by default.

> **A title resolves against the set the verb operates on. `restore` acts only on deleted notes, so the bin is its working set; every other verb resolves against live notes, and a verb widened to include the bin resolves against both.**

Not a fork — one rule already implied by what each verb does, and the alternatives are both worse than it in ways that follow directly:

- **Resolving against the bin everywhere** would make every title lookup compete with deleted notes, raising the `ambiguous_title` rate for reasons the user cannot see, since the bin is invisible by default — and note-model already warns that *"a dozen scratch notes are a dozen identically-titled notes"*.
- **Resolving against live notes everywhere** would make `restore` by title impossible, so the UID-only carve-out decided for `rm` would silently cover two verbs.

*Sibling check: note-model — its decided text holds a title accepted as a convenience when unambiguous, with ambiguity the normal path; untouched. This says which notes the match runs against, which that document never scoped.*

### Decision — there is no `tag` verb

**Settled by derivation** — not discussed. Determined by note-model's tag model.

> **Tagging a note is editing its content, and takes the read-token-write path like any other content change.**

note-model decided tags are **inline `#hashtag`s in the body** — *"a tag *is* content, so it syncs for free, is agent-authorable, and renders at-rest without adding chrome"* — and that **placement is the user's choice**: *"top, under the heading, inline, bottom, anywhere. No enforced position."*

A `tag` verb would therefore have to pick an insertion point the model deliberately refused to pin. There is no right answer for it to choose, and any choice it made would be the surface inventing an editorial convention the product declined to have.

**The brief's verb sketch is superseded on this point** — it listed `tag` among the metadata verbs, written before this document's tag model was settled.

*Sibling check: note-model — its decided text holds tags as inline content with no enforced position, the tag-set derived by parsing content, and normalisation never rewriting content. Adopted; nothing revised. The tag-filtering semantics it routed to management-window are untouched.*

### Decision — a redundant `rm` is an error

> **`rm` on a note already in Recently Deleted is refused with a code. A no-op either way, but the agent is told.**

`rm` reads as *"this note should be in the bin"*, and it already is — so a success answer was argued for on the grounds that nothing is at risk and an error makes every agent wrap the call in a check it did not need. The user rejected the framing: *"its a no-op either way but the agent should know it fucked up."*

**The principle it establishes, which the rest of the vocabulary inherits:** a code fires when **the agent's view of the library was wrong**, not only when something was at risk. The agent addressed a note from a stale list; that is worth knowing even though the outcome it wanted already holds.

**This is the same rule as the stale content token, and the distinction drawn against it does not survive.** The argument for a success answer was that a stale token means the agent's *next action would be wrong* while a stale delete means its action was *already unnecessary*. True, and it buys a per-verb judgment about whether the agent deserves to know — where one uniform rule covers both: a stale view earns a refusal.

### Decision — a note in Recently Deleted is readable but never writable

> **A soft-deleted note is not editable, by anyone, ever. Every write is refused — content and metadata alike. It can still be read.**

The question raised was narrower — whether an *agent* could write to a note whose window is read-only — and the user closed it wider: *"recently deleted are not editable at all. ever."*

**note-window had already decided the substance, and one of the three options was never open.** Its deleted-note state is *"read-only until restored"*, on the ground that *"editing-implicitly-restores would be a silent state change the user didn't ask for"* — which is exactly the implicit-restore option floated here, rejected product-wide before this topic asked. It also matches what the platform does: Apple Notes, Photos and Mail all require an explicit recover first.

**The agent's refusal is the counterpart of a behaviour already designed for the human.** note-window has typing in a deleted note *pulse the Put Back button* rather than do nothing, because *"a dead keyboard is confusing"*. An agent has no button to pulse, so it gets the error code — same answer, same reason: say why the write did not land rather than swallow it.

**Read as the whole surface, not just content.** *"Not editable at all"* taken at its word: a note in Recently Deleted accepts no metadata write either — no `mv`, no colour, no `pos`, no `float`. Per-verb carve-outs would need a rule nobody could state, and the note has one meaningful action available to it while it sits in the bin.

**This closes the read-token path for deleted notes rather than complicating it.** The guard exists to stop a write reasoned over stale content displacing a human's keystrokes; a deleted note takes no writes at all, so the token never comes into it.

#### The exclusion covers writes, not reads

**Settled by derivation** — not discussed. Determined by the reasoning this block already carries (review-001 F2).

The decision first read *"the only operation it accepts is the one that returns it"*, which bars reading a deleted note as well as writing to one. Nothing here ever argued that: every line beneath it is about writing — *not editable*, *content writes are refused*, *no `mv`, no colour, no `pos`, no `float`* — and note-window's adopted state is **read-only until restored**, which is readable by construction.

**It also breaks the flow this topic built two decisions earlier.** `list` reaches the bin behind a flag precisely because *"an agent that can put a note back must be able to find what to put back"* — and telling three similarly-titled candidates apart means opening one. A `restore` an agent cannot aim is not the capability that was decided.

**And the bytes already reach an agent by another route.** search-and-retrieval's *include deleted* is a parameter available to this surface, so a deleted note's current text comes back through search today. Refusing `read` for the same bytes would be incoherent rather than cautious.

### Decision — `list` reaches deleted notes behind a flag, never by default

> **`list` excludes soft-deleted notes by default. A flag includes them, and a deleted row says it is deleted.**

**Exposing the un-delete settles it rather than leaving it to taste.** An agent that can put a note back must be able to find what to put back, or the operation only works on a UID it happened to be holding from before the delete — usable within one turn, useless afterwards. So the bin cannot be invisible to the agent surface.

- **Excluded by default** because an agent reasoning over *what notes are there* is reasoning about a working set, and the bin is not part of it.
- **A deleted row says so.** It behaves unlike every live row — it takes no writes — so an agent that asked for the bin is told which rows came from it.
- **This is an argument choice, not model knowledge.** `engine-architecture` keeps filtering engine-side and has clients translate arguments in; which default `fumi list` passes is exactly what a thin client picks, and the manager choosing differently for Recently Deleted is not a disagreement about the model.

*The corpus question — whether soft-deleted **text** is searchable — is `search-and-retrieval`'s and is untouched here; that document lists soft-deleted notes among the four record kinds it has still to rule on. This decides what the agent surface's `list` returns, not what the index holds.*

*Sibling check: note-window — its decided text holds every delete as a soft delete with hard delete gated behind Recently Deleted, a deleted note read-only until restored with an "In Recently Deleted" banner and a **Put Back** action, *Restore* reserved for the version panel, and typing pulsing Put Back rather than failing silently. All four decisions above adopt that text; none revises it, and the naming reservation is what `verb-naming` was parked for. search-and-retrieval — in session, and its Searchable Corpus subtopic names soft-deleted notes as a record kind it has yet to rule on; nothing here touches the index, so no overlap.*

---

## Response Envelope

### Context

*From: search-and-retrieval · discussion · 2026-09-12*

Two search decisions combine into a requirement on this surface's response shape. Search is **one facility, every caller** — the manager, the note-link picker, the CLI and MCP all call it, with *include deleted* and *include history* as parameters rather than per-surface behaviour. And **results can be legitimately incomplete**: index rebuilds run in the background and never block, and the incomplete state can persist indefinitely, since a note whose bundle never arrived or will not parse is retried forever and the state does not clear while any note remains unindexable.

The failure that creates here:

```
(post-restore rebuild running)
Claude:  search "meeting note"   →  no results
Claude:  "there's no such note"  —  or writes a duplicate

The user's Mac was showing the still-indexing notice the whole time.
The agent never saw a screen.
```

**The error posture does not reach it.** A refusal is a code and a message, and every code answers *what the caller should do* — but nothing failed. The result is true as far as it goes and does not say how far that is. An incomplete success is not a refusal, so no code exists for it, and an agent cannot tell *not found* from *not indexed yet*.

Search decided that **an answer carries its own completeness, to every caller** — one state feeding both the human notice and the machine signal so the two cannot drift — and that on CLI and MCP it rides a **system-state message on the response** rather than a lone boolean. The envelope's shape is this topic's.

### Decision — a system-state block on every successful response

> **Every successful response carries a system-state block. It is always present, and it carries the conditions currently in force — indexing completeness among them. Errors do not carry it.**

**It carries the condition set `status-and-alerts` already defined, not a new vocabulary.** That topic decided *"a condition that persists gets both: a system notification when it begins, and a mark on the menu-bar icon for as long as it lasts"* — so a set of persisting conditions already exists, with the engine recording and each surface reading. This makes the agent a third reader of the same set alongside the notification and the menu-bar dot, which is what keeps the human notice and the machine signal from drifting.

**Always present, not absent-when-quiet.** Absent-when-quiet was argued first, for consistency with the materialisation mapping and to keep a healthy system off every response.

- **The noise objection separates into two things that are not the same.** The **wire** always carries the block; the **CLI's human rendering** simply does not print it when there is nothing in force. That is a display choice, so there was never a trade — both audiences are served.
- **For the failure this exists to prevent, presence is materially stronger.** Absent-when-quiet makes an agent facing an empty result *infer*: nothing came back, no system block, therefore genuinely not found. Always-present lets it read a fact — indexing complete, so the answer is whole. **Inference is what produced the duplicate note**, and an envelope that requires more of it is the wrong fix.
- **The consistency argument was wrong on its own terms.** The materialisation mapping describes **what this call did**, which is genuinely empty when it did nothing. System state describes **the system**, which always has a value.

**Errors carry no system-state block**, per the frame under Failure Modes: a refusal is a code and a message and nothing else.

**This does not reopen the rejected `fumi status` operation.** `engine-architecture` rejected a health subsystem and a status operation as *"building for a reader nobody named"*. The reader is now named — the agent — but what it gets is **ambient**, riding on answers it was already asking for, rather than a call it must know to make. An agent that never thinks to ask is exactly the caller that reports a missing note.

### One paging envelope across the surface *(from search-and-retrieval · discussion · 2026-09-13)*

search-and-retrieval reached the same conclusion independently, and rejected the same thing the user had: its first pass proposed a **bounded** response — first N rows plus a total, with no way to ask for the next — reasoning that an agent seeing *25 of 400* should narrow its query. Rejected because *"that argument is about how an agent should behave, and it was being allowed to decide what the interface can do"*: narrowing is the sensible default, but genuinely exhaustive tasks — tag every note mentioning X — simply fail against a bound with no continuation.

It also routes the mechanics here for the reason the envelope exists: *"an agent should not meet two different continuation conventions depending on which call it made."*

> **The page carries the total. Both verbs report it.**

A page of 25 also says there are 400 matches. Without it a full page says nothing about whether the caller has seen 25 of 26 or 25 of 4,000, and the choice between walking the set and narrowing the query cannot be made.

**`list` reports a total as well, though only `search` was asked to.** It costs a count per page, and a listing's total is rarely a surprise — roughly *"how many notes do I have"*. Paid anyway: two continuation conventions is the thing this concern was written to prevent, and an agent should not have to remember which call tells it how much is left.

> **A cursor is bound to the query that produced it.** The widening parameters — *include deleted*, *include history* — change the result set, so a cursor replayed against different parameters cannot be allowed to silently return a page of something else.

*Sibling check: search-and-retrieval — its decided text holds search as the same facility for every caller with the widenings as parameters, results ordered title matches first then body matches each newest first, and results paginated with the total reported. All adopted; this decides the envelope it explicitly handed over — cursor shape, the total on both verbs, and the cursor's binding to its query — and revises nothing there. The human surface needing no bound of its own, because scrolling the manager is the same walk driven by the view, is left as that topic stated it.*


*Sibling check: search-and-retrieval — its decided text holds search as one facility for every caller with the widenings as parameters, results legitimately incomplete during a never-blocking rebuild, an incomplete state that does not clear while any note is unindexable, and completeness carried to every caller from one state. All adopted; this settles only the envelope it left open. status-and-alerts — its decided text holds a persisting condition getting a notification at onset and a menu-bar mark for its duration, with the engine recording and surfaces reading; this adds a third reader of the same recorded set and moves neither the owner nor the set. engine-architecture — its Observability rule that the engine records and never presents, and its rejection of a status operation, are both intact: the block is state handed to a client to format, and it is ambient rather than queried.*

---

## MCP Tool Surface

### Context

*Opened by review-002 F5 — the one subtopic nothing had started while five decisions elsewhere leaned on it.*

Claude opens its tool list and sees Fumi's tools. How many there are, what they are called, and what each description says is what decides whether it picks the right one. `engine-architecture` closed the **operation set** and was explicit that the MCP enumeration is **hand-written** — *"tool descriptions are prompt engineering, and generated-from-generic is strictly worse for the agent reading them"* — but nothing said the tool list mirrors the operation set one for one.

**The cost that reframed it, measured rather than assumed.** Tool definitions are loaded into a model's context on **every** call, whether or not Fumi is used. From the user's own knowledge base: an MCP server for prediction-market data measured at ~10K tokens, about 5% of context, purely for existing (`dex-engineering/2025-11-07-code-execution-with-mcp-building-more-ef-b6ecf4`); another item puts two MCP tools at ~1.3k (`dex-engineering/2025-11-14-github-piebald-ai-tweakcc-customize-clau-7b4ef6`). At roughly 650 tokens per tool, a one-per-verb mapping of this surface's thirteen operations is **~8.5k of permanent context tax on every conversation the user has**.

**A stronger answer was considered and does not transfer.** Cloudflare's *Code Mode* (`dex-engineering/2025-10-07-code-mode-the-better-way-to-use-mcp-384897`) and Anthropic's *Code execution with MCP* both give the agent **exactly one tool** — execute code against a generated API — and report large gains, Anthropic measuring one task from 150,000 tokens to 2,000. The single tool is a **code sandbox**, and a note application shipping one so an agent can recolour a window is not a trade this product makes.

### Decision — MCP carries the common path; the CLI carries everything

> **A small, task-shaped set of MCP tools — find a note, read one, write one, make one, arrange one, remove one, put one back — not one tool per operation. The long tail stays reachable through the `fumi` CLI, which an agent can shell out to.**

*(Amended 2026-09-13, resolves review-003 F6 — the shapes first read "find, read, write, make, arrange" and left delete out entirely, after Command Grammar spent two decisions establishing the surface is **symmetric on delete**. An agent that can make notes but not remove them is lopsided, and with the shell-out no longer load-bearing — see below — nothing else covered it.)*

- **The operation set is unchanged.** `engine-architecture`'s closure is authoritative in the engine; this decides only which operations get a **tool**, which is a client's argument-surface choice.
- **The long tail costs nothing until used.** Colour, float, visibility, presets, version history, and the Space and display enumerations are all documented CLI operations. An agent that needs one runs `fumi`; an agent that never does pays no context for them.
- **The shell-out is a convenience, not a dependency** *(review-003 F6)*. It was stated once — *"the long tail stays reachable through the `fumi` CLI, which an agent can shell out to"* — and quietly became load-bearing: plenty of MCP clients have no shell, and the Space enumeration sat behind it while Space Addressing had made that enumeration **mandatory** (*"without it an agent has nowhere to get a UUID"*). Putting the **ordinal** on the MCP surface removes that dependency: a move by Space needs no enumeration call at all. What remains behind the shell is genuinely optional — a client without a shell losing the ability to recolour a note costs nothing.
- **Whether `fumi` is on a caller's PATH is already owned.** `engine-architecture` routed *"how `fumi` and `fumi-mcp` become reachable from a shell and an MCP host, given both ship inside the bundle"* to `build-and-release`.
- **It fits what the CLI already is here.** The same material recommends building a CLI first and reaching for MCP only where standard discovery is needed. Fumi ships the CLI as a first-class surface rather than an afterthought — and `engine-architecture` made the two **siblings over the socket, never chained**, so the CLI is not a degraded path.
- **Rejected — one tool per verb (thirteen).** Each description would say one thing sharply, and the travelling/machine-local warning would land in exactly the operations it belongs to. Rejected on the measured tax: ~8.5k tokens of permanent context for a notes app.
- **Rejected — collapsing only the trivial metadata verbs (ten).** Saves perhaps 2k of 8.5k and costs description sharpness, since one tool would have to describe colour, float and visibility together — the vagueness a model mis-picks on.

**Held lightly and said so:** the exact tools are adjustable once there is something to use — *"we can always adjust later."* What is decided is the **shape**: a small task-shaped set, not a mirror of the operation set.

### Decision — the tool result tells the agent what it can do next

> **An MCP tool result carries a short line of prose alongside its structured fields, naming the next move the caller can make.**

The structured fields stay the contract; the prose stops a model inferring what the response already implies.

```
25 of 400 matches · pass cursor c_8fJ2 for more
3 notes match that title — list them and pick one
the token is stale — read the note again and retry
still indexing; results may be incomplete
```

**Every one of those is a fact this document already decided the response carries** — the paging total and cursor, the ambiguity count, the error code, the system-state block. The prose turns each into an instruction rather than a premise.

**It is also how the long tail is discovered**, which is what makes the small tool set work rather than merely tolerable: a result can say *set a colour or a preset with the `fumi` CLI* without those operations ever becoming tools.

*Sibling check: engine-architecture — its decided text holds the operation set closed and named with typed arguments, MCP tool descriptions hand-written as prompt engineering, and `fumi` and `fumi-mcp` as siblings over the socket that never chain. All adopted: the closure is untouched, and which operations become tools is the client argument choice that document already assigns to clients. Nothing there is revised.*

---

## Session Declaration

### Context

Parked here by note-window while it designed agent-activity presentation, and separated from Write Concurrency early in this session — it cannot prevent a lost update without locking, and locking is decided against, so its job is presentation rather than concurrency.

The job is real. note-window's **edge shimmer** means *an agent is working on this note right now*, and it was kept precisely because it covers the moments streaming text cannot: *"an agent that is reading, reasoning or calling other tools produces no bytes for seconds at a time, and the shimmer owns exactly that window."* Nothing in the protocol announces that window — `change-notification` decided no change event crosses the socket, and the engine only learns of an agent when an operation arrives.

The shape first proposed was an explicit engagement — the agent opening and closing a session around its work — and it carries an obvious failure: an agent that crashes or wanders off never closes, and the note glows indefinitely.

### Decision — activity lights it, silence expires it; there is no declaration verb

> **Any operation on a note lights that note's shimmer and refreshes its expiry. When nothing further arrives for that note, the shimmer expires on its own. Nothing is opened and nothing is closed.**

**The user's framing, which is the whole design:** *"That's similar to a chat indicator in a messaging system. Times out if nothing else received. So shows typing while receiving input. When input stops timer begins and stops when time expires."*

**It removes the failure the explicit shape had.** There is no close to forget, so an agent that dies mid-task cannot leave a note glowing — the timer runs out and the note goes quiet.

**Reads refresh it, and that is the load-bearing part.** A typing indicator works because the input itself generates the refresh; here the window being lit is exactly the one where the agent produces nothing. If only writes refreshed the timer, the shimmer would go dark during precisely the gap it exists to cover — read, eight seconds of reasoning, write — and flicker back on. With reads counting, the read carries the glow across the gap.

**So no declaration verb exists. Reading the note is the declaration**, and there is nothing new for an agent to call, remember, or get wrong.

**A plain read lights it even when nothing follows.** Claude reads six notes to answer a question and writes to none; any of those six on screen glow briefly. Accepted rather than filtered: something genuinely did engage with the note, the signal is honest, and only notes the user is looking at can show it at all — a closed note's shimmer is unobservable by construction.

#### What lights it: note-addressed operations, on the `cli` and `mcp` channels *(resolves review-002 F2)*

Two edges the rule did not cover.

> **Library-wide verbs light nothing. Only an operation addressed to a note lights that note.**

You ask *"what have I got about the budget?"* and Claude runs one search returning twenty-five notes with their content. By the engagement argument that justifies a plain read lighting the shimmer, those twenty-five were engaged with — and one call would light every one of them that happens to be on screen.

A search is a question about the **library**, not about any note in it. Notes glowing in bulk because the user asked what they had written would make the shimmer read as ambient noise rather than *someone is working in here*. It also matches how an agent behaves: it searches, then reads the two notes that matter, and **those two** light up.

> **The `app` channel never lights the shimmer. `cli` and `mcp` do.**

The rule names an operation rather than an actor, which is note-window's discipline — but applied without qualification it means the user's own window edit lights an agent-presence cue on the note they are typing in, which is simply false.

The carve is **not** an actor test, and that is what keeps it inside the principle: it is the same `via` channel the version scrubber already records, derived engine-side from the connecting peer. An in-process window edit never crosses the socket and never lights it.

**Cost, accepted at source:** a person running `fumi read` in their own terminal lights the shimmer on that note. storage-and-sync is explicit that the channel cannot imply the actor — *"the CLI is a shared surface the user genuinely uses"* — and an unrecognised peer resolves to `cli`, so a human's own shell script is indistinguishable from an agent's call. The user's ruling: *"Using a cli as a human still lights it up because we can't tell agent from human."* Better than the alternative, which would have the user's own reading of a note in the app light it.

*Sibling check: storage-and-sync — its decided text holds `via` as `app | cli | mcp` known from the connection the write arrived on, with no `user | agent` field because the channel does not imply the actor. Adopted exactly: this branches on the channel and never on the actor, and nothing there is revised. note-window — its rules-never-name-the-actor principle and the shimmer meaning *an agent is working on this note* are both adopted; the channel carve is what keeps the second true without breaching the first.*


**Cost, named:** the expiry has to be generous enough to span a plausible thinking gap — tens of seconds, not a few — so a shimmer lingers that long after an agent dies mid-task. Acceptable for a soft glow that asks nothing of the user. *(The value itself is specification's; the property that decides it is that the expiry must exceed a reasoning gap, which holds at whatever number is chosen.)*

**This changes nothing about writes.** The shimmer is presentation; no operation waits on it, and note-window's *no write-locking during agent activity* is untouched.

*Sibling check: note-window — its decided text holds the edge shimmer as presence rather than identity, kept alongside streaming text because it owns the no-bytes window; no write-locking during agent activity; the recency tint as a separate mechanism marking unseen change; and the header indicator cut because its only unique contribution was live identity. All adopted — this drives the shimmer without naming an actor anywhere, so the equality principle is untouched — and its parked session-declaration question is answered by there being no declaration. engine-architecture — its decision that no change event crosses the socket is why the engine cannot learn of agent activity except from arriving operations, which is what this rule is built on; nothing there is revised, since the shimmer is driven in-process from the engine's own model.*

## Version History On The Agent Surface

### Context

*Opened by review-001 F7.*

*"Undo what you just did to that note"* is the most natural thing to say to an agent immediately after it edits something. Version history exists, syncs, records attribution, and has a **Restore** action in the note window — and nothing said whether any of it reaches this surface.

Two things made the omission load-bearing rather than cosmetic. **search-and-retrieval's *include history* widening is available to this surface**, so an agent could already find text in an old version and then have no operation to act on it. And **Write Concurrency leaned on history as the safety net** — *"every change is snapshotted with attribution, so they are two clicks away"* — two clicks a person makes, not an agent. storage-and-sync had already fixed the cadence for this surface (the call ending for CLI/MCP, with a settle window), so the snapshots an agent produces exist whether or not it can read them back.

### Decision — flags on the verbs that already exist, not new verbs

> **Version history is reachable and actionable: `read --versions` enumerates, `read --version` returns one version's content, `edit --version` makes a version current.**

```
read   01J9… --versions        what versions exist — id, timestamp, attribution
read   01J9… --version <id>    that version's content
edit   01J9… --version <id>    make it current    (+ read token)
```

**No new verbs, which also disposes of a naming problem.** `restore` is spent on un-delete (see Verb Naming), so a version operation would have needed a third word for an action note-window already calls *Restore* in the window. Flags on the verbs that own enumeration, reading and writing avoid inventing one.

**`edit --version` is still an edit under the intent rule.** `engine-architecture` holds that an operation carries everything **one user intent** determines and never bundles two: setting the note's body is one intent, and the only difference here is that the body comes from history rather than from the caller. Unlike `recolour-and-move`, nothing unrelated is riding along.

**Reverting is not the dangerous half, which is why it is exposed.** note-window settled that restore **snapshots the pre-restore state first** and is forward-only — *"restore can never lose anything"*. An agent reverting to the wrong version is undone by reverting again, and what it reverted is still in history. There is no irreversible act here, which is the test that kept hard delete off this surface entirely.

**It takes the read token like any other content write.** Reverting while a human is typing in the note would clobber exactly what the guard protects; nothing about the body's source earns an exception.

**Geometry rides along.** note-window decided Restore takes the note's **size and preset** as well as its content, and note-model has restore writing both back to the Note tier. The write invariant is actor-blind, so an agent's revert reshapes the note exactly as a user's does — and that is the one part of a revert that reaches every Mac.

### Decision — verb scope, and what `read --versions` returns

> **A verb's coherence is its **subject**, not its row shape.** `read` answers about **one note**, `list` about **the library**, `search` about **text**, `spaces` about **the machine**.

```
read    this note      content · a version's content · the version list
list    the library    notes
search  text           matches
spaces  the machine    Spaces and displays
```

**This revises the version-history table**, which had the enumeration as `list --versions`. That made the **library** verb answer about one note, take a UID no other `list` call takes, and return a different row shape — one verb returning two kinds of thing depending on a flag, which is the smell that split `list` from `search` in the first place.

A third enumeration verb (`versions <uid>`) was proposed and the user replaced it: *"list --versions shouldn't be a thing. read --versions makes more sense."* It is better, and it reframes what makes a verb coherent rather than patching the symptom — `read --versions` does return a different shape from `read`, but it is still answering *about this note*. One subject, several granularities.

> **`read --versions` returns a list, never content: version id, timestamp, and attribution (`app` | `cli` | `mcp`, plus the optional self-reported name). Paginated, newest first.**

- **Content would be the response-size failure two decisions were just spent avoiding.** storage-and-sync measured retention defaulting to Forever with a note worked on ~200 days a year accumulating roughly that many snapshots — mostly near-identical. Returning all of them is unthinkable; returning previews of them is noise.
- **The listed fields answer the question that is actually asked.** *"Undo what you just did"* is *the version immediately before the `mcp` write at 10:42* — timestamp and attribution settle it outright, and `read --version X` fetches the one that matters.
- **It is the surface's own loop, applied to one note's history** — enumerate cheap rows, read the one that counts, reason. **Newest first**, which is the end nearly every question about history is about.
- **Finding the version that *contains* some text is a different question** and already has an answer: `search` widened to include history.

### Decision — one spelling for a shared widening

> **The *include deleted* widening is spelled identically on `list` and `search`. History is not the same widening and keeps a different name.**

`list` can be asked to include soft-deleted notes; search-and-retrieval offers the same widening as a parameter. One concept with two spellings is exactly what the paging decision's principle forbids — *an agent should not meet two different continuation conventions depending on which call it made* — and the reasoning generalises past paging to any argument both verbs take.

**History is not the parallel case, despite the similar words.** `search` widened to include history reads **more text** in the same search; `read --versions` **enumerates one note's snapshots**. Different operations, deliberately different names, so nothing invites an agent to assume symmetry that is not there.


*Sibling check: note-window — its decided text holds Restore taking geometry as well as content, restore snapshotting the pre-restore state and being forward-only so nothing can be lost, and *Restore* as the version panel's label. All adopted; nothing revised, and the label is untouched because this adds flags rather than a competing verb. storage-and-sync — its decided text holds the snapshot cadence including the agent-write trigger and the call ending for CLI/MCP, and version snapshots carrying `via`/`by` attribution; relied on, not revised. note-model — its decided text holds restore writing the recorded `size` and `presetId` back to the Note tier; adopted, not revised. search-and-retrieval — its *include history* widening is what made this a gap rather than a nicety; nothing there is revised, and its history hits now have operations to act on.*

---

## Addressing And Disambiguation

### Context

How a caller names the note it means. note-model settled the model and routed the grammar here: the **UID is the reliable handle**, the CLI and MCP **accept a title as a convenience when unambiguous**, matching exactly on the NFC → full case fold → NFC form of the full derived label with no fuzzy or substring matching, and **ambiguity is the normal path rather than an error** — titles are optional and not unique, and every note whose first line is non-text derives *"Untitled"*, so a dozen scratch notes are a dozen identically-titled notes. On ambiguity the agent reads the candidates and reasons.

### Decision — resolving a name is addressing, not a discovery verb *(resolves review-001 F3)*

Two different things a person asks for:

```
"what did I write about the Q3 budget?"   → find text, somewhere, in anything
"open my standup note"                     → I know its name, get me that one
```

search-and-retrieval hands this surface **two modes** of one facility — finding text over the corpus, and resolving a name the caller already holds, exact on the derived label. The question was whether those are one verb with a mode, or two verbs.

> **Neither. `search` is one verb and it finds text. Resolving a name is how every verb that takes a UID accepts a title instead.**

**note-model already decided it**, and the line is the whole reason: the CLI and MCP *"accept a title as a convenience when unambiguous"* — a property of the **argument**, not a call you make first. So `read "Standup notes"` is one operation, not a resolve followed by a read.

- **Rejected — a dedicated resolve verb.** A cleaner boundary, and it adds a round trip to the most ordinary thing an agent does. It would also make note-model's title-as-convenience rule dead text, since nothing would ever pass a title anywhere else.
- **The cost, named:** every verb that takes a UID needs an answer for the ambiguous case, rather than one verb owning it. That shape — what comes back when a title matches several notes, and whether a title is accepted at all on destructive operations — is this subtopic's remaining work.

### Decision — an ambiguous title is an error, not a result *(closes the addressing question)*

You say *"open my standup note"* and three notes carry that title.

note-model holds this is the **normal path, not an edge case** — titles are optional and not unique, and every note whose first line is non-text derives *"Untitled"*, so a dozen scratch notes are a dozen identically-titled notes.

> **The call fails with `ambiguous_title`. The message says how many matched; the candidates do not ride on it.**

- **The record settles it textually.** note-model accepts a title *"as a convenience when unambiguous"* — so an ambiguous title is **not accepted**, by that decision's own terms. The convenience does not apply and the call cannot be served.
- **The error frame could not carry candidates anyway.** A failure is a code and a message, decided under Failure Modes — a result payload inside an error is a shape the protocol does not have.
- **`read` keeps one response shape.** The alternative — returning a candidate list in place of a note — would make every caller branch on which of two things it got, on a path note-model calls common.
- **The message still carries the count.** *Three notes match that title* is a message, not a payload, and it tells the agent to go and look rather than guess. It then has `list` and `search`, which is exactly the `list → read → reason` loop note-model prescribes for this case.

*Sibling check: note-model — its decided text holds UID as the reliable handle, a title accepted as a convenience when unambiguous, exact matching with no fuzzy or substring, ambiguity as the normal path resolved by reading candidates and reasoning, and no tie-breaking heuristics. All adopted; the loop it prescribes is what an agent runs after this error, and nothing there is revised. engine-architecture — its failure frame, its four named codes and the classes it routed here are adopted as written.*

### Decision — displays are addressed like Spaces, named like notes *(resolves review-001 F4)*

> **A display is addressed by its **UUID**, and its **name** is accepted wherever the UUID is, as a convenience when unambiguous. The enumeration operation returns displays alongside Spaces.**

The geometry operation takes a **Display** axis and nothing said what a caller passes for it — the gap Space Addressing closed, one axis over:

```
"move that note to my other screen"   →  geometry 01J9… --display ?
```

**The two decisions already made answer it between them, which is why this is proposed rather than argued.**

- **UUID, from Space Addressing's reasoning unchanged** — an agent *"is calling over a socket with no view of the screen"*, so it cannot count or point; and that decision added the Space enumeration on the ground that *"without it an agent has nowhere to get a UUID"*. A display reference needs the same, so the enumeration returns displays too. This also fits what the record already holds: storage-and-sync keys a preset's Display axis on the display UUID with a main-display fallback, and note-model classes display identity as machine-local.
- **Name-as-address, from the title rule unchanged** — resolving a name is an argument form, not a lookup call. *"Studio Display"* is accepted where the UUID is, on the same when-unambiguous terms as a note title.

**What the name buys beyond typing convenience:** it is what the agent says back. *"Moved it to your Studio Display"* rather than a hex string — the surface can report in the user's own vocabulary because it already accepts it.

**Cost, named:** two identical monitors carry the same name, so they fall to the ambiguity path titles already need. That path is this subtopic's remaining work either way; displays add no new shape to it.

**No ordinal affordance for displays.** Spaces have one because Mission Control gives a human a strip to count; displays have no such view, and a name is the thing a person actually knows their screen by.

### Decision — there is no current-Space affordance *(resolves review-002 F4)*

*"Move that note to this Space."* An agent holds a list of Space UUIDs and nothing tells it which one the user is on. Creation is covered — it defaults to the current Space — but a move names its target explicitly.

> **Nothing is owed. The surface offers no way to say *the Space the user is on now*.**

A `current` keyword resolved against the pointer's display was proposed and rejected by the user:

- **The phrase is vague, and not reliably about the current Space at all.** *"This Space"* is a person gesturing; it does not have a defined referent the engine could resolve.
- **It is a race.** The user may switch Spaces between saying it and the call landing, so a keyword resolved at call time can name a Space they did not mean — and the note lands somewhere they were not looking.
- **The human already has a precise way to say it.** Mission Control gives them numbered Spaces: *"the human has numbers by using Exposé. That's how I would say move a fumi to a Space."*

**The path that works needs nothing new.** The user reads a number off Mission Control and says *"move it to Space 3"*. The enumeration already returns **each Space's UUID alongside its ordinal, display and type**, so the agent matches the ordinal it was told to a row and sends that row's **UUID**. The ordinal never becomes an argument — it stays a field the agent matches on, which is exactly the split Space Addressing decided.

**The two-display case dissolves with it.** The measurements found each display carries its own ordinal 1, so *"current"* would have had two answers and needed the pointer to break the tie — a live reading of the screen taken on an agent's behalf, which is the thing that decision ruled out. With the user naming the Space, the ambiguity is theirs to resolve in the moment, which is where it belongs.

*Sibling check: space-homing — its decided text holds `--space N` as an ordinal resolved to a UUID at call time and never stored, and the CLI default as the current Space for creation. Both untouched; this adds no affordance and moves nothing. Its measurements — per-display ordinal 1, ordinals not being sids, fullscreen Spaces occupying slots, and the default-on recency reordering — are cited as the reason a machine-facing *current* would have been ill-defined, not revised.*


*Sibling check: storage-and-sync — its decided text keys the preset Display axis on the display UUID with a main-display fallback; adopted, not revised. note-model — its decided text classes display identity as machine-local and holds title-as-convenience-when-unambiguous; both adopted, and the name rule is that same rule applied to a second entity rather than a new one. note-window — its decided text holds that moving a note across displays re-homes it; untouched, this decides only how the target is named.*


*Sibling check: note-model — its decided text holds UID as the reliable handle, title accepted as a convenience when unambiguous, exact matching on the full derived label with no fuzzy or substring, and ambiguity returning candidates for the agent to reason over. All adopted; nothing revised, and it explicitly left this grammar here. search-and-retrieval — its Surface Agreement holds the agent getting two modes of one facility. This does not revise that: both modes remain engine-side and reachable, and it decides only that the second reaches callers as an argument form rather than as a verb of its own.*

---

## Verb Naming

### Context

Parked when the un-delete verb was decided. note-window settled that the action returning a note from Recently Deleted is **Put Back**, and reserved **Restore** for replacing a note's content with a version snapshot — deliberately, because *"two buttons can be on screen at once meaning different things"*, and Finder already solves it: recovering from the Trash is *Put Back*.

### Decision — `restore` un-deletes; no invented truncations

> **The un-delete verb is `restore`.**

**note-window's reservation does not transfer, because the thing it protects against does not exist here.** Its argument turns on **simultaneity** — a banner's button and a version panel's button visible together, needing distinct labels so a user cannot confuse them. A caller types one verb; nothing sits beside it to be confused with. And `restore` is the natural word next to `rm`, which is the neighbour it actually has.

**The consequence, named rather than left to be discovered:** `restore` is now spent on this surface. A version operation, if one is added (see the open question on whether the agent can reach version history at all), needs a different verb — it cannot borrow the note-window label, because that label is this one.

> **Verb names are spelled out. No invented truncations.**

`geometry`, not `geom`. **Established unix abbreviations stay** — `rm`, `mv` and `ls` are words a shell user already knows and reads instantly — but a truncation invented for this product is a second thing to learn for no saving. The distinction is whether the short form is already in the reader's vocabulary, not whether it is short.

> **The verb for making a fumi is `new`.** *(resolves review-002 F6)*

The document had written it both ways — `new` where the showing behaviour was decided, `create` where the token rule was — and the spelled-out rule above does not pick between them: both are whole words and neither is a unix abbreviation.

`new` because it is what the brief carried, what a person types, and the shorter of two equally clear words. `create` reads as the **engine operation's** name, which is `engine-architecture`'s to set and not this document's — and letting the client verb drift from the operation name is what produced the two-names-one-thing confusion in the first place.

**This matters more on this surface than on most**, because MCP tool names are read by a model choosing between them, and a made-up contraction is exactly the kind of name that gets picked for the wrong reason.

*Sibling check: note-window — its decided text holds the un-delete action labelled **Put Back** and *Restore* reserved for the version panel, on the ground that both can be on screen at once. That labelling is untouched: it governs the note window's buttons, and this names a CLI/MCP verb where the simultaneity the reservation protects against cannot occur. Nothing there is revised.*

---

## Space Addressing

### Context

*From: space-homing · research · 2026-08-25, narrowed by space-homing · discussion · 2026-08-30*

Discovery settled that `--space N` takes an **ordinal**, resolved to a UUID at call time and never stored. space-homing's measurements then showed that *"resolve at call time"* is underspecified, because an ordinal does not identify a Space on its own. All measured on the user's machine, macOS 26.5.2, two displays:

- **Each display has its own ordinal 1.** The Space list is returned per managed display — the Studio holds 16 Spaces and the built-in holds 1, so `--space 1` has two valid answers.
- **Ordinals are not ManagedSpaceIDs.** This machine's sids run `1, 3, 4 … 17`; `2` does not exist. The ordinal is array index + 1, which is the user-visible Mission Control position — confirmed against the user counting on screen: they said *"space two"*, the machine reported sid 3.
- **A fullscreen Space occupies an ordinal slot.** With Safari fullscreened it appeared at ordinal 17, type 4. So the mapping shifts whenever any app enters or leaves fullscreen.
- **A default-on macOS setting reorders Spaces continuously.** Mission Control → *"Automatically rearrange Spaces based on most recent use"*. Measured off on this machine (`defaults read com.apple.dock mru-spaces` → `0`), which is why earlier measurement could not have exposed it. It is the user's choice about their own machine, not something Fumi should fight.

```
morning     ord 1  ord 2  ord 3  ord 4
            [work] [mail] [docs] [chat]
  fumi new --space 3   ->  [docs]
            (user visits chat, then mail)
afternoon   ord 1  ord 2  ord 3  ord 4
            [chat] [mail] [work] [docs]
  fumi new --space 3   ->  [work]      same command, different Space
```

**Not in question, and untouched here:** identity is stored as the managed-space **UUID** and the ordinal is never persisted. Measured — a sid changed from `19` to `272` across one dock cycle while its UUID was unchanged, so anything storing a number breaks on the first undock.

### Decision — agents address Spaces by UUID

> **The surface accepts a Space UUID, and an operation enumerates Spaces with their UUIDs. The ordinal form is CLI-only, resolves against the display the pointer is on, and counts fullscreen Spaces.**

**The framing is the user's and it decides the rest.** An ordinal is correct *because a human types it while looking at their Spaces*: at that moment they know which one is third, whatever reordered it since. It is **a live reading of what is in front of them, not an identifier.** An agent has no such moment — it is calling over a socket with no view of the screen — so it resolves a UUID first, or passes one directly, and never counts.

**This is what the product already does everywhere else.** Notes are addressed by UID rather than list position, precisely so a `list → read → act` loop cannot misfire between the read and the act. Spaces would have been the one place an agent was asked to count, against a list that macOS reorders by recency under a default-on setting.

**Consequences, each following from the framing rather than decided separately:**

- **A Space-enumeration operation joins the closed set** — returning each Space's UUID alongside its ordinal, display and type. Without it an agent has nowhere to get a UUID, and the UUID rule would be unusable. *(One of the operation names `engine-architecture` left to this topic.)*
- ~~**The ordinal is not on the MCP surface.**~~ **Revised 2026-09-13 — the ordinal is on both surfaces.** See *The ordinal reaches MCP* below.
- **On the CLI, the ordinal resolves against the display the pointer is on.** `009` listed this and rejected it as *"meaningless for an agent calling over the socket with no pointer"* — true of the pointer, and a good proxy for a person who has just typed a command, since their pointer is on the screen they are looking at. The alternatives lose on that test: the main display is stable and wrong whenever the user means the screen in front of them, and the invoking terminal's display is unavailable to a long-lived server.
- **The ordinal counts fullscreen Spaces.** Mission Control shows them in the strip, so a user counting tiles includes them. Excluding them would make the CLI disagree with what the user is looking at, which is the only thing the ordinal is for. `010` recorded this as a consequence of the framing; it is adopted as one.

**The instability the measurements found is not resolved for the ordinal, and does not need to be.** Fullscreen slots and recency reordering both mean *"Space 3"* names different Spaces at different moments — which is correct for a live reading and fatal for an identifier. The ordinal stays live, the UUID is the identifier, and neither is asked to be the other.

*Sibling check: space-homing — its decided text holds `--space N` as an ordinal resolved to a UUID at call time and never stored, with the resolution step being what protects a stored home from any reordering; adopted unchanged, and that topic owns the resolver and implements whatever grammar lands here. Its research also owes itself a correction — an entry there states this was "queued as a separate triage concern" when it never was — which is that document's, not this one's. note-model — its decided text holds UID-not-position addressing for notes and the `list → read → reason` loop; cited as the precedent this extends to Spaces, not revised.*

### Revision (2026-09-13) — the ordinal reaches MCP, resolved against the note's display

*Trigger: review-003 F6 surfaced an MCP client with no shell unable to move a note to a Space at all — ordinals were CLI-only and the enumeration was in the CLI-only long tail. The user's ruling: MCP moves fumis by ordinal.*

> **`--space N` is available on both surfaces. On the CLI it resolves against the display the pointer is on; through MCP it resolves against **the display the note is already on**.**

**Keeping ordinals off MCP rested on a claim that does not survive being stated.** The claim was that an ordinal is *"a live reading of what is in front of them"* and an agent has no such moment. But the agent is not reading anything — **the user read it**, off Mission Control, and said it. The agent relays a reading it did not take.

**What is genuinely different is timing, and it is not what was argued.** A person typing `--space 3` presses Enter within a second. A person *telling an agent* is followed by seconds or tens of seconds of the agent working — and in that window they may switch Spaces, which under Mission Control's **default-on** *rearrange by most recent use* renumbers everything they just counted. The pointer moves in that window too.

**So the pointer rule does not transfer, and the fix is not a pointer at all.** A move targets a note that already lives somewhere, and *"move it to Space 3"* almost always means Space 3 **on the screen that note is on**. The user's ruling: *"if i wanted the fumi to move display i'd say so"* — a display change is an explicit request, carried by the Display axis, never inferred.

- **No pointer, no guess, no dependence on when the call lands.**
- **It needs no enumeration call**, which is what made this a hole: the enumeration is in the CLI-only long tail, so an MCP client with no shell had no route to a Space at all.
- **The display axis stays the way to move displays** — set it and the note changes screen; leave it and the note stays where it is, whatever Space it moves to.

**The staleness stays, and is named rather than solved.** Recency reordering and fullscreen slots mean *"Space 3"* denotes different Spaces at different moments. That is true of the CLI too — a property of ordinals, not of MCP — and it is why identity is stored as the **UUID** and the ordinal is never persisted. The UUID path remains available on both surfaces for a caller that wants certainty.

*Sibling check: space-homing — its measured facts are what this rests on: the Space list is per managed display so each display has its own ordinal 1; ordinals are not `ManagedSpaceID`s; a fullscreen Space occupies an ordinal slot and shifts the ones after it; and the user's own count of "space two" matched array index 1, verified against them rather than assumed. Its resolution ladder — display identity · Space UUID · ordinal index on that display — is placement's, a different consumer of the ordinal, and is untouched here. Nothing in that topic is revised; this changes only which callers may pass an ordinal and what it resolves against.*

---

## Asset Token Handling

### Context

*From: note-model · discussion · 2026-07-30*

note-model defined what a **dangling asset reference** means: a `fumi://asset/<id>` token whose asset is not present renders as a placeholder and is **never rewritten or removed**, because the target may return. Three states — **present**, **excluded** (record exists, bytes deliberately not synced under storage-and-sync's size ceiling), **missing** (no record at all). Agent-authored content is one of the named ways to produce `missing`.

It came here as a fork: should a write containing an unresolvable asset token be **rejected at the surface**, **accepted with a warning**, or **accepted silently**? With the asymmetry noted — refusing on `missing` is defensible, refusing on `excluded` is not, since the asset genuinely exists.

### The fork was closed upstream, not here

> **The surface never refuses a write for an unresolvable asset token.**

note-model answered its own question six days later (2026-08-05, resolving its review-006 F7) and said so explicitly: *"That is the direct answer to the queued 'should it refuse?' question: **no**."*

What it decided instead is that the engine carries the assets. On any write to `content.md` from any channel, the engine scans the incoming content for asset tokens; a token naming an asset the destination bundle does not hold is **materialised** — bytes copied in from wherever they live, a new id minted, that one token rewritten to it. When the id cannot be resolved at all, nothing is invented: the token stays as written and renders `missing`.

**It also rejected the refusal option on this surface's own grounds** — making read-then-write of ordinary prose fail whenever the passage happens to contain an image *"is a bad shape for the `list → read → reason → act` loop this surface is built around."*

So nothing was open. The surface's side of assets is **reporting, not enforcement**, which is what the rest of this subtopic settles.

### Decision — a write reports what it materialised, as an id mapping

> **A write whose content triggered materialisation returns the old→new id mapping, one pair per rewritten token. The field is absent when nothing was materialised.**

**The reason it is not cosmetic: the engine rewrote the content the agent sent.** The agent wrote `fumi://asset/01J9XK…`; the note now stores `fumi://asset/01KB…`. Whatever the agent believes it wrote is wrong, and nothing else in the response would tell it.

```
Claude copies a paragraph from note A into note B. The paragraph has an image.
The engine copies the image into note B and mints a new id.
  sent:   asset/01J9XK…
  stored: asset/01KB…
```

- **Rejected — silence.** Defensible as *materialisation is the engine keeping its own invariant*, and it leaves the agent holding text that does not match the note.
- **Rejected — a count** (*"1 asset copied"*). Enough to tell the user *"I brought the chart across"*, not enough to reconcile what was sent against what is stored. The engine has already computed the pair, so the count withholds for no saving.
- **Absent when empty.** An ordinary write that materialised nothing carries no field, so there is no noise on the common path.

*The concern's own worked example used `append`, which this session cut — the verb is stale, the hole is not. Cutting it slightly widens this: every content write now carries the whole body, so the materialisation scan runs over full content on every write rather than over a trailing fragment.*

### Decision — a read states each token's resolvability

> **`read` returns each asset token with its state: present or missing. The token itself comes back exactly as stored.**

The engine already holds the answer — storage-and-sync's assets manifest is what distinguishes them. *(note-model defined **three** states, the third being `excluded` — a record whose bytes were deliberately not synced. storage-and-sync **retired `excluded` on 2026-08-09**, making the size ceiling a hard limit refused at add time at every route, so there is no local-only asset and no placeholder for bytes living on another Mac. Two states remain.)* Without it, an agent reading a note cannot tell the difference between *"there is a chart here"* and *"there is a chart here but the file is gone"*, and the second is worth saying to the user.

**The token is not rewritten or annotated in the content itself** — it comes back as stored, per note-model's *never rewrite, never remove* rule. The state rides alongside.

**The id an agent reads is the source note's id, and will not be the id that exists after it writes the passage elsewhere.** That is what the write's mapping is for; nothing about the read needs to anticipate it.

### Decision — an asset that cannot be copied is reported, not silently skipped

> **When materialisation cannot copy because the bytes are not on this Mac, the write still succeeds and the response says that token was not carried.**

**Derived from the mapping decision rather than weighed as taste.** With the write returning only old→new pairs for what it copied, a token absent from the mapping is ambiguous: it may have been present in the destination already, or unresolvable. Those are different facts about the note that now exists, so the second needs its own signal.

**What produces an uncopyable token is now only `missing`** — an id that never existed, or one whose asset was hard-deleted and swept. *(An earlier draft of this block grounded the case in storage-and-sync's `excluded` state, oversized bytes staying on the adding Mac. That state was **retired 2026-08-09**; the derivation is unchanged, the case is simply narrower.)* Materialisation cannot invent those bytes, and note-model's rule is that the token stays exactly as written and renders `missing`.

**The write is not failed for it.** note-model's constraint is explicit that the surface never refuses a write over an unresolvable asset token — failing read-then-write of ordinary prose because a passage contains an image is the wrong shape for this loop.

### Decision — an oversized asset: the refusal returns to the agent

*From: note-window · discussion · 2026-08-10*

storage-and-sync made the asset size ceiling a **hard limit**: an oversized asset is refused at the moment it is added, at every entry route, and never enters the bundle. A refusal is the only outcome and it is final. note-window then settled what the *user* sees — a whole-note refusal state during a local file drag, degrading to a notification alone for paste and for a URL drag whose size is only known after fetching — and handed the agent's side here.

> **An agent-caused refusal never fires a system notification. The error goes back to the agent.**

Binding, and note-window's reasoning is that this document has killed the announce-it pattern three times — the sync-arrival banner (*"mark the change; don't announce it"*), the agent-activity header indicator (*"attribution belongs in the version record, not as note chrome"*), and the dialog for a hard-deleted note link. An agent refusal has **no on-screen state to mark** — nothing was added — so a notification would be pure announcement, fired at a user who may not be present and did not perform the act. The agent is mid-operation and in a conversation where the refusal can be explained where the user is actually looking.

> **An asset add takes one file per call.**

The open question was whether a mixed agent write follows the GUI's partial rule — what fits lands, the error naming the omission — or is all-or-nothing.

- **Rejected — partial (the GUI's rule).** It reintroduces **partially applied**, which `engine-architecture` eliminated outright: *"Every operation is individually atomic and individually rejectable, which is what the drain's guarantee rests on"*, and a multi-operation transaction *"introduces partially applied as a third answer — the exact ambiguity that decision exists to eliminate."*
- **Rejected — all-or-nothing over a batch.** Preserves atomicity and discards work for no reason: two perfectly good screenshots dropped because a third was large.
- **One file per call** makes the question disappear. No partial state can exist, the agent is already looping, and each call gets a clean per-file answer — which is more useful to a caller than one aggregate result naming omissions.

**And the GUI keeps its own rule honestly rather than by exception.** Its partial behaviour was chosen because *"a human transfer is a single gesture that shouldn't be discarded wholesale"* — true of a drag, and simply not the shape of an agent's loop. The surfaces differ because the acts differ, not because agents are special.

> **The error names the limit, never the number.** note-window's copy rule is that the surface *names* the limit rather than pinning a value, because the number is storage-and-sync's and still open; the same applies to the error text. And it must not imply the file can be added later by some other means — with link/alias dropped for v1 there is no other route, so an oversized file has none.

**A refusal is an error code with a non-zero CLI exit**, per the frame already fixed under Failure Modes — a code the agent branches on, a message a human reads.

**Dated, deliberately.** The hard limit is a **v1 constraint, not a design position** — chunked-asset spanning post-launch is the intended fix and lifting the ceiling is purely additive. So this error path should stay cheap to relax rather than become load-bearing.

### Decision — there is no asset-add verb; a path in the body is the attachment *(resolves review-001 F8)*

Claude has a screenshot on disk and needs it inside a note. A two-step shape was proposed first — an add operation returning an id the agent then embeds — and the user replaced it with something smaller:

> *"Can't Claude just put the image into the text and fumi engine turns it into the correct format, pulling the file in etc.?"*

> **Yes. The agent writes a filesystem path where a `fumi://asset` token would go, and materialisation carries it: bytes copied in, id minted, that one token rewritten. No add verb exists.**

```
Claude writes:   ![standup board](/Users/lee/Desktop/shot.png)
stored:          ![standup board](fumi://asset/01KB…)
```

**This is the machinery already decided, widened by one input.** note-model's rule has the engine scanning every incoming body for asset tokens the destination does not hold and materialising them. Recognising a filesystem path as such a token is the same scan with one more thing in it.

**It is the honest analogue of the human gesture.** A person drags a file and it lands **at the caret** — the position they put it. An agent has no caret; the position it puts the token *in the text* is the same act. The two-step shape was solving a placement problem the text already solves, and it would have made the engine choose an insertion point — the exact thing that killed the `tag` verb.

**And it removes the sequencing awkwardness entirely:** one call, no window in which the note holds an asset nothing references, and the write's existing old→new mapping reports it — the *old* side is a path rather than an id.

**Attachments need no separate treatment.** note-model's decided syntax already makes a non-renderable asset a **link** — `[report.pdf](fumi://asset/<id>)`, drawn as a chip — so a PDF or CSV materialises exactly as an image does. No new syntax for the agent to learn, which is where this landed after the user weighed and disliked one: *"Maybe the agent has to use a syntax to add? Although I don't love that."*

#### The discriminator

> **Only a path in an **image or link target** is materialised — never a bare path in running text, and never one inside a code fence.**

*"The config lives at /etc/hosts"* is prose about a path, not a request to swallow a file. And note-model's asset recognition already skips code fences so a note documenting Fumi's own syntax does not have its example treated as a real reference; materialisation inherits that discipline rather than inventing one — the same shape as the tag scanner, which suppresses inside code, URLs and math.

#### One file per call is superseded

The oversized-asset decision above took *one file per call* because a batched add could partly succeed. **There is no add call now**, so a single write can carry three images with one over the limit.

> **The write succeeds. The oversized path stays in the text exactly as written, and the response names what it could not carry.**

Consistent with what was already decided for tokens that do not resolve: the surface never refuses a write over an asset it cannot carry. Refusing would fail a paragraph of good prose over one image — the shape note-model rejected when it ruled out refusal in the first place. *(The rest of that decision stands: no system notification, the error names the limit and not the number, and it must not imply another route exists.)*

#### The unreadable path is its own error class

A path the engine **cannot read** is a different thing from a file that is too big — one is a permission the user can grant, the other can never go in — so they are separate codes. *(The class `engine-architecture` named as owed here, alongside the absolute-path requirement the tool schema must carry.)*

#### The path's form: absolute or `~`, never relative *(resolves review-002 F3)*

Moving the path from an operation argument into the body left its **form** unruled:

```
[budget](/Users/lee/Desktop/budget.pdf)   absolute
[budget](~/Desktop/budget.pdf)            home-relative
[budget](budget.pdf)                      relative
```

> **Absolute paths are the form to use, and `~` is expanded. A relative path is not resolved — it stays in the text as written, and the response names it among what could not be carried.**

**`~` is not relative.** It is an unambiguous OS convention and the engine runs as the user, so expanding it is correct by construction. An earlier draft refused it by bundling it with the relative case; that was the weaker case dragging down the stronger one.

**Relative is unsupported because of who would write one.** An agent already holds an absolute path — it came from a file listing or from the user — and has no reason to write a relative one. The only caller who would is a person typing at a shell in that folder, and they see the path sitting in the note as literal text with the response saying it was not carried. Visible and self-explaining, and it degrades exactly as an unresolvable token and an oversized file do.

**Rejected — the engine resolves it against the calling process's working directory.** Technically available: the engine already inspects the connecting peer to derive `via`, and could read its working directory the same way. Two costs against a caller who barely exists — that inspection happens **once at connect** while a working directory would have to be read **per request**, and `fumi-mcp` is a long-lived server whose working directory is wherever its host launched it, meaning nothing. **Purely additive if it ever matters**; nothing here blocks adding it.

**Rejected — the client sends its working directory with the request.** `engine-architecture` deliberately chose to **derive** context rather than accept it asserted, and this would add a field to every request for a rare case.

#### Resolution moves engine-side — owed to `engine-architecture`

That document decided *"the wire carries absolute paths. Resolving a relative path against the caller's working directory, and expanding `~`, happens client-side before the frame is built"*, with `fumi add ./board.png` as the worked case and the absolute-path requirement framed as a constraint on the MCP tool schema.

**That rule was written for a path as an operation argument, and there is no such argument now.** A path lives inside `content.md`, and a client cannot resolve it there without editing the user's text — which note-model reserves to the engine as the one app-authored mutation of content. So `~` expansion happens **engine-side**, during the same scan that materialises the token.

Rerouted to `engine-architecture` as a concern: the case is one its rule did not contemplate rather than one it decided against, and that document owns the transport rule.


*Sibling check: note-model — its decided text holds the `fumi://` scheme with images as image syntax and non-renderable assets as links, materialisation on any content write with nothing invented for an unresolvable id, recognition that skips code fences, and the token rewrite as the one app-authored mutation of content. All adopted and extended by one recognised input; nothing revised. note-window — its decided text holds the drop landing at the caret and the attachment chip's rendering; the caret analogy is drawn from it and neither is revised. storage-and-sync — its hard size ceiling refused at add time is relied on, not revised. engine-architecture — bytes never crossing the socket and file-bearing operations passing absolute paths is what makes a path the right thing to write; adopted, not revised.*


*Sibling check: note-window — its decided text holds the no-notification constraint for agent-caused refusals, the drag/paste refusal surfaces, the mixed-transfer partial rule for human gestures, and the name-the-limit-not-the-value copy rule. All are adopted; the partial rule is left as the GUI's on the reasoning it was given, not overridden. storage-and-sync — its decided text holds the ceiling as a hard limit refused at add time with `excluded` retired; relied on, not revised. engine-architecture — its atomicity rule and the drain's not-applied guarantee decide the batching question and are applied, not revised.*

---

## Agent Initiated Window Effects

### Context

*From: note-model · discussion · 2026-07-30*

What an agent may do to a fumi *as an object on screen*, as distinct from its content. note-model arrived with an asymmetry it expected this surface to design around: **`size` and `preset_id` are intrinsic and sync**, while **position coordinates, the resolved rect, home display and home-Space are machine-local**. The brief lists a `pos` verb, so the same-looking family of window operations would carry two blast radii with nothing marking which is which.

Two rules note-model settled that this surface honours rather than revisits:

- **The write invariant** — *a synced geometry field is written by a deliberate act, on exactly one machine; never by a value each machine derives independently.* It is **actor-blind by design**, consistent with note-window's *"the actor never enters the rule"*: an agent write is a deliberate act and writes exactly like a manual resize.
- **Geometry never bumps `modified-at`** — the same rule as colour. Pure metadata must not leap a note up sort-by-recent, and an agent that resizes a note has not modified it in that sense.

### Decision — geometry is fully exposed, and the split is stated rather than designed away

> **`size` raw, position raw, and `pos <preset>` for authored layouts. Nothing is withheld. The travelling/machine-local split is named in the surface's own documentation and MCP tool descriptions.**

```
the Size axis, set raw            → travels. every Mac.
the Position axis, set by preset  → writes preset_id → travels. every Mac re-resolves locally.
the Position axis, set by coords  → this Mac only.
```

*(Amended 2026-09-13 — these were first written as separate `size` and `pos` verbs. **One geometry operation over three axes**, decided below in this same subtopic, retired that spelling; the axes and their reach are unchanged. The verb is `geometry` per Verb Naming; each axis's flag spelling is specification's.)*

**This is the concern's question answered as asked.** It did not ask whether geometry should be exposed — it asked *"whether the surface distinguishes travelling from machine-local fields (naming, grouping, or documentation)"*. The answer is documentation: an agent reading an MCP tool description should be told that setting a size reaches every Mac while setting coordinates reaches one. The fields genuinely differ, so the surface says so. It costs a sentence per tool.

**And the surface cannot write position on a machine it is not running on** — there is one engine per Mac, and a client talks to the engine it connected to. Stated because the entry asked for it to be, not because anything had to be decided.

**Journey — the same error twice, both times reaching to withhold.** Two proposals were argued here and both were withdrawn against the same objection.

First, `size` read-only, leaving `pos <preset>` as the only write: a raw size travels to every Mac, storage-and-sync's snapshot cadence is content-only and states outright that *"Resizing a note does not create a snapshot"*, and geometry does not bump `modified-at` — so a destroyed authored size leaves no trace and does not even surface in sort-by-recent. The user: *"why not give the agent raw sizing too? I dont get the issue...?"*

Then, raw coordinates left out, on the grounds that they are screen-anchored and meaningless to a caller that cannot see the displays, and that they are the only machine-local geometry write. The user: *"why have you left position out of the agents cli !??! why are you making things weird?"*

Both fail on the same point, and it is note-model's own rule: **the write invariant is actor-blind by design.**

- **A human drag *is* raw coordinates**, and a human resize travels to every Mac with no snapshot and no undo. Each proposal asked the agent to be less capable than the person for a risk the product already accepts from the person.
- **The coordinate argument was wrong on its facts.** An agent reads a note's position, so *"nudge that note left"* and *"put it at 100,100 because I asked"* need no knowledge of anyone's displays. Relaying a placement the user named is not the agent inventing one.
- **"No undo" overweights what is at stake.** The remedy for a note in the wrong place or the wrong shape is the same verb again. Colour travels identically with no undo and raises no concern.
- **The multi-Mac reach is the design, not a blast radius.** `size` and `preset_id` travel because a note's shape and its named placement are properties of the note; a user arranging on one Mac expects it everywhere.

**So the asymmetry is real and is carried, not removed.** A surface offering only presets would have made every geometry write travel and left nothing to signal — which was the second proposal's appeal, and it bought that tidiness by deleting a capability.

**A consequence that needs no new rule.** A raw Size-axis write breaks a preset binding when the preset sets Size, and a raw coordinate write breaks one that sets Position, per note-model's scoped break trigger — *"a gesture breaks the binding only if it overrides an axis the preset actually sets."* Actor-blind again: an agent's write breaks it exactly as a user's drag does.

*Sibling check: note-model — its decided text holds `size` and `preset_id` in the Note tier and position coordinates in the Machine tier, the write invariant as actor-blind, geometry never bumping `modified-at`, presets keyed by syncing UID, and the break trigger scoped to the axes a preset sets. All are adopted as written; nothing is revised. storage-and-sync — its decided text holds the snapshot cadence as content-only with resizing explicitly not triggering a snapshot; cited as the measured fact behind a withdrawn proposal, not revised.*

### `float` travels too, and gets no cue of its own

*From: note-model · discussion · 2026-07-30 — widening the entry above, landed the same day*

The asymmetry was framed as geometry-only and is not. note-model moved **`float-on-top` to the Note tier**, so it is intrinsic and **syncs**:

```
float                             → travels. every Mac.
the Position axis, set by coords  → this Mac only.
```

The split therefore runs through what reads as one family of window operations, and `float` is the sharpest case for stating it — it reads *more* like a local windowing action than a resize does. Covered by the documentation answer above: the tool description says which reach a field has.

**The consequence specific to `float`, and it gets no new mechanism.** note-window decided **no persistent indicator** for a floated note — *"a floated note is self-evidently floating; that on-top-ness **is** the signal"* — and declined the alternatives twice, a hover-revealed float glyph and a corner pin icon both offered and rejected as the *"pinned chrome"* discovery had already ruled out. State is available **on demand**: the corner menu's **Float on Top** item carries a checkmark.

So an agent floating a note on the iMac while the user is at the laptop changes that note's behaviour with no announcement on any machine.

> **Accepted. An agent float gets no cue a human float does not.**

**The deciding factor is note-window's own equality principle.** Giving an agent-initiated float a signal the user's own float does not get is the *"Updated by Claude"* shape that document rejected as **the unequal option** — singling out agent action as exceptional. The failure is also mild and self-correcting: the note is visibly on top, the menu tick says why, and unticking it is one gesture.

*Sibling check: note-window — its decided text holds no persistent float indicator with the alternatives twice declined, the state on demand via a checked menu item, and the actor-blindness principle that a rule never names who acted. All three are adopted here and none is revised. note-model — its decided text holds `float-on-top` in the Note tier and the write invariant as actor-blind; adopted, not revised.*

### One geometry operation, three axes

> **Geometry is one operation taking any subset of **Size · Position · Display**, where position is a preset reference *or* coordinates. Not one verb per field.**

The case the user put:

> *"I might say put that note in the top left qtr for example and make 100 square. I would want an agent to have that power."*

**As separate calls that works, and looks wrong.** note-model's axis composition means a Position-only preset leaves size to its normal home, and its break trigger is scoped — a size write does not break a preset that only sets Position. So `pos <top-left-quarter>` followed by `size 100x100` composes correctly and the binding survives. But the note **visibly jumps twice**: to the corner at its old size, then shrinks in place.

**That is `engine-architecture`'s composite-operation argument, and here it is literally visible.** Its rule is that an operation carries everything **one user intent** determines: *"`create` carries the note's full initial state… because creating-a-note-like-this is one thing a person asked for"*, while *"there is no `recolour-and-move`, because recolouring and moving are two intents that merely happen to be adjacent."* Placing a note *like this* is one intent — the user said it in one breath — and the half-applied state in between is exactly the kind the rule exists to avoid.

**The argument surface mirrors the model.** note-window's presets are *"three independently-toggled axes — Size · Position · Display — and any subset is valid"*; the operation takes the same three, so there is nothing to learn twice and nothing to keep in step.

**Colour, float and visibility stay their own verbs.** They are not geometry axes, and bundling them would be the `recolour-and-move` the rule forbids.

*Sibling check: engine-architecture — its decided text holds operations as intent-shaped, `create` carrying full initial state, no transaction frame on the wire, and no verb bundling two unrelated intents; this is an application of that rule, not a revision. note-model — its decided text holds a preset as three independently-toggled axes with each axis sourced independently and the break trigger scoped to the axes a preset sets; the operation's argument surface adopts that shape and revises nothing.*

### Decision — `new` shows the fumi; `--open false` for when it should not

*From: space-homing · research · 2026-08-23*

Surfaced while working out how a fumi gets placed on a Space with the app already running. Placement resolved there — a fumi created for a Space the user is not on is created there **silently**, no Space switch and no window thrown in front of them, and an explicit `--space N` that does not resolve **fails loudly** because a caller is waiting. What it exposed was an operation-shape question: creating a fumi and *showing* it may not be the same act.

> **`new` shows the fumi. `--open false` creates it without showing it.**

**Neither half was actually open, which is why this is recorded rather than argued.**

- **The default is the brief's decided silent-create behaviour** — *"an agent-created fumi pinned to a Space you're not on appears **silently** on that Space — never pulls focus."* It appears; it just never steals focus. A default of not-showing would quietly retire that.
- **The flag was the user's own proposal at source**, in the space-homing session that raised this: *"you could argue that there is a difference between creating the fumi using the CLI and opening it… that probably is something that would be useful"*, with no reason against it identified there or here.

**The case the flag answers:** *"import these twenty meeting notes"* with a showing default throws twenty windows across the user's Spaces. An agent creating twenty notes is doing something deliberate enough to say so; an agent saving one is the common path and should behave as decided.

**"Created but not shown" is not a new state.** note-window's existence/visibility split already holds that a fumi's existence — in the store, listed in the manager, addressable by CLI and MCP — is independent of being on screen, and **close = hide**. So a note created unshown is indistinguishable from any note the user has ever closed, and neither the manager nor the launch-restore path meets anything new.

**One default, both surfaces.** A CLI that shows and an MCP that does not was considered and dropped: the same instruction through two doors producing different outcomes is the kind of divergence that stays invisible until it bites, and the operation has one default even though passing an argument is the client's job.

**The space-homing interaction, preserved as they asked:** the flag governs **visibility, never Space identity**. A fumi created with `--space N` while unshown still has that home Space recorded, and lands there by the normal homing path when it is later shown or when the app restarts and restores.

*Sibling check: note-window — its decided text holds existence as independent of on-screen visibility and close as hide rather than delete; adopted, and it is what makes the unshown state ordinary rather than new. space-homing — its decided text holds silent creation on a non-current Space and a loud failure for an unresolvable explicit target; adopted unchanged, and the visibility flag is kept clear of Space identity exactly as that topic asked.*

---

## Structured Output

### Context

*From: note-window · discussion · 2026-07-29*

What a call hands back. The brief's inherited position is *structured output for agents, pretty output for humans, native structured returns for MCP*, rich enough to reason in one round-trip — UID, derived title, space, tags, float state, position, content preview, timestamps.

note-window sent three decided principles here, not as constraints on the verb set but as the frame anything this topic designs is checked against:

- **Rules never name the actor.** The recency tint marks *what you have not seen yet* and decays when you return; your own typing, an agent write and a sync arrival are treated identically. A banner reading *"Updated by Claude"* was rejected as the **unequal** option — singling out agent edits as exceptional.
- **No write-locking.** An agent writing to a note never blocks the human from editing it; presence is signalled by an edge shimmer, not by disabling input.
- **Attribution exists but is uniform** — version history lists *"Claude via MCP"* in the same row shape as *"You"*, with no visual privileging either way.

### Decision — a read says which door the last write came through; a list row does not

> **`read` carries the note's last-write attribution — `lastVia` (`app` | `cli` | `mcp`) and the optional self-reported `lastBy`. `list` does not.**

**The field cannot say "you" or "Claude", and that is storage-and-sync's call, not a simplification here.** It refused a `user | agent` field outright: *"the CLI is a shared surface the user genuinely uses, so the channel does not imply the actor, and nothing else can tell us. Storing that boolean would be storing a guess."* So a read reports **which door** — and `app` is the only value that reliably means a human at a window, since a user's own shell script presents as `cli` by the unrecognised-peer rule.

**Journey — the case for withholding it was argued and was wrong twice over.** The proposal here was that the agent surface carry no actor at all, on two grounds: that an agent cannot act differently on the fact (its next write either holds its token or is refused), and that the user had already rejected *"a human is writing"* on the refusal frame, so serving the same fact through a read would make the error's code-and-message shape cosmetic.

The user rejected both: *"Im confused why youre reaching for adding code to hide data for absolutely no reason. When I said about this before that was under very different circumstances. that was about blocking a write after an edit happening between the read."*

- **The direction of cost was backwards.** `lastVia`/`lastBy` are already on the note record — synced, updated on content writes — and the engine is holding that record when it serves a read. *Including* the field is free; **excluding** it is the act that needs a deliberate projection to strip a field the record already carries.
- **The earlier call was narrower than it was being applied.** That decision was about not putting narration inside a failure frame whose shape is fixed at a code and a message. It never established that the author is withheld.
- **And the use dismissed as unactionable is real, one level up.** An agent that can see the last write came through `app` can say *"you edited this a few minutes ago — want me to hold off?"* That is the agent surfacing a fact to a person, not inventing scheduling policy, and it can only do it if it knows.

**`list` stays as it is, and this is where the cost lives.** `list` hits the SQLite projection, and storage-and-sync deliberately left these two columns out of it: *"a column exists to answer a query and nothing asks about last-writer attribution."* This topic asking would falsify that premise and owe that document a reopened call. Weighed on the one use only `list` could serve — sweeping a whole library for *which notes has the human been in lately* — and declined: the real question is *"I am about to write to this note"*, which `read` already answers. **No correction is owed to storage-and-sync; its projection decision stands and its rationale holds.**

### Decision — `list` and `search` are cursor-paginated, and a partial page says so *(resolves review-001 F9)*

Four hundred notes and *"tidy up my library"*. Nothing in this document weighed the size of a round trip, on any verb — and this session sharpened the problem by making every read and every write carry a whole body, with the targeted replace and `append` both cut.

> **`list` and `search` are both paginated: a bounded page by default, a stable ordering, and a **cursor** to ask for the next. A partial answer says so in the page's own fields — the total and the cursor.**

The user's position, stated flatly: *"Claude will not get 400 notes back. List should be paginated. At no point should we allow 400 notes to hit the user's agent context."* — and, on the same breath, *"list and search both return paginated. and probably cursor based to avoid movement under the page?"*

**Both verbs, because the problem is not `list`'s.** A search over a large library returns as much as a listing does and has no reason to behave differently; bounding one and not the other would leave the same failure reachable through the other door.

**A cursor rather than an offset, and the reason is sharper on this surface than most.** The agent is frequently **the thing mutating the library while it pages**: it lists, writes a note, asks for the next page — and with an offset the set has shifted underneath, so rows are skipped or repeated. Sync arrivals from another Mac and the user typing do the same. A cursor pins where the caller was instead of counting from the top.

**One edge it cannot fix, and does not need to.** Search results are ranked, so an index rebuild completing mid-paging can re-order the set under even a cursor. That is not a paging problem and it is already answered: the response's completeness state says the index was moving.

**The honesty half is what makes it more than a size limit.** A page that quietly returns part of the library is the same class of failure the Response Envelope was built for — the agent reasons over what it believes is the whole set and tidies around notes it never saw — but **not the same mechanism**, and the distinction is one that decision drew itself. The system-state block carries *"the conditions currently in force"*, and it was argued explicitly against per-call facts: *"the materialisation mapping describes **what this call did**… System state describes **the system**, which always has a value."* A page boundary is what this call did. *(Amended 2026-09-13 — this pointed the announcement at the completeness block, which by that scope rule cannot carry it.)*

**So the page announces itself in its own fields**, which the decision below already provides: **the total** says how much exists, and **the presence of a cursor** says more is waiting. Nothing further is needed, and the system-state block keeps meaning what the Response Envelope decided it means.

**Rejected — no limit, on the grounds that this is one person's notes rather than a database.** A real argument: four hundred rows fit, and paging is machinery for a scale that may never arrive. It loses because the failure is **silent** and the remedy is a field on a response already being sent.

**The numbers are specification's.** That `list` is bounded, ordered stably, and honest about truncation is the decision; the page size and the default ordering are not settled here.


### Decision — stdout, stderr, and what selects structured output *(resolves review-001 F6)*

```
id=$(fumi new "shopping")
```

The chaining idiom the brief carries forward. With the system-state block on stdout, `$id` holds a UID **and** a line about indexing the moment a rebuild is running — and nothing said it did not.

> **stdout carries the answer and nothing else. System state, errors and every other line go to stderr.**

That makes the brief's own idiom work by construction rather than by convention, and it is what a shell user already expects. It also settles the half `engine-architecture` left open when it fixed the failure frame here but assigned the CLI's rendering to this topic: **the error goes to stderr**, while the machine-readable code rides in the payload as that document specified.

> **Human output by default. `--json` opts into structured. No terminal detection.**

The orthodox trick is to detect a terminal and switch to machine output when piped. **Rejected on the case this surface is built around:** `fumi list | grep standup` is not a terminal but *is* a person's pipeline, and they would get JSON they never asked for. Explicit opt-in means the same command produces the same thing wherever its output goes.

**It is also the third time this session that the same shape has been turned down** — a CLI and MCP defaulting differently on `new`, an ordinal meaning different things per surface, and now output that changes with what is downstream. Behaviour that varies with something the caller is not thinking about is invisible until it bites.

**The MCP server is unaffected**, and that is why the CLI can be plainly human by default: `engine-architecture` ships `fumi` and `fumi-mcp` as **siblings over the socket, never chained**, so no agent is reading the CLI's output. The CLI's audience is a person and their scripts.

### Decision — the CLI holds the token for a person; an agent always reads *(resolves review-003 F5)*

The stdout rule left the read token with nowhere to go. `stdout carries the answer and nothing else`, and the answer to a `read` is the note's body — so a token printed there breaks `fumi read 01J9… > note.md`, a token on stderr is out of band from the thing it describes, and no token at all means the CLI's default mode cannot perform a write.

The user named the real problem underneath: *"cli shouldn't need the token when a human does it."*

> **`fumi edit <uid>` opens the body in `$EDITOR`, and the CLI holds the token across the edit. A person never sees one. An agent always reads first and passes it explicitly.**

```
person   fumi edit <uid>        → editor opens · save · written    (CLI holds the token)
agent    read → reason → edit   → token passed explicitly
```

**The guard is satisfied both ways, by the same rule.** The token proves the writer saw the content it is replacing. A person in `$EDITOR` **is** looking at it, so the editor round trip is that proof; an agent has no such moment, which is why the read **is** the moment. One rule, two ways of meeting it — not a per-surface exception.

**The interactive path cannot be taken by accident.** It is `$EDITOR`, which an agent cannot drive, so no shortcut exists for it to find. And if the note changed while the editor was open, the write is refused and the CLI says so — the guard does its job and the human simply never carried the hash. This is `git commit` and `crontab -e`; nobody experiences those as awkward.

**So the token is a protocol concern, not a CLI surface one**, and the stdout question is moot in human mode: nothing needs carrying between two commands, so nothing needs printing.

**Left out deliberately:** a person doing it the manual way — `fumi read > note.md`, edit, write back — still needs a token, and uses `--json` like a script would. A third path for that was considered and dropped; the ergonomic path exists and the scripting path exists.

#### What stdout carries, per mode

> **stdout carries what the caller asked for: the body in human mode, the whole response object under `--json`. Errors go to stderr in both.**

The global form of the rule — *stdout carries the answer alone* — stranded a second caller and this one was load-bearing. `--json` puts structure on stdout, but the system-state block is *"everything else"*, so a script parsing stdout would never see the indexing state — the block that exists precisely to stop *no results → "there's no such note"*. Under `--json` the response is **one machine-readable document**: result, system state, pagination and any token; splitting it across two streams would be the strange thing.

In human mode stdout stays the body alone, so redirects and pipes behave, and system state prints to stderr where a person still reads it.


*Sibling check: engine-architecture — its decided text holds the failure frame as a machine-readable code plus a human-readable line with the CLI's rendering left to this topic, and the two client binaries as siblings that never chain. Both adopted; this settles the rendering half it deferred and revises nothing.*


### Decision — what a `list` row carries

Left implicit while the subtopic settled attribution and the response envelope, and settled from elsewhere rather than argued fresh.

> **A row carries everything the read model already holds about a note: UID, derived title, tags, colour, content preview, timestamps — and its Space, position, display, visibility and float state. Rows come back paginated with the total, and a deleted row says it is deleted.**

```
uid · title · tags · colour · preview · timestamps
space · position · display · visible · float
```

*(Corrected 2026-09-13, resolves review-003 F9 — this first read "the brief's set" and then listed a **different** set, silently dropping Space, position and float. The reasoning for the drop was that those are machine-local and projecting them would reach into storage-and-sync. **That is wrong**: its read model restates `window_state` as a per-note tuple — `uid`, `x`, `y`, `display_uuid`, `space_uuid`, `visible`, `last_opened`, `z_order` — and `float_on_top` sits on the note record. Every one of them is already projected, because the engine needs them to restore windows. No column is added and nothing is owed to that document.)*

**The precedent it was pattern-matched onto is the opposite case.** `lastVia`/`lastBy` are **deliberately unprojected**, which is why putting them on a row would have been a real ask and was declined. Here the columns exist; declining would have withheld what a single projection read already returns.

**What it buys:** *"which of my notes are on Space 3"* is answerable from one page rather than a `read` per row — and filtering by a field a row does not show was lopsided.

- **The brief's *"rich enough to reason in one round-trip"* holds at a page.** It was written before paging existed and would have been wrong across a whole library; bounded, it is exactly right — the preview is what lets an agent decide whether a note is worth reading without reading it, and the placement fields let it reason about where a note lives without opening it.
- **The preview is already bounded** — note-model fixes it as the title strip applied after the title line, plain text, single line, ~200 characters at derivation. Nothing here re-specifies it.
- **No last-write attribution**, per the decision above: those columns are deliberately unprojected in storage-and-sync's read model, and the one use only a list could serve was weighed and declined.
- **A deleted row is marked**, because it behaves unlike every live row — it takes no writes.

*Sibling check: note-model — its decided text holds the preview's derivation and bound, and `list` as a cheap SQLite read-model query returning UID, derived title, tags, colour and a preview. Adopted as the row; nothing revised. storage-and-sync — its read-model projection is the row's source and `lastVia`/`lastBy` stay out of it; untouched.*


*Sibling check: note-window — its three principles above are adopted as the frame, not revised; the actor-blindness rule governs what the **human's** live surfaces say, and it cut a header indicator whose only contribution was live identity, while its own version panel carries attribution after the fact. A structured response to an agent is neither surface. storage-and-sync — its decided text holds `lastVia`/`lastBy` as synced note-record fields updated on content writes, with no `user | agent` field because the channel does not imply the actor, and holds both fields deliberately unprojected into SQLite. The read adopts the fields as they are; the list decision leaves the projection untouched, so nothing there is revised.*

---

## Failure Modes And Engine Absence

### Context

`engine-architecture` closed its own topic naming the error-code vocabulary as this topic's to draw — *"including the unreadable-path and* not responding *classes"* — and fixed the frame it travels in: a failure is `{"id":…,"ok":false,"error":{"code":"…","message":"…"}}`, a machine-readable code plus a human-readable line, *"the shape is decided here; the code vocabulary is `agent-surface`'s"*.

The first member of that vocabulary arrived with the read-token guard: a write whose token no longer matches is refused, and the refusal is what the agent acts on.

### Decision — a refusal is a code and a message, and carries nothing else

> **The error frame carries a code and a message. Never a content payload, and never an account of why the model moved.**

**A refusal does not return the current content.** Saving a round-trip on every retry was argued for — the loop is the mechanism, so halving its cost has real value, and the agent was entitled to read that content moments earlier. Rejected, and the deciding factor is the frame rather than the ergonomics: `engine-architecture` fixed the failure frame as a code and a message, so a result payload inside an error is a shape the protocol does not have. *"Writing should not return content in an error response."* The agent re-runs the read itself.

**A refusal does not say who moved the content.** Distinguishing *a human is typing in this note* from *another writer landed a change* was argued as actionable — back off versus retry immediately. Rejected: **the agent's action is identical in both cases.** Read again, reason again, try again; and if it keeps failing, report that it could not, which is equally true whichever writer moved the bytes. A distinction that changes no behaviour is an invitation for an agent to invent different behaviour for cases that deserve the same one. It also sits badly with `engine-architecture`'s Observability rule — the engine records state and never narrates it to a caller, which is the same instinct that rejected a `fumi status` operation there.

**What this fixes for the rest of the vocabulary:** every code answers *what the caller should do*, not *what the engine was doing*. A code is fixed text an agent can branch on; the message is for a human reading a terminal or a transcript.

*Sibling check: engine-architecture — its decided text holds the failure frame as a code plus a message and assigns the code vocabulary here, and its Observability rule holds that the engine never presents state it records; both are adopted as written and neither is revised.*

### Decision — the code vocabulary

> **A closed set of codes, each answering what the caller should do. The vocabulary is the contract; there is no separate retryability field.**

```
stale_token        the write's token no longer matches       → re-read, retry
stale_cursor       the cursor's query is not the one supplied → restart the walk
ambiguous_title    a title matched several notes             → resolve it, then retry
no_match           a title matched no note                   → the view was stale
already_deleted    rm on a note already in Recently Deleted  → the view was stale
not_deleted        restore on a note that is not in the bin  → the view was stale
not_found          unknown UID                               → the view was stale
not_editable       a write to a note in Recently Deleted     → restore it first
asset_too_large    over the ceiling; names the limit         → never retryable
path_unreadable    the engine cannot read the path           → a permission the user grants
space_not_found    an explicit Space target did not resolve  → the target is gone
display_not_found  an explicit display target did not resolve
preset_not_found   an explicit preset reference did not resolve
version_not_found  an explicit version id did not resolve
version_mismatch   client and engine protocol disagree       (engine-architecture)
not_responding     a wedged engine, answered by transport    (engine-architecture)
not_running        a dead socket                             (engine-architecture)
not_applied        the drain rejected an in-flight operation (engine-architecture)
```

*(Five members added 2026-09-13, resolving review-003 F7 — each for a failure this document had decided and left with nothing to carry it back. `stale_cursor` for the rule that **a cursor is bound to the query that produced it**, since a cursor replayed against different parameters must be refused rather than silently return a page of something else. `not_deleted` as the exact mirror of `already_deleted`, under the principle generalised from it: **a code fires when the agent's view of the library was wrong**. `preset_not_found` and `version_not_found` because an explicit target that does not resolve already has two members and a preset reference and a version id are the same shape. `no_match` because a title matching **nothing** was named by neither `ambiguous_title`, which covers too many, nor `not_found`, which is scoped to an unknown UID. Assembly, not judgement — the same move the set itself was.)*

**Rejected — folding the not-found family into one code with a subject field.** Fewer members, and it makes an agent parse a field to learn what it could have branched on. The vocabulary is the contract precisely so a code is enough.

**Most of the set was already determined** — four by `engine-architecture`, which named the unreadable-path and *not responding* classes as owed here and settled the rest in its own decisions; the others by decisions made in this topic. Drawing the set is assembly, and it is recorded because nothing had assembled it.

**No separate retryability field.** An agent needs to know whether to retry or stop and tell the user, and the code already says: the vocabulary is closed and documented, so `stale_token → retry` and `asset_too_large → never` are properties of the code itself. A second field restating what the first implies is the shape rejected on the stale-token refusal — *"a clean fixed error message + Code is perfectly fine for this."*

**The engine-absence half of this subtopic is carried entirely by `engine-architecture`** and is recorded here so a reader does not go looking for a decision that was never owed: a dead socket is a clean structured failure for both clients, clients never start the engine, and a wedged engine answers *not responding* from the transport layer because the socket runs off the main thread.

---

## Summary

### Key Insights

1. **The read token is one rule, and its simplicity is the feature.** A token comes from a read, always describes the live body, and is required on any write that replaces content. Every attempt to add a conditional path — returning one from a write, minting one from a version read, hanging one off a listing — was argued and withdrawn, each time because the exception defeated the property the guard exists for: that a write is based on content the writer actually saw.

2. **The surface withholds nothing from an agent that a person can do, and the reasoning is note-model's, not this topic's.** The write invariant is **actor-blind by design**. Four separate proposals here tried to give the agent less capability than the human — read-only geometry, no raw coordinates, no last-write attribution, no version revert — and every one fell to the same objection: the risk being guarded against is one the product already accepts from the person, and the remedy is usually the same verb again.

3. **A capability withheld over an edge case that an existing failure path already covers is not caution.** Relative paths, oversized assets, unresolvable tokens, `list` against the bin — each looked like a reason to refuse and each was already answered by *the write succeeds, the text stays as written, the response names what it could not carry*.

4. **Ordinals are a reading, not an identifier — and a relayed reading is still the user's.** The clearest reversal in the session: ordinals were kept off MCP because an agent has no live view of the screen, which mistook *who is counting*. The user counts; the agent relays. What genuinely differs is **timing** — an agent acts seconds later, by which time the pointer has moved and macOS may have renumbered — and the answer was to resolve against the note's own display rather than a pointer.

5. **Two audiences, one rule, satisfied differently.** A person in `$EDITOR` has seen the content, so the editor round trip is the proof the token would otherwise carry; an agent has no such moment, so the read is the moment. The same discipline runs through stdout (the body for a person, the whole response for a script) and through the MCP tool set (the common path as tools, the long tail as a CLI).

6. **The context budget is a design input on this surface and nowhere else in the product.** Tool definitions cost tokens on every conversation whether Fumi is used or not, measured at roughly 650 each — which decided the tool set's shape, and it is the constraint an agent surface has that a GUI does not.

### Open Threads

- **`engine-architecture` holds two concerns from this topic** — that path resolution has moved engine-side now a path is content rather than an argument, and whether cutting `append` and `tag` from the client surface reaches the engine's operation set. Both are that document's to answer; neither blocks anything here.
- **`privacy-and-data-handling` holds one** — the MCP server as a content-egress channel its inventory does not count.
- **Argument shapes are specification's**: each verb's flag spellings, page sizes and default orderings, the token's representation, exit-code granularity, and a `color` alias for the British spelling.

### Current State

- **Resolved** — a content write carries the read token for the body it replaces; a stale token is refused and the agent reads again. No `append`. The retry loop is the mechanism, not a failure of it.
- **Resolved** — MCP carries a small task-shaped tool set with the CLI carrying the long tail, and a tool result names the next move in prose.
- **Resolved** — the error-code vocabulary is drawn and closed (eighteen codes), with no separate retryability field; an ambiguous title is an error carrying a count, never a candidate list.
- **Resolved** — there is no session-declaration verb: a note-addressed operation on the `cli` or `mcp` channel lights that note's shimmer and refreshes an expiry, silence lets it lapse, and library-wide verbs and in-app edits light nothing.
- **Resolved** — version history is reachable by flags on `read` and `edit`; `read --versions` returns id, timestamp and attribution rather than content; reverting takes the read token and carries geometry.
- **Resolved** — a verb's coherence is its subject: `read` is note-scoped, `list` library-scoped, `search` text, `spaces` machine-scoped. A shared widening is spelled identically on both verbs that take it.
- **Resolved** — `search` finds text; resolving a name is title-as-address on every UID-taking verb, not a verb of its own. Displays are addressed by UUID with the name accepted as a convenience, and the enumeration returns them alongside Spaces. There is no current-Space affordance — the user names a Space by its Mission Control number and the agent matches it to a UUID.
- **Resolved** — the verb set is assembled and named (thirteen verbs); property verbs take a value while action verbs do not, retiring `show`/`hide` for `visible on|off`; `spaces` and `displays` are separate enumerations.
- **Resolved** — the verb for making a fumi is `new`, the un-delete verb is `restore`, and verb names are spelled out rather than invented-truncated; `list` and `search` are two operations, not one with an optional term.
- **Resolved** — every successful response carries a system-state block, always present, carrying status-and-alerts' condition set; errors carry none.
- **Resolved** — agents address Spaces by UUID with a Space-enumeration operation to get one; the ordinal is available on both surfaces — resolving against the pointer's display on the CLI and against the note's own display through MCP — and counts fullscreen Spaces.
- **Resolved** — the surface never refuses a write over an asset token; a write returns the old→new mapping for what it materialised and names what it could not carry; a read states each token's resolvability; an oversized asset is refused to the agent with no notification; there is no add verb — a path written into the body is materialised, absolute or `~` but never relative, and one that cannot be carried stays as written with the response naming it.
- **Resolved** — geometry is fully exposed — the Size axis raw, the Position axis by coordinates or by preset — as **one** operation over three axes rather than a verb per field. The travelling/machine-local split is stated in the surface's documentation and tool descriptions rather than designed away. `float` travels and gets no cue a human float does not. `new` shows the fumi, with `--open false` for bulk.
- **Resolved** — `fumi edit <uid>` opens `$EDITOR` and the CLI holds the token across it, so a person never handles one; an agent always reads first. stdout carries what the caller asked for — the body in human mode, the whole response object under `--json` — and stderr everything else; human output by default with `--json` opting into structured, and no terminal detection.
- **Resolved** — `list` and `search` are cursor-paginated with a stable ordering, both report the total, a cursor is bound to the query that produced it, and a truncated page announces itself through the response's completeness channel.
- **Resolved** — `read` carries last-write attribution (`lastVia`, optional `lastBy`); `list` does not, and storage-and-sync's unprojected columns stay unprojected.
- **Resolved** — a token comes only from a read and always describes the live body, whatever content the read returned; a write returns none. A whole-body write is diffed by the engine before it reaches an open note, so note-window's patch model holds.
- **Resolved** — a refusal is a code plus a message and nothing else: no content payload, no account of which writer moved the bytes.
- **Resolved** — `rm` is a soft delete and permanent deletion is not on the agent surface at all (arriving constraint, note-window); `restore` is exposed, so delete is symmetric; a redundant `rm` is refused, on the rule that a stale view earns a code; `rm` takes a UID only while every other verb accepts a title, resolved against the set that verb acts on; a note in Recently Deleted is not editable by anyone but can still be read; `list` reaches the bin behind a flag and never by default.
- **Uncertain** — argument shapes: each verb's flag spellings, page size and default orderings, the token's representation, exit-code granularity. All specification's. *(Amended 2026-09-13 — this also listed the error-code vocabulary and the session declaration; both were decided in full above, the second as not existing.)*

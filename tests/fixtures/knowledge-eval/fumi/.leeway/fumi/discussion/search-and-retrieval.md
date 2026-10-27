# Discussion: Search And Retrieval

## Context

Every completed topic assumes search and none defines it. **storage-and-sync** pins the mechanism — `notes_fts`, an FTS5 index over `content.md`, refreshed inline by the engine on every note change, inside the same transaction that writes the bundle — and **note-model** lists "the search index" in the Derived tier (per-machine, disposable, rebuildable, never synced). Neither says what a query *means*.

Unstated today: whether a search matches tags, the derived title, the preview, an asset's `originalFilename`, or a note's raw Markdown syntax and `fumi://` tokens; whether soft-deleted notes, conflict candidates and version snapshots are searchable; what tokenisation and normalisation a query goes through; what a result carries back; and whether the CLI, the MCP server and the management window all answer the same way.

Two of those are worse than omissions.

**Tokenisation is a live inconsistency, not a gap.** note-model pins tag identity at **NFC → full case fold → NFC** precisely because a derived value computed independently on each Mac diverges without it, and pins agentic title matching to the same rule against the full derived label (no fuzzy, no substring). FTS tokenisation is a fourth reading of the same content and inherits none of that by anything written down. A user who filters `#café` and searches `café` can currently get two different answers from the same note.

**The versioned-derived-set boundary is stated two ways.** note-model's derivation-version rule enumerates "the title, the tag-set, the preview" — a rule change bumps the version and forces a Projection-only re-derivation pass. storage-and-sync's pass recomputes "title / tags / preview / FTS", and its state-tiering names `notes_fts` in the Projection tier. So FTS is inside the versioned set under one document and outside it under the other; under the note-model reading, a tokeniser change leaves every FTS row stale with nothing to trigger the reprojection.

The consumers of the answer are unstarted and would each invent their own: **management-window** owns browse/search/filter/sort, and **agent-surface** owns the `list → read → reason` loop where search is the cheap step deciding whether a note gets opened at all. *(A third turned up during the session — note-window's link picker had already been specified as a title-search field before search existed. See Surface Agreement.)* This is the shape note-model named as its own worst failure — an invariant stated in one document and implemented in another is only as strong as the caller who remembers it, and its fix was moving enforcement to the layer every reader passes through.

### Inherited ground

Carried forward as working position, not reopened:

- **The index is a rebuildable projection.** Bundles are truth; `list` / search / filter / sort hit SQLite and never scan the filesystem; full content is read on-demand. (storage-and-sync, note-model)
- **`notes_fts` is FTS5 over `content.md`**, refreshed inline by the engine — sole writer — in the same transaction as the bundle write. No FSEvents in v1. (storage-and-sync)
- **Derived values are per-machine and never synced.** Version skew across Macs is accepted and self-healing. (note-model)
- **Identity rule for tags and titles**: NFC → full case fold → NFC; display preserves as-typed; content is never rewritten. (note-model)
- **Title matching for agents** is exact on the full derived label — no fuzzy, no substring — and ambiguity is the normal path `list → read → reason` exists for. (note-model)
- **Preview** is the title strip applied after the title line, plain text, single line, bounded ~200 chars at derivation. (note-model)
- **A derivation-rule change** bumps a version held separately from the schema version and triggers a background, resumable, Projection-only re-derivation pass that writes nothing to the store and never bumps `modifiedAt`. (note-model + storage-and-sync)
- **One engine, four thin clients** — note windows, menu-bar manager, CLI, MCP. (engine-architecture)
- **Safety posture**: a partial / unparseable / evicted bundle is marked *unresolved* and retried; `list` and search hit the projection so absent content bytes don't break browsing. (storage-and-sync)

### References

- Discovery map item `fumi.discovery.search-and-retrieval` (source: gap-analysis) — no discovery brief, no prior research
- `.workflows/fumi/discussion/storage-and-sync.md` — Read-Model Index, state tiering, re-derivation pass, safety posture
- `.workflows/fumi/discussion/note-model.md` — Derived tier, tag identity, title derivation and matching, preview definition, derivation version
- `.workflows/fumi/discussion/engine-architecture.md` — one engine, thin clients

---

*Subtopics are documented below as they reach `decided` or accumulate enough exploration to capture. The Discussion Map lives in the manifest.*

---

## Query Semantics

### Context

What text a query is matched against. Nothing stated it: storage-and-sync pins `notes_fts` as FTS5 over `content.md` and stops there. Everything downstream turns on the answer — tokenisation has nothing to normalise until the corpus is known, result ranking has nothing to rank, and the two unstarted consumers (management-window, agent-surface) would each pick their own.

Anchor case. A note reads:

```
Café notes #café #work
See the Q3 deck — fumi://asset/01H8XK3QRT9Z…   (chip renders "budget-final.pdf")
```

The user types `café`. Which of these is a hit: the body word, the tag, the derived title, the attached file's name, the `fumi://` token?

*From: note-window · discussion · 2026-09-14*

Your corpus decision has one deciding argument, and note-window settled something today that removes its instance.

**What your corpus rule rests on.** The index holds what the user put there — a note's own `content.md`, plus each referenced asset's `originalFilename`, minus the `fumi://` URL targets, with link and image labels surviving. The attachment-filename half was not a tidiness choice: it is the whole decision's deciding factor, and it was argued from one concrete failure — the user reads *budget-final.pdf* on a chip inside a note, searches those words, and the note does not come back. Visible-but-unfindable, which reads as *search is broken* rather than *search doesn't do that*.

**Why that instance no longer exists.** note-window closed a gap nobody had noticed: nothing anywhere said what label is written into `content.md` when a file is inserted. note-model pins the content form as link syntax — `[report.pdf](fumi://asset/<id>)`, drawn as a chip (`note-model.md:353`) — while storage-and-sync's index-input decision states flatly that *"the filename is not in the note's text"* (`storage-and-sync.md:157`). Both could not hold, and the reason neither cited the other is that the fact they disagreed about belonged to note-window's insertion surface and had never been stated there.

It is stated now:

> Inserting a file writes its filename as the link label. The chip renders the label. `originalFilename` stays on the record as what the file *is* — what it reveals as in Finder, opens as, and drags out as — and is no longer what the chip reads.

Decided on your own shape, in fact: it is *inserting with no selection pre-fills the label* — note-window's answer to the empty-label question you handed it two days earlier — applied to the other token type, on the same reasoning that a token whose visible text is derived from elsewhere is a token whose words exist nowhere in the note's own bytes.

**So the chain that produced the failure is broken at its first link.** The filename is in `content.md` as the link label; your corpus rule already keeps link labels; the text the user reads on the chip is therefore already indexed by the general rule, with no manifest pull involved.

```
your argument      chip shows "budget-final.pdf"
                   → that text is not in content.md
                   → search misses it
                   → pull originalFilename into the row

now                chip shows "budget-final.pdf"
                   → because that IS the link label, in content.md
                   → the label-survives rule already indexes it
```

**The ask — does `originalFilename` still belong in the corpus?** Two readings, and note-window has no standing to pick:

- **Drop it.** The deciding failure mode cannot occur, and the pull is the one input that reaches outside `content.md` — which is what forced storage-and-sync to state the rebuild pass's inputs defensively as a rule rather than a file list (`:172`, `:261`), precisely so a corpus change could not silently strand it. Dropping it collapses that whole complication.
- **Keep it, for a narrower job.** The label is ordinary content, so it is editable — note-window accepted that consequence explicitly: rename a chip to *"the deck"* and the note's text no longer contains `budget-final.pdf`, while the file still reveals and opens under that name and a user may well search for it. The pull would then be covering divergence between the label and the file's real name, which is a smaller and different job than the one it was written for — and *"what the user put there"* arguably cuts against it, since the user is the one who renamed it.

Either answer is consistent with note-window's decision; the chip behaves identically under both.

**One thing that does change regardless: the empty-label exception's remaining instance is now agent-only for both token types.** You priced the empty-label note-link pill on frequency, and note-window's picker decision made it reachable only by an agent emitting a bare reference. The same now holds on the asset side: a chip whose label came from the manifest is gone as a shape, and a bare or unlabelled asset token is likewise an agent artefact rather than an ordinary human path.

*A parallel concern has gone to storage-and-sync for `notes_fts`'s input path and the rebuild pass, which your `:185` sibling check leaves theirs. This one is the corpus rule itself.*

*From: storage-and-sync · discussion · 2026-09-15*

You hold a concern from note-window reporting that your corpus decision's deciding failure mode — the user reads *budget-final.pdf* on a chip and searches it and gets nothing — cannot occur for an unedited chip any more, because inserting a file now writes its filename into `content.md` as the link label. It laid out two readings and picked neither: drop `originalFilename` from the corpus, or keep it for the narrower job of covering a chip whose label the user has since renamed.

The parallel half of that concern came to storage-and-sync, which owns the input path — what the refresh reads, per your own `:185` sibling check that settled the corpus rule as yours and the input path as ours. **It has now been decided here, and the decision forecloses the "keep it" reading rather than leaving it open**, which is why you are being told rather than left to find it.

**What was decided (2026-09-15).** `notes_fts` no longer reads the assets manifest. Its corpus is `content.md` alone, with the `fumi://` URL targets stripped and link and image labels kept — the general rule, with no second input.

**The argument that carried it, which is not the one note-window's entry offered.** Their "drop it" reading rests on redundancy — the deciding failure cannot occur, so the pull is doing nothing. That is true but weak: a redundant input is cheap, and it would not on its own have justified reversing a decision. What decided it here is that on the "keep it" reading the pull stops being redundant and becomes actively wrong:

```
user renames a chip's label to "the deck"
  note's text now contains:  "the deck"
  note's text does NOT contain:  budget-final.pdf

  with the pull:   searching "budget-final" returns this note
                   user reads it top to bottom — the word is nowhere in it
```

That is the original failure inverted — findable-but-invisible instead of visible-but-unfindable — and it is the same property that decided your corpus rule in the first place: what you read, you can search, and nothing matches on text you cannot see. A relabel is an authorship act; indexing the name the user replaced is indexing what they took out. **"The index holds what the user put there" reads against the pull once the label is the user's own text**, which your own entry noted in passing ("*'what the user put there' arguably cuts against it, since the user is the one who renamed it*") without weighing it.

**The cost, accepted here and yours to accept or reject:** a user who renames a chip loses filename search for that file. They still have the visible label to search by, and the file still reveals, opens and drags out under its real name — so nothing about the file is lost, only one query term for it.

**What did *not* change here, deliberately, against note-window's expectation.** Their entry suggests that if the pull goes, the defensively-stated rebuild-pass input goes with it — *"the rule those two exist to protect goes with it"*. It does not. The pass is still defined as drawing **whatever the corpus rule names**, not `content.md` by name; the corpus simply happens to resolve to one file again. That formulation is what stops the next corpus change stranding the pass silently, and it cost a reader one hop. Removing it because the corpus narrowed would re-arm exactly the trap it was written for.

**What you owe, and what you do not.** The corpus rule is your decided text and it still names `originalFilename` as a second input; that sentence is now false on the ground. Your document needs the corpus restated without it. Nothing else of yours is touched — the authorship principle, the `fumi://` strip, the kept external URLs, the separate search derivation version, and history search's deduplicated blocks all stand exactly as decided.

**If you reach the opposite answer**, say so and route it back: the input path here follows the corpus rule, so a corpus that keeps `originalFilename` re-instates the manifest read and the two defensive sites revert to their earlier wording. Nothing has been built, and the reversal is a wording change at four sites in storage-and-sync.

### Journey

**The opening instinct was "all of them — everything else is part of the body anyway."** Correct for four of the five, and the exception is the interesting one.

*(Reading note, 2026-09-15 — the three paragraphs below record the ground as it stood on 2026-09-12, when nothing said what label a file insertion writes. note-window settled that on 2026-09-14 and the filename is now in the note's text; the current corpus rule is the dated entry at the head of the Decision below.)*

**The filename is not in the body.** `content.md` holds `fumi://asset/<id>` and nothing else; the original filename lives in `meta.json`'s assets manifest as `id → {originalFilename, addedAt}` (`storage-and-sync.md:560`), and a non-renderable asset's chip renders that stored filename (same line). So the user drops `budget-final.pdf` into a note, reads "budget-final.pdf" on a chip inside that note, searches `budget-final`, and gets nothing. Nobody files that as a bug; they conclude search is broken.

**The mirror problem: things in the body the user never typed.** `fumi://asset/01H8XK…` and `fumi://note/<uid>` are machine addressing. Index `content.md` verbatim and searching `fumi` returns every note holding an attachment or a link, and `note` does too. The *label* on a link — `[Q3 planning](fumi://note/…)` — is the user's own words and must stay findable.

So the stored file is wrong in both directions at once, and the question underneath is not "which fields" but **what the searchable text *is*.**

### Options Considered

**A — `content.md` verbatim.** Simplest; matches what storage-and-sync already wrote; nothing can accidentally fall out of the index.
- Cons: attachments unfindable by name; scheme and ULID noise findable.

**B — the note as the user made it.** `content.md` plus each asset's `originalFilename`, minus the `fumi://` URL targets (labels kept).
- Cons: the index takes a second input, so it must refresh when an asset is added or removed, not only when content changes.

**C — A now, filenames as a follow-on.**
- Cons: trains the user that attachments are unsearchable, and reversing it later means re-indexing every note.

### Decision

#### 2026-09-15 — revised

*Trigger: triage from note-window: "The corpus's deciding failure mode cannot occur for an unedited chip" — inserting a file now writes its filename into the note as the link label, so the words on a chip are the note's own text and the failure the manifest pull was bought to prevent can no longer occur.*

> **The index holds what the user put there, and that is now the note's own text alone.** Corpus = `content.md` minus the `fumi://` URL targets. Link and image labels are kept, and so are external `https://…` URLs. **The assets manifest is not read** — an asset's `originalFilename` is no longer an input to the index.

- **The deciding factor was an instance, and the instance is gone.** The whole corpus decision turned on one failure: the user reads *budget-final.pdf* on a chip inside a note, searches those words, and the note does not come back. note-window settled on 2026-09-14 that inserting a file writes its filename as the link label and that the chip renders **the label**, so that text sits in `content.md` and the label-survives clause above already indexes it. Nothing is fetched, and the failure cannot occur for a chip nobody has edited.
- **What the pull would still cover is a rename, and the rule's own test rules against it.** A label is ordinary content, so a user can type *the deck* over *budget-final.pdf*; the file underneath still reveals, opens and drags out under its real name. Keeping the pull would make that note answer to a word appearing nowhere in it — and *the index holds what the user put there* now points at *the deck*. The test that admitted filenames is the test that removes them.
- **The corpus becomes a function of the note's own text.** The manifest pull was its one input that was not `content.md` — inside the same bundle, but a second reader every refresh and every rebuild had to carry. Dropping it makes *what you can read, you can search* hold in both directions: nothing matches on text the reader cannot see, which is the visible-but-unfindable failure inverted. **This inversion, not redundancy, is what carries the reversal** — storage-and-sync's phrasing, reached independently the same day and adopted here: with the pull kept, a note relabelled *the deck* still answers a search for *budget-final*, and the user opens it to find the word nowhere on the page. A redundant input would be cheap and would not justify reversing a decision; an actively wrong one does.
- **Rejected — keep it for the narrower job.** Covering the user who renamed a chip and then searches the file's real name is a genuine recall; it costs the corpus its single-input property and keeps a second reader of the assets manifest alive on every rebuild path. **The frequency it turns on was assumed, not established** — the reading taken is that renaming a chip *and* later reaching for the original filename is an uncommon compound. If relabelling turns out to be an ordinary habit, that assumption is what to re-examine; the inversion argument above would still have to be answered separately.
- **Accepted cost:** renaming a chip loses filename search for that file, the label the user chose standing in its place.
- **Two filename-specific rules retire with the pull, and nothing replaces them.** *Filenames are drawn per referenced id, not per manifest entry* had one job — closing the window where a deleted chip's name lingered in the index; the label leaves `content.md` with the chip, so removal closes itself with no rule. The same goes for the history corpus's mirror of it. **Everything else in the block below stands unchanged**: the `fumi://` strip and the backlink cost it creates, the kept external URLs, and the empty-label exception, now on the terms in the bullet above.
- **The empty-label exception is now agent-only on both token types.** A chip labelled from the manifest has stopped existing as a shape, so — exactly as with the note-link pill — a bare or unlabelled asset token is an agent artefact rather than an ordinary human path. The frequency the exception was priced on holds for both.

*Sibling check: note-window — its decided text holds that inserting a file writes its filename as the link label, that the chip renders the label, and that `originalFilename` stays on the record as what the file *is* — what it reveals as in Finder, opens as, and drags out as; adopted as written, and it is what carries this. storage-and-sync — its decided text reached the same answer on the input path the same day, dropping the manifest read and restating `notes_fts`'s corpus as `content.md` alone, on the argument that a renamed chip would otherwise stay findable by a word appearing nowhere in it; it defers the corpus rule itself to this document, and this decision settles it in agreement. Their second concern confirmed the match on the one point they expected divergence: the rebuild pass still draws whatever the corpus rule names rather than `content.md` by name, kept on both sides because it guards the next corpus change rather than the last. note-model — its decided text holds the non-renderable asset's content form as `[label](fumi://asset/<id>)` and the assets manifest as metadata *about* assets rather than the record of which exist; neither is revised, and the manifest keeps every reader but this one.*

#### Initial

> **The index holds what the user put there.** Corpus = `content.md`, plus each asset's `originalFilename` from the assets manifest, minus the `fumi://` URL targets. Link and image labels are kept, and so are external `https://…` URLs.

- **Deciding factor: the visible-but-unfindable failure.** Searching for a word you are looking at, and getting nothing, is the one failure mode a user reads as "search is broken" rather than "search doesn't do that". A ULID nobody typed is only reachable by someone querying `fumi` or `note` by accident — a much smaller cost than the one A pays.
- **The principle is authorship, not visibility.** The first pass reached for *"what the note shows"*, and it fails immediately on external links: note-window renders an `https://…` link as *"link text with the URL concealed"*, hover showing the target (`note-window.md:1485`), so a concealment rule would strip the URL. But the user pasted that URL, and *"which note did I save that link in?"* — sometimes with the domain as the only thing they remember — is a real query. Authorship covers all three calls with one test: the user typed the external URL (in), named the file (in), and never typed a ULID the picker wrote for them (out).
- **The refresh cost of the added input is close to free on the add path.** An asset add is a bundle write, and storage-and-sync already has the engine refreshing FTS inline on any note change, in the same transaction as the bundle write.
- **Rejected — C, defer filenames.** The follow-on is not additive in the way deferrals usually are: shipping A trains the user that attachments are not searchable, and a later reversal has to re-index every note to undo it. The cost of doing it now is one extra field read at derivation.
- **Rejected — a concealment rule ("the index holds what the note shows").** Strictly consistent, one sentence, and it takes the external URL out with the ULID. Superseded by authorship above.

**A cost this decision creates, settled as a cost** *(resolves review-001 F1)*. Stripping `fumi://note/<uid>` targets removes the only place a note-to-note reference is queryable. The asset case survives the strip — storage-and-sync ref-counts `fumi://asset/<id>` for GC, so that structure exists — but note links have no equivalent: note-model:389 states outright that for a `fumi://note/<uid>`, *"nothing is ref-counted"*, and note-model:1355 records note links as soft UID references with no enforcement or cascade. So *"what links to this note?"* has no answer anywhere in the product.

> **Search does not answer it, and the obvious workaround is rejected.** Leaving note-link targets in the index would make a UID query return referrers — but it would match a UID written inside a code fence as readily as a live link, so it cannot tell an actual reference from an example of one. A wrong answer to *what links here* is worse than no answer.

The capability itself is wanted — the user's call: the manager should be able to show a note's referrers, and deleting a note should be able to warn what points at it. That needs a structure the engine maintains, not a text index, and its surface is the organiser's. **Rerouted to management-window**; nothing about the corpus rule changes.

*(An earlier draft of this block asserted the backlink capability survived the strip via ref-counting. False for note links — struck.)*

*Sibling check: management-window — no session yet; its map remit is the organiser (browse / search / filter / sort, Recently Deleted), which is where a referrers view belongs. note-model — its decided text holds note links as soft UID references with no enforcement or cascade and nothing ref-counted; a referrers view reads references, it does not enforce them, so nothing there is revised.*

**One accepted exception, eyes open** *(resolves review-001 F2)*. note-window's note-link rule holds that a pill shows the label as written and *"fall[s] back to the live title only when the label is empty"*. So an empty-label link — `[](fumi://note/<uid>)`, reachable from an agent emitting a bare reference, or an insert made with nothing selected — renders the **target's** title as text that exists in neither this note's `content.md` nor its assets manifest, with the URL target stripped. The user reads *Q3 planning* on a pill inside the meeting note, searches those words, and the meeting note does not come back. It is the same visible-but-unfindable failure the corpus rule was written to eliminate.

> **Accepted. The index does not reach into another note.** Pulling the target's derived title into the linking note's row makes one note's searchability a function of another note's first line: renaming *Q3 planning* would have to re-index every note linking to it. Every other input to a note's index row lives inside that note's own bundle, and this is the only candidate that would break that — a cross-note refresh trigger bought for a corner case.

**What would reopen it**: how often an empty-label link actually occurs. If the link picker writes the target's title in as real text at insert time, this is confined to agent-emitted links and is negligible; if the picker leaves the label blank, it is the common path and the trade above is being made on the wrong frequency. That is note-window's to answer — routed there as a question, not as a request to change anything.

**The corpus draws filenames only for what the note currently references** *(resolves review-001 F3)*. The user deletes a chip; the file is gone from the page; searching its name still returns that note. The add path closes because attaching a file rewrites the note and the index refreshes on note writes — but removal does not: storage-and-sync collects unreferenced assets on **a sweep never triggered by a write**, with a 24-hour young-asset grace, so the refresh that runs when the chip is deleted reads a manifest that still lists the file and puts the name straight back.

> **Filenames are drawn per referenced id, not per manifest entry.** Removal then closes itself — the token leaves `content.md`, the note rewrites, the id is no longer referenced, and the name drops in the same transaction. The second refresh trigger Option B was charged with stops existing: the index becomes a function of the note's content plus a lookup keyed by what that content references, which is what the rest of this topic already assumes.

**Accepted, and it is the right reading:** for the window between deleting a chip and the sweep collecting it, the file is still on disk and still recoverable through version history, but unfindable by name. It is not in the note any more, so it should not answer as though it were. Whether a *retained version* that still references it is searchable is a different question and a different corpus — see Searchable Corpus.

- **This is a third reading of content, not a reuse of the existing strip.** note-model's title/preview strip removes inline tags from a mixed line and skips code fences whole; both are deliberately *kept* here — a tag is how the user labelled the note, and a code fence is exactly the thing worth finding. Title, preview and search are three readings of the same bytes with three different rules, and the search rule is this document's to own.

*Sibling check: storage-and-sync — its decided text holds `notes_fts` as an FTS5 index over `content.md`, refreshed inline by the engine in the bundle-write transaction, and its assets manifest as the filename's only home in a sync-off store. This widens what feeds that index; it does not move the index, its owner, or its refresh point. Owed to them as a corpus amendment.*

*Sibling check: note-model — its decided text holds that assets are referenced by `fumi://asset/<id>` tokens which are never rewritten or removed, and that title and preview are derived readings of content. Nothing here revises either; this adds a third reading alongside them.*

---

## Searchable Corpus

### Context

Which *records* a query runs against, as distinct from which *text* within a record (Query Semantics). Fumi holds four kinds: live notes, soft-deleted notes in Recently Deleted, version snapshots, and conflict candidates. Only the first is obviously in.

### Version history — in, behind a switch

**The moment.** Two of them, and they cost differently. *"I deleted a paragraph from this note and want it back"* — the user is already in the note, and a find-within-history covers it by scanning that one note's snapshots on demand, no index at all. *"I wrote that somewhere and deleted it, no idea which note"* — only a search across all history answers it.

**The first position was note-scoped only, and it was wrong.** The argument against global history search was size: storage-and-sync measured that retention defaults to Forever and a note worked on ~200 days a year accumulates roughly that many snapshots, a working session collapsing into one rather than one per edit (`storage-and-sync.md:950`). So history looked like hundreds of documents per note against its one live one, on a machine-local index that is rebuilt from bundles whenever a derivation rule changes.

**The user's challenge dissolved it: that figure is the count of snapshots, not the amount of distinct text.** Successive snapshots of a note are near-identical. Indexing the *union of distinct blocks a note has ever contained* rather than one document per snapshot makes the cost live text plus everything ever deleted from it — bounded by everything ever typed into the note, not by the snapshot count. Deduplicating near-identical revisions is a solved problem, not a research risk. The size objection was an artefact of assuming one index document per version, and it does not survive being stated.

### Decision — version history is searchable, off by default

> **A switch on the main search area — *include history* — widens the query to every note's version history. The history corpus is the set of distinct text a note has ever held, not one document per snapshot.**

- **Deciding factor: the expensive-looking cost was a modelling artefact.** Once history is indexed as distinct content rather than per-version documents, the *"somewhere, no idea which note"* recovery — the one moment a note-scoped find cannot serve, and the one where search earns its keep — costs roughly what the deleted text weighs.
- **Off by default.** Everyday search is *"where is that note"*, and history hits would crowd it. The switch is the user saying they are recovering something, not browsing.
- **Results are one row per note, marked as a history match** — *Q3 planning · in history* — never one row per matching version, and **carrying no version count** *(revised 2026-09-12, resolves review-002 F3 — see below)*.
- **Rejected — note-scoped find-in-history only.** Free, and it covers the recovery the user can name a note for. Dropped because it cannot answer the *"somewhere"* case at all, and that case is why this reaches search rather than staying inside version history.

**The rebuild cost — answered, not carried.** The index is disposable and rebuilt from bundles when a derivation rule changes, and storage-and-sync's re-derivation pass is defined as re-reading each `content.md`, so history is not in its scope. **The history index rebuilds as a separate, slower background job**, rather than growing that pass. See Index Availability, which takes background indexing as the general rule for every corpus, live notes included.

#### What a history hit surfaces — the note, never a version *(resolves review-002 F3)*

The first draft of this decision said results collapse to *"Q3 planning — 3 older versions match"* with click-through to the matching version. Two things were wrong with it, and the second killed the first.

**The mechanical objection.** A count of matching versions, and navigation from a hit to the version holding it, both require knowing which snapshots each indexed block came from. Deduplicated text does not carry that. Worse in the same direction: retention purge deletes version records, and with no block-to-version mapping nothing tells the index which text just became unreachable — **text the user set a retention period specifically to destroy would stay queryable**.

**The UX objection, which is the one that decided it.** A search term is often present in *every* version of a note. Forty rows for one note is not a result list.

> **A history hit surfaces the note, marked as a history match. No version count, no click-through-to-version from global search.** Finding *which* version holds the text is a step taken inside that note's own history, where a scan is cheap because it is one note.

- **The marking is not optional.** A note can match on text the user has since edited out, so an unmarked row sends them into a note where the phrase they searched for is not present. The user opted into history explicitly, so the marker is a reminder of their own switch rather than an explanation.
- **This removed the provenance requirement rather than satisfying it.** Surfaceable provenance was only ever needed for the row now deleted. What dedup still needs is a **count per block of how many live versions contain it** — and purge maintains that with no stored mapping at all, because when it deletes a version it holds that version's text: block it, decrement, drop anything reaching zero.
- **Rejected — index every note and every version in full, no dedup.** Simpler, and it makes purge trivial (delete the version's document). Dropped on size, which was dedup's only job: with the provenance requirement gone, dedup is *easier* than when it was first argued for, not harder.

#### Attachment filenames in history *(resolves review-002 F4)*

Query Semantics forwarded this question by name — *"whether a retained version that still references it is searchable is a different question and a different corpus"* — and the history decision, defining its corpus as *"distinct text"*, said nothing about assets either way. The forward reference landed on nothing.

The user deletes a chip; the file survives because a retained version still links it; they turn on *include history* — the switch that exists for exactly this recovery — and search the filename.

> **It matches. Filenames are drawn per referenced id for the history corpus too — the same one-sentence rule, applied to the ids each historical block references.**

- **The GC ref-count already lines the two up.** storage-and-sync keeps an asset while **any** version links it and collects it when the last link drops, so a filename is in the manifest for precisely as long as a version referencing it is retained. There is a name to draw exactly when there is a version to draw it for.
- **Purge stays in step with no special case.** Retention purges the last version holding the reference, the link drops, the asset is collected, and the name stops matching — the same moment the text stops matching.

*(Amended 2026-09-15 — this block's subject is gone. The corpus no longer draws filenames from the assets manifest at all (Query Semantics, revised the same day), so there is no per-referenced-id filename rule for the history corpus to mirror. **The recovery still works, and now for the ordinary reason**: the filename is the chip's link label, the label is text in the block, and the history corpus is distinct text. The two bullets above are left as the record of why the special case was thought necessary — the GC ref-count alignment was only ever needed to justify the pull.)*

**Scope note, recorded deliberately.** History search is **purely additive** — the corpus rule, both switches, the tokeniser rule and the freshness rule all stand unchanged whether or not the history index exists. Shipping without it costs a background job and a switch to add later, with no re-index of live notes and nothing for the user to unlearn. It is therefore **the first thing to drop if v1 needs scope back** — deliberately unlike the attachment-filename decision in Query Semantics, where deferral would have trained users wrongly and forced a re-index.

### Deleted notes — in, behind their own switch

> **A second switch — *include deleted* — widens the query to notes in Recently Deleted.**

- **Why not follow `list`.** note-model has the read-model filtering soft-deleted notes out of the plain listing into a Recently Deleted view, which makes exclusion the consistent read. Consistency with `list` is the wrong master here: a listing shows you what you have, and the whole job of search is finding what you cannot see. A phrase you remember writing is exactly the thing you would search for without first remembering you deleted the note it was in.
- **Off by default**, for the same reason history is: everyday search is *"where is that note"*.

**The two switches are orthogonal, which is what makes them two rather than one** *(settled by derivation — the two widen different dimensions; no product choice in it)*. *Include deleted* widens the **set of notes** searched; *include history* widens the **text within each note** searched. They compose without ambiguity in all four states — history alone searches everything live notes have ever held; deleted alone searches the current text of deleted notes as well; both searches everything. A deleted note's own snapshots are reached only with both on, since the note itself must be in scope before its history is.


### Conflict candidates — both sides searchable *(resolves review-002 F1)*

> **A conflicted note is searched on both of its texts. The hit is flagged conflicted.**

The third of this subtopic's four kinds, and neither switch reached it — a candidate is not a version snapshot and its note is not deleted, so it was out by omission.

- **Deciding factor: the discontinuity after resolution.** On resolving, storage snapshots the losing candidate into history unconditionally, so those words become findable under *include history* the moment the conflict is resolved and are findable nowhere before it. That is backwards — the point at which the user most needs to see both wordings is while deciding between them.
- **Rejected — search the surviving side only.** Its argument is note-model's rule that a conflicted note keeps **singular derived values**, one title and one preview, which search could follow. It does not hold: singular is about the note appearing *once* — one row, one UID that still resolves. Searching both sides yields one hit on one note, not two notes.


## Index Availability

### Context

What search does while the index is not yet complete — on a first launch after install or restore, on a second Mac whose library is still arriving, and after a derivation-rule change forces a reprojection. The index is machine-local, disposable and rebuildable, so every one of these is a normal state rather than an error.

*From: note-window · discussion · 2026-09-14*

The freshness decision below rests on a supporting claim about who writes — that the bundle write *"is the same event for a local edit, an agent write over the socket, and an inbound change applied from another Mac"*, so an agent's read-after-write is safe by construction. **The headline rule is untouched; the supporting claim over-generalises for one of the three writers.**

engine-architecture has since decided that mutations serialise per note and that an open note's editor buffer is the live copy, with *"every write to it go[ing] through the buffer whatever channel it arrived on"* — open notes route through the buffer, closed notes are written directly, *"genuinely two write paths"*. It reached that from the collision side: an agent write cannot be *write the bundle, then tell the window*, because the buffer can be ahead of the bundle at any instant, so whichever way it reconciled, someone's keystrokes or the agent's patch would be lost.

The two paths differ exactly where the claim assumes they do not:

```
note closed    agent appends a line → bundle write → index refreshed inline   → findable at once
note open      agent appends a line → the note's editor buffer                → findable at the autosave settle
```

Not a corner case: note-window's argument for its editor model is that a fumi's resting state is *open* — notes live on the desktop as furniture, close is hide — so the open path is the ordinary one for an agent writing to a note the user keeps on their desk. Read-after-write still survives, and for the reason given: the buffer is the live copy, so a read of an open note sees the write. **Search**-after-write on an open note is what does not.

The window is bounded: note-window pinned the cadence in the same sitting — partly because this decision made the interval user-visible — at a short idle settle (~500ms working value) with immediate flushes on blur, hide and close.

### Decision — indexing runs in the background and says so

> **Every index rebuild is a background job that never blocks the app, and the interface says the library is still indexing while one is running.** This is the rule for every corpus — live notes and version history alike.

- **The precedent is Spotlight**, and it is the right one: a Mac is usable while it indexes, search results are simply incomplete for a while, and the system says so rather than pretending. Nobody expects a freshly restored machine to search perfectly, and nobody is surprised by a notice that says why.
- **History rebuilds as its own job**, separate from and slower than the live-note pass, rather than being folded into storage-and-sync's re-derivation pass. That pass re-reads current content; walking every snapshot on the same path would make an ordinary rule change an expensive foreground event.
- **Consequence accepted: results are incomplete while a job runs**, and the notice is what makes that honest rather than broken.
- **Incremental updates outrank *backfill*.** While a global job is running, indexing a note the user just saved is done ahead of backfilling old history, so the note being worked on now stays findable at normal speed and the rebuild absorbs the delay. Without the rule the two compete and the everyday case loses to the rare one. **Backfill is the whole scope of the deprioritisation** *(sharpened 2026-09-12, resolves review-003 F5)* — a **newly created** version snapshot indexes on the ordinary path like any other incremental update, never behind it.

### Freshness — findable the instant it is saved *(resolves review-001 F6)*

The user types a sentence into an open fumi, switches to the manager, and searches a word from it. Underneath, an agent appends a paragraph over MCP and immediately searches for what it just wrote — a plausible loop, since an agent has no reason to wait.

#### 2026-09-14 — revised

*Trigger: triage from note-window: "An agent write to an open note is not a bundle write" — an open note's writes route through its editor buffer, so the bundle write is not the same event for all three writers and an agent's search-after-write on an open note can miss it.*

> **Anything saved is findable the instant it is saved. Text still in an unsaved editor buffer is not searchable.** *(unchanged)* **On an open note, a write is saved at the autosave settle rather than at the call — so an agent writing to an open note becomes findable then, not immediately.**

- **The rule holds; the writers are not one event.** What breaks is the generalisation, not the guarantee — *saved* simply means something different on the two write paths. A closed note is written to the bundle directly and the index refreshes in that transaction; an open note's write lands in the live buffer and reaches the bundle at the settle. The rule is still a single sentence about saving, and it still needs no per-writer freshness story — it just no longer claims the three writers share an event.
- **Read-after-write is unaffected**, and for the original reason: the buffer is the live copy, so a read of an open note sees the write whatever channel it arrived on. Only search waits.
- **The exposure is a design consequence, accepted, not a defect to build against.** It is bounded by note-window's settle (~500ms idle, immediate on blur, hide and close), it self-clears, and the agent's write call returned success — so a search that misses finds it on the next look. The one open edge is that the idle timer restarts on keystrokes, so a write into a note the user is typing into continuously stays unflushed while they type; note-window's flush points cover every moment they stop.
- **Rejected — flush the buffer on an agent write**, which would buy the guarantee back for every writer at roughly no cost (an agent write is a discrete external event, the same class as the blur/hide/close flushes, not keystroke traffic). Dropped because note-window weighed the adjacent call — flushing the buffer before any client read — in the sitting that raised this, and rejected it as *"real machinery bought for a sub-second window"*, noting that taking the opposite side would put the two documents at odds. Reopening a two-day-old deliberate call to close a self-clearing sub-second window is the wrong trade. **What would reopen it**: an agent loop that verifies its own writes by searching turning out to be common rather than incidental.

*Sibling check: note-window — its decided text holds autosave at a short idle settle (~500ms working value) with immediate flushes on blur, hide and close, records this same open-note consequence on its own side, and rejects flushing the buffer before any client read; all three are adopted and none revised. engine-architecture — its decided text holds mutations serialising per note, an open note's editor buffer as the live copy every write routes through, and closed notes written directly; cited as the reason the two paths differ, not revised. storage-and-sync — its decided text holds the index refreshing inline in the same transaction as the bundle write; unchanged, and it is the bundle write's timing that moved, not the refresh's.*

#### Initial

> **Anything saved is findable the instant it is saved. Text still in an unsaved editor buffer is not searchable.**

- **One rule covers all three writers.** storage-and-sync refreshes the index inline *in the same transaction as the bundle write*, and that write is the same event for a local edit, an agent write over the socket, and a change arriving from another Mac. So an agent's read-after-write is safe by construction rather than by timing, and no writer needs its own freshness story.
- **The unsaved buffer stays out.** Making the manager search an in-memory editor buffer is real machinery for a sub-second window. Consistent with note-window's rule that a previewed snapshot *"temporarily makes the buffer not the note"* — the buffer is not the note until it lands.
- **Non-blocking throughout**: an index update never holds up the write that triggered it.

### Unindexable notes — a count, not a permanent alarm *(resolves review-002 F5, review-003 F6)*

The note is in the list. The user searches a word they know is in it and gets nothing, today and next week — because its bundle's bytes never arrived or will not parse, and nothing about it is going to change until they do. Search says *no such note* about a note the user can see.

Storage's safety posture already covers browsing — a partial, unparseable, evicted or vanished bundle is marked *unresolved* and retried, and *"`list`/search hit the projection (so absence of content bytes doesn't break browsing)"* (`storage-and-sync.md:407`). But there is no content to index, so search cannot match, and the three cases the decision above was written for are all **jobs that finish**. An unresolved bundle is retried indefinitely with no job running, so the notice clears and the hole is silent and permanent.

**The first fix held the indexing state open** — *the incomplete-index state does not clear while any note remains unindexable* — and it was half right. Followed through, one unparseable bundle means the manager reads *still indexing* forever and every CLI and MCP answer carries *results may be incomplete* forever. **A notice that never clears stops being read, and a completeness flag that is always false carries no information** — the opposite of what each was for. *Still indexing* also describes work in progress, and a retry loop that never advances is not progress.

> **Indexing state ends when the indexing job ends. Notes that cannot be read are reported separately, as a stable count — not as ongoing indexing.**

- **A number, not a boolean.** The manager carries it quietly; the CLI/MCP system-state message carries the same figure. Both readers get something true and actionable-to-interpret rather than a standing alarm, and the agent can tell *nothing matched* from *two notes could not be read*.
- **It does not breach note-model's rule that a damaged bundle is never surfaced to the user as damaged.** *"Two notes aren't searchable"* is a fact about the index, not a diagnosis of the note — and it is one the user needs in order to read their own results.
- **The gap still never goes silent**, which was the first fix's whole point; it just stops impersonating a job.

### An answer declares its own completeness *(resolves review-002 F7)*

An agent searches for the meeting note during a post-restore rebuild, gets an empty result, and reports that there is no such note — or creates a second one. The user's Mac was showing the *still indexing* notice the whole time; the agent never saw a screen.

Two decisions above make this reachable rather than theoretical: incompleteness is accepted deliberately and bought honest with a **human-facing** notice, and Surface Agreement puts every caller through one facility — so the CLI and MCP receive the same incomplete answers with nothing attached that says so. agent-surface's error posture does not cover it either: a refusal is *"a code and a message"*, and an incomplete success is not a refusal.

> **A search answer carries its own completeness, to every caller.** The surfaces differ only in rendering: the manager shows the notice it already has; the CLI and MCP carry it in the response.

- **One state feeds both**, which is what stops the human notice and the machine signal drifting apart.
- **Not an error code.** Nothing failed and nothing should be retried differently; the result is true as far as it goes, and says how far that is.
- **On CLI and MCP it rides a system-state message rather than a lone flag** — the caller is told the state of the system it just queried, indexing among it, so an agent and a human reading the same output can both see that results may be incomplete. **The envelope's shape is agent-surface's**, not this topic's; what search declares is that this answer's completeness belongs in it. Routed there.


## Derivation Version Scope

### Context

A derived value is a function of content *and* of the code deriving it, so a rule change invalidates the projection while leaving the bundles untouched. note-model settled the mechanism: a **derivation version** held separately from the index's own schema version, a bump triggering a background, resumable, Projection-only re-derivation pass that writes nothing to the store and never bumps `modifiedAt`. Two things about search's place in it were unsettled, and the corpus decision above made both sharper.

**The scope was stated two ways.** note-model's rule enumerates the values a change reprojects as *"the title, the tag-set, the preview"*. storage-and-sync's pass recomputes *"title / tags / preview / FTS"* (`storage-and-sync.md:198`) and its state-tiering names `notes_fts` in the Projection tier invalidated by a bump (`storage-and-sync.md:196`). On note-model's reading a tokeniser change reprojects nothing and every search row stays wrong indefinitely.

**The pass's input list is now wrong either way** *(raised by review-001 F4)*. *(Historical from 2026-09-15 — the second input was dropped; see the amendment on the decision below.)* It is defined as re-reading each `content.md`. Since Query Semantics the search corpus also draws each referenced asset's `originalFilename` from the assets manifest, so a pass reading content alone rebuilds search rows **without filenames** — not stale rows, wrong ones — on every note the user has not since edited. The user ships an update that fixes accent matching and silently loses attachment-name search.

### Decision — search carries its own derivation version

> **The search index is separately versioned from title / tags / preview, and a rebuild draws whatever the corpus rule names — not `content.md` by name.**

- **Deciding factor: search is plainly its own reading now.** Query Semantics established a third reading of a note with its own rules and its own inputs, deliberately different from the title/preview strip. Coupling its version to theirs means every search tweak drags a full recompute of values that did not change — visible to the user as how long the app spends reindexing after an update.
- **note-model's enumeration stays true exactly as written.** That is a benefit of separating rather than an accident: its three named values remain the set *its* version covers, and no amendment is owed there.
- **The input list is stated as a rule, not a list of files.** A rebuild reads whatever that corpus rule names, so a future corpus change cannot strand it again — the failure here was a pass naming its input by filename while the corpus rule moved underneath it.

  *(Amended 2026-09-15 — the instance that raised this is gone: the corpus dropped the manifest pull the same day, so a pass re-reading `content.md` alone would now be correct. **The rule-shaped statement is kept deliberately** — it exists to stop the *next* corpus change stranding the pass, not the last one, and storage-and-sync kept it on the same ground when they dropped the read. The separate search derivation version is untouched; it never rested on the second input.)*
- **Rejected — one version for every derived reading.** Simpler to hold in the head, one counter, and it forces note-model's enumeration to be amended from three named values into a general statement. Dropped because it makes the common case (a search tweak) pay for the rare one.
- **Accepted cost:** two version counters rather than one.

*Sibling check: storage-and-sync — its decided text puts `notes_fts` inside the Projection tier a single derivation-version bump invalidates, and defines the re-derivation pass as re-reading each `content.md` to recompute title / tags / preview / FTS. Both are revised by this: FTS leaves that pass for its own separately-versioned job, and the search rebuild's inputs are the corpus rule's, not `content.md` alone. Owed to them as an amendment. note-model — its decided text holds the derivation version separate from the schema version, the bump triggering a background resumable Projection-only pass that never bumps `modifiedAt`; all of that is adopted unchanged, and its three-value enumeration is left true rather than widened.*

## Surface Agreement

### Context

Four surfaces retrieve notes, and three of them wanted different matches before this topic existed *(raised by review-001 F5)*:

- **The manager** — browse / search / filter / sort over the whole library.
- **The note-link picker** — note-window decided it as *"a title-search field over notes plus a results list"*, choosing the target *"by searching notes by title"*, explicitly *"reus[ing] the manager's search capability as a component"*. Title-scoped and incremental.
- **The agent surface** — note-model's rule is exact on the **full derived label**, with *"no fuzzy or substring matching"*, because ambiguity is resolved by the `list → read → reason` loop rather than by the app guessing.
- **The CLI**, which is the agent surface wearing a different coat.

Three matching behaviours with nothing saying whether they are three settings of one thing or three things people built. The picker's was settled in another topic before search existed — the precise shape this topic was opened to prevent.

### Decision — one facility, three modes

> **Search is one facility taking a scope and a match style. Every surface calls it; no surface implements its own matching.**

| Caller | Scope | Match style |
|---|---|---|
| Main search (manager) | the full corpus, plus whatever *include deleted* / *include history* admit | last token as a prefix, preceding tokens whole-word |
| Note-link picker | derived titles only | prefix, narrowing as you type — **forgiving** normalisation, as main search |
| Agent / CLI — finding text | the full corpus, the same two widenings available as parameters | as main search |
| Agent / CLI — resolving a name it holds | the full derived label | exact — unchanged from note-model |

*(Table corrected 2026-09-12, resolves review-002 F2 — it originally carried a single `Agent / CLI by name` row, conflating **resolving a reference the caller already holds** with **finding text it has never seen**. An agent asked "what did I write about the Q3 budget?" had nothing to call, leaving it to list the library and open notes one at a time — the expensive path this topic exists to prevent — or to invent its own matching, which is the divergence it exists to stop. The widenings were also written as switches "on the main search area", so nothing said an agent could reach history or Recently Deleted at all; agent-surface has decided an agent can `restore`, so it could undelete a note it had no way to find. **The two widenings are parameters of the facility; the search field's switches are how a human sets them.**)*

- **Deciding factor: divergence is the failure this topic exists because of.** If each surface grows its own matching, they drift apart on accents and case exactly as the tag rule and the body index currently do. One facility means **one tokeniser** under every mode, and the agreement is structural rather than a convention every future caller has to remember.
- **One tokeniser, two normalisations — by design** *(corrected 2026-09-13, resolves review-003 F4 — this read "one tokeniser and one normalisation under all three", which the table on this page already contradicted: the exact row is unchanged from note-model, which is a second normalisation, and Tokenisation later made the two provably different on `café`/`cafe`)*. The **forgiving** normalisation serves humans typing — main search and the link picker; the **exact** one serves a machine resolving a name it already holds. Typing `cafe` into the picker **does** surface *Café notes*: it is a person looking for their own note, which is precisely the situation the accent-insensitivity argument was made about, whereas the exact mode answers a different question with a definite answer or an honest ambiguity.
- **Main search reacts per keystroke.** `bud` already lists *Budget Q3* and every note containing "budget"; `q3 bud` finds notes with "Q3" and something starting "bud". Matching the last token as a prefix and everything before it whole-word is what every search field on the machine does, and it is what the picker was already given.
- **The agent's exactness is not an inconsistency to fix.** A human narrowing a list wants forgiveness; an agent resolving a name wants a definite answer or an honest ambiguity it can loop on. Different callers, deliberately different modes, one implementation.
- **note-window's picker decision stands as written** — it is this facility's title mode, not a separate feature.

*Sibling check: note-window — its decided text holds the link editor as a title-search field over notes with a results list, no UID and no `fumi://` surfaced, reusing the manager's search as a component; that is adopted as this facility's title mode and nothing there is revised. note-model — its decided text holds agentic name resolution as exact on the full derived label with no fuzzy or substring matching, ambiguity being the normal path for `list → read → reason`; adopted unchanged as the exact mode.*

**Still open here**: the query *language* — phrases, operators, whether `tag:` or colour filters are typed into the same field or live as separate controls. See Query Syntax.

## Tokenisation And Normalisation

### Context

The one live *defect* on this topic's board rather than an undefined area. note-model pins tag identity — and agentic title matching — at **NFC → full case fold → NFC**, chosen because a derived value each Mac computes independently diverges without it, and because full folding (not simple) is what makes `#straße` and `#STRASSE` one tag rather than two. FTS tokenisation is a fourth reading of the same content and inherits none of that by anything written down.

### Measured, not reasoned about

Run on this machine, SQLite **3.51.0** (system `sqlite3`; cross-checked on Python's bundled 3.53.4 — same results):

```
sqlite3 :memory: "CREATE VIRTUAL TABLE t USING fts5(x); CREATE VIRTUAL TABLE v USING fts5vocab(t,'row'); INSERT INTO t(x) VALUES ('Café notes #café #work straße 🔥 https://example.com/foo'); SELECT group_concat(term,' ') FROM v;"
```
→ `cafe com example foo https notes straße work`

Four results, two welcome and two defects:

- **`#` is a separator, so a tag indexes as its bare text.** What makes *"search finds tags"* work for free, as Query Semantics assumed — now verified rather than hoped.
- **A URL splits into its parts** (`https`, `example`, `com`, `foo`), so the domain-recall argument that kept external URLs in the corpus actually pays out.
- **Accents are stripped by default.** `Café` and `#café` both index as `cafe`, and `cafe` matches them. *Looser* than tag identity, which normalises but keeps the accent — so `#café` and `#cafe` are two tags but one search term.
- **`straße` stays `straße`; `STRASSE` finds nothing.** SQLite does **simple** case folding where note-model deliberately chose **full**. Search is *stricter* than the filter beside it.
- **Emoji produce no token at all.** `🔥` is absent from the term list entirely, so `#🔥` — which note-model explicitly allowed, on the grounds that Fumi is a visual product and people use emoji as markers — is unfindable.

### Journey

**The framing in the Context was half wrong, and measuring it is what showed that.** The defect was stated as *search and tag-filtering disagree*. They do, but disagreement is not itself the problem: the two are different operations. Filtering by a tag is picking a label you know exists; searching is guessing at text you half-remember. A search box that finds more than you literally typed is doing its job.

What is wrong is that they disagree in **both directions unpredictably** — looser on accents, stricter on `ß`, and totally absent for emoji.

### Decision — search may be looser than tag identity, never stricter

> **The invariant.** A query must never return fewer notes than filtering on the equivalent tag would. Forgiveness beyond that is allowed and wanted.

This blesses the accent behaviour and makes the other two defects, without needing a case-by-case ruling on each future divergence.

- **Search is accent-insensitive** — `cafe` finds *café*. Requiring a user to produce `é` to find their own note is the strictness that makes people conclude search is broken, and the invariant permits the looseness. **Rejected: match tag identity exactly** (normalise, full-fold, keep the accent) — one rule across the whole app, at the cost of `cafe` no longer finding *café*.
- **A knock-on that removes a worry.** With accents stripped, the two ways a Mac can encode `é` collapse to the same token, so the per-machine divergence note-model's NFC rule guards against cannot bite the index. Under the rejected option it would have, and normalisation would have had to be stated explicitly.
- **Emoji are indexed, compound emoji as single units.** A skin-tone modifier, a ZWJ family, a keycap and a flag each index as one token rather than being split or dropped.
- **Full case folding is required of the search reading too**, forced by the invariant: `STRASSE` must find `straße`, because the tag filter would.

**The two fixes do not cost the same, which is worth knowing before planning** *(measured)*. Emoji are reachable by **configuration** — FTS5's `unicode61` takes a `categories` argument, and admitting the symbol and modifier categories both indexes emoji and keeps compound sequences intact:

```
python3 - <<'PY'
import sqlite3
d = sqlite3.connect(':memory:')
d.execute("""CREATE VIRTUAL TABLE t USING fts5(x, tokenize="unicode61 categories 'L* N* Co So Sk Cf Me Mn'")""")
d.execute("INSERT INTO t(x) VALUES (?)", ('#🔥 #👨‍👩‍👧 #1️⃣',))
d.execute("CREATE VIRTUAL TABLE v USING fts5vocab(t,'row')")
print([r[0] for r in d.execute('SELECT term FROM v')])
PY
```
→ `['1️⃣', '👨‍👩‍👧', '🔥']` — whole sequences. With the narrower `So` alone the family splits into three tokens and the keycap degrades to a bare `1`, which would also make `#1️⃣` answer a search for `1`.

**Full folding is not reachable by any tokeniser setting** — none of `unicode61`, its diacritic variants, or `trigram` matched `STRASSE` against `straße`. It needs a fold applied to the indexed text and the query, or a custom tokeniser. Which of those is the implementer's call; that the requirement exists is this decision's.

## Query Syntax

### Context

What the user may type into the field, as distinct from what it is matched against (Query Semantics) and how it is matched (Tokenisation).

### Measured, not reasoned about

FTS5's own query language is not a superset of plain text — most of it is *operators*. Passing a user's input to `MATCH` unescaped, on this machine (SQLite 3.51.0):

```
python3 - <<'PY'
import sqlite3
d = sqlite3.connect(':memory:'); d.execute('CREATE VIRTUAL TABLE t USING fts5(x)')
d.execute('INSERT INTO t(x) VALUES (?)', ('Q3 draft budget C++',))
for q in ['budget', 'budget: Q3', 'Q3 (draft)', 'C++', '"unbalanced', 'a-b', 'NOT budget']:
    try: print(repr(q), '->', d.execute('SELECT count(*) FROM t WHERE t MATCH ?', (q,)).fetchone()[0])
    except Exception as e: print(repr(q), '-> ERROR:', e)
PY
```

| typed | result |
|---|---|
| `budget` | 1 |
| `budget: Q3` | **ERROR** — no such column: budget |
| `Q3 (draft)` | **ERROR** — syntax error near "Q3" |
| `C++` | **ERROR** — syntax error near "+" |
| `"unbalanced` | **ERROR** — unterminated string |
| `a-b` | **ERROR** — no such column: b |
| `NOT budget` | **ERROR** — syntax error near "NOT" |

Hard errors, not empty results. A colon, a bracket, a hyphen, a plus. **And Surface Agreement decided main search reacts per keystroke** — so typing `"budget` throws an error on every keystroke until the quote is closed. Exposing the raw syntax is not an option that survives contact with a search field.

### Decision — literal text, plus quoted phrases, and nothing else

> **What the user types is literal text: tokenised exactly as note content is, the words ANDed, the last one as a prefix. The single exception is `"a quoted phrase"`. An unterminated quote is treated as literal text, so typing never errors.**

- **Deciding factor: phrase search is the one thing users reach for that no control can replace.** `"annual review"` against two common words scattered across a note is a different query, and there is no filter that expresses it. Everything else on offer — boolean operators, prefixes, column syntax — duplicates what a control does better.
- **Everything else is a control, never typed.** Tag, colour, *include deleted*, *include history*. Consistent with Surface Agreement's ruling that the two widenings are parameters of the facility and the search field's switches are merely how a human sets them.
- **Rejected — no syntax at all.** Nearly right, and it loses phrase search with nothing to replace it.
- **Rejected — a fuller language (`tag:`, `AND`/`OR`/`NOT`, prefixes).** More power, at the cost of teaching a syntax; it also reintroduces the error class above at exactly the moment the user mistypes it. Against the do-one-thing-well positioning.
- **`C++`, `a-b`, `budget:` and an unclosed bracket all just work** — they are text. This is the whole point of the rule and the reason it is stated as *literal by default* rather than as a list of escapes.


## Result Shape And Ranking

### Context

The user searches `budget` and five notes come back. What each row carries, and what order they are in.

### Decision — the matching text, ordered title-first then newest-first

> **A result row shows the matching text in context, not the note's stored preview. Results are ordered title matches first, then body matches, each newest first.**

**On the row's content.** `list` already has a payload — UID, derived title, tags, colour and a preview — and reusing it would be the cheap choice. It is the wrong one: note-model derives the preview from the *top* of the note for browsing, so a search row could show a preview with the query term nowhere in it, which reads as a wrong result rather than a correct one described badly. A search row and a browse row answer different questions — *why did this match* versus *what is this note* — and the preview was designed for the second.

- **A history match's snippet comes from the version that matched**, not the live note, which is consistent with the row being marked as a history hit and is the only honest thing it can show.
- **This interacts with the fold required by Tokenisation.** Full case folding has to be applied to the indexed text and the query; a snippet must nevertheless come back in the note's original casing. That is an argument for the fold living in a tokeniser rather than in a pre-pass over the text, since a tokeniser preserves offsets into the original. Noted as a consequence for the implementer, not a decision here.

**Two hit types have no text to quote** *(resolves review-003 F1)*:

- **A filename match.** The query matched an attachment's name, which is not prose in the note — there is nothing to snippet. **The row names the attachment**: the match is the chip, so the chip is what it shows.

  *(Amended 2026-09-15 — the premise is gone and the hit type with it: an attachment's name is the chip's link label, which is text in the note, so a filename match snippets like any other body match with the chip's label as the matching text. Nothing special is needed and nothing special is drawn. See Query Semantics, revised the same day.)*
- **A conflicted note.** One row, two texts. **The snippet comes from whichever side matched — the live side when both did.** The conflicted flag already says there is another version behind it, so the row does not try to show both.

**Results are paginated, and the total is reported** *(resolves review-003 F2)*. Ordering settles what a person scrolling sees; an agent has no scroll, so without a bound a query over a large library returns every hit at once — hundreds of rows for the caller to triage, which is the expensive path this topic exists to shorten reappearing at the other end.

- **Paginated, not truncated.** A first pass proposed a bounded response carrying the match total and no way to continue, reasoning that an agent seeing *25 of 400* should narrow its query rather than walk the list. **That argument is about how an agent should behave, and it was wrongly allowed to decide what the interface can do** — narrowing stays the sensible default, and exhaustive tasks (tag every note mentioning X) simply fail against a bound with no continuation. Pagination serves both.
- **The page mechanics are agent-surface's**, because `list` needs identical treatment and the shape belongs to the response envelope rather than to search — the same split as the system-state message. What search declares is that results are paginated and the total is reported; where the cursor is specified is theirs.
- **The human surface needs no bound of its own** — scrolling is the same walk, driven by the view.

**On the order.** Three candidates:

- **Relevance scoring (bm25).** The standard answer and a poor fit: it substantially measures document length, and fumis are short and wildly uneven — a two-line note and a two-page note are both ordinary.
- **Newest first, only.** Predictable, and defensible for working material where the note touched yesterday is usually the one wanted. Ignores match quality entirely, so a title match can sort below an incidental body mention.
- **Title matches first, then body matches, each newest first.** *Chosen.*

- **Deciding factor: it is the only one that can be described in a sentence and have the user predict the order.** It needs no weights to tune, no scoring to explain when it surprises someone, and it encodes the single thing relevance scoring would have got right — that a note *called* Budget beats a note that mentions a budget.


---

## Summary

### Key Insights

1. **Search is a third reading of a note, not a reuse of an existing one.** note-model's strip serves the title and the preview; both remove inline tags and skip code fences whole. Search deliberately keeps both — a tag is how the user labelled the note, a code fence is exactly the thing worth finding. Three readings of the same bytes under three rules, and conflating any two of them produces a defect.
2. **Authorship, not visibility, is the test for what belongs in an index.** The first attempt — *what the note shows* — was strictly consistent and failed on external URLs, which are concealed but deliberately saved. *What the user put there* settles filenames (in), external URLs (in), and machine-written ULIDs (out) with one test rather than three rulings. *(Amended 2026-09-15 — the filename ruling has since reversed, and the same test is what reversed it: once inserting a file writes the filename into the note as the link label, a manifest pull covers only a label the user has since renamed, and what they put there is the new name. The insight is stronger for it — one test answered the same question twice and moved when the ground under it did. What made the reversal decisive rather than merely permitted was stating the property in **both** directions: what you can read you can search, *and* nothing matches on text you cannot see. The pull failed the second half.)*
3. **An invariant beats a ruling per case.** *Search may be looser than tag identity, never stricter* blessed the accent behaviour, condemned the `ß` behaviour and condemned the emoji behaviour without any of the three being argued separately — and it will settle the next divergence nobody has thought of.
4. **Measuring changed the question, not just the answer.** The topic opened believing the defect was *search and tag-filtering disagree*. They do, and it is fine: filtering picks a label you know exists, searching guesses at text you half-remember. The real defect was disagreeing in **both** directions — looser on accents, stricter on `ß`, silent on emoji.
5. **Removing a requirement beat satisfying it.** The version-count result row looked like it needed block-to-version provenance the deduplicated history index could not carry. Deleting the row — because a term present in every version of a note produces an unusable result list — removed the requirement instead, and left a refcount the purge can maintain from the version it is already deleting.
6. **A capability's cost is not where it looks.** History search read as a size problem until the size objection turned out to be an artefact of assuming one index document per snapshot; it then read as a surfacing problem until surfacing collapsed to one rule. What it actually costs is a separate rebuild job.
7. **Two fixes that look alike can differ by an order of magnitude.** Indexing emoji is a tokeniser *setting*. Full case folding is reachable by no setting at all and needs a fold over the indexed text and the query, or a custom tokeniser. Worth knowing before either is planned.

### Open Threads

Nothing deferred — every subtopic reached a decision. What is outstanding is consequences owed to other topics, each delivered with its full context:

- **management-window** — *what links to this note?* has no answer anywhere now that link targets are out of the index; the referrers view and a delete-time warning are the organiser's to decide.
- **note-window** — whether the link picker ever writes an empty-label link. **This one can reopen a decision here**: the accepted unfindable-pill exception was priced on that case being rare. *(Answered 2026-09-14: the picker now pre-fills the label with the target's derived title at insert, so an empty-label pill is agent-only. The frequency the exception was priced on holds — it does not reopen; the accepted cost now covers the agent-emitted case alone.)*
- **note-window** — autosave cadence is now the delay between typing a word and finding it. *(Answered 2026-09-14: a short idle settle, ~500ms working value, with immediate flushes on blur, hide and close. It came back with a consequence — an open note's writes route through its editor buffer, so an agent's write to an open note is findable at the settle rather than at the call. Folded into Index Availability → Freshness.)*
- **note-window** — the version-history panel has no find, and this topic's result-row decision delegates *which version holds the text* to it. **This one can reopen a decision here** too, if the panel should not carry a find. *(Answered 2026-09-14: the panel gained a find over that note's own history — a third corpus mode of this facility, same tokeniser and same forgiving normalisation, differing only in corpus. The delegation holds and nothing here reopens.)*
- **storage-and-sync** — the FTS corpus is wider than `content.md`; and `notes_fts` leaves the shared derivation-version pass for its own. *(Amended 2026-09-15 — the corpus is no longer wider than `content.md`: the manifest pull went with the revision to Query Semantics, so nothing on the corpus side is owed them. The derivation-version split still is.)*
- **status-and-alerts** — what surface says the library is still indexing, in an app with no guaranteed window. *(Sent while the state was pinned open indefinitely; that has since been revised — indexing ends when the job ends and unreadable notes are reported as a count — so what reaches them is a finite job plus a standing figure.)*
- **agent-surface** — a CLI/MCP response carrying system state, index completeness among it; and the pagination envelope, which `list` needs identically.

**Scope lever, recorded deliberately**: history search is purely additive and is the first thing to drop if v1 needs room. Nothing else here is.

### Current State

**Resolved** — what a query is matched against; how text is tokenised and normalised, and where that must not diverge from tag identity; which records are searchable and behind which switch; what may be typed into the field; what a result row carries and in what order; which surface gets which mode; when a change becomes findable, and what an answer says when the index is incomplete; and how a rule change reprojects the index.

**Uncertain** — nothing structural. The two routed concerns flagged as able to reopen a decision here were both answered by note-window and neither did; a third, unflagged, did — their insertion rule put the filename into the note's own text and the corpus dropped the manifest pull on 2026-09-15. Two implementation routes are deliberately left open because either satisfies the decision: whether full case folding lives in a custom tokeniser or a fold over the indexed text and query (the snippet requirement leans towards the tokeniser), and whether the history index is maintained as deduplicated blocks with a refcount or as full per-version documents (deduplication was chosen on size; the requirement is only that a purge stops the purged text matching).

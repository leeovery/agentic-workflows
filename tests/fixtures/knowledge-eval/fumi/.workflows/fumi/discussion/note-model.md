# Discussion: Note Model

## Context

What a *fumi* is at the data level — the core noun the whole product is built around. A fumi is a Markdown body with a stable per-note UID. The title is derived (first non-empty line, Markdown-stripped, truncated), not a stored field; titles are optional and not forced unique. Tags are a multi-valued optional filter axis parallel to Spaces. Colour is an independent per-note visual property. Agentic addressing resolves ambiguity by list → read → reason.

Discovery already reached soft decisions on most of this (see brief). This session's job is to ratify those, pin down the details that were left open, and surface anything discovery missed before the model is treated as settled.

### References

- [Discovery brief — note-model](../discovery/briefs/note-model.md)

---

*Subtopics are documented below as they reach `decided` or accumulate enough exploration to capture. The Discussion Map lives in the manifest.*

---

## Content Format

### Decision

Content is Markdown, and the `.md` file holds **nothing but content**. No YAML frontmatter, no embedded state of any kind — *"Markdown is not for storing state."* The title is part of the content (the first line), not a separate field.

### Rationale

- Single source of truth for the human GUI and the agent surface.
- **Separation of concerns** — content and state are different things; state never belongs in the content file. Stands independent of any portability goal (it also avoids write-churn and matches the two-bucket model).
- RTF/rich text rejected in discovery: predates Markdown, adds nothing here, awkward for the scripting surface.

Confidence: high — user was categorical ("we won't be using front matter").

### The format serves Fumi, not other tools

External readability is **not a goal** (this *retracts* the earlier "point it at Obsidian" framing). A synced/backed-up store is *accessible* — Dropbox/iCloud can hold the files — but that is for **backup/sync, not a portability contract**. Notes are meant to be read and rendered **through Fumi**; if they happen to open cleanly elsewhere, that's a bonus, never a constraint. Consequences:

- We're free to **extend the format with Fumi-custom syntax** to make features render perfectly, without caring how they look in other tools.
- **Markdown stays the format** — great base, great tooling, single source of truth — but by *preference, not obligation*; the format is Fumi's to shape. (The "we could even store binary" line was hyperbole to make the point, not a plan.)
- **Answers review F7** (intended level of external-tool interaction): external tools are not a supported read/edit workflow — the store is Fumi's. Also **defuses F1** (external-rename orphaning): hand-editing `{uid}.md` in Finder isn't a workflow we design around.

---

## Markdown Dialect

### Decision

**GFM (GitHub-Flavoured Markdown) is the base**, extended freely with Fumi-custom syntax where a feature needs it. GFM because task-lists (already committed as interactive checkboxes) require it and it's a well-understood, well-tooled superset of CommonMark. Rendering fidelity is **Fumi's concern only** (see *The format serves Fumi* above) — we own the format.

**Math delimiters are an admitted extension** *(2026-08-05, resolves review-006 F6)*: inline `$…$` and display `$$…$$`. They are a third category this statement didn't have — neither GFM nor Fumi-custom, but a widely-implemented convention outside CommonMark (Pandoc, GitHub, Obsidian, MathJax). Worth admitting explicitly rather than leaving implied by note-window's rendering decision, because **every derived value here is a reading of content**: a delimiter the dialect doesn't admit is a delimiter the derivation rules don't know to skip — which is precisely the gap this finding caught. Rendering is note-window's; the **recognition rule is shared**, and the derivation rules must use the same delimiter constraints the renderer does (see Title Derivation).

### Note-to-note linking

Represented as a **standard Markdown link with a custom protocol**: `[label](fumi://note/<uid>)` (unified `fumi://` scheme — see Non-Text Content § in-content reference syntax).

- Keys off the stable **UID**, never the title (honours "title ≠ identifier").
- Human-readable label; the `fumi://` scheme is Fumi's to resolve.
- The *representation* is reserved now (costs nothing); the *feature* — hover spawns a peek of the linked note to the side, click opens it — is an interaction that belongs to **note-window** and is deferred there. The model simply doesn't preclude it.
- **Referential integrity — soft, no enforcement** *(review-002 F6)*: links are soft UID references. A **soft-deleted** target still **resolves and opens** (it exists — flagged as in Recently Deleted, with restore); a **hard-deleted** target is a **dangling reference** shown "unavailable" (non-destructive). No cascade-delete, link-rewriting, or delete-blocking — a target may return (restore / re-sync from another Mac). The deleted/unavailable *visuals* (colour to distinguish soft vs hard delete, hover-shows-state, open-even-when-deleted) are note-window's — rerouted.

**Wikilinks `[[…]]` rejected** — non-standard and tempt title-as-identifier; the `fumi://uid` link is cleaner and UID-keyed. Their only edge was resolving inside Obsidian, and cross-tool rendering is no longer a goal.

### Parked

- `#tag` behaviour + tag-click → **Tags** subtopic. Parallel worth carrying: a note-link *opens* a note; a tag-click will *filter/peek* — define it there.

Resolves review F4 (dialect undefined).

---

## Non-Text Content

### Decision — a fumi is a bundle (container), not a flat file

A fumi is a **package/bundle** identified by its UID — **`{ulid}.fumi/`** holding `content.md` (the text spine) + `meta.json` + `assets/` (media & attachments). *(Originally written as a bare `{uid}/`; storage-and-sync amended it to `{ulid}.fumi/` — an opaque macOS package marked **by extension**, because the bundle bit is dropped by iCloud/Dropbox/zip/copy while an extension is part of the name and travels. See Identity & UID.)* Very Mac-native (mirrors **RTFD**, TextEdit/Stickies rich text). Enabled by the "format serves Fumi" retraction — we no longer need a flat folder of browsable `.md` files, so a note being a package costs nothing.

**Bonus — resolves the parked metadata-home question:** intrinsic (the Note tier) state can ride *inside* the bundle (e.g. a `meta.json` sibling to `content.md` — still separate from content), travelling atomically with the note; machine-local (the Machine tier) state stays in the central non-synced store. So the two buckets get two natural homes: **the Note tier → in the bundle; the Machine tier → central local store.** (Physical layout still storage-and-sync's to finalise.)

### Supported content

- **Text (Markdown)** — the spine.
- **Images** — pasted/dropped, rendered inline.
- **Animated GIFs** — render and animate.
- **Diagrams via Mermaid** — ` ```mermaid ` blocks render to diagrams (text → picture, so agent-authorable).
- **Math (LaTeX)** — inline `$…$` and display `$$…$$` render as equations. *(Added 2026-08-05, resolves review-006 F6 — note-window landed math as a content type after this list was written, judging that "the note model is unchanged… same shape as Mermaid". Mermaid is on this list, so the analogy argues for carrying math rather than omitting it: like Mermaid it is text → picture, and therefore agent-authorable.)*
- **Code blocks** — fenced code renders syntax-highlighted.
- **Emoji** — Unicode, works for free.
- **Attachments (Excel/PDF/zip/…)** — *carried, not previewed*: shown as a **chip/badge** (icon + name) that opens in its native app on click. The agent can still act on the reference ("there's a P&L attached"). *(Amended 2026-09-15 — this read "icon + filename". The name the chip draws is the **link's label** in `content.md`, written as the filename at insert and editable thereafter; see* A chip's name is the link's label *under In-content reference syntax.)*

Resolves review F5 (non-text content was silently excluded).

### Asset identity — a ULID, globally unique *(2026-08-03, resolves review-005 F3)*

The `<id>` in `fumi://asset/<id>` was used throughout without ever being specified — conspicuous next to note identity, which got a whole subtopic and an argued choice.

**Decision: a ULID, globally unique, opaque, minted when the bytes are copied into `assets/`.** The same scheme as note identity, chosen for the same reasons — filename-safe, collision-safe under offline creation on several Macs, case-insensitive-filesystem-safe, and time-ordered as a bonus.

**Why global rather than bundle-scoped.** A bundle-scoped id (an ordinal, or a name unique only within `assets/`) is shorter and locally sufficient, but it is **meaningless without knowing which bundle you are standing in** — so a token carried from one note into another by an ordinary copy-paste silently addresses *a different file*. Globally-unique ids make that stray token either resolve or dangle, and dangling is a state the model already handles non-destructively (**missing**, never rewritten or removed). Resolving *wrongly* is the one outcome with no recovery, and scope is what decides whether it can happen.

**Rejected: content-addressing (an id derived from a hash of the bytes).** Tempting — it deduplicates identical files for free. But it makes the same bytes in two notes **one asset**, so deleting the chip in note A drops a ref-count that note B depends on, and the ref-counting rule stops being a per-note statement. It also makes the id unstable under any re-encode of visually identical content. Deduplication is a storage optimisation; identity is not the place to buy it.

**Consequences, each following from the choice rather than needing its own rule:**

- **`original_filename` stays a label, not an identifier** — it already is one in storage-and-sync's per-asset child record. Renaming it breaks nothing, because no token keys off it. *(Amended 2026-09-15 — this read "a **display** label", which since 2026-09-14 names the wrong thing: what a chip displays is the link's label in `content.md`. `originalFilename` is what the file reveals, opens and drags out as. Still a label rather than an identifier, which is all this bullet ever turned on.)*
- **A restored version's tokens keep resolving.** An older `content.md` carries ids minted when it was written; nothing about the id derives from state that changed since, so restore needs no rewriting — consistent with the standing rule that tokens are never rewritten.
- **The same file dropped into two notes is two assets, stored twice.** Named rather than left to be discovered. This is the cost of self-containment, already accepted when copy-only beat link/alias: a duplicated screenshot costs a few hundred KB and buys a bundle that always travels intact.

*Sibling check: storage-and-sync — its per-asset child record carries `originalFilename` / `addedAt` and is keyed by the asset id. Nothing here revises that record; this pins what the key is. (Amended 2026-08-09 — the record also carried an `excluded` flag, struck when they made the ceiling a hard limit. The key is unaffected.)*

### Placement & linkage (decided — copy-only)

**Every asset is always copied into the bundle's `assets/`.** No linking/aliasing (dropped for v1 — see below). A fumi is therefore **self-contained**:

> **Every asset a fumi renders is owned by that note and stored in its bundle, and it travels, backs up, and resolves on every Mac. Nothing it depends on lives outside, under anyone else's control.**

*(Reverted 2026-08-09 — storage-and-sync ratified the hard limit, so no asset can exist whose bytes are absent from a Mac, and the availability clause is true again without exception. The 2026-08-03 restatement narrowed the invariant to **ownership alone** to accommodate `excluded`; with that state deleted at source there is nothing left to accommodate, and the invariant holds in its stronger availability-and-ownership form. Its argument survives the revert and is kept below, because it — not the availability claim — is what carries the URL-fallback rejection.)*

~~*(Restated 2026-08-03, resolves review-005 F5. This read "every asset travels, backs up, and resolves on every Mac" — an availability claim the `excluded` case below contradicts, since an oversized asset deliberately does **not** travel. Self-containment was never really about every byte reaching every Mac; it is about **ownership** — where an asset lives and who can change it. `excluded` satisfies that: the bytes are in the bundle, on the Mac that added them, with a record that syncs saying so. What is absent is transport, not ownership.)*~~

*The ownership reading is what keeps the URL-fallback rejection below standing, and it is the stronger of the two arguments: a remote URL's bytes sit on someone else's server and can change or vanish with nothing in Fumi knowing. "These bytes are at home, just not on this Mac" and "these bytes are somebody else's" are different failures, and only the second breaks the invariant. The asymmetry was never arguable on availability alone — a 50 MB video absent from this Mac is **less** available than a URL that usually loads. That the availability clause now also holds adds a second guarantee; it does not replace this one.*

Remote/pasted-URL media (e.g. a Giphy link) is **fetched and copied** into `assets/` too, so a note stays self-contained and works offline.

*Sibling check: storage-and-sync — its Asset Storage decision of 2026-08-09 holds that the per-asset size ceiling is a hard limit refused at every entry route, with no `excluded` state and no record without bytes. This revert discharges the conditional this document wrote against that ruling; nothing there is revised.*

**When the fetch fails** *(resolves review-003 F17)* — offline at paste time, a 404, an auth-walled URL. The self-containment invariant is load-bearing (it is why copy-only beat link/alias), so it must not acquire an exception *(2026-08-03 tightened this to "an **ownership** exception" because the `excluded` transport case contradicted the plain form; reverted 2026-08-09 with `excluded` — there is no transport exception either, so the unqualified wording stands again)*:

> **A failed fetch produces no asset.** The paste degrades to **ordinary Markdown content** — the URL as a plain link.

**An asset exists only when its bytes are in hand.** Nothing ever claims to be an asset without being one, so the invariant stays absolute rather than becoming "absolute except while pending". The user gets a visible, editable link where an image was expected, and can re-paste when online. Transient and permanent failures need no distinguishing — both degrade identically.

**Retaining the original URL as a fallback reference is rejected** — it reintroduces precisely the non-self-contained asset that killed link/alias for v1, and fails on the same axis: a URL resolves differently, or not at all, on another Mac at another time.

**A "pending" asset that retries on reconnect is also rejected.** It preserves the intent, but adds a third state on top of present/missing *(written when the states were present/excluded/missing; the count changed 2026-08-09, the objection did not — a state whose whole meaning is "not yet" is the problem, whatever it is added to)*, needs a retry queue and permanent-failure handling, and turns a 404 into a promise the app can never keep. It also cuts against the grain set elsewhere in this topic — the same *no-magic* reasoning that settled the fitted-note resize.

**The oversized case is a fetch failure like any other** *(inverted 2026-08-09 — storage-and-sync ratified the hard limit)*. A remote resource over the ceiling is **refused at the fetch**: no asset is created, and the paste degrades to the URL as a plain Markdown link, identically to offline-at-paste or a 404. This needs no rule of its own — the ceiling is enforced at **every** entry route and a remote fetch is one of them, so the failed-fetch rule above simply covers it, with a different cause. It also removes what used to be the one apparent counter-example to *"an asset exists only when its bytes are in hand"*: an over-ceiling fetch does hold the bytes momentarily, and now they still produce no asset. ~~*Previously: "The oversized case is not a fetch failure" — an over-ceiling resource fetched successfully, became a normal asset, and landed as `excluded` (record syncs, bytes stay local), the invariant's one transport exception.*~~ *(A locally-dropped file that fails to copy — disk full, permissions — is an ordinary error, not a degradation.)*

*Whether the failure is announced (a transient toast) or simply evident from a link appearing where an image was expected → **note-window**.*

**Every asset is referenced by content — this is an invariant** *(resolves review-003 F10)*. An asset is dropped at the cursor and referenced in `content.md` via `fumi://asset/<id>`. Renderables (image/GIF/Mermaid) render inline; non-renderables (PDF/Excel) show as a **chip at the cursor**. There is no second kind.

~~*Originally a two-kind model: **in-body** (positioned, referenced in content) vs **note-level attachment** (carried, unpositioned, a footer-style chip — "simply an asset in the bundle not referenced by any `fumi://asset` token", so placement was **derived, not a stored flag**, with "only sliver of metadata: an order for note-level chips — likely just add-time").*~~ **The second kind is dead**, killed from both directions by decisions taken since:

- **storage-and-sync** made asset lifetime **ref-count by version-links** — *"keep an asset while **any** version links it; **GC when the last link drops**."* An asset referenced by nothing is, by that rule, **garbage**.
- **note-window** decided *"**Note-level attachments are dropped as a user-facing concept**… there is no separate footer/attachment area"* — the derived state survives in principle, but the GUI never deliberately creates it.

So the exact state this document called a feature is the state storage collects and note-window won't produce. Both topics already agreed; only note-model still described it.

**Nothing is lost by killing it.** The case it appeared to serve — *"I removed it but want it back"* — is answered better by note-window's delete rule: *"deleting a chip removes the reference, not necessarily the file. The asset survives while retained versions still link it, then is GC'd at retention."* Version history covers it; a limbo attachment state does not.

**Two loose ends close with it.** Placement stops being a derived two-way property — every asset is in-body, because an asset must be referenced to exist at all. And the dangling *"order for note-level chips"* attribute disappears: there is nothing left to order.

**One consequence worth stating rather than discovering later:** with retention **Off**, deleting a chip drops the last link immediately, so the asset goes straight away. That is storage-and-sync's retention model and note-window's delete UX, not note-model's — but it follows directly from the invariant.

#### Content transfer carries the bytes

##### 2026-08-30 — revised: a transfer mints once per source id, not once per token

*Trigger: review finding — the two ends of the paste axis were settled on 2026-08-10 (same note shares, another note copies), but the arrangement that combines them was never asked: a passage carrying the **same token twice**, pasted into another note.*

Both readings were supported by text in the entry below. The engine rule is written per **token** — *"a token naming an asset the destination bundle does not hold is materialised … **that one token** is rewritten to it"* — and after the first materialises, the second still names an id the destination does not hold, so it fires again. The same entry's headline is singular: *"Another note: a new id and a copy of the bytes."*

```
note A   "Q3 was rough.   ![chart](fumi://asset/01J9…)"
         "…and again:     ![chart](fumi://asset/01J9…)"
         assets/01J9….png                          ← one file, two tokens

              │  ⌘C both lines → ⌘V into note B
              ▼

note B   assets/01K2….png                          ← one file, two tokens
```

> **Materialisation mints once per *source id* per write. Tokens sharing a source id within one write share the destination id minted for it.**

**The destination is a bundle like any other, and that is what decides it.** The same-note ruling rejected exactly this picture — *"a bundle holds three copies of one screenshot, uploaded three times, for a note the reader sees as showing one image"* — and nothing about note B makes that outcome acceptable there and unacceptable in note A. A rule that flips on which side of a paste you are standing on is a rule with no statable reason behind it.

**The cost is a map that lives for one write.** The scan already walks the incoming content; it now carries source id → minted id for the duration of that walk and discards it. The 2026-08-03 bullet argued against machinery here, but what it was refusing was a **ref-count** — persistent, per-reference bookkeeping that outlives the operation. A lookup that exists only while a single write is in flight is not that, and per-token minting's saving is the map alone.

**One consequence stops being route-dependent.** *"Anything that ever acts per-asset — replacing an image, renaming the stored `originalFilename` — reaches both chips at once"* was stated for the same-note case. It now holds in the copy too, which is what a reader would assume from looking at note B.

**The narrower reading is the one adopted, deliberately.** This does **not** assert *one bundle holds one asset per distinct bytes* — that invariant is false here and stays false: *"the same file dropped into two notes is two assets, stored twice"*, and two separate drops of the same file into one note are two deliberate acts and two assets. The rule is about a **single transfer**, where one source asset is being carried once however many tokens point at it.

*Sibling check: storage-and-sync — its asset lifetime is ref-counted by version-links (*"keep an asset while any version links it; GC when the last link drops"*), which is indifferent between the two readings: two tokens in one body are two links in one note either way. Nothing there is revised; this changes how many assets a transfer creates, not how their lifetime is counted.*

##### 2026-08-30 — revised: duplication is a conditional rule, not a shipped route

*Trigger: review finding — three clauses here describe duplicating a note as an operation that exists, two of them written on 2026-08-10, four days after note-window decided Fumi ships no Duplicate command.*

**Settled by derivation** — not discussed. Determined by note-window's *no Duplicate command* decision of 2026-08-06 and its own caveat that a duplicate shipped elsewhere later inherits this rule for free (review-009 F2).

> **Fumi ships no note-duplication surface in v1. Every clause here about duplicating a note is a *conditional* — the rule any duplication route must satisfy if one is ever built — never a description of something a user can do.**

**Nothing about the asset rules changes**, which is why this is a reframing rather than a decision. The carriage invariant is enforced at the engine's write boundary on *any* write to `content.md`, so it already covers whatever routes exist now or later without this document naming them; the `originalFilename` / `addedAt` split stands exactly as written and simply has one fewer live caller today.

**What changes is what a reader is entitled to build.** The 2026-08-10 entry's *"one answer, two routes"* framing reads as two shipped operations, and a specification taking this document at its word would specify a duplicate-note command the product deliberately declined. Read correctly it is one shipped route — cross-note paste — plus a standing rule waiting for a route that may never arrive.

**The conditional is worth keeping rather than striking.** note-window's own carve-out names where duplication would land if it ever does — *"if management-window ever ships a duplicate in its note list, it inherits the same rule for free; that surface is theirs"* — and management-window has had no session yet. A rule already written for the case costs nothing and is the thing that makes the inheritance free.

*Sibling check: note-window — its 2026-08-06 decision holds that **Fumi has no Duplicate note command**, rejected on what a fumi is for (copy and paste already covers it) rather than on cost, with the self-containment invariant enforced at the engine's write boundary covering any route regardless. It struck its own duplicate clauses on that basis. Nothing here revises it; this propagates it.*

##### 2026-08-10 — extended: same-note paste, and what the materialised copy's record carries

*Trigger: a final-review pass read the 2026-08-03 entry's intra-note bullet against the 2026-08-05 materialisation trigger and found them saying opposite things about the same act; pinning that then exposed a second silence — the rule says a new id is minted and never says what else the new record holds.*

**Same-note paste shares one asset** *(resolves review-008 F1)*. The 2026-08-03 entry closed the intra-note case as *"pasting within one note duplicates the asset"*, argued on avoiding a per-reference ref-count. Two days later carriage moved into the engine, and the trigger it was given — *"a token naming an asset **the destination bundle does not hold**"* — is false within one note, so nothing is minted:

```
note A   "Q3 was rough.   ![chart](fumi://asset/01J9…)"
         "…and again:     ![chart](fumi://asset/01J9…)"    ← ⌘C ⌘V, same id
         assets/01J9….png                                   ← one file
```

> **Same note: one id, one file, two tokens. Another note: a new id and a copy of the bytes.**

The 2026-08-05 rule stands as written and the earlier bullet gives way to it, because *duplicating* is the behaviour that would need machinery here, not the behaviour that avoids it: draft by copying a passage three times and a bundle holds three copies of one screenshot, uploaded three times, for a note the reader sees as showing one image. The ref-count the bullet was defending against never arrives either — *"keep while any version links it"* is already a per-note count over content, and two tokens in one body are two links in one note.

**The asymmetry is worth stating rather than inferring**: *every ⌘V of a passage yields an independent asset* is not true, and never was after 2026-08-05 — same-note paste shares, cross-note paste copies. Note duplication is the cross-note shape and is unaffected.

**One consequence of sharing, since the id is the same object:** anything that ever acts per-asset — replacing an image, renaming the stored `originalFilename` — reaches both chips at once. Nothing of that kind is decided, and it sits on the record rather than in content, so it is a property to know rather than a problem to solve. *(Amended 2026-09-15 — this read "it is **display** metadata rather than content". `originalFilename` is not displayed: the chip renders the link's label, which is content and is per-token, so renaming the record changes what **both** chips open and reveal as while their two labels stay independent. The consequence stands; what it reaches is narrower than the wording implied.)*

---

**What the materialised copy's record carries** *(resolves review-008 F5)*. The rule enumerated three effects — *"the bytes are copied in from wherever they live, a new id is minted, and that one token is rewritten to it"* — and stopped there. The new asset also gets a **record**, carrying `originalFilename` and `addedAt`, and nothing said whether those are inherited from the source or minted fresh. Both answers are defensible and they are visibly different:

```
note A   assets/01J9….pdf     record: originalFilename "Q3-accounts.pdf"
                                      addedAt          2026-06-14
              │  ⌘C ⌘V into note B
              ▼
note B   assets/01K2….pdf     record: originalFilename  ?
                                      addedAt           ?
```

> **`originalFilename` is inherited. `addedAt` is stamped at copy time.**

**They split because they answer different questions.** The filename describes **the file**, which did not change in the copying — so a materialised PDF keeps the name it reveals and opens under, and the alternative gives a note a chip it cannot launch even though `[Q3-accounts.pdf](fumi://asset/01K2…)` travelled intact in the text. *(Amended 2026-09-15 — this read "keeps the name **its chip renders** and the extension it opens with … a chip it cannot **label or** launch". The chip labels from the link text, not from the record; the parenthetical here already assumed the label was in the text, which is what went stale in the wording rather than in the ruling. Inheritance is untouched and gets easier: on a cross-note paste the label travels as ordinary content and needs no carrying, while `originalFilename` is inherited for exactly the reason given — it is what the file opens and reveals as. See* A chip's name is the link's label *under In-content reference syntax.)* `addedAt` describes **this bundle's copy**, which is new — and reading it as *when the bytes were first seen anywhere* is the reading that breaks something concrete: storage-and-sync's sweep grants a **24-hour young-asset grace**, so an inherited June date would deliver a copy already outside its grace window, which is exactly the ordering hazard the grace was introduced to close.

**One answer, two routes.** Note duplication (*"duplicating a note duplicates its assets"*) asks the identical question, so this governs it too rather than acquiring a second rule.

**A consequence of the split, not a cost:** two notes can hold the same bytes under different ids with the same `originalFilename`. That is already the design — *"the same file dropped into two notes is two assets, stored twice"* — and the filename was never an identifier, so nothing keys off the coincidence.

*Sibling check: storage-and-sync — its per-asset child record is keyed by the asset id and carries `originalFilename` / `addedAt`, and its asset GC is a sweep never synchronous with a write, with a 24-hour young-asset grace. This says what a **copy's** values are; it does not change the record's shape, the sweep, or the grace period. The record's shape stays theirs.*

##### 2026-08-08 — revised

*From: note-window · discussion · 2026-08-06*

*Trigger: rerouted concern — the rule's third branch, where an id **resolves to a record** while its bytes are unavailable on this Mac.*

The 2026-08-05 entry left one edge open and said so. storage-and-sync's per-asset child record syncs even when its `CKAsset` does not, so an `excluded` (>50 MB) asset presents an id that resolves while the bytes stay on the Mac that added them. Copy a passage referencing one from a Mac without the bytes, and materialisation has nothing to copy — neither *"materialise it"* nor *"an id that cannot be resolved"* is written for that.

```
Mac 1                                  Mac 2 (this Mac)
  note A ── asset 01J9 (58 MB)           note A ── record 01J9, excluded ✓
            bytes here                             bytes not here
                                         ⌘C the passage → ⌘V into note C
                                         materialise: nothing here to copy
                                         note C: no asset, no record
```

note-window raised it while settling the visual treatment of absent assets, carrying a requirement rather than a design: **a pasted reference to an `excluded` asset must read `excluded`, never `missing`**. Their reasoning is this document's own — the table calls `missing` *"an error state, not a transport state"*, and their two-state treatment was designed on that frequency, so a paste reaching `missing` falsifies the characterisation and the pair stops meaning what both topics say. They also flagged that minting a **new** id on a failed copy would produce a token naming an asset with no bytes anywhere, unrepairable even by walking to the Mac holding the original; the existing *"left exactly as written"* already implies nothing is minted, so that was a clarification rather than a reversal.

**Decision: the case is removed at source rather than answered. Nothing over the sync ceiling enters a bundle at all.** The ceiling becomes a **hard limit**, applied at every entry route — drop, paste, remote fetch — and refused at the moment of the attempt instead of accepted-and-then-excluded. With no `excluded` assets there are no records without bytes, and this rule's two existing branches become complete as written: bytes in hand → materialise; id unresolvable → leave as written, render `missing`. The only remaining way an id resolves while its bytes are absent is a **damaged or partially-restored bundle**, which is already `missing`, already an error state, and already served by leaving the token untouched so a restore can return it.

**The cost, named rather than discovered later: a single-Mac user loses a capability.** Today an oversized file dropped into a note becomes a working local-only asset; under the hard limit it is refused, and with link/alias dropped for v1 there is no other route to referencing it — the file simply cannot go in a fumi. That is a real capability removed to serve a sync constraint that user does not have. Accepted on two grounds: the ceiling is a v1 constraint expected to lift, and accepting-then-excluding was never a clean capability either — it is a promise half-kept, since the file appears to work and then silently isn't there on the other Mac. A refusal at the moment of the drop is at least honest, and the user still has the file.

**One rule, whatever the sync state.** It is tempting to exempt a user with sync off, since the constraint that motivates the ceiling does not apply to them — and they are exactly the user the paragraph above costs. Don't: sync can be enabled later, and then the store either refuses assets already in it or reintroduces `excluded` by the side door. The limit holds unconditionally so the store is sync-ready at every moment.

**The number is deliberately left open, and the ceiling is not this topic's to set.** As a soft ceiling it was a judgement about what is practical to upload; as a hard refusal it becomes a product statement — *a fumi holds files up to X* — and may want to be a different, rounder figure. Rerouted to **storage-and-sync**, whose flag, placeholder and GC ownership rule this strikes. Lifting the limit afterwards (split uploads, or whatever lands) is **purely additive** — the same shape as deferring the `fumi://` scheme registration: every note already written stays valid and the limit simply relaxes, so there is no migration owed. Pre-launch there is no data, so the change costs nothing now and a migration later. *(Settled 2026-08-09 — **50 MB**, and it was never a choice: it is Apple's documented per-`CKAsset` maximum, so the product statement is a platform fact reported rather than a figure picked. Two caveats storage-and-sync recorded — the source table is in Apple's archived library, and an unattributed 250 MB figure circulates as a recommendation rather than a cap — so they verify it empirically at implementation and the ceiling lifts to whatever the real limit proves to be. Additive either way, as this paragraph already assumed.)*

~~**Fallback, if that topic keeps the ceiling soft: the paste produces text, not a reference.** The engine rewrites the token to plain Markdown built from the record it can still read — `original_filename` and the reason — so the destination holds a line of text and **no `fumi://` token at all** …~~ *(Unreachable from 2026-08-09 — storage-and-sync made the ceiling hard, so there is no record whose bytes can be absent and no paste that can reach this branch. Kept as history, not as a live alternative: the argument it rested on — the failed-fetch rule applied without an exception, since "an asset exists only when its bytes are in hand" — survives where it was always primary, in the oversized-fetch case above.)*

**Journey — three mechanisms, each smaller than the last, and the smallest was not a mechanism at all.** The order matters: degradation-at-paste was the working answer for most of this discussion, and it lost its place not by being refuted but by the ceiling itself coming into question. Once the ceiling could be hard, the case degradation was handling stopped existing — so what had been the recommendation became the fallback without a word of it changing. Worth recording because it is the second time this topic has found that the cheapest fix was upstream of where it was looking (the first being *"an invariant routed to one surface is not an invariant"*).

*Deferral (note-window's offered shape).* Do not mint until the bytes can be copied: the token keeps pointing at the source id, which still names a record with `excluded` set so it renders honestly, and materialisation completes on a Mac that holds the bytes. Rejected on what happens on that Mac. Materialisation fires **on write**, so until something writes to the destination, it sits there *rendering an asset out of the source note's bundle* — not a deferred repair but a live cross-bundle reference with an opportunistic fix-up, and *"every asset a fumi renders is owned by that note and stored in its bundle"* broken in the plainest available form.

*Background repair.* Hang the completion off the launch reconciliation walk rather than a write, so any Mac holding the bytes heals the token without the note being opened. Strictly better than write-triggering — it narrows the cross-bundle window to "until that Mac next runs" and, had the ceiling later lifted, would have healed the stale tokens itself rather than owing a migration. Rejected on **payoff, not risk**: the repaired copy is *itself* over the ceiling, so it is excluded too, and on the Mac where the paste happened the destination shows the same absent chip before and after repair. Nothing visible changes where the work is being done. What the machinery buys is the note rendering on the *other* Mac, plus surviving the source note's deletion; what it costs is a duplicate of the file on that Mac's disk, an index of cross-bundle tokens, and a **content mutation with no user write behind it** — which must either snapshot (a phantom version in the note's history, credited by the engine-originated attribution rule to whoever last wrote it, on a note nobody touched) or not snapshot (a content change that never enters an append-only history built on the assumption that it cannot happen). A background rewrite on one Mac while the note is edited on another is also a conflict on a note neither side deliberately changed.

**Two corrections the discussion made to its own inputs.** The concern cites a transient form of the same shape — record arrived, `CKAsset` still downloading. That state does not exist: fully-eager sync removed it, and this document already struck *"a restore or sync arriving out of order"* on exactly that basis (review-004 F9). And the garbage-collection objection to deferral is weaker than it first looked — retention defaults to **Forever**, so old versions keep linking the asset and the last link rarely drops at all; reaching through from the source note to the pasted one needs a non-default retention, plus deleting the passage, plus the holding Mac being offline throughout. Real, but not the common case, and not what decided this.

**What the edge cost, which is the argument for deleting it.** `excluded` forced a restatement of the self-containment invariant (2026-08-03), a third state two other topics had to model, a GC ownership rule, and this concern — all to serve what is a temporary engineering shortfall rather than a design intent. A workaround that acquired the standing of a feature.

**What this leaves contingent.** Until storage-and-sync rules, the `excluded` row of the three-state table and the ownership-vs-availability restatement of self-containment stand as written. If the hard limit is adopted, the row is struck and the invariant reverts to its stronger original form — *every asset travels, backs up, and resolves on every Mac* — which `excluded` was the sole counter-example to. *(**Discharged 2026-08-09** — adopted. The row is struck, the table is **present · missing**, and the invariant carries both clauses again. Nothing came back changed, so the "if their mechanism makes it wrong, this reopens" escape hatch never fired.)*

*Sibling check: storage-and-sync — the >50 MB ceiling, the per-asset child record's `excluded` flag, the "too large to sync — on {Mac}" placeholder and *"an excluded asset's record is the origin Mac's to collect"* are all that topic's. This strikes the case they serve rather than revising how they work, and is rerouted there for ratification; nothing is adopted unilaterally here. Its ref-count-by-version-links lifetime and per-note independence (*"two independent ref-counts, so deleting one note never reaches the other's asset"*) are unaffected, and were the ground the rejected deferral broke.*

##### 2026-08-05 — revised

*Trigger: review finding — the invariant is stated universally but was routed to one surface, so an agent doing the same transfer through text alone (`read` note A, `append` the passage to note B) produces exactly the dangling reference it forbids.*

**The invariant binds every writer. Carriage is the engine's, not the caller's.**

> **On any write to `content.md` — GUI, CLI or MCP — the engine scans the incoming content for asset tokens. A token naming an asset the destination bundle does not hold is *materialised*: the bytes are copied in from wherever they live, a new id is minted, and that one token is rewritten to it.**

The agent route is ordinary work, not a malfunction — read a passage, write it into another note — and a text-write API has no means of carrying bytes even if it wanted to. So the choice was never *whether* the agent surface carries them; it was who does the carrying. Making it the engine's job means note-window's paste is **one caller of the rule rather than the only place it is honoured**, and no surface needs a new verb.

**When the id cannot be resolved, nothing is invented.** The token stays exactly as written and renders `missing` — an id that never existed, or one whose asset has since been hard-deleted and swept. This is the same non-destructive stance the model takes everywhere: never rewrite, never remove, because the target may return.

**The token rewrite is the one app-authored mutation of `content.md`, and it stays inside its exception.** *"Nothing rewrites it behind the user"* protects the user's prose; minting a destination-local id is part of the copy itself, and the alternative is a note holding a reference to bytes it does not own — precisely what copy-only exists to prevent. The rewrite touches only the tokens being materialised.

**What this now genuinely preserves is the characterisation of `missing`** — the claim the 2026-08-03 entry made and could not support, since it rested on a rule only the GUI was told to keep. With the engine enforcing it, `missing` is unreachable by ordinary editing **on any surface**, with one edge below. *(Amended 2026-08-08 — that edge is closed by the entry above; the exception this sentence points at no longer exists under either branch.)*

**The edge, surfaced but not resolved: an `excluded` source.** *(Amended 2026-08-08 — resolved by the entry above and no longer open: the case is removed at source by making the ceiling a hard limit, and under the fallback the paste writes plain text and no token at all. The paragraph below states the question as it stood on 2026-08-05 and must not be read as live.)* storage-and-sync's oversized assets (>50 MB) keep their record synced while the bytes stay on the Mac that added them. Copy a passage referencing one on a Mac that doesn't hold the bytes, and materialisation has nothing to copy — and it must not invent, by the same rule that governs a failed remote fetch (*"an asset exists only when its bytes are in hand"*). So the token is left as written, and the destination renders it absent. **Which of the three states that is has not been decided**: `missing` is the literal answer (the destination bundle holds no record), but the asset demonstrably exists, which is the distinction `excluded` was introduced to make. Resolving it means deciding whether absence is judged against the bundle or against the store — a question this document has not needed to ask before, since until now every reference began life in the bundle that owned it. Until it is settled, *"unreachable by ordinary editing"* holds everywhere except here.

*Rejected — reject the write, naming the unresolvable ids.* Safe, but it makes read-then-write of ordinary prose fail whenever the passage happens to contain an image, which is a bad shape for the `list → read → reason → act` loop the whole agent model is built on. *Rejected — accept the dangle and redefine `missing` as routine.* It unpicks a characterisation two topics rely on, to avoid work the engine is already positioned to do.

*Sibling check: storage-and-sync — each asset has its own child record keyed by the asset id, so resolving an id to the bundle that owns it is a lookup that already exists rather than an index this rule asks for. Its ref-count-by-version-links lifetime is unaffected: materialising mints a new id in the destination, so the source's count is untouched.*

*What the clipboard carries, and what an agent write reports back about materialised assets, belong to **note-window** and **agent-surface** — rerouted. What is not negotiable from here is that neither of them owns the carriage.*

##### 2026-08-03

*(resolves review-005 F4)*

Self-containment was stated as a property of how an asset *arrives* — dropped, pasted, or fetched. It was never stated for content **moving between notes**, and that route reaches the same place:

```
note A   "…see the chart: ![chart](fumi://asset/01J9…)"
                     │ ⌘C ⌘V
                     ▼
note B   "…see the chart: ![chart](fumi://asset/01J9…)"
         assets/ is empty — the token travelled, the bytes did not
```

Note B is born holding a reference to something it does not have — through the GUI, with no agent involved and nothing damaged.

> **Any transfer of content that carries an asset token carries the asset.** Copying a passage between notes copies the referenced bytes into the destination bundle and mints a **new id** there; duplicating a note duplicates its assets.

This isn't a new principle, it is the existing one applied to a route nobody walked: copy-only beat link/alias precisely so that **a note never depends on bytes it does not hold**, and a bundle that travels intact is the whole reason a fumi is a package. A shared reference across two bundles would reintroduce the dependency by the back door — and with ids globally unique, the alternative isn't even a wrong resolution, it is a permanent dangle.

**Two edges, both resolved by the same rule rather than special-cased:**

- **Pasting within one note** duplicates the asset. Cheap, and the alternative is a ref-count that is per-note rather than per-reference — machinery for a case nobody minds. *(Superseded — see the 2026-08-10 entry above: within one note the engine's materialisation trigger never fires, so the paste shares one id and one file.)*
- **Pasting into another application** carries the literal token text, which resolves nowhere. No worse than pasting any other URL out of context, and nothing in the model can help it.

**What this preserves is the characterisation of `missing`.** The three-state table calls it *"an error state, not a transport state"*, and that only holds while no routine editing produces it. With this invariant, paste and duplicate never do — `missing` stays confined to an agent writing an id that never existed, and to a damaged or partially-restored bundle.

*The paste and duplicate interactions themselves are **note-window's** — rerouted there. What is not negotiable from here is the invariant they have to satisfy.*

**Link/alias dropped for v1 — resolves review-002 F2 & F3.** A macOS alias is machine-specific and can't resolve on another Mac; multi-Mac sync is a *headline* scenario, so a link-mode asset would silently break exactly where the product promises notes travel. Copy was already the default; link was a rare escape hatch that turns out to be a cross-Mac footgun. Dropping it **dissolves the "intrinsic-by-intent but doesn't travel" contradiction (F3)** and **removes the `mode`/alias slots from the attribute set (F2)** — `assets/` is simply the source of truth. (`move` and raw-path `reference` were already dropped.)

**Validated against the field:** Apple Notes and Bear both *import/copy* attachments into their store and sync the bytes (CloudKit); Obsidian copies them into the **vault** as real files referenced by relative path — its managed model *is* our bundle. None manage a synced *link* to an external file, because a local alias can't cross machines. Copy-into-the-container is the industry answer. **Reversible** — the only viable future "link" is a **(B)** reference to a file that itself lives in a **shared cloud location** (DEVONthink-style index), added later if a real need emerges; never a local alias.

*Interaction (two-zone drop overlay, cursor insertion, chip affordance) is **note-window's** — rerouted there.*

### In-content reference syntax — the `fumi://` scheme (decided)

All Fumi-managed references in `content.md` use the **`fumi://` scheme**, written with standard Markdown so the file stays valid Markdown:

- **Note link** → `[label](fumi://note/<uid>)` — opens/peeks a note.
- **Asset** → `fumi://asset/<id>`:
  - **renderable** (image/GIF) → image syntax `![alt](fumi://asset/<id>)` → renders inline.
  - **non-renderable** (PDF/Excel) → link syntax `[report.pdf](fumi://asset/<id>)` → the renderer draws it as a **chip**.

Every downstream consumer then has a stable form: title-derivation treats a leading `fumi://asset` token as non-text and falls through; the agent sees `fumi://asset/…` in content and can reference it; and it's all standard Markdown links/images under the hood (rendering is note-window's). Resolves review-002 **F1**.

**A chip's name is the link's label — content, not a record field** *(2026-09-15, from note-window · discussion · 2026-09-14)*. The form above always put a label in the brackets, but nothing anywhere said what is written there when a file is inserted, and in that gap this document acquired the opposite claim — that a chip draws its name from the asset's stored `originalFilename`. note-window's insertion surfaces (drop, paste, the band's picker) settled it:

> **Inserting a file writes its filename as the link label. The chip renders the label. `originalFilename` stays on the record as what the file *is* — what it reveals as in Finder, opens as, and drags out as — and is no longer what the chip reads.**

The correction belongs here because the reading is this document's: a chip labelled from a record is a token whose visible words exist nowhere in the note's own bytes, which is the one thing a content-is-the-note model does not do. Every other visible token in a fumi — a note link's label, a tag, a heading — is already the user's text in `content.md`, and the chip stops being the exception.

**The cost, named: the label is ordinary content, so it is editable and can drift from the file.** Rename `[Q3-accounts.pdf](fumi://asset/01K2…)` to `[Budget](…)` and the chip reads *Budget* while the file underneath still reveals and opens as `Q3-accounts.pdf`. Accepted: that is what every other Markdown link in the buffer already does, and the label was never carrying the file's identity — `originalFilename` is, and no token keys off either.

*Sibling check: note-window — its 2026-09-14 amendment holds the rule quoted above and rests on its own* inserting with no selection pre-fills the label *ruling for note links, on the ground that a pill whose visible text is derived from elsewhere is a pill whose words exist nowhere in the note's bytes; its chip treatment (icon, name line, metadata line) is unchanged. Adopted as written. storage-and-sync — its per-asset manifest (`id → {originalFilename, addedAt}`, `storage-and-sync.md:67`) and the on-disk `<ulid>.<ext>` naming (`:707`, `:779`) are untouched. Its search corpus was the decision this falsified — it pulled each referenced asset's `originalFilename` in on the ground that *"the filename is not in the note's text"* — and it has already reconciled: as of today the corpus it feeds is `content.md` alone (`:152`), the label being indexed like any other link text. Nothing is owed from here.*

#### Recognition: recognise broadly, render narrowly *(2026-08-03, resolves review-005 F2)*

The above pins the **syntax** of a reference. It never pinned how one is **recognised when scanning content** — a separate question, and the destructive one, because asset lifetime is ref-counted: *keep an asset while any version links it; GC when the last link drops*. The scan decides whether bytes are deleted.

**The case that forces it.** A note documenting Fumi's own syntax — entirely ordinary in a product aimed at engineers — contains the same token twice, once inside a fence as an example and once as a real reference:

````
Reference an image inline:

```md
![diagram](fumi://asset/01J9X…)
```

And here's the actual diagram: ![diagram](fumi://asset/01J9X…)
````

Delete the real one, keep the code sample. If code counts, the asset is **pinned forever by prose** — an invisible leak. If code does not count, the ref-count drops to zero and **the bytes are collected**, and the same rule means any token landing in a construct the scanner didn't anticipate is treated as unreferenced.

**The rule — the two jobs split, because their costs are opposite:**

> **Recognised** for reference-counting wherever the token appears in content — **including inside fenced and inline code**, and including a **bare** `fumi://asset/<id>` with no surrounding link or image syntax.
>
> **Rendered** only in link or image syntax, outside code. A fence still displays its literal text, exactly as it does now.

Rendering asks *"is this a live reference?"*; counting asks *"could anything here be meant as one?"* Over-counting leaks a file the user cannot see and will never notice. Under-counting deletes their data. With storage-and-sync's sweep already carrying a young-asset grace period and a standing rule that GC is never synchronous with a write, leaning conservative costs a little disk and buys the guarantee that nothing legible in the content is ever collected.

**"Content" here includes a conflicted note's candidate bodies** *(2026-08-09, resolves review-007 F3)* — the predicate reads a candidate exactly as it reads `content.md`, fences and bare tokens included. It states this predicate's scope rather than deciding anything new: a candidate body *is* content, and a narrower reading would collect assets the surviving candidate still links.

*Sibling check: storage-and-sync — its asset GC already holds that *"conflict candidates count as versions for ref-counting, for as long as they exist"*, with advisory deletion (*"a Mac that still holds a live reference to a deleted asset re-uploads it"*) as the backstop. This says what counts as a link *within* one candidate; that topic already said candidates count as versions. Nothing there is revised.*

**This also settles a contradiction the document was carrying.** The syntax section insists on Markdown link/image form, while Agentic Addressing says *"the agent sees `fumi://asset/…` in content"* and Title Derivation *"treats a leading `fumi://asset` token as non-text"* — both bare-token readings. Both are now correct as written: a bare token is recognised (so title derivation falls through it, and the agent can see it), and simply isn't rendered.

**Note links follow the same split**, with nothing at stake — a `fumi://note/<uid>` in a code fence is not clickable, and nothing is ref-counted, so the rule is uniform rather than special-cased.

**Materialisation is the third consumer of this reading, and it takes the *render* predicate** *(2026-08-09, resolves review-007 F1)*. The split was written for two jobs — counting and rendering — and *Content transfer carries the bytes* then added a third (*"the engine scans the incoming content for asset tokens"*) without saying which side it falls on.

> **The engine materialises only tokens that are live references — link or image syntax, outside code.** A token inside a fence, or a bare `fumi://asset/<id>`, is recognised for counting and left exactly as written.

**The question each job asks is what decides it.** Counting asks *could anything here be meant as a reference?*; rendering asks *is this a live reference?*; materialisation asks *does this note need to own these bytes?* — and a note only needs the bytes it actually shows. That is the rendering question, so it takes the rendering answer.

**The cost asymmetry inverts here, which is why the wide predicate is wrong for this job.** For counting, casting wide leaks a file and casting narrow deletes data, so wide wins. For materialisation, casting wide **rewrites prose the user wrote** — the forcing case is a note documenting Fumi's own syntax, where the same token appears once in a fence as an example and once live below, and a broad scan copies bytes into a bundle that will never display them while silently changing the documented id. Casting narrow leaves an inert token that displays nothing. The rewrite exception is justified as *"minting a destination-local id is part of the copy itself"*, and for a fenced example there is no copy — nothing is being referenced — so the justification never reaches it.

**Nothing is stranded, because the scan runs on every write rather than only on the paste.** Un-fence a carried token later to make it live and that edit is itself a write to `content.md`, at which point the token *is* image or link syntax outside code and materialisation catches it. The narrow predicate is self-healing on exactly the act that makes the token matter.

**One consequence for the universal claim.** *"No surface, GUI or agent, mints a dangling reference"* narrows to *no surface mints a dangling **rendered** reference* — the only kind that can visibly dangle, since an unrendered token resolves nowhere and displays nothing.

*Sibling check: storage-and-sync — its asset GC consumes the **counting** predicate (*"keep an asset while any version links it"*), which is untouched: recognition stays broad for lifetime purposes, so nothing it sweeps changes. Only the materialisation scan narrows, and that mints rather than collects.*

*The counting predicate is note-model's — it is a statement about what content means. The sweep that consumes it is storage-and-sync's.*

**`fumi://` is an internal convention in v1, not a registered URL scheme** *(2026-08-03, resolves review-005 F13)*. Choosing a URL-shaped representation raises whether it is also registered with **LaunchServices**, which would make every note addressable from outside the app — a `fumi://note/<ulid>` link in Safari, Mail, or another app's document would open that note. **Not in v1.** Nothing decided here or elsewhere needs it, and registering a scheme is a *product surface* — any web page could then ask the app to open a specific note — which is a decision to take deliberately rather than acquire as a side effect of a representation choice.

It costs nothing to defer, which is what makes this the obvious call rather than a close one: **registration is purely additive**. Every token already written keeps its exact form, and a later release can register the scheme without touching a single note. The representation deliberately doesn't preclude it — deep-linking into notes is a natural want for the CLI/MCP audience, and this is where it would land when someone asks for it.

*Sibling check: storage-and-sync — its asset lifetime is ref-counted by version-links with collection at the last drop, and its GC discipline holds that a sweep is never synchronous with a write, with a young-asset grace period. Nothing here revises either; this defines the predicate both already assume.*

#### Dangling asset references — two states *(resolves review-003 F16; collapsed from three 2026-08-09)*

*"Every asset is referenced by content"* is an invariant (see Placement & linkage). The inverse — every reference has an asset — is **not**, and there is **one** way to break it: **an id that does not resolve to an asset in this bundle** — an agent writing a token for an id that never existed or whose asset has since been hard-deleted and swept, or a damaged / partially-restored bundle. *(Amended 2026-08-09 — this read "two ways", the second being storage-and-sync's oversized-asset exclusion (>50 MB stays local-only). They ratified the **hard limit** on 2026-08-09: nothing over the ceiling enters a bundle, so no record without bytes exists and that route is gone.)* *(A route that never existed — "a restore or sync arriving out of order" — was struck by review-004 F9: storage-and-sync's **fully-eager sync** means bytes and record arrive together. Their **atomic publish** rule of 2026-08-09 closes the same gap from the upload side, so sync produces no absent-asset case in either direction.)*

**The base rule mirrors note links exactly: a token whose asset is absent renders as a placeholder, and the token is never rewritten or removed.** Same reasoning — the target may return (a restore lands, a damaged bundle is repaired), and destroying the reference makes recovery impossible. No cascade, no rewriting, non-destructive.

~~**But absence has two meanings, and this is the soft-delete/hard-delete distinction again.** An excluded asset **exists** — it is simply not on this Mac … **And the two are distinguishable**: storage-and-sync gives each asset its own child record carrying an `excluded` flag, so the record syncs even when the bytes do not.~~ *(Struck 2026-08-09 — there is no `excluded` flag on the child record any more, so nothing distinguishes two kinds of absence because there is only one. Absence now means exactly one thing: the id does not resolve here, and that is an error rather than a transport state.)*

| State | Meaning | Model's stance |
|---|---|---|
| **present** | bytes are here | renders |
| **missing** | no record | genuinely unavailable, non-destructively. **An error state, not a transport state** — reachable via a token for an id that never existed or whose asset has since been hard-deleted, or a damaged/partially-restored bundle; never by sync (review-004 F9 on the download side, atomic publish on the upload side), and **never by ordinary editing that mints a rendered reference on any surface** (2026-08-05 — the engine materialises unheld assets on every content write; narrowed 2026-08-09 by review-007 F1 to **live references only**, so copying a *fenced example* of a token into another note leaves an id that resolves nowhere. That token renders nothing, which is why the narrowing costs the characterisation nothing: what cannot be rendered cannot visibly dangle). It is now the **only** absent state, which strengthens rather than weakens the characterisation: every route to it is a fault, so a fumi rendering `missing` always means something is wrong, never merely that a file is elsewhere. |

**Duplicate tokens need no handling.** Two references to one asset render twice; lifetime is ref-counted as *"keep while **any** version links it"*, so duplicates do not affect it.

*Visual treatment for `missing` → **note-window**, as with note-link deleted/unavailable states — a matching entry sits in their queue, since their absent-asset design was drawn against the three-state model. Whether the agent surface should refuse to write a token with no matching asset is **answered, not open**: the engine materialises unheld assets on every content write, so the surface never refuses an unresolvable token; what a write *reports* about materialised assets is **agent-surface's**. (Amended 2026-08-09 (review-008 F3) — this read "for both", counting two absent states, and posed the agent-surface question as still open although this document answered it on 2026-08-05.)*

### Rendering intents (note-window owns — rerouted)

Inline rendering of Markdown / Mermaid / syntax-highlighted code / GIF animation, and the **rendered ↔ raw** toggle (raw = the underlying Markdown/Mermaid source) all live in **note-window**; confirmed intent, **rerouted to note-window** along with the drop-interaction and note-link peek/open design.

---

## Title Derivation

### Decision — pressure-tested, stays (Option A)

#### 2026-09-15 — revised: a chip's label is not title material

*Trigger: the chip's name became ordinary content today (see* A chip's name is the link's label *under In-content reference syntax), which puts a construct the derivation rules already skip on a different footing — it is now the user's own text sitting in the first line.*

**Settled by derivation** — not discussed. Determined by the leading-image precedent in the Source rule and by this section's own principle, *fall through what has no prose, strip what does*.

The Option A ruling below is unchanged — the title is still the derived first line and still never an identifier. This entry pins one construct the Source rule already skipped:

> **A leading attachment chip still falls through. Its label is not title material, and the preview inherits the same rule.**

A leading image already falls through although `![alt](…)` carries the user's text too, and an attachment is a structural object in the note rather than a sentence about it. So a note opening with `[Budget review for Q3](fumi://asset/01K2…)` takes its title from the next text-bearing line, or derives **"Untitled"** where there is none — unchanged from the rule as written, now resting on what a chip *is* rather than on an assumption that its label was a filename nobody chose.

The **inline** case is untouched and was never the same question: a chip mid-sentence strips to its label like any other link, because there the label is part of a line that has prose in it.

#### Initial

The title is the **derived first line**, display-only, and **never an identifier** — identity is the UID (locked). The "first line feels fragile as an identifier" worry dissolves under scrutiny: the UID carries identity; addressing is *soft* (list→read→reason absorbs first-line drift); deliberate naming is just writing a good first line (optionally a heading). No stored title field — discovery's rejection stands, and the optional-explicit-name (Option B) wasn't needed.

### Algorithm

- **Source** — the first line that yields non-empty text after stripping (skip blank/whitespace; fall through a leading image / `fumi://asset` chip / Mermaid-or-code fence / `---` rule / **tags-only line** to the next text-bearing line).
- **Strip to plain text** — heading markers (`#`), list/quote markers, emphasis, inline-code backticks, link/image syntax → their label text (`[Budget](fumi://…)` → "Budget"), and **inline math `$…$` → its source text** (`Solve $x^2+1=0$ tonight` → "Solve x^2+1=0 tonight"). *(Inline math added 2026-08-05, resolves review-006 F6. It follows the inline-code rule, not the inline-tag rule: a tag is metadata and is **removed**, but an equation is part of the sentence — dropping it yields "Solve tonight". **The cost, and it is the real one:** derivation must apply the same delimiter constraints as the renderer, or a bare `$` in prose — "costs $5 and $10 later" — reads as an equation spanning the middle and the strip eats words that were never math. One scanner, one rule, the same discipline `#` recognition already pays for tags.)*
- **Tags removed from the label** *(review-002 F4)* — a line that is **only tags** (`#tags` + whitespace) is non-text → falls through; on a **mixed** line, inline `#tags` are **removed** (not stripped to bare text), so `Buy milk #shopping` → "Buy milk", not "Buy milk shopping".
- **Empty** (or no text-bearing line) → **"Untitled"**.
- **Truncation is a display concern** — the label is the full stripped line; each surface (manager row, note header) truncates to fit. Not baked into the model.
- **Live** — re-derived when the first line changes; cached in the **Derived tier** for fast `list`. *(Amended 2026-08-05 — this read "the Machine tier", wording that predates the three-tier split; the Machine tier is backed up per-device, and a derived value must be rebuilt from content, never carried.)*

#### Structural first lines *(2026-08-03, resolves review-005 F9)*

The algorithm was precise about stripping and about mixed tag lines, and silent on several constructs the dialect explicitly supports. Each resolves by asking the same question the rule already implies — *is this line's text a plausible label?* — so none of them needs a new principle:

- **A fenced block is skipped whole, not just its marker.** *"Fall through a Mermaid-or-code fence"* was ambiguous between skipping the ` ``` ` line and skipping the block; whole-block is meant. Otherwise a note opening with a code sample is titled `const x = 1`, which is source, not a label. **An unterminated fence** (the state of any note being typed into) extends to the end of the content — so a note that is *only* an open code block derives **"Untitled"**, correctly: there is no prose in it yet.
- **Task lists strip their checkbox with the marker.** `- [ ] Buy milk` → **"Buy milk"**. GFM task lists are a committed feature and a checklist is a canonical Stickies-replacement note, so this is a common first line, not an edge case. The existing *"link/image syntax → label text"* clause doesn't cover `[ ]`, which is why it needed saying; `[x]` behaves identically.
- **Tables strip to their cell text.** `| Item | Cost |` → **"Item Cost"** — pipes and alignment rows removed, cells joined by a space. Low stakes; the alternative (falling through a table to whatever follows) is worse, because a table's header row usually *is* what the note is about.
- **HTML blocks strip to their text content**, falling through when they contain none (`<img …>` alone behaves like a leading image).
- **A footnote definition** (`[^1]: some text`) strips its marker like any other, yielding the text.
- **A display equation is skipped whole, exactly as a fence is** *(2026-08-05, resolves review-006 F6)*. `$$` opens a block with no prose in it; skipping only the delimiter line titles the note `E = mc^2`, which is source, not a label — the identical failure the fence bullet exists to prevent. An **unterminated** `$$` extends to the end of the content, so a note that is only an open equation derives **"Untitled"**. Math was enumerated nowhere in this list because note-window landed it as a content type after the list was written.
- **Setext headings need no rule at all.** `Groceries` over `=====` already works: line 1 is text-bearing, so it is taken and the underline is never consulted. The `---` case the review raised resolves the same way — whether line 2 makes line 1 a heading or is a thematic break, the label is "Groceries" either way. Recorded because it looks like a gap and isn't.

The through-line: **fall through what has no prose in it; strip what does.** Anything not enumerated here follows that.

Resolves review F8 (empty/whitespace-only note → "Untitled"; identity still the UID).

### Block styles are Markdown, not separate state

The Apple-Notes-style **text-style dropdown** (Title / Heading / Subheading / Body / Monospace / lists / Block Quote) maps **1:1 onto Markdown block types** — Title = H1 `#`, Heading = H2 `##`, Subheading = H3 `###`, Body = paragraph, Monospace = code, Bulleted/Numbered = `-` / `1.`, Block Quote = `>`. So "applying a style" *is* editing the Markdown — there is **no separate styling state** (reinforces content-only). A new note's first line defaults to **Title (a real `# ` H1)**; Enter → Body. The derived label strips the `#`, so `# Groceries` → "Groceries". (Apple's dashed-vs-bulleted distinction is cosmetic — not replicated.)

*The editing affordance itself — style dropdown UI, first-line auto-title behaviour, H1 size + bottom-padding gap, live-styling, rendered ↔ raw — is **note-window's**; rerouted there.*

---

## Content Preview

### Context

*(2026-08-05, resolves review-006 F4)*

The preview was named in four places as a first-class derived value and defined in none: `list`'s payload (*"UID + derived title + tags + colour + a content preview"*), the Derived tier's *"title / preview caches"*, the derivation-version rule (*"every derived value here — the title, the tag-set, the preview"*), and the conflicted-note rule (*"title, tag-set and preview derive from `content.md`"*). The title got a full algorithm and tags got another; the preview got neither — while being the value an agent actually reads when deciding which note it wants. Nothing stated its length, whether it was plain text or raw Markdown, whether it began after the title line or repeated it, or what it did with a leading image, a fence, or a tags-only line.

Nobody else can take it: storage-and-sync **projects** it and treats the rule as this document's; management-window and agent-surface have had no session. And the derivation-version rule this document owns cannot be applied to a rule that does not exist — a preview change is one of the three things that is supposed to bump it.

### Decision — the same strip, applied to the rest of the note

> **The preview is the title algorithm's strip applied to the content *after* the title line: fall through what has no prose, strip what does, collapsed to a single line, bounded at derivation.**

- **It starts after the title line and never repeats it.** The caller already has the title; spending the snippet on it wastes the only cheap signal `list` gives an agent before it decides whether to `read`.
- **Same fall-through and strip rules as title derivation** — a leading image or bare `fumi://asset` token, a fence or display equation (each skipped whole), a tags-only line and a `---` rule all fall through; task lists lose their checkbox, tables strip to cell text, inline `#tags` are removed from a mixed line and inline `$…$` strips to its source. One reading of content, two consumers.
- **Plain text, single line, whitespace collapsed.**
- **Bounded in the model — order of 200 characters.** This is the one place it cannot inherit from the title, whose *"truncation is a display concern — the label is the full stripped line"*. The preview exists precisely so the list view and `list` never open a bundle; an unbounded preview *is* the content, and the projection would then carry every note's full text. The exact number is tunable; that it is bounded **at derivation time** is the model's statement.
- **An empty preview is a real state**, not an "Untitled" equivalent. A note whose whole content is one line has a title and no preview, and that is correct — nothing is lost, because the title carries it. The title never renders empty because a note must be addressable in a list; a preview has no such duty.
- **Participates in the derivation version.** A change to this rule bumps it and forces a reprojection, exactly as a title or tag rule change does.

**Rejected — raw Markdown truncated at N bytes.** The cheapest thing to produce and the worst to consume: the snippet fills with syntax and `fumi://asset` tokens, and the first thing the reader sees is a repeat of the title it already holds. It also puts the preview on a different footing from every other derived value here, all of which are *readings* of content rather than slices of it.

*Sibling check: storage-and-sync — its `notes` projection carries a "cached preview snippet (so the list view never opens a bundle)" and its re-derivation pass recomputes title / tags / preview / FTS. Nothing here revises that; this defines what it is projecting.*

---

## Tags

### Decision — inline `#hashtag` (content), Option A

Tags are **inline `#hashtag`s in the content** (like Bear / Obsidian / Apple Notes). A tag *is* content, so it syncs for free, is agent-authorable, and renders at-rest without adding chrome to the content-only surface. Chosen over structured-metadata tags (Option B).

- **Placement is the user's choice** — top, under the heading, inline, bottom, anywhere. No enforced position.
- **Heading-collision rule:** `# ` (trailing space) = heading; `#tag` (no space) = tag. Tag names contain **no spaces** (`#multi-word`).
- **Nested tags supported** — `#project/sub` (Bear/Obsidian-style hierarchy). Filtering by a parent includes its children (e.g. `#fabric` matches `#fabric/ports`); the filter semantics are management-window's.
- The note's **tag-set = the `#tags` parsed from its content** — derived, cached in the **Derived tier** for fast filtering. *(Amended 2026-08-05 — as with the title cache, this read "the Machine tier" and predates the three-tier split.)* Tags are an organizing/filter axis parallel to Spaces.

### Tag parsing (review-002 F5)

#### 2026-08-10 — revised: math is a suppression context

*(resolves review-008 F6)*

*Trigger: the suppression list — code and URLs — was pinned on 2026-08-03. Math entered the dialect on 2026-08-05, and only the **title** derivation rules were revised for it; the tag scanner was never revisited. Its own entry stated the rule that catches this: "every derived value here is a reading of content: a delimiter the dialect doesn't admit is a delimiter the derivation rules don't know to skip."*

> **`#` never starts a tag inside math — inline `$…$` or display `$$…$$` — on the same footing as code and URLs.**

**Why it is a real class and not a curiosity.** `#` is live LaTeX syntax (macro parameters, and ordinary text inside `\text{…}`), so an equation can contain a token that satisfies every clause of the rule as written:

```
Fees this quarter

$$
\text{fee}(n) = \text{#total} \times n
$$
```

`#total` starts a token, is not in code, is not a URL — so it derives a tag, on every Mac identically, and lands as a real entry in the manager's filter axis from a construct the dialect explicitly admits.

**The character-set rule catches part of the class but not the class.** `#1`, `#2` — the common macro-parameter form — already fail *"at least one letter, mark, or symbol"* and were never tags, so bare parameters produce nothing. It is the letter-bearing forms that get through. Narrower than it first looks, and still a leak.

**Cost: close to nothing.** The scanner already has to locate math delimiters — title derivation skips a display block whole and strips inline math to its source — so the boundaries are computed regardless; this reads them. It also keeps the *one scanner, one rule* discipline the dialect entry named as the cost of admitting math, rather than leaving the tag-set as the single derived value that does not skip it.

*Rejected: shrug at it.* Defensible on frequency — a phantom `#total` is cosmetic and rare, and it costs nothing to filter past. Rejected because the inconsistency is the problem rather than the frequency: `#` recognition already pays for context-awareness in code and URLs, and titles already pay for it in math. A derived value that skips two of the three contexts is the odd one out for no reason anyone could state later.

**The same delimiter constraints apply here as everywhere else.** Title derivation already carries the caveat that a bare `$` in prose — *"costs $5 and $10 later"* — must not read as an equation spanning the middle. That constraint is the scanner's, not each consumer's, so tags inherit it: whatever the renderer treats as math is what the tag scanner skips, and prose dollars remain prose in both.

#### 2026-08-03 — revised

*Trigger: the character set and the identity key were pinned as "letters" on a "lowercased key" without saying whether letters meant ASCII or Unicode, or whether the key is normalised — and the tag-set is derived independently on every Mac, so an unstated answer is a divergence, not a detail.*

- **Where `#` counts** — unchanged: only when it **starts a token** (preceded by whitespace or line-start), and **never inside code** (inline or fenced) **or a URL**. So `issue#3`, `https://x/#section`, and `#fff` in a code span are *not* tags. *(Math added as a third suppression context 2026-08-10 — see above.)*
- **Tag-name chars** — **Unicode**: letters and marks in any script, digits, **emoji and other symbols**, plus `-`, `_`, `/` (nesting); terminated by whitespace or punctuation. **A tag needs at least one letter, mark, or symbol** *(tightened — see Segmentation and folding)*, so prose refs like `#1` and `#123` still aren't caught, and neither are `#-`, `#_` or `#/`.
- **Identity** — the key is **NFC → full case fold → NFC** *(the trailing re-normalisation added below)*. Display preserves the as-typed form. `#Work` == `#work` as before; now `#café` typed one way equals `#café` pasted another.

**Why Unicode rather than ASCII.** A notes app that silently drops `#日本語` or `#café` from its tag index is broken for anyone not writing in English, and the failure is invisible — the text stays in the note, the tag just never appears in the manager.

**Why NFC, and why it isn't optional.** `é` has two valid encodings: one code point (NFC), or `e` plus a combining accent (NFD). macOS produces both routinely — filesystem APIs hand back NFD, keyboards and pastes give NFC — so the *same* visible tag can reach two Macs as different byte sequences. The tag-set is **derived per Mac from content**, so without a normalisation step two machines derive two different keys from identical content, and the same note filters differently depending on where you're standing. NFC over NFD because it is the interchange-standard form and the shorter one.

**Locale-invariant folding, specifically.** Turkish-locale lowercasing maps `İ` to a dotted `i̇`, so `#İstanbul` would key differently on a Turkish-locale Mac than on any other — a locale-sensitive fold reintroduces the per-machine divergence NFC just removed, in a form that only shows up on someone else's machine.

**Emoji are in.** `#🔥`, `#📌` — allowed, because Fumi is a visual product and excluding them from a tag syntax would be a strange omission (Bear allows them; people use them as markers). The cost is accepted: sequences like `#1️⃣` and ZWJ/skin-tone emoji become legal tags whose normalisation is fussier than plain text, and NFC handles them by leaving them alone. *Rejected: "letters only, keep it boring" — defensible and cheaper, but it makes the rule arbitrary from the user's side, since nothing about a tag's job requires it to be pronounceable.*

**Normalisation never touches content.** `content.md` keeps exactly what was typed; NFC applies only when deriving the key. Same shape as every other derived value here — the content is the note, and nothing rewrites it behind the user.

*Which display form wins when two spellings collapse to one key — `#Work` and `#work` in different notes, one entry in the tag list — is **management-window's**, with the rest of the filter semantics. Identity is settled here; presentation isn't ours.*

##### Segmentation and folding *(2026-08-03, resolves review-005 F11)*

Five residues left by the revision above — the character set and the key were pinned, the edges of both were not.

**Degenerate slashes — split, drop empties, rejoin.** `/` is both a legal name character and the nesting separator, so `#foo/`, `#/foo` and `#a//b` all parse but had no defined result. One rule covers them: split the name on `/`, discard empty segments, rejoin. `#foo/` → `foo`; `#a//b` → `a/b`; a name with nothing left after the discard is not a tag.

**A parent tag is *not* implicit in the derived set.** A note containing only `#fabric/ports` has the tag-set `{fabric/ports}` — not `{fabric, fabric/ports}`. The set is what the content says; synthesising ancestors would have a note claim tags its author never typed, and would break the plain reading that the tag-set *is* the parsed `#tags`. Parent filtering still works as decided (*"filtering by a parent includes its children"*) — it is a query-time walk over segments, not a fatter stored set.

**One constraint that walk must honour, stated here because the nesting semantics are ours:** matching is on **segment boundaries**. `#fab` must not match `#fabric`; `#fabric` must match `#fabric/ports`. A naive prefix comparison gets the first case wrong, and it would be implementing our semantics incorrectly rather than choosing its own. *(The rest of the filter semantics remain management-window's.)*

**Punctuation-only names are excluded, and the numeric rule folds into the same clause.** The character-set rule now requires **at least one letter, mark, or symbol**, which excludes `#-`, `#_` and `#/` while continuing to exclude `#1` and `#123`. This replaces "needs at least one non-digit character", which admitted the punctuation cases by accident.

**Full case folding, not simple.** The two differ on ligatures and on `ß`: under simple folding `#straße` and `#STRASSE` are two tags; under full folding they are one. **Full**, because the failure it prevents is precisely the one case-insensitivity exists to prevent — the same word typed in caps becoming a second tag. Accepted cost: a user cannot deliberately keep `#straße` and `#strasse` as distinct tags. Unicode's default caseless matching is full folding, so this is also the unsurprising choice for anyone who checks.

**The fold is re-normalised.** Case folding can move a string out of NFC, so normalising only *before* folding leaves the same divergence one level down that NFC was introduced to remove. The key is **NFC → full fold → NFC**.

#### Initial

- **Where `#` counts** — only when it **starts a token** (preceded by whitespace or line-start), and **never inside code** (inline or fenced) **or a URL**. So `issue#3`, `https://x/#section`, and `#fff` in a code span are *not* tags.
- **Tag-name chars** — letters, digits, `-`, `_`, `/` (nesting); terminated by whitespace/punctuation. **Not purely numeric** (`#123` is not a tag — needs ≥1 letter — so prose refs like `#1` aren't caught).
- **Identity/normalisation** — tags match **case-insensitively** (`#Work` == `#work`); the tag-set dedupes and filters on a lowercased key, while display preserves the as-typed casing.

### In-note behaviour vs management

- **In a note, a tag is an editable content token** — click to select/edit; backspace across it reverts to plain `#text`. It is **not** a navigation trigger. (Rationale: "clicking a tag opens every note carrying it" would scatter windows across Spaces — chaos, not navigation.)
- **Filtering/organizing by tag lives in management-window** — the tag's real home. Tags are an axis you *act on in the manager*, not a link you follow from a note. (This corrects the earlier "tag-click = navigate to filter" idea.)

*Rendering (at-rest badge/pill, token editing behaviour, syntax-marker reveal-on-cursor) → note-window. Tag filtering/organizing → management-window. Both rerouted.*

---

## Colour

### Decision — the stored value is a *role*, not a colour *(reconciled with note-window, review-003 F11)*

Colour is a per-note intrinsic (the Note tier), stored as a **stable role/slot** — **not** a raw hex, an arbitrary value, or a palette colour name.

~~*Originally: "a **named token from a curated palette** (`sage`, `butter`, `blush`, `sky`, … + a neutral default)".*~~ **Superseded.** note-window has since landed a **two-level colour model**, and both halves of that phrasing were wrong: those names are *renderings*, not slots, and there is no single palette for them to be drawn from.

**The two levels:**

- **Per-note — a role.** One of **seven stable slots**: Neutral · Yellow · Orange · Red · Green · Blue · Purple. Base hues only, naming *a position on the hue wheel* rather than a colour. This is the field note-model owns, and it **syncs** (Note tier).
- **App-level — the active swatch.** A swatch is a whole **role → colour set**; ten ship, with no user authoring, and **one active swatch per Mac** decides how every role renders. Machine-local, not per-note.

**Consequences that matter to the model:**

- **Roles are never surfaced as a text label.** The user picks a chip in note-window's role strip, not a named colour — because a role's rendering can drift off its own internal name. For most swatches red reads red; the deliberate exceptions are **Okabe–Ito**, built for separability so its "Purple" slot renders bluish, and **Graphite**, a chroma-0 lightness ladder where nothing is any hue at all.
- **The field is never empty. Neutral is a role, not the absence of one** — every swatch defines it as its quietest member, and switching swatch re-tints it along with the rest. This corrects the old *"default = neutral glass; colour is opt-in per note"*, which framed uncoloured as a null state. The stored value is always one of the seven; the default is **Neutral**, rendered by the default swatch (**Wash**).
- **Curated-only still stands**, and is now stronger: ten fixed swatches, no user authoring, no arbitrary picker. The "you literally can't make an ugly note" taste guarantee; an open picker is what breaks the calm/furniture coherence (the Stickies-garish trap). Reversible later, even post-launch, if wanted.
- **Storing the slot, not a literal colour**, keeps the original benefit intact: it survives light/dark, swatch switching, and any future re-tuning of the values.

**Wire form: the role name** *(review-004 F10)*. Stored as the name (`"colour": "red"`), and the same on the agent surface (`--colour red`). note-window left this open (*"indexed or named under the hood — not surfaced"*), so nothing is overruled. A name suits storage-and-sync's diffable/greppable JSON rationale, and an index would be hostile to natural-language addressing. The *never-surface-a-label* rule is a **GUI** rule — a label misleads a **human** about rendering (Okabe–Ito's Purple reads bluish) — not a storage or protocol rule. The label is untrustworthy about *rendering* and perfectly trustworthy as an *identifier*.

**An unrecognised role value is preserved, not coerced** *(2026-08-03, resolves review-005 F14)*. The field is never empty and holds one of seven names, but nothing said what happens to a value outside that set. Two entry points, two answers, and the split is the same one used for `size`:

- **On a write through the agent surface** (`--colour teal`) — **rejected**, with the valid roles named in the error. A live write with a bad value is a caller mistake, and failing loudly beats silently storing something the GUI can't represent. Same stance as `size`'s minimum, which is *"a floor on the value, enforced wherever `size` is written"*.
- **On a value read from storage** — **preserved as-is and rendered as Neutral**. Never rewritten. The case that decides this is forward-compatibility: a **newer Fumi adds an eighth role**, a note using it syncs to a Mac still on the old build, and that Mac projects it. Coercing to Neutral *on read* would be harmless; coercing on **write-back** would destroy the user's choice permanently, and the older Mac has no way to know it is discarding something real. Preserve-and-render-Neutral is the only option that survives a round-trip through an old build intact, and it is the same reasoning as tokens never being rewritten because the target may return.

*(This is the colour instance of the general rule the model already applies: an unrecognised value is a value from somewhere else, not garbage.)*

**Scope: note-model records that the field is a role, and holds the role names. It does not record how they render.** The ten swatches, their pinned literals and the tinted-glass treatment are **note-window's**, and duplicating them here would repeat the over-claim corrected in the attribute set.

*(Amended 2026-08-05 — this read "It does not record the values. The seven role names, the ten swatches …", which the same subtopic contradicts twice: the wire form stores the **name** (`"colour": "red"`, `--colour red`), and an unrecognised name is **rejected on an agent write with the valid roles named in the error**, which cannot be done without holding the set. The line was drawing the boundary in the wrong place — the untrustworthy thing is the **rendering**, never the identifier.)*

### The active-swatch pointer — app-level state, and why the tiers don't cover it

*(second half of review-003 F11)* The swatch pointer is per-machine presentation state that appears in none of the three tiers, despite the classification rule being declared the durable test for any future state.

**Resolved by scoping rather than by adding a tier: the tiers classify *per-note* state.** The swatch pointer is not an attribute of a note — it is an **app-level setting**, like global opacity, the material, or the Light/Dark chrome flag. Sorting it into a tier of note attributes would be the same category error as absorbing storage-and-sync's plumbing into the attribute set.

**The two axes still apply to it, though — and note-window already used them.** The swatch pointer is *per-machine* on the scope axis and *durable* on the durability axis, which is why note-window specified per-device backup for it: *"a machine-local setting that vanishes on reinstall is a bug, not a design."* Same shape as the Machine tier, different subject. **The axes are general; the tiers are the note-state instance of them.**

Palette contents and the tinted-glass rendering treatment → note-window.

---

## Identity & UID

### Decision — ULID

Identity is the **UID** (locked: never the title). The UID is encoded as a **ULID** — 128-bit, time-ordered, Crockford base32 (case-insensitive-safe), 26 chars, no separators.

**The UID is a stored field; the folder name mirrors it** *(reconciled with storage-and-sync, review-004 F2)*. ~~*Originally: "and is also the **bundle folder name** (`{ulid}/`)".*~~ storage-and-sync amended both halves of that:

- The bundle is **`{ulid}.fumi/`** — an opaque package marked by extension.
- **The UID is a canonical field in `meta.json`**, and the folder name is a *"derived, human-debuggable mirror of it, **not the source of identity**"*. On disagreement — reachable only if a folder-sync service renames on collision — **the in-file UID wins** and the engine repairs the folder name. *(2026-08-03 — with the store local and CloudKit as the transport, no folder-sync service touches it, so the stated trigger is unreachable in v1. The rule costs nothing and is kept as it stands: it is the redundancy that makes the folder name safe to derive at all, and it is the recovery path when a `meta.json` is unreadable.)*

**The ULID-as-folder-name choice survives, for a better reason than the original one.** It is kept over an opaque or random name because it gives a **deterministic UID→path mapping** (`{store}/{ulid}.fumi`), so the engine locates a bundle by UID with no index lookup; random names would force an indirection just to find bytes. It is simply demoted from *being* the identity to *mirroring* it, with redundancy (recover the UID if the sidecar is lost) as a bonus.

ULID over UUIDv4/v7: it satisfies every constraint at once — filename-safe, collision-safe by randomness (offline multi-Mac creation merges cleanly), case-insensitive-FS-safe (APFS default), compact, and time-ordered as a bonus (ids roughly sort by creation). Low-stakes — any collision-resistant id works; ULID is simply the best fit.

---

## Agentic Addressing

### Decision — `list → read → reason` (ratified)

Ratifies discovery; unchanged by anything decided since:

- The **UID is the reliable handle** for machines.
- CLI/MCP **accept a title as a convenience when unambiguous** — the title being the derived first-line label.
- On ambiguity, the agent does **`list → read → reason`**, escalating to the human only as a last resort.
- `list` is a cheap **SQLite read-model** query (UID + derived title + tags + colour + a content preview — see **Content Preview** for what the preview is), so the loop stays fast even at thousands of notes.

### Title matching — same identity rule as tags, and ambiguity is the normal case *(2026-08-03, resolves review-005 F8)*

*"Accept a title as a convenience when unambiguous"* was ratified without defining either operative word — conspicuous next to the four paragraphs spent pinning tag identity, and this string is consumed by an automated agent rather than a human.

**What "matches" means — the tag rule, unchanged.** A supplied title matches on the **NFC → full case fold → NFC** form of the **full derived label**, not the truncated display string. Same identity rule as tags, for the same reason: an unstated rule diverges per Mac, and there is no argument for the *other* derived string having *different* semantics. Matching the full label rather than what `list` displayed matters because truncation is a per-surface display concern — an agent that saw a shortened row must not be silently matching a different string from the one stored.

**No fuzzy or substring matching.** Exact-after-normalisation only. A near-match that resolves is worse than one that doesn't: the agent acts confidently on the wrong note, and the `list → read → reason` loop exists precisely so that *not* resolving is cheap.

**"Ambiguous" is the common path, not an error.** Titles are optional and not unique, and the derivation yields **"Untitled"** for every note whose first line is non-text — so a dozen scratch notes are a dozen identically-titled notes. That is a systematic class, not an edge case, and the model already answers it: ambiguity returns the candidates, and the agent reads and reasons rather than being handed an arbitrary winner or an error. Nothing about a title is load-bearing enough to justify tie-breaking heuristics; the UID is there for when identity matters.

*The CLI/MCP grammar — flag shapes, how candidates are returned, whether a title argument is accepted at all on destructive operations — is **agent-surface's**. What is fixed here is the identity semantics of the derived title, since this document owns the derivation.*

### A conflicted note is still one note with one UID *(2026-08-03, resolves review-005 F12)*

storage-and-sync's keep-both conflict handling raises an identity question that is note-model's, because *"identity is the UID"* is this document's foundational claim. Their decision settles it; this document had simply never recorded the consequence:

> *"the divergent side is **not a separate note** … Instead: **one** note, `conflicted`, with candidate version(s) as subordinate records … History stays with the one note; assets stay in its one shared bundle (ref-counted)."*

So: **one note, one UID, one bundle** — throughout the conflict and after it. No second identity is ever minted, which is what stops an inbound `fumi://note/<uid>` link being orphaned or silently redirected at half the content.

Three consequences follow directly, none needing a new rule:

- **Derived values stay singular.** Title, tag-set and preview derive from **`content.md`**, which remains the note's one live body; a candidate is a subordinate record, not a second body to project. One row in the read model, as always.
- **`fumi://note/<uid>` keeps resolving** — to the note, in its conflicted state. A fourth condition alongside live, soft-deleted and hard-deleted, behaving like the first: the target exists and opens. What the reconciler shows on arrival is note-window's.
- **Resolution changes nothing about identity.** It writes the chosen text into `content.md` and drops the candidate records; the note that comes out is the note that went in.

*Sibling check: storage-and-sync — its conflict lifecycle explicitly supersedes an earlier "new record id / forked bundle" framing, on the grounds that a forked note would sprout a phantom duplicate that syncs and accrues its own history. Nothing here revises that; this records what it means for identity.*

---

## Metadata & State Representation

### Context

Everything that isn't content — UID, tags, colour, created-at, soft-delete state, window geometry, home-Space, float-on-top — has to live somewhere other than the `.md`. Where, and as how many stores?

*From: storage-and-sync · discussion · 2026-08-04*

**Repair values are "marked as repairs", but storage-and-sync decided the repair carries no marker.** *(**Resolved 2026-08-05** — see Attribute set & access model → *A damaged bundle* → the 2026-08-05 entry, which strikes the marker claim. The entry below is the concern as it arrived, not an open conflict.)* Coherence finding (conflict). This document states that a damaged bundle's defaulted fields are marked as repairs; storage-and-sync has since decided the sidecar repair carries no marker at all, and rejected a per-field one explicitly — *"the marker has to be a real per-field addition to the sidecar and the record — the first thing either would carry about how a value got there rather than what it is — and it must then survive round-trips through builds that don't understand it, where an old client would read a marked field as an ordinary one."*

This document's damage rules landed 2026-08-03 and were rerouted to storage-and-sync, which absorbed them on 2026-08-04, adopting two of the three sentences by name — *"the synced record beats a local default"* and *"preserved as-is and rendered as Neutral"*. The third was not addressed, and the mechanism they went on to decide is incompatible with its concrete reading. The phrase had two readings and the documents diverged on both: **as a stored marker**, it cannot be satisfied as a fact about the record; **as documentation**, it makes a claim about this design's prose while sitting inside an inventory of what a fumi *is*.

Their new rule removes most of the need for one — *"A damaged sidecar's repair consults the note's record first, and defaults only what the record cannot supply. The repair does not write until this store is `reconciled`. Meanwhile the note renders a fallback without storing one."* It fixes the failure *"the synced record beats a local default"* exists to prevent: their old recovery defaulted every field but the UID and rewrote the sidecar, and per-field merge read the invention as a local edit and propagated it — a corrupt `meta.json` on one Mac turning a Blue note Neutral on all of them. The residue is the sync-off or never-synced store, where a default genuinely is written and is indistinguishable from a choice by any mechanism either document has decided. Left to stand, a specification pass reading both documents would produce a sidecar schema carrying a field one document requires and the other refuses.

*From: space-homing · research · 2026-08-24*

**Does a fumi's record carry explicit placement fields, or an opaque AppKit state blob?** Measuring how macOS itself records a window's home Space turned up a second persistence model this topic never anticipated. `-[NSWindow encodeRestorableStateWithCoder:]` — fully public — emits one archive whose `$top` carries the entire placement picture at once: `NSWindowWorkspaceID` (the stable managed-space UUID), the window frame, `NSScreenLayoutUUIDString` (display identity) and the display geometry. Chrome base64s that lump into its own session store and replays it through `restoreStateWithCoder:` at launch, recovering Space, position and size from something it never inspects. So the record could name placement outright — home Space, position, size, display — or it could persist the archive and replay it. The Machine tier was written as explicit fields, but the alternative was not on the table when it was written, so the shape was assumed rather than chosen.

Constraints space-homing attached to either shape: identity is the stable managed-space UUID, never an ordinal; **Space 1 records as an empty string, not an absent value**, and that empty string is a working identifier — restoring with `NSWindowWorkspaceID = ""` places a window on Space 1 from a different active Space — so any model normalising empty-to-nil silently strands those notes on whatever Space the user happens to be standing on; and a deleted home Space needs an explicit existence check and redirect, because both placement routes degrade silently to the *active* Space rather than to Space 1. Which placement route Fumi uses — AppKit restoration or the SkyLight calls — is space-homing's open tradeoff and was explicitly out of this concern's scope.

*From: space-homing · research · 2026-08-25*

**`com.apple.spaces.plist` IS captured by Time Machine — a stated premise needs re-deriving.** This document's Machine-tier ruling for home-Space is described as technically forced, on the stated ground that Spaces *"are persisted to neither iCloud nor Time Machine"*. Measured on the user's machine (macOS 26.5.2):

```
~/Library/Preferences/com.apple.spaces.plist   2.4 KB
tmutil isexcluded  ->  [Included]
keys: Display Identifier | Spaces | Current Space |
      ManagedSpaceID | uuid | type | windows | app-bindings
```

Re-measured 2026-08-30 before this document leaned on it, since it overturns a claim two sections were built on: `` tmutil isexcluded ~/Library/Preferences/com.apple.spaces.plist `` → `[Included]`, and `` plutil -p ~/Library/Preferences/com.apple.spaces.plist | grep -oE '"(uuid|windows|app-bindings|type)" =>' | sort -u `` → all four present. Confirmed independently.

The file is not excluded — it is backed up like any other preference and it carries the Space UUIDs, along with per-Space `windows` and `app-bindings`, so the WindowServer does persist which app's windows belong to which Space. What remains **unverified** is whether *restoring* it reinstates Space identity: the WindowServer plausibly regenerates Spaces against real display hardware, which would leave the restored file inert, and it is keyed by `Display Identifier`, which differs on new hardware regardless. So the conclusion may hold; the stated reason does not.

A related measured fact: every Mac's main display has a first Space whose UUID is the **empty string**, and that empty string is a working identifier — so a note homed to Space 1 resolves on another machine rather than taking the fallback path.

### Settled

- ~~**All non-content state lives outside the Markdown, in a persistent store** — leaning **SQLite** (normal for a Mac app of this class). No frontmatter; no *visible* sidecar files next to the `.md` (a user linking the store to Obsidian must not be dragged into implementation-state files — "that's implementation state, not user state").~~ *(**Superseded 2026-08-03, resolves review-005 F7** — three ways, none of which had been marked, while the two bullets below it carried their supersession notes. **(1)** The Obsidian motivation was explicitly retracted by Content Format: external tools are not a supported read/edit workflow. **(2)** "No sidecar files next to the `.md`" is contradicted by the decided model — Note-tier state lives in **`meta.json`, a sibling of `content.md`**. The word *visible* arguably survives, since the bundle is an opaque package, but nothing had performed that reconciliation. **(3)** "All non-content state … leaning SQLite" is now backwards: Note-tier truth lives in the bundle and SQLite is the disposable read model plus machine-local state.*
  
  *What survives, and is stated positively rather than as a prohibition: **the Markdown file holds content and nothing else** — no frontmatter, no state. That rule stands on separation of concerns, which never depended on the Obsidian framing.)*
- **Two tiers, split by whether the state must survive a backup and travel:**
  - **Intrinsic (must be backed up / travels with content):** the content (`content.md` + `assets/`), UID, colour, created-at, **modified-at**, **soft-delete state**. *(Title and tags are **derived from content**, not stored.)* A soft-deleted note is effectively *archived* — deleted *to keep it* and restore it, so it must travel.
  - **Machine-local:** window coordinates, home display, home-Space UUID, float-on-top, last-opened. Only meaningful on the machine that produced them. *(**Amended twice** — this originally read "window coordinates **+ size**" and was labelled *disposable*. Size was never separately argued; it rode along with position, and Note Size Classification later ruled it **intrinsic**. The *disposable* label then split into the **Machine** and **Derived** tiers, and float-on-top moved to the **Note** tier — see the state model below.)*
- ~~**On reinstall / a different machine, machine-local state is simply not honoured.**~~ *(**Superseded** — see *Arrival: a new Mac vs a restored Mac*, below. The two cases were conflated. A **new** Mac still cascades position, but now honours the arriving size and preset binding; a **restored** Mac gets its coordinates and home display back, because the Machine tier is backed up per device. The original "precise coordinate restoration isn't worth engineering" was a cost argument, and the cost changed.)*
- **Consolidate** all machine-local state into a *single* non-synced ride-along store rather than scattering it — the ephemeral bucket is disposable as a unit.
- ~~**Identity travels as the folder/file name** (user: "obvious choice"), nothing extra to store.~~ *(**Superseded** — the early lean was `{uid}.md`, then the bundle folder name `{ulid}/`. storage-and-sync has since anchored identity in **`meta.json`** with the folder name as a derived mirror, and renamed the bundle `{ulid}.fumi/`. **"Nothing extra to store" is now false** — `uid` is the first field of their `meta.json` set. See Identity & UID.)*

### Decision — the state model: two axes, three tiers *(amended by review-003 F15 / F6)*

Originally a **two-bucket** model on a single test: *"does this ride along with the note, or is it just how this Mac is showing the note right now?"* That test is still correct — it just turned out to answer only one of two questions.

**The second question was never asked: *if this Mac is wiped and restored, should this value come back?*** note-window later decided a case the two-bucket model has no home for — *"a machine-local setting that vanishes on reinstall is a **bug, not a design**"* — and specified a per-device-keyed CloudKit record for it. That is machine-local **and** durable, which the old model treats as a contradiction.

**They are orthogonal axes**, and the grid has one empty cell:

| | **Durable** | **Disposable** |
|---|---|---|
| **Travels between Macs** | **Note** | *(empty)* |
| **Per-machine** | **Machine** | **Derived** |

The empty cell is the sanity check: nothing worth carrying between Macs is worth throwing away on one of them.

*Named rather than numbered from here on — "Bucket 1/2/3" carried no meaning and the labels were already sitting there unused. Sibling topics still reference the old numbers: **Bucket 1 = Note**, **Bucket 2 = Machine**, and what they call Bucket 2 also covers what is now **Derived**.*

**The Note tier** *(previously "Bucket 1")*. Travels + backed up; rides inside the bundle. Content (incl. inline `#tags`), UID, colour, created-at, modified-at, soft-delete/archived state, **size**, **`preset_id`**, **float-on-top**. *(Title and tags derive from content — not separately stored.)*

**The Machine tier** *(previously "Bucket 2")*. Per-machine, **backed up per-device**, so a reinstalled Mac gets its own values back. Window coordinates (display-local), **home display**, home-Space, open/hidden visibility, **`last-opened`**.

**The Derived tier** *(new — the disposable half of what "Bucket 2" used to cover)*. Per-machine and genuinely disposable; rebuildable from the Note and Machine tiers plus content. The **resolved rect**, title / preview caches, the search index, z-order / last-active.

*`last-opened` sits in **Machine**, not Derived *(resolves review-004 F7 — it was dropped from both inventories in the tier rewrite)*. The Derived tier is defined as **rebuildable**, and `last-opened` is not reconstructible from anything — so it cannot live there, and it is a user-visible sort axis worth keeping across a reinstall. **`z-order` / `last-active` are a different attribute** — window stacking and focus, not a sort axis — and are genuinely disposable, so they stay in Derived.*

**The classification rule is now two tests, applied in order:** *does it ride with the note?* → Note. Otherwise: *would losing it on a wipe be a bug, or a shrug?* → Machine or Derived. Any future state gets sorted by these, not case-by-case.

**Why position and home display moved to durable.** Fumi's premise is notes as **furniture** — they live in *places*. Losing every note's position on a reinstall means rebuilding the desktop by hand, which is not graceful degradation but the loss of the product's value on that machine. note-window's principle applies with far more force to a hundred note positions than to one colour-swatch pointer. The original *"precise coordinate restoration isn't worth engineering"* was a **cost** argument made before this epic established the per-device pattern; now that the facility is needed anyway, the marginal cost of putting position in it is small. *(This also completes the correction begun by Note Size Classification, which found the coordinates precedent **contaminated** — swept along with home-Space's forced disposability — and then only re-ruled on size.)*

**home-Space sits in the Machine tier because its *intent* is durable, but it is best-effort**: the stored UUID travels and restores like any Machine-tier value, and whether the OS still has a Space wearing it is not ours to guarantee. On a restored Mac an unresolvable home falls back to Space 1. ~~*Originally: "home-Space cannot join them, and that is not a choice. macOS Spaces have no identity surviving an erase-and-reinstall (they are persisted to neither iCloud nor Time Machine), so there is nothing to reattach to … The OS denies it, not the model."*~~ *(Amended 2026-08-30 — the parenthetical is false: `com.apple.spaces.plist` is included in Time Machine and carries the Space UUIDs. The tier placement is unchanged and the re-derivation is in Review F6 below, which is where the ruling lives.)*

**float-on-top → Note** *(resolves review-003 F14; reverses the earlier "parked in B2 for now")*. The parking rationale was *"closer to coordinates than to Markdown"* — but that comparison stopped working once we knew **why** coordinates are machine-local: a coordinate is anchored to *hardware*, meaningless without a display arrangement. Float-on-top has **no display dependence at all** — no screen, no arrangement, no resolution step.

The colour precedent settles the classification, and it was initially misread in both directions. note-window's model is **per-note role (syncs) + one app-level active swatch per Mac (machine-local)**. There is no per-note colour override per machine. So the precedent reads: *per-note identity syncs; the machine-level rendering choice is machine-local.* Float-on-top is per-note, not an app-level rendering mode. For it to be the swatch's shape it would have to be an app-level *"float all notes on this Mac"* setting, which nobody proposed.

**The strongest counter-argument, and why it loses.** Float-on-top is **z-order policy**, and layering is a desktop concern — z-order/last-active sits in the Derived tier for exactly that reason. But the Machine tier exists for state that differs because **machines differ** (screens, arrangements, hardware). Float-on-top wouldn't differ for any machine-intrinsic reason — a 27" display doesn't make floating more or less appropriate. It would differ because **what you're doing there differs**, which is a *context* difference. The model has no tier for that, and inventing one for a single boolean is disproportionate.

**The decisive argument is asymmetric discoverability.** note-window decided a floated note has **no persistent indicator** — *"a floated note is self-evidently floating; that on-top-ness **is** the signal."* So the two ways of being wrong are not equivalent:

- *Syncs, and you didn't want it* → the note is floating in your face on the other Mac. Noticed in seconds, untick.
- *Doesn't sync, and you did want it* → the note sits quietly behind other windows, with **no cue anywhere** that it was meant to float. Possibly never noticed.

A wrong-but-visible state beats a wrong-but-invisible one, and with no indicator the machine-local option is specifically the invisible failure.

**Accepted cost:** a shared boolean means float cannot differ per Mac. Judged the rarer want — floating reads as *"this note always stays up"*, a persistent property like colour, not a per-session toggle.

**open/hidden visibility stays in the Machine tier.** Which notes are showing is the working state of *this* desktop, changes constantly, and is per-machine by nature — but durable rather than derived: open notes should return after a reinstall.

**What a restore now looks like:** notes come back **on the right displays at the right coordinates and their authored sizes**. the Derived tier rebuilds itself. Spaces are the one best-effort part: the stored home UUID comes back with the rest, and whether the OS still has a Space wearing it is unverified — an unresolvable home takes the ordinary Space-1 fallback, while a note homed to Space 1 resolves outright, since `""` is a working identifier anywhere. ~~*Originally: "on Space 1 rather than their original Spaces … Only the Spaces are lost, and only because macOS makes them unrecoverable."*~~ *(Amended 2026-08-30 — that stated the struck "unrecoverable" ground as fact; see Review F6's revision, which replaced the footing without changing the tier.)*

**"Disposable as a unit" now applies to the Derived tier only.** the Machine tier is consolidated per-machine but no longer throwaway.

*(Physical realisation of the per-device store — CloudKit private database keyed by a stable per-device identifier, or a replacement — is **storage-and-sync's**. note-window already has an open entry there asking whether anything besides the swatch pointer wants that shape; window and display state is the answer — and, since 2026-08-05, the **default new-note size** as well. See `size` at creation.)*

### Decision — the record names placement; the AppKit archive is a transient wire format *(2026-08-30, from space-homing triage 001)*

> **Placement state is explicit, readable fields on the record. The AppKit restorable-state archive is never stored — it is read at capture and, if the placement route wants one, synthesised at restore.**

**The blob loses on the tier split, before queryability is reached.** Its unit is a *frame*, and a frame straddles two tiers:

```
NSWindowLayoutWindowFrame   {{200, 200}, {320, 232}}
                              └─origin─┘  └─ size ─┘
                              Machine        Note
                              per-machine    travels, in the bundle
```

`size` is the Note tier by an argued ruling — content-anchored, absolute points, in the bundle, synced. Position is the Machine tier because it is anchored to hardware. The archive fuses them into one opaque value that can only sit on one side of that line. Machine-local, and `size` stops travelling — which undoes Note Size Classification and, with it, note-window's version-preview and restore-takes-geometry decisions, both of which rest on a snapshot's recorded geometry meaning something on a second Mac. In the bundle, and position syncs — the two-Mac ratchet the write invariant exists to make structurally impossible.

**The same opacity defeats the write invariant itself.** *A deliberate act on exactly one machine writes; a value each machine derives independently never does* is a **per-field** rule. An archive has no fields to apply it to: the resolved rect (Derived, never written back) and the authored size (Note, written on a deliberate resize) arrive in the same lump, so no writer can be told from any other.

**Queryability is the secondary argument, and it is stronger here than it was for Chrome.** The CLI and MCP are first-class surfaces in this product. `fumi list --space 7` against explicit fields is a filter over the read model; against archives it is unarchiving every note's state to answer a query — and an agent asking *which fumis are on this Space* is ordinary work, not an edge case. It is secondary only because the tier argument already settles it.

**One of the concern's arguments rests on a retracted premise and is recorded so it isn't re-raised.** It reads *"the store is also plain Markdown files in a user-chosen folder, which sits awkwardly with an embedded base64 archive."* That store no longer exists: the folder driver was stood down, the store is bundles with CloudKit as transport, and Machine-tier state lives in the SQLite read model and the per-device record — nowhere near the Markdown. A base64 column there would have been perfectly comfortable. The blob loses on the tier split, not on tidiness.

**We do not need both, and that is measured rather than assumed.** Storing fields does not force the SkyLight route: a **synthesised** two-key archive, built from stored values and never captured from any window, placed a borderless window on the target Space — 242 bytes against ~1400 for a captured one (space-homing's `scratchpad/t/synth.m`; the scratchpad is transient and the probe is no longer on disk, so this is cited from their record, not re-run here). So the archive is a *wire format we construct on demand*, not a store:

```
capture:   window ──encode──▶ [archive] ──read NSWindowWorkspaceID──▶ record.home_space
                                  └─ discarded

restore:   record.home_space ──build 2-key archive──▶ [archive] ──restore──▶ window
                                                         └─ discarded
           (or the SkyLight route — no archive at all)
```

**A caveat from that same measurement, which suits us:** the synthesised `NSWindowFrame` key did **not** apply — the encoding did not match what AppKit expects — so geometry would come from `setFrame:` regardless. That narrows the archive's job to Space placement alone and leaves geometry sourced from our own fields on their own tiers, which is exactly the separation the first argument demands.

**What the read half buys unconditionally.** Reading a window's home Space needs **no private API** — archive the window's own restorable state, read `$top.NSWindowWorkspaceID`, get the stable managed-space UUID. That holds whichever placement route wins, so capture is settled here even though placement is not ours to settle.

**The question that unstuck this was "do we need both?", and the answer is that the alternatives were never symmetrical.** The archive does two separable jobs — *reading* a Space (`encodeRestorableStateWithCoder:`, the only public way to learn one) and *placing* a window (`restoreStateWithCoder:`, one of two candidate routes). Chrome conflates them: it keeps the captured lump on disk and replays it, so for Chrome the archive **is** the storage format. That conflation is the whole reason it read as a rival to explicit fields. Separate the jobs and there is no "both" to choose between — one store, plus an archive constructed and discarded at each end.

**One field-shape rule follows, and it is this document's to state.** `home_space` is a **string whose empty value is meaningful** — Space 1 records as `""`, and absent means *no home recorded*, never *Space 1*. The two must stay distinguishable in the record, because collapsing them places those notes on whatever Space the user is standing on. Same shape as colour, where the field is never empty because Neutral is a role rather than an absence; here the empty string is a value rather than an absence.

**Cost accepted:** field-mapping code and owning the restore path, where replaying a captured lump would have been free and is battle-tested at Chrome's scale. Bought with it: every placement value readable, queryable, diffable and writable by the agent surface, and each one classifiable into its own tier.

*Sibling check: space-homing (research) — its record holds that reading the home Space is public API (`$top.NSWindowWorkspaceID`) while only placement is private; that a synthesised two-key archive places a window correctly though its `NSWindowFrame` key does not apply; and that the placement route (AppKit restoration vs the SkyLight calls) is an open tradeoff there. Nothing here revises any of it — this decides only what the note record stores, which their concern referred to this topic.*

---

### Arrival: a new Mac vs a restored Mac (amended by the geometry ruling and the durability axis)

The old text said machine-local state *"is simply not honoured"* on *"reinstall / a different machine"* and everything cascade-renders. Both halves of that need splitting — **the two cases are no longer the same**, because the Machine tier is keyed per device.

**A genuinely new Mac** — the Machine tier has no record for this device, so:

- **Position cascades** — notes stack down-and-right on Space 1, as before.
- **Size is honoured** — the note arrives at its authored size, fitted to the display if it doesn't fit (fit only; never written back).
- **A preset-bound note cascades only for the axes its preset doesn't set** *(corrected, review-004 F3 — this read "doesn't cascade at all", which predates Axis composition)*. A preset setting Position resolves it against the new Mac's screen and lands where the preset says; a **Size-only** preset sets no position, so that note still cascades like any other. Since preset definitions sync, "left rail" means the same thing on arrival as it did at home.

So a new Mac looks like *your notes*, at *their* shapes, with the bound ones already in place — rather than a uniform cascade of default rectangles. A new machine starting without inherited positions is **correct behaviour, not a failure**: those coordinates described a desktop that isn't this one.

**A reinstalled or restored Mac** — the same device, so its the Machine tier record returns:

- **Position and home display are restored** — notes return to their real places on their real screens.
- **Size and binding arrive from the Note tier** as always.
- **Spaces are the one best-effort part** — the stored home UUID returns with the rest of the Machine tier, and an unresolvable one falls back to Space 1; a Space-1 home resolves rather than falls back. ~~*Originally: "**Only Spaces are lost** — home-Space falls back to Space 1, because macOS leaves nothing to reattach to."*~~ *(Amended 2026-08-30 — the struck "unrecoverable" ground; whether the OS still holds a restored Space's identity is unverified in both directions. See Review F6's revision.)*
- **the Derived tier rebuilds itself** and is never missed.

**Storage homes (via the bundle, see Non-Text Content):** the Note tier rides *inside* each note's bundle (travels atomically with content + assets); the Machine tier lives in the central non-synced store. This supersedes the earlier "hidden dotfolder" sketch. Physical layout still storage-and-sync's to ratify.

### Attribute set & access model (decided)

**Stored intrinsic set** (in each bundle, travels): content (`content.md` + `assets/`), **UID** (a stored canonical field; the `{ulid}.fumi` folder name is a derived mirror of it), colour (a role), **created-at**, **modified-at**, soft-delete state (+ `deleted-at`), **size**, **`preset_id`** (a preset UID), **float-on-top**. **Title and tags are derived** from content — not stored — and cached in the read model. The content *is* the note.

**Scope of this list** *(resolves review-003 F2)*: it is the whole **model** footprint — what a fumi *is*. It is deliberately **not** every field in the stored record. storage-and-sync may add **plumbing** fields to the same record — what they are is theirs to define, and theirs to change; **consult that topic for the record's actual shape**. *(Amended 2026-08-03 — this named `schemaVersion` and `edit_counter` as the two that existed. `edit_counter` was dropped on 2026-07-31, per-field merge against the CloudKit ancestor having retired it before it shipped.)* Those are mechanism, not model — absorbing them here would make note-model start owning storage-and-sync's implementation, which is the opposite of the split the two topics agreed. The earlier phrasing, *"that's the whole stored-metadata footprint"*, over-claimed and is retracted; downstream topics should read this list as canonical for the note model and consult storage-and-sync for the physical record.

*(`size` and `preset_id` added by Note Size Classification. The one attribute previously left unresolved — an ordering value for note-level chips — is **gone**: note-level attachments were killed as a concept, so there is nothing to order. See Non-Text Content.)*

**`created-at` / `modified-at` are engine-maintained fields, not filesystem timestamps** — fs mtime is machine-local, unreliable across sync, and wiped by copy/restore (**resolves review F2**). The engine stamps them so they travel and stay correct for sort-by-recent.

**Clock skew is accepted, and timestamps are never repaired** *(2026-08-03)*. Both timestamps, and ULID's rough creation ordering, rest on the clock of whichever Mac did the stamping. Conflict resolution is unaffected — storage-and-sync merges per field against the CloudKit ancestor and consults no timestamp — so the exposure is confined to **display ordering**, where ordinary drift is a few seconds and self-corrects the moment clocks sync.

The one case with a visible symptom is a **future**-dated stamp: a Mac running days ahead stamps a note that then sits at the top of sort-by-recent long after the clocks agree. **We do not correct it.** An app that silently rewrites the user's timestamps is a worse failure than a misplaced row — the value would then be wrong *and* unrecoverable, and the same reasoning already rejected write-back everywhere else in this document.

*Rejected: sorting the read model on `min(modified_at, now)`.* It hides the symptom without mutating anything, which is genuinely the cheap fix — but it makes the sort disagree with the field it claims to sort by, for a case that needs a materially wrong clock to occur at all. If it ever becomes a real complaint, the read model is disposable and this is a one-line change there. *(A server-side receipt time, should CloudKit's record modification date prove usable as a tiebreak, is storage-and-sync's to offer — not something this model asks for.)*

**`modified-at` triggers** *(review-002 F7)*: stamped on edits to **content** (`content.md`) ~~or **assets** (add/remove)~~ only — title and tags derive from content, so they bump it automatically. *(**Asset limb struck 2026-08-09, resolves review-007 F2.** It was written when the model had two placement kinds, so a note-level attachment could be added or removed without touching content. That kind is dead — *"every asset is referenced by content — this is an invariant"* — so every user-initiated asset change is already a content edit, and the limb's only surviving referents were engine-side. Read literally it licensed an asset **sweep** to stamp a **synced** field from a non-deliberate event that each Mac performs independently: the shape the write invariant forbids, and the one the reprojection pass was explicitly excluded from — *"the pass writes nothing to the store and never bumps `modifiedAt`"*. Nothing changes for any user action, and materialisation is unaffected because it rewrites `content.md` inside a write that stamps anyway.)* **Not** bumped by viewing/opening (that's `last-opened`, the Machine tier), by soft-delete/restore, by a **colour** change, by **geometry** (`size` / `preset_id`), or by a **float-on-top** toggle — pure metadata shouldn't leap a note up sort-by-recent. **Nor by an asset sweep**: collecting bytes that only an archived version referenced changes no content, and the note's own content is what the timestamp describes.

#### A damaged bundle — what a fumi is when its parts are missing

##### 2026-08-05 — revised

*Trigger: triage from storage-and-sync — "Repair values are 'marked as repairs', but storage-and-sync decided the repair carries no marker": their 2026-08-04 repair decision carries no per-field marker and rejects one explicitly, so the entry below asserted a stored property that does not exist.*

**"Marked as repairs" is struck.** It read as a fact about the stored record while sitting inside an attribute inventory, and nothing in the record carries provenance: storage-and-sync weighed a per-field marker and rejected it — it would be the first thing either the sidecar or the `CKRecord` carried about *how* a value got there rather than what it is, and an older build would read a marked field as an ordinary one. Nothing in this model branches on the distinction either, so there was no requirement underneath the sentence.

**What it was actually protecting, in the register it belongs to:** the repair values are **named by this model** — colour → **Neutral**, size → **the creation default** — so a never-null invariant is satisfied by a stated rule rather than by whatever the code happens to reach for. That is a claim about the design, not a property of the note.

**Most repairs now invent nothing at all.** storage-and-sync's ordering: *"A damaged sidecar's repair consults the note's record first, and defaults only what the record cannot supply. The repair does not write until this store is `reconciled`. Meanwhile the note renders a fallback without storing one."* So wherever a better source exists, no invented value is ever written — *"the synced record beats a local default"* stops being an aspiration and becomes the mechanism. The render-without-storing shape is the same one a dangling `preset_id` already uses.

**With sync off, the repaired value simply *is* the note's value.** This is the residue — the only case where a default is genuinely written — and it needs no provenance, because there is nothing for provenance to be *for*: no record to disagree with it, no second machine to propagate it to. storage-and-sync's own definition says so directly — *"a store that has never had a sync relationship is always reconciled — local state is total state; there is no elsewhere."* Local state is authoritative there, so a repaired Neutral is the colour, not a lesser kind of colour. The real cost is the data loss (a Blue note comes back Neutral) and no marker would have prevented it.

**A damaged bundle is never surfaced to the user.** Repair is internal, and the model should stop implying a provenance story a badge could later be built on. The bundle sits `unresolved` and is retried in storage-and-sync's index; that stays engine-internal. *Rejected: a per-note "this was repaired" notice* — telling someone which field was invented requires per-field provenance, which is the rejected marker arriving by another route; and it can only ever fire in the sync-off case, where nothing better was recoverable anyway. A notice that fires only when nothing can be done about it is noise.

*Sibling check: storage-and-sync — its 2026-08-04 repair decision gates the write on `reconciled` and consults the record first, and its `reconciled` definition makes a never-synced store trivially reconciled with local state as total state. Nothing here revises either; this strikes the marker claim and records what a damaged bundle is to the model.*

##### 2026-08-03

> *Three clauses below are superseded by the 2026-08-05 entry above and must not be read as live (noted 2026-08-05; the entry itself is history and stays as written):* **"Both are marked as repairs, not as choices the user made"** — struck outright; **"default the rest, rewrite a fresh `meta.json`"** — storage-and-sync replaced that recovery on 2026-08-04 with consult-the-record-first; and **"It writes"** — now conditioned on the store being `reconciled`. The rest of the entry stands, including *`content.md` is what makes a fumi a fumi* and *the synced record beats a local default*.

*(2026-08-03, resolves review-005 F10)*. Three passages referenced bundle damage without saying what the *note* is in that state. The mechanism is storage-and-sync's and already decided (*recover `uid` from the folder name, default the rest, rewrite a fresh `meta.json`, flag it; quarantine only a bundle with no readable `content.md`*). What was missing is the model-level half:

- **`content.md` is what makes a fumi a fumi.** A bundle with readable content and no usable `meta.json` **is a note** — recoverable, because the folder name mirrors the UID. A bundle with no readable `content.md` is **not a note**, whatever else it holds: the content *is* the note, so there is nothing to recover into. Bytes in `assets/` referenced by nothing are not a note either — they are the state the sweep calls garbage, which is why the sweep's grace period exists.
- **The never-null fields have documented repair values**, so the invariants hold rather than being quietly violated: colour → **Neutral**, size → **the creation default**. Both are marked as repairs, not as choices the user made.
- **The synced record beats a local default.** A defaulted field is a last resort — where the note's record is still available from CloudKit, the true value is restored from it and no default is invented. Damage is local; the record usually isn't.
- **Repair is not the write the invariant forbids.** *"Never written by a value each machine derives independently"* is about values every Mac computes from shared state and then fights over. A repair is triggered by **local damage on one machine**, is not derivable anywhere else, and does not recur — the same shape as a user action, and the opposite of a resolved rect. It writes.

**Access model — index, don't scan:** we do **not** parse every bundle at query time (cumbersome at hundreds of notes). Instead:
- **Bundles = source of truth**; a note's full content is read **on-demand** (open / agent `read`), never for listing.
- A **central SQLite index = the query layer** — a projection of every note (UID, derived title, tags, colour, timestamps, soft-delete) plus Machine-tier machine-local state. `list` / search / filter / sort hit SQLite, not the filesystem.
- The index is **derived and kept in sync** (the engine updates the row in the same transaction as the bundle write; reconciles on launch) and **fully rebuildable** from the bundles.

  ~~*Originally: "engine updates on write; **watches the store via FSEvents for folder-sync changes**; reconciles on launch".*~~ **The watcher is gone, and the assumption under it went first** *(2026-08-03)*. A watcher earns its place only when something other than Fumi can write the store — the sketch above assumed a folder in Dropbox or iCloud Drive, where a sync daemon lands a bundle behind the engine's back and the index goes stale until something notices. **v1 has no such writer**: storage-and-sync fixed the store as local truth with CloudKit as the transport, so a change made on another Mac arrives *through* the engine as a record, and the engine writes the bundle and the row together. There is nothing left to watch.

  **Launch reconciliation survives, with a different job** — it used to catch what a daemon landed while the app was closed; now it catches a bundle left half-written by a crash or a kill.

  **Nor is the watcher waiting in the wings.** It would return only with the **folder driver**, which storage-and-sync has since stood down as a design target — *"a real future project, not a bolt-on"* that *"may never be built"*, its seam kept for testability rather than portability. Treating FSEvents as pending work would misrepresent a decision that has already been taken.
- So intrinsic *truth* lives in the bundle (travels); the index is a fast, disposable **read model**; machine-local state lives only in the index.

**Derived values are versioned, and a rule change forces a reprojection** *(2026-08-03, resolves review-005 F6)*.

Every derived value here — the title, the tag-set, the preview — is a function of **content *and* of the rules deriving it**. The rules are code, code ships in versions, and two Macs can sit on different ones for weeks (Sparkle updates on its own schedule; a laptop can be closed).

**Version skew across Macs is accepted, because it is self-healing.** Take a note reading `Weekend list #café #🔥`. A Mac on today's Unicode-and-emoji rule derives `café` and `🔥`; a Mac still on an ASCII-letters build derives neither, and filtering there finds nothing. That is a stale Mac behaving correctly by the rules it has, and it corrects itself on update — **derived values live in the Derived tier, per-machine and rebuildable, and nothing derived is ever synced**, so no wrong value can reach the Note tier or another machine. This is a materially different situation from the one NFC normalisation exists to prevent: *that* divergence was two Macs on the **same** build deriving different keys from identical bytes, permanently, with no event that would ever reconcile them.

**What does not self-heal is the update itself, and that is the actual rule this establishes.** The index is *"fully rebuildable"*, but rebuildability is a capability, not a trigger. Nothing said a derivation-rule change is a reason to rebuild — so on the Mac that *did* update, the projection sitting in SQLite was still built by the old rules and is never revisited. Shipping the Unicode tag rule would therefore do nothing for existing notes until each one happened to be edited: `#café` stays invisible on the up-to-date machine. Worse than the skew, because it never resolves.

> **The derivation rules carry a version. When it changes, the projection is rebuilt rather than trusted.**

Cost: a one-off full reprojection on any release that touches a derivation rule — a table rebuild over hundreds of notes, not a migration of files. Cheap because both halves already exist on storage-and-sync's side: their index carries **its own schema version in a `meta` table**, and the index is already declared fully rebuildable. This adds one comparison at launch, not new machinery.

*Sibling check: storage-and-sync — its Read-Model Index decision holds a `meta` table for "the index's own schema version" and states the index is fully rebuildable from the bundles. Nothing here revises that; the derivation version is a second value of the same kind, and where it physically sits is theirs. Rerouted below.*

*Physical realisation — SQLite schema, on-disk bundle layout, sync-safety (SQLite stays machine-local), ~~FSEvents reconciliation,~~ live multi-Mac concurrency — is **storage-and-sync's** to own. Sketched here; rerouted. (FSEvents struck 2026-08-03 — not deferred scope for them to own, but a mechanism v1 deliberately does without; see the access model above.)*

### Rerouted

- **Physical storage/access layout → storage-and-sync:** bundle layout, SQLite schema, the read-model/index, filename scheme, sync-safety, soft-delete-as-trash-folder, attachment copy, and the live multi-Mac concurrency problem. Note-model owns the *attribute set* + the *intrinsic vs machine-local split*; the mechanism is rerouted.
- **Manual note-ordering** — *if* the manager offers drag-to-order, that order would be an intrinsic per-note field (it should travel). Flagged for management-window; not built here.

### Review F6 — home-Space disposability (accepted)

#### 2026-08-30 — revised

*Trigger: triage from space-homing: "`com.apple.spaces.plist` IS captured by Time Machine" — the plist is measured as included in Time Machine and carries the Space UUIDs, so the "technically forced" justification below has no support as written.*

**The ruling is unchanged and its footing is replaced.** Home-Space stays **the Machine tier**, best-effort, with a Space-1 fallback where the home does not resolve. What is struck is *"technically forced"* and *"preservation is impossible"* — both claim a certainty the measurement removes.

**The framing that was wrong was treating this as Fumi failing to preserve something.** Fumi's side already survives: `space` rides in storage-and-sync's per-device blob, which lives in Application Support where Time Machine captures it, so the UUID comes back on a same-Mac restore. The open question was never whether *we* keep the value — it is whether the **OS** still has a Space wearing it, and that is unverified in both directions.

**So the honest ground is one this document already owns: *intent travels; resolution does not*** — the fourth application of the rule that settled geometry. `home_space` is intent, stored and restored like any Machine-tier value; whether it resolves belongs to the OS. A UUID that does not resolve needs nothing new, because the model already handles it — the deleted-Space fallback, and note-window's home resolution. **A restore is not a special degradation; it is the ordinary unresolvable-home path arriving by another route.**

*(Amended 2026-09-01 — this read "the deleted-Space fallback to Space 1, and space-homing's **home ladder**". Two words, both now wrong in the same small way. There is no ladder: note-window resolves a home as **two independent rules plus a fit** since 2026-09-01, and the resolution is theirs rather than space-homing's. And the fallback is **display-qualified** — an unresolvable home lands on **the first Space of the home display**, the main display's where the home display is gone, because under* Displays have separate Spaces *each display owns its own first Space. On a one-display machine that is Space 1 and the two readings coincide, which is why every plain "falls back to Space 1" elsewhere in this document still reads true. Nothing about the ruling changes: the fallback destination is note-window's and space-homing's to state, and this document's claim is only that an unresolvable home needs no new machinery.)*

This is a better property than the document previously claimed for itself: if a restore does turn out to reinstate Space identity, best-effort quietly starts succeeding and nothing here needs revisiting. *"Content is the value; Space-homing is the graceful-degradation bonus"* stands.

**One measured detail that qualifies the fallback claim.** Space 1's UUID is the **empty string**, and `""` is a working identifier on any machine — so a note homed to Space 1 *resolves* after a restore rather than falling back to it. Same destination, different path. *"Everything falls back to Space 1 on a restored Mac"* is therefore not literally true, and the distinction leans on the absent ≠ `""` rule landed above in the placement-fields decision.

The *how Space degrades/persists* detail remains space-homing's domain. Whether restoring the plist reinstates identity is a live research question there, not a blocker here — the ruling holds under either answer.

*Sibling check: storage-and-sync — its per-device blob carries `{position, display, space, visible, lastOpened}` per note, is a real file in Application Support outside SQLite, is keyed by hardware platform UUID (restore onto replacement hardware starts on defaults), and it records that Time Machine covers a same-Mac wipe-and-restore of that blob. Nothing here revises any of it; this reads it as the reason Fumi's own half of the home already survives.*

#### Initial

Home-Space stays **the Machine tier** (Space-1 fallback on reinstall/other-machine). Not merely a pragmatic trade but **technically forced**: macOS Spaces are ephemeral — a full erase + reinstall leaves no managed-space UUID to reattach to (Spaces aren't persisted to iCloud or Time Machine), so preservation is impossible. "Content is the value; Space-homing is the graceful-degradation bonus." The *how Space degrades/persists* detail is space-homing's domain, and its brief already carries the deleted-Space → Space-1 fallback.

### Identity (carried, reaffirming discovery)

Identity is the **UID**. The title is a **derived display label only** and is never an identifier anywhere — not in the CLI/MCP, not as a filename, not as a store key. This resolves the "title feels too ephemeral to be an identifier" discomfort: the title is *allowed* to be ephemeral precisely because nothing load-bearing ever keys off it. (UID scheme pinned: **ULID** — see Identity & UID.)

---

## Note Size Classification

### Context

*Rerouted from: note-window · discussion · 2026-07-27*

Surfaced while designing the version-history browse UI. **This topic's two-bucket rule needs to rule on note *size*.**

**The current position** is that window **position** is machine-local — screens differ, so exact coordinates are "just how this Mac shows it". Size has been treated as travelling with position, but it was never separately argued.

**The case for size being intrinsic (rides in the bundle, syncs):** **size often encodes content.** A user sizes a note to fit what's in it — a three-line reminder and a long document want different shapes, and that shape is a property of *the note*, not of the Mac displaying it. Opening the same note on a second Mac at an unrelated size loses information the user deliberately expressed.

**The case for size staying machine-local:** displays differ — a size that suits a 27" screen may not fit a laptop. Positioning presets/tiling also change size as a *transient screen arrangement*, which is machine-local by nature. And position and size travelling separately is arguably incoherent.

**The two-bucket test to apply:** *"does this ride with the note, or is it just how this Mac shows it?"* Size plausibly answers **both**, which is why it needs an explicit ruling rather than inheriting position's.

**If size is ruled intrinsic**, a display-fit **clamp** is required — a synced size larger than the receiving Mac's screen must be bounded to what fits.

**Related but separate — do not conflate** (rerouted to storage-and-sync): whether **version snapshots record geometry** so that scrubbing through history previews each version at the size it was written at. That is a *historical record* question and is independent of how the live note's current size is classified here. Snapshots could record geometry even if live size stays machine-local.

**Why it wasn't already settled:** note-window recorded the user's *intent* that "geometry is syncable — size is intrinsic", but flagged it as note-model's call and noted that its version-preview animation, its restore-takes-geometry decision, and part of its scrubber rejection all need revisiting if size landed machine-local. Meanwhile note-model's machine-local list still read "window coordinates **+ size**". **The two documents contradicted each other** — that was the actual open item.

### Journey — two framings tried and discarded before the answer got smaller

**False path 1 — "position and size split cleanly, one each side."** The first landing was: position is anchored to *hardware* (a coordinate only means something relative to a display arrangement), size is anchored to *content*, so they legitimately fall on opposite sides of the two-bucket line and the "splitting them is incoherent" objection dissolves. True as far as it goes, and it survives into the final answer — but it treats geometry as *values*, which is what generated the next two problems.

Worth keeping from it: the precedent for classifying coordinates as machine-local was **contaminated**. Home-Space landed there on a claim that macOS *forced* it, and coordinates were swept along on a "cascade-render is good enough" cost-of-engineering argument. Neither is a two-bucket ruling. Position stays machine-local in the final answer, but now for a *principled* reason. *(Amended 2026-08-30 — the parenthetical here read "Spaces have no persistent identity across reinstall — 'technically forced', not a classification ruling", which is the ground struck by Review F6's revision. The contamination diagnosis is unaffected and, if anything, sharpened: the precedent was contaminated by a claim that has since turned out to be unmeasured.)*

**False path 2 — relative/proportional position.** Raised by the user (store position as a share of screen resolution, so a note re-lands in the same relative spot on any screen; Moom does something like this for half-screen windows) and initially run with. It generated real complications:

- **Anchor reference point.** Storing the *top-left* as a proportion breaks the very case that motivated it: a note at the bottom-right of a 27" has its top-left at ~90%, so applied to a laptop with an absolute size it overflows off-screen. It needs an anchor *affinity* ("near the bottom-right"), which is **inference** — and note-window had already decided **no inference on capture**.
- **Proportional to which display?** Two Macs can have different display counts, so the intent would have to reference display identity rather than float free.

**Both evaporated once the user corrected the framing** (see Decision): relative geometry only ever exists *inside preset definitions*, which note-window already expresses as measurements-or-shares. A freely-dragged note needs absolute coordinates, which are machine-local. Proportional position was solving a problem that named presets had already solved. **Dropped.**

**False path 3 — a generic `{mode, value}` "geometry intent" object.** The orchestrator's attempt to unify bound and free geometry into one per-note field carrying a mode plus either a relative spec or absolute points. The user's correction: *"I thought we were labelling these things as labeled sizes, effectively, and we save the name rather than the size."* Correct — this was reinventing, badly, a thing note-window had already solved by making presets **named and addressable**. The per-note field is just a name.

### Decision — geometry intent is the Note tier; resolved geometry is the Machine tier

**Size is intrinsic (the Note tier).** That is the triage question's answer.

The governing rule is the third application of one this epic has already landed twice — note-window's **"a home is intent, not a location — fallbacks resolve without rewriting"**:

> **Geometry *intent* travels. Resolved geometry does not.**

**Added to the Note tier (rides in the bundle, travels):**

- **`size`** — the **authored** size, in **absolute points**. Content-anchored: a user sizes a note to fit what's in it, and that shape is a property of the note.
- **`preset_id`** — a **preset UID**, or empty (freely placed). *A name is portable in a way coordinates never are* — "top-right quarter" means the same thing on a 13" laptop and a 27" Studio, and the receiving Mac needs to know nothing about the sending Mac's displays. *(Originally named `placement`; renamed for review-003 F5 — see Axis composition below. `_id` keeps the field distinguishable from the preset entity in prose.)*

**Staying in the Machine tier (machine-local):** position coordinates, and the resolved rect (a cache).

### Axis composition — a preset overrides only the axes it sets *(resolves review-003 F5)*

The first phrasing was *"a binding resolves against the current display and **wins**; otherwise the authored size applies."* That treats a preset as all-or-nothing, which contradicts note-window's decided model: **a preset is three independently-toggled axes — Size · Position · Display — and any subset is valid**, with per-dimension units (points or a share). A position-only preset must leave size to be sourced from somewhere; a size-only preset must leave position alone. The rule was never stated:

> **Each axis is sourced independently — from the preset where it sets that axis, otherwise from its normal home: size → Note, position → Machine, display → the note's home display.**

A preset overrides the axes it sets, and nothing else.

**Mixed units need no special handling.** A share-valued width re-resolves per screen; an absolute height re-resolves to itself. Re-resolution is idempotent for absolute values, so one preset reference covers a mixed preset with no extra machinery — the earlier worry that absolute axes are "applied and forgotten" while relative ones stay bound turns out not to need modelling at all.

**The break trigger is scoped to the axes the preset sets.** The session first landed a flat *any-geometry-gesture-breaks-it* rule. That drops bindings a gesture never touched: a **size-only preset with a share-valued width** genuinely needs to stay bound, and dragging the note would clear it.

> **A gesture breaks the binding only if it overrides an axis the preset actually sets.**

Drag breaks a preset that sets Position; resize breaks one that sets Size; neither breaks one that only sets the other. The binding stays **atomic** — one reference, cleared or not — only the *trigger* is scoped. *(The break trigger itself is note-window's call under the reroute; this is note-model's recommendation, replacing the flat version previously sent.)*

**Why absolute points, not a share (the size-is-fixed argument):** size is relative to *content*, not to screen. Text doesn't shrink when you change monitors, so a note sized to fit its content should keep its point size. Technically sound — **macOS points are density-independent**, so a 400×600pt note is the same *physical* size on a Retina laptop and a Studio Display, and content fit genuinely survives the trip. The accepted flip side: that same note is ~55% of a 27" logical width and ~97% of a 13" one. Content fit preserved, screen proportion wildly not — which is exactly why the safety net below is required.

### Consequence rules

- **Resolved geometry is never written back to the Note tier.** Not because it would change behaviour (a binding overrides it either way) but because a synced field that every Mac writes and none reads is **pure conflict churn** — and a resolved rect fails the two-bucket test on its face: it is *literally* "just how this Mac is showing it right now". It caches in the Machine tier, which already holds derived caches.
- **Two clamps, and they are not the same kind of thing** *(review-004 F6)*. The **maximum** exists because screens are finite and **vary per Mac** — 2560pt wide is invalid on a laptop and perfectly valid on a Studio — so it is a **display-time fit that is never written**: the value is right somewhere else. The **minimum** (note-window's floor: chrome band + one line) exists because the chrome needs room, and that constraint is **identical on every Mac** — a sub-minimum size is not "invalid here", it is invalid **everywhere, forever**. So the minimum is a **floor on the value, enforced wherever `size` is written**. That is not writing back a resolution; it is validating against a constant. The sources that can produce a sub-minimum value are all writes anyway — a preset whose captured size is below the floor, a restore from a snapshot predating it, or an agent; a manual resize cannot, because note-window already clamps the drag. *(Amended 2026-08-21 — the floor was cited here as "~180–200pt wide"; note-window raised it to a ~240pt working value on 2026-08-10. The figure is **struck rather than updated**: this rule turns on the constraint being identical on every Mac, which holds at whatever the value is, and the number is note-window's to state. A preset captured below the new floor now clamps where it previously did not — that is the floor doing its job, and needs nothing here. **Sibling check: note-window** — its minimum width is "the band in its fullest state", the binding constraint having moved from the text measure to the fully-populated chrome band. Nothing here revises that.)*
- **The safety net survives, and is a different mechanism from the binding.** Two things were sharing the word *clamp*: the **binding** (a named preset that re-resolves per screen, and stays until broken) and the **safety net** (a note that simply doesn't fit gets bounded to what does). Bound mode handles display changes gracefully; **free mode is absolute points and can overflow**, so the safety net is still needed. Their write rules are opposite — the safety net **must never write back**, or you reproduce note-window's documented failure exactly: clamp fires on the laptop, writes back, note is permanently laptop-sized, and dragging it to the Studio doesn't restore it because drag never resizes.
- **Geometry never bumps `modified-at`.** Identical to the rule already decided for colour — pure metadata must not leap a note up sort-by-recent.
- **Geometry conflicts should be last-writer-wins, with no conflict UI.** Two Macs both resizing is low-stakes; storage-and-sync should not build a prompt for it. *(Stated as note-model's **position**, not a settled rule, and rerouted there as an open question. **Since answered by their model**, 2026-08-03: they resolve per field against the CloudKit ancestor, where two Macs changing the same scalar means the second write lands and wins, and only concurrent `content.md` edits produce the keep-both conflict state. `size` and `preset_id` are scalars, so the position holds without anything being built for it.)*

### Payoff — unblocks note-window's version history

This is why the triage fired in the first place. With size in the Note tier, a **snapshot's recorded geometry is meaningful on any Mac**, so note-window's **preview-animates-to-recorded-size** and **restore-takes-geometry** decisions stand rather than needing revisiting.

**That was first asserted rather than tested** *(review-003 F7)* — restore is a **write** of historical geometry onto the live note, which sits directly against the no-write-back rule. Tested, it holds, and every part resolves from rules already landed:

- **Restore writes the Note tier.** It is a deliberate act on exactly one machine, so the write invariant says it writes — and it should. Restoring v3 means wanting v3's *shape* for the same reason as wanting v3's *content*. That this "pushes a historical size to every Mac" is simply what restoring means.
- **Restore writes the *recorded authored* size, not the clamped one** *(review-004 F6)*. note-window applies two clamps at restore (the current display, and the minimum window size), and their reasoning is *"you've been previewing at that size; committing keeps what you were looking at."* That still holds — the display clamp **re-applies at display after the commit**, so the picture is identical either way. Only the stored value differs, and storing the unclamped value is what makes the note right again when it is next opened on a larger screen. Writing the clamped value would be the fitted-note write-back wearing a different hat. *(The minimum, being a value floor rather than a display fit, does apply to what is written — see the two-clamps rule above.)*
- **A snapshot records the authored (Note-tier) size, never the resolved rect.** A resolved rect is machine-specific, so recording it would make history meaningless on a second Mac — the exact failure this ruling exists to prevent. note-window's own wording already assumes this: *"preview animates the note to that version's recorded size, **clamped to the current display**"* — recorded value, display-time clamp, which is the safety-net rule applied to preview.
- **Preview writes nothing.** It is transient and derived. Only committing the restore writes.
- **A snapshot records `preset_id` alongside `size`.** The binding is part of the note's geometry *intent*, and intent is what travels; a version is a historical state of the note, and its binding belongs to that state. It degrades with no new machinery: restoring a `preset_id` whose preset has since been deleted hits the existing fallback — binding clears, recorded `size` applies.
- **For a bound note, preview re-resolves the binding against the current display** rather than animating to the recorded absolute rect. That is what the note would actually look like if restored *here*; animating to a Studio-shaped rect on a laptop would misrepresent what is about to be committed. *(Preview/restore behaviour is note-window's — rerouted.)*

### Live two-Mac resize — no ratchet (the strongest case for no-write-back)

Scenario raised by the user: a 27" Studio and a 16" laptop, same account, same note open on both. Resize on the Studio to fill the screen — does the laptop's smaller screen fight back, so the note either bounces or is permanently capped at laptop size?

**No.** The Studio's manual resize writes the authored `size` to the Note tier and syncs. The laptop finds it doesn't fit, **fits it at display time, and writes nothing**. The Note tier still holds the Studio's value; the Studio never hears anything back. The ratchet requires the small screen to write back, and it never does.

**This is a better justification for the no-write-back rule than the one it was introduced with** (unplug-the-monitor). The live case is where a write-back would be actively destructive.

**Why tmux ratchets and Fumi doesn't** (the user's analogy, and it's instructive): a terminal is one shared character grid, so every attached client must see *identical* dimensions — tmux has no choice but to clamp the session to the smallest attached client, and that clamped value **is** the session's real state. The medium cannot support an authored-vs-resolved split. Two Macs rendering a note independently can. The failure is **structurally impossible** here, not merely avoided by care.

**"Fits" means the note's current display**, not the union of attached screens — otherwise a laptop with an external monitor would let an off-screen size count as fitting.

### Decision — a synced geometry change applies while the note is unfocused

#### 2026-08-03 — revised

*Trigger: storage-and-sync replaced "honoured at open" with an unfocused/on-blur rule — "at open" assumes a close-and-reopen cycle that a note left up as furniture may never perform.*

**A synced geometry change applies when the note is not focused — immediately if it is already unfocused, otherwise on blur.**

The protection the original rule existed for is untouched: nothing resizes under your hands. What changes is the trigger. **"At open" only fires if the note is ever closed**, and Fumi's whole premise is that it isn't — a fumi is furniture, left up for weeks. So the entry below could leave a synced size unapplied indefinitely, which quietly cancels the decision to sync `size` at all: the field travels, and the receiving Mac never acts on it. A note that has been sitting on the laptop since Tuesday would still be at its old shape in March.

Focus is the right trigger because it is what the objection was ever about. Resizing a window someone is typing in is hostile; resizing one they are not looking at is how every window on the desktop already behaves. An unfocused note converges in seconds; a focused one waits for blur, which costs nothing.

This is the same instinct the entry below cited, applied more precisely — the two note-window rules it names both object to geometry moving **during active use**, not to a window changing while unattended.

**Unchanged by this:** the *fitting* and *homing* rules, which are about a note meeting a display rather than receiving a synced change. The safety net and home resolution still belong to open / relaunch — an oversized note stays oversized until it is next opened, exactly as an oversized Chrome window does, and a topology change still provokes no action at all. See the undock walkthrough.

#### Initial

A synced size change does **not** resize an already-open note on another Mac. It is honoured at open (or when a preset binding re-resolves). Otherwise a note resizes under your hands because someone nudged a corner on another Mac.

Consistent with two note-window instincts already landed: its rejection of write-locking during agent activity ("a note refusing keystrokes is a modal dialog in disguise") and its rule that the conflict reconciler **must not animate geometry** ("the window resizing while you read two texts against each other" is actively harmful). Both Macs simply disagree until reopen, which is calm and harmless.

### Preset identity — UID-keyed, label is display-only

The Note-tier `preset_id` field references a preset by **stable UID**, never by name. The human-readable name is a **label**. Same argument the topic already made twice: ULID over titles for note identity, and case-normalisation for tags. A name-keyed reference fails two ways — **rename orphans it** (management-window decided the editor supports rename, so this is a shipped affordance aimed at the weak spot), and **two Macs holding different presets under the same name resolve silently to the wrong geometry**, which is worse than dangling because it's quiet.

**Built-in tiling layouts use the identical mechanism.** note-window decided the halves/quarters icon grid are not *user* presets, but they are relative geometry and therefore must bind — "left half" is the most portable placement there is, and if applying it didn't bind, left-halfing on the Studio and opening on the laptop would hand you absolute Studio-half pixels, the exact failure binding exists to prevent. So built-ins are ordinary presets that happen to be shipped: **opaque UID + human label**, not user-editable, not deletable. The UID is deliberately *not* human-readable so a user can create their own preset labelled "Left Half" without colliding with the shipped one. No special-casing anywhere.

**Preset names need no uniqueness constraint.** With UID keys, two presets sharing a label is harmless and resolves correctly. A constraint would buy nothing and cost an error state.

**Preset definitions sync** (account-level, not machine-local). This dissolves the same-name-different-geometry failure entirely — two Macs can no longer independently hold different presets under one identity.

### Decision — a bound note also stores its applied geometry (fallback on preset deletion)

The problem: a UID reference survives rename but not **deletion**. Options considered:

- **Lazy drop** — on open, a missing preset clears `preset_id` and the note renders at some default. Rejected twice over: it throws away a size the user deliberately chose, "some default" is unspecified, and *(review-004 F5)* the clear itself would be a write to a synced field triggered by a non-user event and performed independently on every Mac — the exact shape rejected below for the cached-rect promotion.
- **Store the geometry alongside the reference** (user's preference, adopted). Applying a preset **also writes the resolved geometry into the Note-tier `size` field** — but **only for the axes the preset actually sets** *(scoped by review-004 F4)*. A Position-only or Display-only preset does not touch `size` at all; a preset does what it says and nothing else, exactly as Axis composition requires. A **share**-valued Size axis writes its **resolved absolute** — apply "full height, 20% wide" on a Studio and the note becomes 1440×512, so that is what is stored: simply the shape the note now has, and the shape it keeps if the preset is later deleted. A note is therefore never dependent on the preset surviving — if the preset vanishes the note falls back to `size`, exactly as if it had been sized by hand. It keeps the shape it had; it just stops re-resolving.

**`preset_id` is never cleared by preset deletion** *(corrected, review-004 F5 — this originally read "`preset_id` **clears**", which left an unowned write)*. It **dangles**. Resolution is display-time: if the reference resolves, bind; if not, use `size`. **If the preset returns** — restored from backup, re-created, or the library re-syncing — **the note re-binds by itself.**

This is the third application of a rule the document already made twice: a hard-deleted **note link** is *"a dangling reference shown unavailable"*, and an absent **asset token** is *"never rewritten or removed"* — both because **the target may return**. A preset is no different.

Consequences: **zero writes**, so there is no writer to own and no invariant to violate; and it is strictly better than clearing, since a restored preset silently reattaches every note that referenced it rather than having orphaned them permanently. The management-window entry — *no cascade, no rewriting of note records, no "N notes use this preset" prompt* — was correct as written; note-model's "clears" was the thing out of step.

**The only thing that ever clears `preset_id` is a binding-breaking gesture**, which is a deliberate act on one machine. One writer, consistent with everything else.

**The write rule matters, and only one form of it is safe.** The geometry is written **once, at apply time, by the Mac performing the apply** — a user action. Other Macs re-resolve the binding for display and **never rewrite** the field.

**A clarification the edge forced** *(review-004 F4)*: writing a share-resolved absolute means storing a *resolution* in the Note tier, which looked like a violation. It isn't — the prohibition was being stated too broadly. It is not *"no resolved value may ever be stored"*; it is:

> The Note tier must never hold a value that **each machine derives independently** — because then every machine writes it and they fight.

The safety-net fit is exactly that, and may never be written. A preset apply is not: it happens **once, on one machine, deliberately**.

Said plainly: **while a note is bound, `size` is not the authoritative geometry — the binding is.** `size` is the standing fallback, *the last concrete shape this note had*. Unbound that is the authored size; bound it is the last resolved application. Same meaning either way, which is what a fallback needs.

A tempting alternative was rejected: *let each Mac fall back to its own Machine-tier cached resolved rect on preset deletion*, so the laptop keeps a laptop-shaped fallback and the Studio a Studio-shaped one. Better-looking per Mac, but **the promotion is a write to a synced field triggered by a non-user event, performed independently on every Mac** — both write, last-writer-wins, one Mac jumps anyway, and it reintroduces exactly the churn the no-write-back rule exists to prevent.

### The write invariant — a deliberate act on one machine, never a derived value on every machine

First stated as *"only a **user** action writes a synced geometry field."* The user challenged the word: an **agent** resizing a note through the CLI/MCP is the same kind of event. Correct, and the fix isn't to swap "user" for "actor" — it's to notice the actor was never the load-bearing part:

> **A synced geometry field is written by a deliberate act, occurring on exactly one machine. It is never written by a value each machine derives independently.**

The distinction is *deliberate act* vs *derived value*, not *who performed it*. Manual resize, applying a preset, an agent write — all deliberate, all happen on one machine, all write. Safety-net fitting and preset re-resolution are derived on every machine, so neither writes. **The actor never enters the rule**, which is the epic's own principle — note-window's recency tint landed on exactly this ("the actor never enters the rule"), and human⇄agent equality demands it here too.

*(An agent writing geometry does carry an asymmetry worth pinning at the agent surface: an agent write to `size` changes the note on **every** Mac, while a write to position changes only the Mac its engine runs on. Same verb, very different blast radius. → **agent-surface**.)*

### `size` at creation, and write cadence *(resolves review-003 F13)*

**A new note is stamped with the default size at creation, and is loose from that default forever.** The field is never null.

The orchestrator initially argued the opposite — that `size` should be **absent** on a new note, meaning "resolve the app default at open", on the grounds that a default nobody chose is not *intent* and storing it records a resolution as a decision. **The user pushed back and was right, and the counter-argument is stronger than the one they made:**

- **The invariant is not "only explicit choices get written."** It is *a **deliberate act on exactly one machine** writes; a value **each machine derives independently** does not.* **Creating a note is a deliberate act on one machine**, so stamping at that moment satisfies the rule. The orchestrator applied the *shape* of the rule where its mechanism doesn't bite. As the user put it: *"you did create the fumi, which generated its presence on the screen… you called it into existence, and therefore now it has size."*
- **A nullable `size` is what actually breaks the rule.** An empty field means Mac A resolves its default at open and Mac B resolves its own — **a value each machine derives independently**, differing by app version or by whatever the default is relative to. That is precisely the incoherence this ruling exists to prevent, reintroduced through the back door.
- **An app update changing the default must not silently resize existing notes.** Stamping makes that impossible; an absent value makes it automatic.
- **The nullable option's only claimed benefit doesn't survive:** it would let us distinguish a deliberately-sized note from an untouched one, but nothing in the model branches on that distinction. A distinction looking for a use.

*(Contrast with `preset_id`, which **is** legitimately empty — "freely placed" is a real state with defined behaviour, not an unresolved default. And with **colour**, whose field is likewise never empty because Neutral is a real role rather than an absence. Only `preset_id` is nullable, and for a reason.)*

#### What the creation default is — a user setting, machine-local *(2026-08-05, resolves review-006 F5)*

The stamp was decided without ever saying what gets stamped. *"The creation default"* was then consumed as if it were a stated value — by this document's own damage rules (*"size → the creation default"*, sitting next to colour's **Neutral**, which names a real member of a real set) and by storage-and-sync, whose sidecar-repair decision adopts *"note-model's own repair values — Neutral, the creation-default size"*. Two documents depended on a value that existed in neither, and note-window's geometry work covers presets, the minimum floor and the display fit but never a birth size.

> **The creation default is a user setting, not a constant. It is read once, at creation, and stamped; existing notes never re-read it.**

**Nothing about the stamp changes.** Reading a setting and writing the resolved value is the same shape as applying a preset — a deliberate act on exactly one machine. And the guarantee the stamping argument was made to protect gets *stronger*: *"an app update changing the default must not silently resize existing notes"* now covers a user changing it too. A change affects notes created after it and nothing else.

**The repair fallback stops being a second concept.** *"size → the creation default"* means the current value of the setting. There is no separate repair constant to define, own or keep aligned.

**Machine-local, backed up per device — the swatch-pointer shape.** The orchestrator first proposed **account-level**, arguing from *intent travels, resolution does not*: "how big I like my notes" is intent, and a per-Mac default reintroduces the screen-dependence the content-anchored ruling exists to remove. **The user's steer reversed it** — *"this is the same thing as the colour… machine local, still backed up"* — and the better reading of what the setting is follows from that comparison. It is not intent about a *note* — it is *how big should a new window open on this machine*, and new notes are created wherever the user happens to be sitting. A 360pt-wide note is modest on a Studio and a third of a 13" laptop's width.

The objection turned out not to bite: **a machine-local default reintroduces no per-machine resolution of any stored value.** It is read once, at birth, and what it produces is an authored `size` that travels like any other. The content-anchored rule governs never re-deriving an *existing* note's size per screen, which this leaves untouched. *Accepted cost:* a note's birth size depends on which Mac created it — indistinguishable from having been dragged to that size there, and equally permanent.

**This is the third inhabitant of the app-level per-machine-but-durable shape**, after note-window's active swatch and this document's window/display state. The tiers classify *per-note* state; this is an app-level setting sorted by the same two axes — per-machine on scope, durable on durability. It must survive a reinstall for the same reason the swatch does: *"a machine-local setting that vanishes on reinstall is a bug, not a design."*

**Shipped value: 360 × 420 pt.** A deliberate placeholder — sensible now, tuned during implementation. Chosen so a new note holds roughly a 50-character prose measure at the system body size and a dozen or so lines; clear of note-window's ~240pt minimum; and about a quarter of a 13" laptop's logical width, so several can sit side by side without arranging anything.

*(Amended 2026-08-21 — this cited note-window's **~180–200pt** floor, which they raised to a **~240pt** working value on 2026-08-10: the band became the formatting surface (a four-item capsule in the middle whenever the note is focused and editable, controls at 23px in a fixed 30px band), so the binding constraint stopped being the text measure and became the fully-populated chrome band. **The value stands** — its other two justifications are untouched, and both are the load-bearing ones. Only the margin changed: 360 was nearly double the old floor and is 1.5× the new one, ~120pt of slack, so "comfortably" is dropped rather than the number being revisited. **Sibling check: note-window** — its Surface & Chrome amendment holds the minimum width as "the band in its fullest state", working value ~240pt, itself a placeholder for tuning in the build. Nothing here revises that; this repairs a citation of it.)*

*Sibling check: storage-and-sync — its per-device blob already carries the durable per-machine values (window state, `lastOpened`) and its account documents carry account-level ones. This setting takes the per-device blob, the same home as the swatch pointer; the physical slot is theirs.*

*Where the setting is edited, and how it is presented — a size field, or a "use this note's size as the default" action on a note — is **management-window's**. Rerouted.*

**Write cadence: one write per gesture, on release.** `size` lives in the note's intrinsic state, which is the **synced** store, so a live resize drag must not write per frame — it coalesces into a single write when the gesture ends. The same applies to a drag that ends by breaking a preset binding.

*(Whether the agent surface exposes geometry at all, and the asymmetry that an agent write to `size` changes every Mac while a position write changes one — **rerouted to agent-surface**.)*

### Resizing a fitted note — the accepted cost *(review-003 F8)*

The safety net is specified never to write back, but the same end state is reachable by a route that isn't the safety net: on the small Mac the user nudges the **fitted** note's corner. That is a deliberate act, so it writes — and the large-screen authored size is replaced everywhere.

**Accepted, deliberately.** User: *"that's standard, and if we try to work around that it would be too magic."* Distinguishing *"resized to express new intent"* from *"adjusted a note that was only this small because it was clamped here"* needs a concept of provisional size that would leak into every surface. Every application behaves this way.

Two things the document should nonetheless state accurately:

- **The loss is a discontinuity, not a nudge.** The note is *displayed* at the fitted size, so dragging its corner adjusts from the fitted rect — a one-pixel nudge doesn't slightly alter a 2560pt authored width, it replaces it with roughly 1728pt.
- **The write syncs immediately; only the display is deferred.** A note already open on the large-screen Mac does **not** resize under the user — it takes the new size as soon as it is unfocused, or on blur if it is the note being worked in. *(Amended 2026-08-03 — this read "it picks up the new size the next time it is opened there", the superseded at-open trigger.)*

**It only bites a *fitted* note.** Resizing a note that already fitted is an ordinary resize adjusting the real authored size, with nothing lost.

**Rejected — a per-display size map** (`{studio: 2560×1440, laptop: 1400×900}`, each display's resize writing only its own entry). It would genuinely solve the above, and it is the obvious counter-proposal, so it is recorded here with its answer rather than left to be re-raised:

- **It contradicts the ruling's own foundation.** Size is the Note tier *because* it is content-anchored — points are density-independent, so one size preserves content fit on any display. A per-display map asserts the opposite: that the right size depends on which screen you are looking at. If that were true, size is display-anchored and belongs in the Machine tier. Both cannot hold.
- Secondary but real: **display identity is machine-local**, so a synced map keyed by display UID is partly meaningless on arrival — the exact class of machine-specific reference this session ruled cannot travel; entries **accumulate** for every monitor a note ever meets; and a display with no entry still needs a base case, so all the fitted-fallback logic survives with a map bolted on top.

### Display is not a synchronisation concern at all

The user asked how a second monitor plays into synchronisation, reasoning that Space UUID + coordinates ought to be sufficient. Working it through corrected two things — one of them the orchestrator's.

**The premise to correct first: none of it synchronises.** Coordinates, Space UUID and display are *all* the Machine tier — machine-local, never synced. Each Mac independently remembers where its own copy of a note sits; nothing about placement travels. **Display therefore has no bearing on sync whatsoever.** It is entirely a within-one-machine concern.

**Why display is stored at all** — note-window decided **positions are stored display-local, not in global desktop coordinates**, because *"a saved x of 3000 is meaningless on a laptop"*. So display isn't an extra fact bolted onto a coordinate; it is the **anchor the coordinate is measured from**. (macOS itself does use one global plane spanning all displays, with secondary displays at offsets that may be negative — Fumi deliberately declines to store in it.)

**Why Space UUID alone is insufficient** — a display disconnect destroys a Space UUID permanently, so a note homed there dangles with nothing in the Space half left to resolve against. Display identity is what gives the fallback a *destination*: the home display's first Space. So display is load-bearing twice over in this section — it is the anchor a coordinate is measured from, and it is what makes an unresolvable home land somewhere meant rather than wherever the user happens to be standing.

*(Amended 2026-09-01 — this read: "note-window's research found that on disconnect, an external's non-first Spaces migrate to the primary display keeping their UUIDs, but the external's **first Space is destroyed**, taking its UUID permanently. A note homed there has a forever-dangling UUID. Hence the three-rung home ladder — **display identity → Space UUID → ordinal Space index on that display** — where the display rung is what brings the note back when the monitor returns." Two things went stale, and they are different kinds of stale.*

*__The ladder.__ note-window revised its home resolution on 2026-09-01, absorbing space-homing's `fallback-destination` ruling (2026-08-30, display-qualified 2026-08-31). A home stores **display identity · Space UUID** and resolves as **two independent rules plus a universal display-time fit**, not three ordered rungs — Space: the UUID, else the home display's first Space (the main display's, where the home display is gone); display: the recorded display, else the main one. The ordinal rung is gone. Its firing condition — display present, UUID dead — is exactly a restored Mac, where the Machine tier returns coordinates and home display while every home-Space UUID is dead, so the rung would fire for every note at once and scatter them by ordinals that meant something on the old install. It also required a field this record has never carried: inspect every mention of *ordinal* in this document — `` grep -n -i "ordinal" .workflows/fumi/discussion/note-model.md `` — and each is prose about resolution or about asset ids; none names a stored field, against a Machine tier of window coordinates (display-local), home display, home-Space, open/hidden visibility and `last-opened`. Dropping it reconciled the two documents rather than trading one against the other.*

*__The casualty was inverted.__ Measured across a dock cycle on this user's topology (Studio main, built-in secondary), the **surviving** display inherits the departing display's Space list wholesale — every `ManagedSpaceID`, UUID and ordinal position intact — and it is the survivor's **own** first Space that is discarded. The old text named the leaving display's first Space, which is backwards.*

*__The conclusion is unaffected either way__, which is why this is a correction and not a re-decision: some Space UUID still dies on a disconnect, so the UUID alone is still insufficient. If anything the display half is more load-bearing under the new shape — it qualifies the fallback destination rather than sitting one rung above it.)*

*Sibling check: note-window — its 2026-09-01 home-resolution entry holds the two-rules-plus-a-fit shape, the ordinal's removal, and the survivor-inherits measurement; it delivered this to note-model as a correction rather than a re-decision, on the grounds that the reason display identity is stored survives intact. Nothing here revises it. space-homing — its `fallback-destination` decision is the Space half adopted above, display-qualified because under* Displays have separate Spaces *each display owns its own first Space; on a one-display machine that reading and the plain "Space 1" are identical.*

**The orchestrator's earlier framing was a red herring.** *"Displays have separate Spaces"* is a real toggle, and it does determine whether a Space UUID happens to imply a display — but it does not change the coordinate model, and it is not why display is stored. Position being display-local is.

**The one place display identity crosses machines** is the synced preset **Display axis** — and note-window already handles it: *"if a preset references a display that's no longer connected, fall back to the main display."* A footnote, not a gotcha; the earlier framing overweighted it.

**Also confirmed** (an open question the orchestrator raised): note-window's home resolution covers both cases, not just relaunch — *display disconnects while running* → **do nothing, let macOS relocate the window** (intervening would double-move and fight the WindowServer); *relaunch while disconnected* → resolve, **home untouched**; *reconnect* → resolves to its real home and returns. A topology change is not a user action, so it never writes a home.

*(Amended 2026-09-01 — this said "ladder", as did* Unchanged by this *above and* Size is not re-fitted while running *below; note-window's home resolution stopped being a ladder the same day. Only the name changes here: what it covers, and when it runs, are exactly as written.)*

**note-model's only job here:** per-note **home display** is per-note state and belongs in this document's inventory, which previously omitted it. Its *behaviour* is note-window's and needs no restatement. **Classified (review-003 F6): the Machine tier** — per-machine and durable, restored with position on a reinstalled Mac.

### The undock walkthrough — the model's acceptance test

User's scenario: Studio is the **main** display, a fumi sits on it, then the dock is unplugged and the laptop becomes the only screen. Expectation: *"everything just is exactly the same"* — Chrome, Ghostty and every other window simply move across, so a fumi should too.

**What happens: nothing. Fumi does not act.** macOS relocates the window like every other app's, and note-window's decision is explicitly *do nothing while running* — intervening would double-move the window and fight the WindowServer. The expectation is met **by not intervening**, which is why the note behaves identically to Chrome.

**Size is not re-fitted while running either.** The safety net and home resolution both belong to **open / relaunch**, not to live topology changes. *(This is fitting a note to a display, not applying a synced change, so the unfocused/on-blur rule does not reach it — the two were briefly the same sentence, and only the synced-change half moved.)* So a Studio-sized note may overflow the laptop screen until it is next opened, exactly as an oversized Chrome window does. Re-fitting live was considered and rejected: it would make Fumi the one app that behaves differently, which is precisely what the user did **not** want.

**This is what makes display-local positions right, not wrong** (the user flagged this as the part that felt off). Global coordinates would break this scenario every time: unplug the main display and the coordinate plane re-origins, so a note at global x=2000 may land off-desktop. Display-local (`display=Studio, x=300, y=200`) is stable — when the Studio returns, x=300 within the Studio is still exactly right no matter how the arrangement changed meanwhile. **Display-local is the thing that makes "the monitor comes back and the note goes home" work at all.**

**Convergence worth noting:** note-window reached this session's write invariant independently, from the other direction — *"a display disconnect is not a user action… a topology change never writes a home."* Deliberate act writes; OS-caused placement does not. Two topics deriving the same rule from unrelated problems is good evidence the rule is load-bearing rather than convenient.

**Rerouted to space-homing (research, 2026-08-03) — a research gap for this exact topology.** Its disconnect research is framed as *"the external's first Space is destroyed, its windows merge into the primary display's first Space"*, assuming the built-in is primary and the external secondary. The user's setup is **inverted** — the Studio is main, the laptop secondary — so the display being removed *is* the main one. If the destroyed-first-Space rule follows the disconnected display rather than the built-in, then this user's primary working Space is destroyed on **every undock**, making the ladder's rung-3 ordinal fallback the everyday path rather than an edge case. Worth verifying against the inverted topology.

*(Amended 2026-09-01 — answered and moot. Measured on the inverted topology, the destroyed first Space follows neither of the two candidates this asked between: the **surviving** display keeps its Space list only in name — it inherits the departing display's list wholesale and its own first Space is discarded. And the ordinal rung the question was sizing no longer exists — note-window removed it the same day, so there is no rung-3 whose firing frequency matters. See* Why Space UUID alone is insufficient *above.)*

Consequence: `size` is always populated — it holds the last user-authored *or* preset-applied value, serving as the standing fallback. A manual resize overwrites `size` and, **where the bound preset sets the Size axis**, clears `preset_id`. *(Corrected, review-004 F3 — this read "overwrites `size` **and** clears `preset_id`" unconditionally, which predates the scoped break trigger. A resize must **not** clear a Position-only binding; see Axis composition.)*

### Dependency this ruling creates

**The preset library must sync** (resolved above — account-level). Where it physically lives is not note-model's (management-window owns the editor, storage-and-sync the mechanism); the **requirement** originates here.

**The one residual preset-sync gotcha: the Display axis.** A preset's Size and Position axes mean the same thing on any screen, but a preset naming a *display* travels to a Mac that may not have it. note-window's absent-display resolution ladder already handles this, so it composes — but Display is the one part of a preset that is not universally meaningful, and syncing the library is what exposes it.

### Rerouted to storage-and-sync

*(resolves review-003 F3 / F4)* — the ruling adds **two synced per-note fields** to a topic whose data mapping was closed, and directly contradicts it in two places: its *"**Not synced:** … all Machine-tier window-state"* line, and its read-model line listing *"window coords/**size**"* as machine-local. Sent as a triage entry carrying:

- **`size` and `preset_id` as new synced discrete fields**, with position / home-Space / home-display / resolved-rect staying the Machine tier.
- **`preset_id` is a new *kind* of field** for a per-note record — a reference to an entity outside it. Hence the **preset library must sync**, and references are **UID-keyed, never name-keyed**.
- **The write invariant** — a deliberate act on exactly one machine writes; a value each machine derives independently never does. This is what makes the two-Mac ratchet structurally impossible.
- ~~**Two open questions only that topic can rule on**: whether a geometry write bumps **`edit_counter`** (it deliberately does not bump `modified-at`, so the precedence input may be absent), and whether a geometry write can trip the note-level conflict flow — which would make *"no conflict UI for geometry"* unhonourable as stated.~~ *(**Both closed 2026-08-03.** The first is moot — `edit_counter` was dropped 2026-07-31, so there is no precedence input to bump. The second is answered: their per-field merge reserves the note-level conflict state for concurrent `content.md` edits, and a scalar simply takes the second write.)* note-model's position is that a resize must never produce a user-visible conflict; **how** is theirs.

**Also landed 2026-08-03 — a derivation version must force an index reprojection** *(resolves review-005 F6)*. Derived values are a function of content *and* of the code deriving them, so a rule change invalidates the projection while leaving the bundles untouched. Their `meta` table already holds the index's own schema version and the index is already fully rebuildable, so the ask is a comparison at launch. Whether the derivation version is separate from the schema version, whether a bump needs a full rebuild or only a re-derivation pass, and whether the pass is synchronous or background, are theirs.

*(**Answered 2026-08-03, recorded here 2026-08-05.** All three: the derivation version is held **separately** from the schema version — folding them would force every derivation change through schema-migration machinery and every schema change through a full re-derivation; a bump triggers a **Projection-only re-derivation pass**, not a full rebuild, because a rebuild would discard the CloudKit change token and force a network re-fetch to repair a purely local recompute; and the pass is **background and resumable**, serving stale-but-not-broken rows meanwhile. One clause of it is this document's business rather than theirs: the pass **writes nothing to the store and never bumps `modifiedAt`**, which is what keeps a rule-version reprojection consistent with the `modified-at` triggers — derived values bump the timestamp only via a content edit, and re-deriving without one must not.)*

~~Written firmly, explicitly open to challenge — if their mechanism makes it wrong, this subtopic reopens.~~ *(**Discharged 2026-08-05** — both rulings ratified without change: `size`/`preset_id` in storage-and-sync's *Synced Geometry Fields* on 2026-07-30, where `size` was re-tested on its own terms rather than inherited, and the derivation version absorbed 2026-08-03. The escape hatch never fired.)*

### Rerouted to note-window

1. **A preset stays bound until broken.** note-window's landed line is *"the result is an ordinary free-floating note — drag overrides and is remembered."* Under this model drag still overrides and is still remembered (it breaks the binding and writes absolutes), but "ordinary free-floating note" reads as *immediate* un-binding. A refinement to their decision, and theirs to make.
2. **Which gestures break a binding.** *(Superseded by Axis composition, above — review-003 F5.)* The recommendation is now: **a gesture breaks the binding only if it overrides an axis the preset actually sets.** Drag breaks a Position-setting preset, resize breaks a Size-setting one, neither breaks a preset that only sets the other. The binding stays atomic — one reference, cleared or not — only the trigger is scoped. This replaces the flat *any-gesture-breaks-it* version, which would drop a share-valued size-only binding on a plain drag.
3. **Re-applying a preset on a new display re-resolves against that display.** User's example: a corner-bound note dragged to a second monitor (which breaks the binding), then the preset re-applied — it lands in *that* monitor's corner. Confirms presets resolve against the **current** display unless the definition names one; Display remains an optional axis of the preset *definition*, not per-note state.
4. **Version preview of a bound note re-resolves its recorded binding against the current display** *(review-003 F7)*, rather than animating to the recorded absolute rect — otherwise preview misrepresents what committing would produce. Restore then writes the restored `size` **and** `preset_id` to the Note tier, as a deliberate act.
5. **Paste and duplicate must carry asset bytes, not just the token** *(landed 2026-08-03, resolves review-005 F4)*. The invariant is note-model's and fixed; what the clipboard carries, feedback on a large copy, and partial-failure handling are theirs.

---

## Summary

### Key Insights

1. **The format serves Fumi, not other tools.** Retracting external-portability as a *goal* (a synced store is accessible, not a portability contract) freed the whole design — custom syntax, bundle packages, copy-only assets — and pre-answered several review flags.
2. **State sorts on two axes, not one.** *Scope* — does it ride with the note, or is it just how this Mac shows it? *Durability* — if this Mac is wiped, would losing it be a bug or a shrug? The original single test was right but answered only half the question, and the missing half is what made position recoverable on a reinstall. Three tiers fall out — **Note · Machine · Derived** — with the fourth cell empty, because nothing worth carrying between Macs is worth throwing away on one of them.
3. **Intent travels; resolution does not.** The epic's third application of note-window's *"a home is intent, not a location — fallbacks resolve without rewriting"*. It settled geometry, and its companion write invariant — **a deliberate act on exactly one machine writes; a value each machine derives independently never does** — is what makes a two-Mac resize ratchet structurally impossible rather than merely avoided. The invariant is **actor-blind**: manual, preset and agent writes are identical to it.
4. **Derived-not-stored keeps the model tiny.** Title and tags derive from content; the stored intrinsic footprint is UID, colour, timestamps, soft-delete, size, `preset_id`, float-on-top. The content *is* the note.
5. **A name is portable where a coordinate is not.** Storing a preset **UID** rather than resolved geometry is why "left rail" means the same thing on a 13" laptop and a 27" Studio. The same instinct as ULID-over-title and case-normalised tags, applied a third time.
6. **Bundles-as-truth + a rebuildable SQLite read-model.** Never scan at query time — index and query; read full content on-demand.
7. **Copy-into-the-container is the industry answer** (Notes/Bear/Obsidian all do it); local aliases can't cross machines, so copy-only isn't a compromise.
8. **This document's real failure mode was unpropagated reasoning, not weak reasoning.** As the epic's first discussion, it went stale in five places while note-window and storage-and-sync decided things that changed it. Review-003 caught all five; the lesson is that a first-mover topic needs re-reconciling, not re-arguing.
9. **The model was rigorous about *what a fumi is* and thin about *how content is read back into structure*.** Nearly every gap left by the fifth review sat at that boundary — asset token recognition, asset ids, tag segmentation, title derivation over structural lines, title matching — even though every derived value depends on that reading and one of them (asset ref-counting) deletes bytes. Two rules closed the class: **fall through what has no prose, strip what does** for derivation, and **recognise broadly, render narrowly** for tokens, the latter because over-counting leaks a file the user never sees while under-counting destroys their data.
10. **An invariant routed to one surface is not an invariant.** *"Any transfer of content that carries an asset token carries the asset"* was written as a universal rule and handed to note-window, so the GUI honoured it and a text-only agent write walked straight through it — and the model's characterisation of `missing` had been narrowed on the strength of a rule only one caller kept. The fix was to move enforcement to the layer every writer passes through. The same shape appeared twice more in the sixth pass: the `preview` was named as a derived value in four places and defined in none, and math shipped as a content type without ever entering the dialect the derivation rules read against. A fourth instance closed on 2026-08-10: admitting math to the dialect prompted a revision of **title** derivation and none of the **tag** scanner, so a `#` inside an equation still derived a tag — the same content, three readers, two of them updated. **Where a rule is enforced is part of the rule**, and a rule stated in one document but implemented in another is only as strong as the caller who remembers it; the corollary for a single document is that admitting a new construct means walking *every* consumer of the reading, not the one the change was noticed in.
11. **An edge case is sometimes cheaper to delete than to solve.** *(2026-08-08)* The unavailable-bytes paste absorbed a deferral scheme, then a background reconciler, before anyone asked why the state existed at all. Every mechanism was answering *"what should happen when an asset's bytes aren't here?"*; the answer was to stop letting that be possible — a hard ceiling instead of a soft one, which deletes the question along with the state. Two things made it available and both are worth recognising next time: the cause was a **temporary engineering shortfall** rather than a design intent, and the fix was **purely additive to reverse** (lift the limit later; no note already written changes). The tell was cost disproportion — one transport exception had already forced an invariant restatement, a third state in two other topics, a GC ownership rule, and a rerouted concern.
12. **Ownership, not availability, is what self-containment ever meant.** Stated as *"every asset travels and resolves on every Mac"* it was contradicted by the deliberate `excluded` case; stated as *"every asset a fumi renders is owned by that note and stored in its bundle"* it holds absolutely and still does the work it was invented for — rejecting the URL fallback, because bytes on someone else's server can change without Fumi knowing. The same restatement pattern as the tiers: the original test was right and was answering a narrower question than it appeared to. *(Resolved 2026-08-09 — the hard limit was ratified, `excluded` no longer exists, and the invariant carries both clauses again, so the restatement is no longer **needed**. The insight is unchanged, as it said it would be: what makes the ownership form the load-bearing one is that it rejects the URL fallback, and that argument never depended on a transport exception existing. The availability clause is now a second guarantee sitting alongside it rather than the thing being defended.)*
13. **Restating a mechanism can silently reverse a decision two days old.** *(2026-08-10)* The 2026-08-03 entry closed intra-note paste as *"duplicates the asset"*. The 2026-08-05 entry then moved carriage into the engine and gave it a trigger — *"a token naming an asset the destination bundle does not hold"* — which is simply **false** within one note, so the outcome flipped to sharing without a word about it, and both statements sat in the document as live for five days. Nobody was careless: the second entry was answering the *cross-note* question and its condition was correct for that. The tell is that a **condition** was introduced where the earlier text had an **outcome**, and a condition is a claim about every case, not just the one being discussed. Distinct from insight 8's cross-document staleness — this drifted inside one document, between two entries written by the same thread days apart, which is why the review caught it and re-reading did not. **When a rule acquires a trigger, replay the cases the old rule already decided.**

14. **A load-bearing fact asserted without measurement outlives every review that reads past it.** *(2026-08-30)* *"Spaces are persisted to neither iCloud nor Time Machine"* carried the word **forced** in two places for a month; `tmutil isexcluded ~/Library/Preferences/com.apple.spaces.plist` → `[Included]` is a one-line refutation nobody ran, because the sentence read like platform knowledge rather than a claim. All eight review passes went by it — `review-001`, whose findings this document cites as bare `review F2` / `F4` / `F5` / `F8`, through `review-008` (`` node .claude/skills/workflow-engine/scripts/engine.cjs agent scan fumi discussion note-model `` → 8 incorporated `review` rows). A review reads what is written, and a plausible fact reads as settled. What caught it was a *different* topic measuring the same ground for its own reasons. Distinct from insights 8 and 13, which are both about reasoning drifting out of date: this one was never true. The conclusion survived, which is the trap — a wrong justification protecting a right answer produces nothing that looks broken, and the cost only lands when someone later reasons *from* the justification. **A fact that makes a decision "forced" is the one most worth running, precisely because it is the one nobody will re-examine.**

15. **Two documents can contradict each other while both are internally right, when the act that reconciles them belongs to a third.** *(2026-09-15)* This document said an attachment chip's content form is `[report.pdf](fumi://asset/<id>)`; storage-and-sync built its search corpus on *"the filename is not in the note's text"*. Neither cited the other, neither was careless, and the disagreement was not staleness — it was that **nothing anywhere said what goes in the brackets when a file is inserted**, because insertion is note-window's surface and none of its decisions had reached the question. Each document then filled the silence from its own side and filled it differently. Distinct from the three failure modes already recorded here: not reasoning gone out of date (8), not a trigger quietly replacing an outcome (13), not a plausible fact nobody measured (14) — a claim can be absent rather than wrong, and absence leaves nothing for a review to read. What surfaced it was a downstream question about an unrelated damage case, which is the tell: **when two topics answer a question differently, check whether the question has an owner at all before deciding which of them is wrong.**

### Open Threads

- ~~**One edge open within note-model** *(2026-08-05)* — copying content that references an **`excluded`** asset from a Mac that doesn't hold its bytes … **which of the three states that is** turns on whether absence is judged against the bundle or against the store.~~ **Closed 2026-08-08** — the question was dissolved rather than answered: with the ceiling made a **hard limit**, no record without bytes can exist, so the case has no legitimate instance and the materialisation rule's two branches are complete. ~~Degradation-at-paste is recorded as the fallback if storage-and-sync keeps the ceiling soft.~~ *(2026-08-09 — they kept it hard, so the fallback is unreachable and recorded as history.)* See Content transfer carries the bytes.
- ~~**Awaiting ratification by storage-and-sync** *(2026-08-08)* — the hard limit itself, and the number it settles on … three consequences land.~~ **Discharged 2026-08-09** — storage-and-sync adopted the hard limit and settled the number at **50 MB** (Apple's documented per-`CKAsset` maximum, so not a choice; verified empirically at implementation, and the ceiling lifts if the real limit proves higher). All three consequences are written in: the table is **present · missing**, self-containment carries its availability clause again, and an oversized fetch degrades like any other failed fetch. The ratification also brought **atomic publish** — a note's content and its asset records publish as one unit — which gives *"`missing` is never reached by sync"* a second ground on the upload side to match fully-eager sync's on the download side.
- ~~**Two rulings await ratification by the topic that owns their mechanism** *(2026-08-03, resolves review-005 F1)*. … Both entries below sit in storage-and-sync's triage queue, unabsorbed … "ready for specification" is conditional on them.~~ *(**Discharged 2026-08-05** — both were ratified and absorbed, and storage-and-sync concluded on 2026-08-04 with an empty queue. Neither came back changed, so this document's "if their mechanism makes it wrong, this subtopic reopens" escape hatch never fired.)*
  - **`size` and `preset_id` as synced per-note fields** — ratified in storage-and-sync's *Synced Geometry Fields*, **2026-07-30**. `size` was **re-tested on its own terms** rather than inherited: a per-Mac size was weighed and rejected on the wrong-but-visible-beats-wrong-but-invisible test, and the ruling reinforced structurally — *"a machine-local size would make a snapshot's recorded geometry meaningless on any other Mac."* The two things that did move are already carried here: the application rule became **unfocused/on-blur**, and *no-conflict-UI-for-geometry* was upheld via **per-field merge against the ancestor** rather than last-writer-wins.
  - **The derivation version forcing an index reprojection** — absorbed **2026-08-03**, with more mechanism than was asked for: a **Projection-only re-derivation pass** (a full rebuild would discard the CloudKit change token and force a network re-fetch to repair a purely local recompute), the derivation version held **separately** from the index's own schema version, background and resumable, serving stale-but-not-broken rows meanwhile.

  *(The rest of the dependency ledger is genuinely closed and dated: the `edit_counter` drop, the per-field merge, fully-eager sync, the no-FSEvents ruling, and the sidecar repair ordering.)*
- **Rerouted and landed 2026-08-09** (entries written into the target topics' Triage):
  - **storage-and-sync** — what bounds a bundle **in aggregate** once the ceiling is hard. The per-asset rule was doing double duty under accept-then-exclude (it capped the largest upload *and* kept heavy notes local); made hard, everything admitted is uploaded, and duplication is deliberate, so nothing bounds a bundle's total. ~~Live only if the hard limit is adopted, and it is the same judgement as setting the number.~~ **Answered 2026-08-09** — **no aggregate bound at all.** The 750-delete-self-reference limit looked like one mid-argument, but their child-record-ceiling decision settles that a surplus child is created *without* a reference, so it bounds the free cascade rather than child count. The per-asset limit is the only byte bound, with the **store-size indicator** as the backstop — a *"this note is full"* refusal names a state the user cannot see the cause of, where *"that file is too big"* names something actionable. Nothing in this topic depends on the answer; the model never bounded a bundle.
- **Rerouted and landed 2026-08-08** (entries written into the target topics' Triage):
  - **storage-and-sync** — make the sync ceiling a **hard limit** (refuse oversized assets at every entry route) rather than accept-then-exclude, retiring `excluded` entirely; the number is theirs to set, and post-launch work on split uploads lifts the limit additively.
  - **note-window** — the concern they raised is answered by deleting the state it protected: their `excluded`/`missing` pair collapses to one absent state, their oversized-asset copy and chip treatment retire, and a drop-time refusal affordance replaces the attach-time warning. ~~Contingent on storage-and-sync ratifying.~~ *(No longer contingent — ratified 2026-08-09. storage-and-sync rerouted the refusal's surface to them directly, so both entries now sit in their queue.)*
- **Rerouted and landed 2026-08-05** (entries written into the target topics' Triage):
  - **management-window** — the default new-note size is a user setting and needs a settings surface (the value, its scope and its repair use are decided here; where it is edited is theirs).
  - **agent-surface** — the engine materialises unheld assets on every content write, so the surface never refuses an unresolvable token; what a write *reports* about materialised assets is theirs. This answers, differently, their queued question about refusing.
  - **note-window** — paste no longer has to carry asset bytes; the engine does. Narrows the entry landed there on 2026-08-03, leaving them the feedback question and the oversized-asset case.
- **Rerouted and landed 2026-08-03** (entries written into the target topics' Triage):
  - **storage-and-sync** — a derivation version must force an index reprojection.
  - **note-window** — paste and duplicate must carry asset bytes, not just the token.
  - ~~**space-homing** *(research)* — whether the destroyed first Space follows the disconnected display or the built-in, which decides how often the home ladder's ordinal fallback fires in an inverted topology.~~ *(**Closed 2026-09-01** — neither: the surviving display inherits the departing one's Space list and loses its own first Space. The ordinal rung is gone regardless, so the frequency the question was sizing has nothing to size.)*
- **Rerouted and landed in the geometry session** (entries written into the target topics' Triage, not just noted here):
  - **note-window** *(reopened from `completed` to receive them)* — preset bindings persist until broken (revising *"drag overrides and is remembered"*), the scoped break trigger, preset re-application resolving against the current display, version preview/restore for a bound note, and visual treatment for the asset-reference states *(three when this landed; **`missing` alone** since the 2026-08-09 collapse)*.
  - **storage-and-sync** — `size` and `preset_id` as new synced fields (contradicting its closed data mapping in two places), `preset_id` as a reference to an entity outside the note record, whether geometry can trip the note-level conflict flow *(since answered — it cannot; only concurrent `content.md` edits do)*, what a version snapshot records, the per-device durable tier as a *facility* rather than one value, and the `schemaVersion` casing inconsistency.
  - **agent-surface** — the geometry write blast-radius asymmetry, and whether to refuse an unresolvable `fumi://asset` token.
  - **management-window** — the preset editor must keep references UID-keyed; preset deletion needs no cascade.
- **Rerouted in earlier sessions:** note-window (rich-content authoring/drop UX, inline rendering, note-link peek/open + deleted-state visuals, tag badge + in-note editing, editing-UX dropdown); management-window (tag filtering/organizing, possible manual note-ordering); storage-and-sync (bundle layout, SQLite schema, sync-safety, soft-delete-as-trash, multi-Mac concurrency); space-homing (Space persistence/degradation).
- **Every reroute above is written firmly but explicitly open to challenge.** If a target topic's mechanism makes a ruling wrong, this topic reopens.
- ~~**Flagged for verification, not decided — now rerouted to `space-homing` (research), 2026-08-03:** note-window's display-disconnect research assumes the built-in is primary and the external secondary. A setup where the **external is the main display** inverts it — if the destroyed-first-Space rule follows the disconnected display, that user's primary Space is destroyed on *every* undock, making the ladder's ordinal fallback the everyday path. *(The document previously said this was "flagged to note-window"; it never was — no entry existed in any queue. It has now been landed in space-homing, the topic that owns Space persistence and degradation, as a research question rather than a design one.)*~~ **Closed 2026-09-01** — measured on the inverted topology, and the answer was a third option: the **surviving** display inherits the departing display's Space list intact and discards its own first Space. So the everyday undock does *not* destroy this user's primary working Space — those Spaces migrate and their UUIDs still resolve. The ordinal fallback the question was sizing no longer exists either.
- ~~**Open, deliberately not resolved** *(review-004 F11, F12)* — Unicode in tag identity; wall-clock assumptions.~~ **Both closed 2026-08-03.** Tag identity is pinned (Unicode chars incl. emoji; key = **NFC → full case fold → NFC** — see Tag parsing); clock skew is accepted with timestamps never repaired (see Attribute set & access model). Only the display form of two spellings that collapse to one key remains open, and it is management-window's.
- **Unverified, and deliberately not depended on** *(2026-08-30)* — whether restoring `com.apple.spaces.plist` reinstates Space identity on a rebuilt Mac. Measured facts: the file is captured by Time Machine and carries the Space UUIDs; what a restore does with them is untested, and the WindowServer may regenerate Spaces against real hardware and ignore it. Home-Space is best-effort under **either** answer — an unresolvable home takes the Space-1 fallback, a resolvable one is honoured — so nothing in this model turns on it. Space persistence and degradation are space-homing's domain.
- **Future option, not v1:** a "(B) cloud-file reference" as an asset link (DEVONthink-style), if a real need for live-linked files emerges.

### Current State

- **Content & format:** content is Markdown, the file holds content only (no frontmatter/state); the format serves Fumi only — external readability is a bonus, not a goal, so we extend it freely. Dialect = **GFM + Fumi-custom syntax + admitted math delimiters** (`$…$`, `$$…$$`); note-links = `[label](fumi://note/<uid>)` (wikilinks rejected).
- **Identity:** the UID is a **ULID** (time-ordered, case-safe, 26 chars), **stored as a canonical field**; the bundle folder name `{ulid}.fumi/` is a derived mirror of it, and the in-file value wins on disagreement. The ULID is kept as the mirror for a deterministic UID→path mapping (no index lookup to find bytes). The title is never an identifier anywhere.
- **State model — two axes, three tiers.** **Note** (travels + backed up, in the bundle): content + assets, UID, colour, created-at, modified-at, soft-delete, **size**, **`preset_id`**, **float-on-top**. **Machine** (per-machine, backed up per-device): window coordinates (display-local), home display, home-Space, open/hidden, `last-opened`. **Derived** (per-machine, disposable): the resolved rect, title/preview caches, search index, z-order. Access = bundles-as-truth + a rebuildable central **SQLite read-model** (index, don't scan); physical realisation → storage-and-sync. **Placement is named in explicit fields, never an opaque AppKit restorable-state archive** — the archive's unit is a frame, and a frame straddles the Note/Machine line that `size` and position sit either side of, while the per-field write invariant has nothing to bind to inside a lump. The archive stays a transient wire format: read at capture for `NSWindowWorkspaceID` (public API, no private hook), synthesised from stored values at restore if the placement route wants one. `home_space` is a string whose **empty value is meaningful** — Space 1 records as `""`, and absent means *no home recorded*, never Space 1. Home-Space is Machine-tier **best-effort on the *intent travels; resolution does not* ground, not on a claim that preservation is impossible** — Fumi's stored UUID survives a same-Mac restore in the per-device blob; whether the OS still has a Space wearing it is unverified, and an unresolvable home takes the existing fallback either way — **the first Space of the home display** (Space 1 on a single-display Mac), note-window resolving a home as **two independent rules plus a display-time fit** rather than a ladder with an ordinal rung. A note homed to Space 1 resolves rather than falls back, since `""` is a working identifier anywhere.
- **Geometry.** Size is intrinsic and **absolute points** (content-anchored; macOS points are density-independent). `preset_id` holds a **preset UID** or empty (freely placed). **Axis composition:** a preset overrides only the axes it sets — size from the Note tier, position from the Machine tier, display from the note's home display. Bindings **persist until broken**, and a gesture breaks one only if it overrides an axis that preset sets. Applying a preset also writes its resolved geometry into `size`, so a deleted preset degrades to plain authored geometry rather than stranding the note. Resolved geometry is **never written back**; the safety net is a display-time fit; a **synced** geometry change applies **while the note is unfocused** — immediately if it already is, otherwise on blur — while *fitting and homing* still belong to open / relaunch; geometry never bumps `modified-at`; writes coalesce on gesture end; `size` is **stamped at creation** and never null. The **creation default is a user setting** (machine-local, backed up per device — the swatch-pointer shape), read once at birth and never re-read by an existing note; ships at **360 × 420 pt**, and the damage-repair fallback reads the same setting rather than a second constant. Position stays machine-local because it is anchored to hardware — display is a within-machine concern only and has no bearing on sync.
- **Attribute-set scope:** this list is the whole **model** footprint, not every field in the stored record. storage-and-sync adds plumbing fields to the same record; that is mechanism, not model, and that topic holds the record's actual shape.
- **Title:** the derived first line — display-only, never an identifier. Algorithm pinned (strip to text, fall through non-text lines, tags removed, empty → "Untitled", truncation is a display concern). Structural first lines settled on one principle — **fall through what has no prose, strip what does**: a leading attachment chip falls through though its label is the user's own content (the leading-image precedent; inline, it strips to its label like any other link), a fenced block or display equation is skipped whole (unterminated → "Untitled"), task lists lose their checkbox (`- [ ] Buy milk` → "Buy milk"), tables strip to cell text, inline `$…$` strips to its source, setext headings need no rule. Derivation shares the renderer's math-delimiter constraints, or a bare `$` in prose is read as an equation. Block styles map 1:1 onto Markdown, so there is no separate styling state.
- **Preview:** the title strip applied to the content **after** the title line — same fall-through and strip rules, plain text, single line, **bounded at derivation** (order of 200 chars, because the preview exists so nothing opens a bundle). It never repeats the title, an empty preview is a real state, and raw truncated Markdown was rejected.
- **Tags:** inline `#hashtag` content; user-choice placement; `# `-heading vs `#tag` rule; **nested tags** (`#a/b`); parsing pinned (token-start only, never in code, URLs **or math** (`$…$` / `$$…$$`, added 2026-08-10); **Unicode** letters/marks/digits/**emoji** plus `-`, `_`, `/`, needing at least one letter, mark or symbol — so `#1` and `#123` are not tags); identity is **NFC → full case fold → NFC**, display keeps what was typed, and content is never rewritten. Nesting splits on `/` dropping empty segments; **a parent is not implicit in the derived set**, and parent filtering matches on segment boundaries. The tag-set is derived from content. In-note a tag is an editable token, not navigation.
- **Colour:** the per-note field is a **role** — one of seven stable slots (Neutral · Yellow · Orange · Red · Green · Blue · Purple), never surfaced as a text label, **never empty** (Neutral is a role, not an absence; default = Neutral under the **Wash** swatch). The **active swatch** is one app-level pointer per Mac — machine-local but backed up. Ten fixed swatches, no user authoring, no arbitrary picker. An **unrecognised** role value is rejected on an agent write and **preserved-but-rendered-Neutral** on read, so a note using a role added by a newer build survives a round-trip through an older one.
- **Non-text content:** a fumi is a **bundle** (`{ulid}.fumi/` = `content.md` + `meta.json` + `assets/`, an opaque package marked by extension) supporting images, GIFs, Mermaid, **math (`$…$` / `$$…$$`)**, highlighted code, emoji and attachment chips. Assets are referenced via `fumi://asset/<id>`, where the id is a **globally-unique opaque ULID** minted on copy-in (never content-addressed, so identical bytes in two notes are two assets) — **recognised broadly** for ref-counting (inside code fences, bare, and in a conflicted note's candidate bodies) but **rendered narrowly** (link/image syntax, outside code), because over-counting leaks a file while under-counting deletes one. **A non-renderable asset's chip draws its name from the link's label in `content.md`**, written as the filename at insert *(note-window, 2026-09-14)* and ordinary editable content thereafter — so a chip's name can drift from the file, while `originalFilename` stays on the record as what that file reveals, opens and drags out as. Assets are **always copy-only** into `assets/` (link/alias dropped for v1 — machine-specific, breaks multi-Mac), and **any content transfer that carries a token carries the bytes** — enforced by the **engine on every write to `content.md`**, whoever performs it: an unheld asset is materialised (copied in, new id minted, that token rewritten) and an unresolvable one is left untouched to render `missing`. The trigger is *unheld*, so the two paste routes differ: **within one note nothing is minted** — two tokens share one id and one file — while **into another note** the bytes are copied and a new id minted, **once per source id rather than once per token**, so a passage carrying the same token twice lands as one asset with two tokens there as well. Cross-note paste is the only duplication route Fumi ships — note-window decided there is **no Duplicate command** — so the duplicate-a-note clauses stand as a **conditional** governing any such route if one is ever built, never as a description of an operation a user has. A materialised copy **inherits `originalFilename`** (it describes the file, unchanged, and is what the copy reveals and opens as) and **stamps `addedAt` at copy time** (it describes this bundle's copy, which is new, and an inherited date would land the copy outside the GC sweep's young-asset grace). Materialisation takes the **render** predicate, not the counting one — only live references (link/image syntax, outside code) are materialised, so a fenced example or a bare token is carried verbatim and never rewritten; the scan runs on every write, so un-fencing one later materialises it then. So no surface, GUI or agent, mints a dangling **rendered** reference. **Every asset is referenced by content** — note-level attachments are killed as a concept, so there is no second placement kind. A reference has **two** states — **present · missing** — and is never rewritten or removed; **absence has exactly one**, and it is `missing`, an error state (bad id, hard-deleted asset, damaged bundle) rather than a transport one *(corrected 2026-08-09 (review-008 F2) — this read "a reference whose asset is absent has two states", a half-applied edit that kept the pre-collapse lead-in over the post-collapse list)*. **Self-containment is both an ownership and an availability claim** — every asset a fumi renders is owned by that note, stored in its bundle, and travels, backs up and resolves on every Mac; the ownership half is what rejects a URL fallback, the availability half holds because nothing whose bytes cannot travel is ever admitted. **The oversized ceiling is a *hard limit*** *(ratified by storage-and-sync 2026-08-09, at **50 MB** — Apple's documented per-`CKAsset` maximum, verified empirically at implementation and lifting if the real limit is higher)* — refused at drop, paste and fetch rather than accepted-and-excluded, unconditionally whatever the sync state; the accepted cost is that a single-Mac user cannot put an oversized file in a note at all, and the intended fix is chunked-asset spanning post-launch, purely additive. A failed remote fetch produces **no asset** and the paste degrades to a plain Markdown link — an over-ceiling fetch included, since it is refused at the fetch like any other failure. `fumi://` is an internal convention in v1, deliberately not registered with LaunchServices.
- **Agentic addressing:** ratified — the UID is the reliable handle; a title is accepted when unambiguous; `list → read → reason` on ambiguity; `list` is a SQLite read-model query. A title matches on the **same identity rule as tags** (NFC → full fold → NFC) against the **full** derived label, never the truncated display form; **no fuzzy or substring matching**, and ambiguity — a dozen notes called "Untitled" — is the normal path the loop exists for, not an error. A **conflicted** note is still **one note with one UID**: derived values stay singular and `fumi://note/<uid>` keeps resolving.
- **Derived values are versioned.** Title, tag-set and preview are a function of content *and* of the code deriving them, so the rules carry a version and a change **forces a reprojection** of the index. Cross-Mac version skew is accepted as self-healing — nothing derived is ever synced.
- **Damage:** `content.md` is what makes a fumi a fumi — content without a usable `meta.json` is a recoverable note (the folder name mirrors the UID); no readable `content.md` is not a note at all. Never-null fields have documented repair values (Neutral, the creation-default size), the synced record beats a local default, and repair writes because local damage is not a value every Mac derives. **A repaired value carries no marker** — the model names the repair values, the record says nothing about how a value got there, and nothing branches on the distinction. Repair consults the record first and writes nothing until the store is `reconciled`, so it invents a value only where sync is off — and there local state is total state, so the repaired value simply *is* the note's value. **A damaged bundle is never surfaced to the user**; it sits `unresolved` and retried, engine-internal.

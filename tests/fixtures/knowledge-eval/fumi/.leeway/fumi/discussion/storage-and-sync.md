# Discussion: Storage And Sync

## Context

File-based Markdown store in a user-chosen folder (local / iCloud / Dropbox as one "folder driver"; SFTP / hosted later), backup and restore, and live multi-Mac sync conflict handling.

This topic owns the **physical realisation** of the model note-model settled. note-model decided *what* a fumi is (content + intrinsic metadata) and *which bucket* each attribute belongs to (intrinsic-travels vs machine-local-disposable); storage-and-sync owns the on-disk mechanism: bundle layout, the SQLite read-model, sync-safety, soft-delete mechanism, folder drivers + backup, and the deferred live multi-Mac concurrency problem.

### References

- [Discovery brief — storage-and-sync](../discovery/briefs/storage-and-sync.md)
- [note-model discussion](./note-model.md) — the two-bucket model, bundle-as-truth, and read-model decisions rerouted here for physical realisation.
- [search-and-retrieval discussion](./search-and-retrieval.md) — what a query matches, which set the corpus rule and the search derivation version this topic's index implements.

---

## Bundle Layout

### Context

Owns the on-disk shape of a fumi. note-model settled that a fumi is a bundle (`content.md` + `assets/` + intrinsic metadata) and that intrinsic state (UID, colour, created-at, modified-at, soft-delete) must travel with the note while title/tags derive from content. Open questions realised here: where intrinsic metadata lives on disk, in what format, and whether the bundle is a plain folder or an opaque package.

**Fixed inputs from note-model** (carried, not re-litigated):
- **content.md** — pure Markdown, content only, no frontmatter/state.
- **assets/** — every asset copy-only (link/alias dropped: machine-specific, breaks multi-Mac). `assets/` is the source of truth; in-content refs use `fumi://asset/<id>`. **Every asset is referenced by content — there is no second placement kind** *(replaces the original "a note-level attachment = an asset not referenced by content"; note-model killed note-level attachments — see asset-storage, 2026-07-30)*.
- **Format posture** — store is accessible for backup/sync but *not* a portability contract; external tools are not a supported read/edit path.
- **Intrinsic set** — UID, colour (palette token), created-at, modified-at, soft-delete (+ deleted-at). Title/tags derived from content.

### Decision — intrinsic metadata home: a JSON sidecar, not frontmatter

Intrinsic state lives in a **`meta.json` sidecar** inside the bundle, not in `content.md` frontmatter.

**Options weighed:**
- **Frontmatter in content.md** — one object per note (atomic content+state); ecosystem-conventional (Obsidian/Jekyll). Rejected: violates note-model's "content.md is pure content", puts ULIDs/colour/delete-flags at the top of the file the human actually edits (one stray keystroke from a clobbered state block), and — decisively — routes *metadata-only* changes (recolour, soft-delete) through the content file, so a recolour on one Mac and a text edit on another **collide on the same file**.
- **JSON sidecar (chosen)** — content.md stays pure; metadata-only writes touch only `meta.json`; a recolour and a content edit on different Macs touch *different* files → no conflict. Cost: one extra small file per note, and a partial-sync window on `modified-at` only.

**Why the "2 objects splitting in sync" worry is minor:** of the intrinsic set only `modified-at` moves with a content edit; the rest change independently. A few seconds' staleness on sort-by-recent self-heals when `meta.json` lands. So the decision turned on **content-purity** and **conflict-surface** (both favour the sidecar), not sync-splitting. The human-clobber angle reinforces it: frontmatter sits in the file a human opens; a sidecar inside an opaque package is out of reach.

**Format = JSON** (not plist/YAML). Swift `Codable` writes JSON and plist equally, so "Mac-native" is a wash; JSON wins on being plaintext-**diffable** in an accessible backup store and greppable/debuggable. Binary plist's only edge (compactness) is meaningless at ~4 fields; YAML adds whitespace fragility for no gain. Bake in regardless of format: a **`schemaVersion`** field for clean future migration, and **atomic writes** (temp-file + rename) so folder-sync can never catch a torn state file mid-write.

### Decision — the bundle is an opaque package (`.fumi`), marked by extension

The bundle folder is **`{ulid}.fumi/`**, treated as an opaque macOS **package** (the `.app` / `.rtfd` / `.key` model): Finder shows one opaque item; "Show Package Contents" inspects on purpose. This protects `content.md` + `meta.json` + `assets/` as a unit — so the sidecar needn't even be hidden — and matches the "accessible but you generally wouldn't" posture exactly. *(The bundle's full content list has grown twice since: `versions/` for history, and — 2026-09-14 — a sibling of it holding any unresolved conflict candidate's text. See multi-mac-concurrency.)*

**Package by extension, not by the bundle bit.** macOS marks packages two ways; only the extension survives folder-sync. The "bundle bit" (folder flag / xattr) is dropped by iCloud/Dropbox/zip/copy → the note would appear as a plain folder on the other Mac. The extension is part of the name → travels perfectly. Cost: amends note-model's bare `{ulid}/` to `{ulid}.fumi/`; UID is still the ULID stem, the extension ignored in resolution.

**Consequences:**
- On a Mac with Fumi installed, notes render as opaque Fumi documents and **double-click opens/focuses the note in Fumi** — maps onto the engine's existing "open note" op, a free and natural entry path. On a Mac without Fumi, they show as plain browsable folders — graceful, nothing breaks.
- Assets inside a package aren't independently double-clickable from Finder — fine; assets are accessed through Fumi anyway (copy-only, `fumi://asset/`).

### Registration (settled) — under-the-hood, no permission

The `.fumi` package/document type is declared **declaratively in the app's `Info.plist`** (`UTExportedTypeDeclarations` conforming to `com.apple.package`; `CFBundleDocumentTypes` with `LSTypeIsPackage=YES`) and registered **automatically by Launch Services** when the OS sees the app — no user prompt, no onboarding step, and **independent of the Accessibility TCC permission** (a separate runtime grant for the private Space APIs).

*Cross-topic note → onboarding-and-permissions:* the one faint ordering nuance — on a fresh Mac where the iCloud folder arrives *before* Fumi is installed, note bundles briefly show as plain folders until Fumi runs once and registers the UTI. Automatic and self-healing, not a wizard gate; onboarding just needs awareness. (Also a loose tie to build-and-release: Launch Services registration is stable once the app lives in `/Applications`, past Gatekeeper/quarantine.)

### Edge cases carried
- **Multiple app copies** — Launch Services may bind `.fumi` to the wrong copy if an old Fumi lingers (e.g. in Downloads). Standard macOS install-hygiene issue.
- **Double-clicking a soft-deleted note's bundle** — define what open-from-Finder does for a deleted note (open? restore? refuse?). Deferred to soft-delete-mechanism.

### Amendment — identity anchored in `meta.json` (resolves review F1)

The **UID is stored as a canonical field in `meta.json`**; the folder name (`{ulid}.fumi`) is a *derived, human-debuggable mirror* of it, not the source of identity. On any disagreement (only reachable if a *folder* sync service renames on collision), the **in-file UID wins** and the engine repairs the folder name. Under the leaning CloudKit transport this basically can't arise — no shared folder for a service to rename, and the CKRecord carries the UID field regardless.

Folder name **stays the ULID** (not a random/opaque id): keeps redundancy (recover UID if the sidecar is lost), debuggability, and — the load-bearing reason — a **deterministic UID→path** mapping (`{store}/{ulid}.fumi`), so the engine locates a bundle by UID without an index lookup. Random names would force an index indirection just to find bytes.

So the `meta.json` stored set is: **`uid`**, `schemaVersion`, `colour`, `createdAt`, `modifiedAt`, `deleted` (+ `deletedAt`). *(Casing per the layer rule below — sidecar and record camelCase, SQLite columns snake_case.)* *(**Set extended by later decisions** — synced-geometry-fields added `size`, `presetId`, `floatOnTop`; the attribution decision added `lastVia`, `lastBy`. Full v1 set: `uid`, `schemaVersion`, `colour`, `createdAt`, `modifiedAt`, `deleted`, `deletedAt`, `size`, `presetId`, `floatOnTop`, `lastVia`, `lastBy`. Swept 2026-08-01, review-005 F1.)* *(**Extended 2026-08-23** — `lastDevice` joins `lastVia`/`lastBy` as a third last-content-write field, so the conflict reconciler can name the Mac holding the live side. See multi-mac-concurrency.)* *(**Plus the assets manifest** — `id → {originalFilename, addedAt}`, decided in asset-storage. Added 2026-08-09, review-008 F3: it dropped out of a list of scalars because it is a keyed structure, but the list is labelled full and is what a specification builds from. It is the filename's **only** home for a sync-off store, where there are no asset child records to reconstruct it from.)*

### Reopened (drained triage 2026-07-30) — field naming is inconsistent: `schemaVersion` is camelCase, everything else snake_case

*From: note-model · discussion · 2026-07-30.*

Surfaced while reconciling note-model's attribute set against this topic's decided data mapping.

This topic's synced discrete field set is **`colour`, `created_at`, `modified_at`, `deleted`, `deleted_at`, `schemaVersion`, `edit_counter`** — six snake_case and one camelCase. `schemaVersion` is the lone outlier.

**Likely cause:** camelCase is the common JSON idiom and the record is `meta.json`, so it probably arrived by reflex. But the same record maps field-by-field to SQLite columns, where snake_case is the norm — which is presumably why every other field went that way. The record therefore has a genuine convention tension in it, and it was resolved inconsistently rather than deliberately.

**Suggested resolution:** six-to-one says normalise to **`schema_version`**. Whichever way it goes, the point is to pick one convention for the record and apply it uniformly — the current split is neither.

**Not urgent, but cheapest now:** this is a stored on-disk field name. Once notes exist in the wild, changing it costs a migration, and this topic has already decided a `schemaVersion` mechanism whose whole purpose is versioning such changes — using it to fix its own name would be an odd first migration.

**Scope note:** note-model owns the *model* attribute set and has now explicitly scoped its inventory to exclude plumbing fields like `schemaVersion` and `edit_counter`, naming them as this topic's. So the naming decision is unambiguously storage-and-sync's — note-model has no stake in it beyond consistency.

#### Decision (2026-07-30) — casing is per *layer*, not per record: the reported outlier was the correct field

The record is serialized three times — `meta.json` keys, `CKRecord` field names, SQLite columns — and the report's framing ("pick one convention for the record") assumed those are three formats needing one answer. They aren't three formats; they are **two layers**.

> **`meta.json` and the `CKRecord` are serializations of the note itself — they mirror the struct, so **camelCase**. SQLite is the query index — a database, so **snake_case**.**

**This inverts the report.** `schemaVersion` was the only correctly-named field. The ones to change are the other five: `created_at` → `createdAt`, `modified_at` → `modifiedAt`, `deleted_at` → `deletedAt`, `edit_counter` → `editCounter` *(field since dropped — multi-mac-concurrency, 2026-07-31)* (`uid`, `colour`, `deleted` are single words, unaffected). SQLite columns are **unchanged** — they stay `created_at`, `modified_at`, `deleted_at`, `deleted`, which is what read-model-index already documents. *(The rule binds `preset_id`, `float_on_top` as columns and was silent on `size` — a single word, unaffected by casing; it lands as a `notes` column in the projection, per the re-partition sweep. review-005 F1.)*

**Options weighed:**

- **snake_case everywhere** (the report's suggestion) — follows the 6-to-1 majority. Rejected: majority is not a reason, and it lets a **disposable** artifact set naming on **permanent** ones (see the durability note below).
- **camelCase everywhere** — one name per field on every surface; grep a field name and find every site; Swift `Codable` needs no `CodingKeys`. **Argued for and abandoned.** Two things killed it. First, the claim that camelCase is *conventional* for SQLite was overstated — it is more common in Swift than elsewhere, because GRDB / SQLite.swift map columns onto struct properties by default, but GRDB ships an explicit `.convertToSnakeCase` strategy precisely because the opposite is equally normal. The ecosystem is split, so convention backs neither. Second, and decisively: **every one of the three surfaces already has an explicit mapping site** — `Codable` for the sidecar, `record["createdAt"] = …` for CloudKit, column bindings for SQLite. No surface gets a free ride from matching names, so "one name everywhere" buys almost nothing. It would only pay if raw keys leaked across layers, and they don't — data crosses layers as typed structs, not loose keys (the user's argument, from the equivalent Laravel practice: camelCase through frontend → DTO → domain, snake_case the moment it hits the database).
- **Per-layer (chosen)** — one boundary, one mapping, drawn where the layer actually changes.

**Why the line sits between the record and the index, and not somewhere else.** The sidecar and the `CKRecord` are not two different things: they are the same domain object written to disk and written to the wire. SQLite is a genuinely different layer — this document already calls it *"truly throwaway"*, a rebuildable projection that exists to answer queries. That is the same split as DTO-vs-database, and it is why "be idiomatic to each format" is the wrong rule to write down: it is per-*format* taste, and it is exactly the rule under which the next field gets named by reflex. **Per-layer is stated so the boundary is a decision rather than an inference** — which is how `schemaVersion` diverged in the first place.

**Durability note — why the permanent surfaces set the convention.** The sidecar (on disk in every bundle) and the record are the expensive-to-change surfaces; a CloudKit container's schema **cannot rename or remove fields once deployed to Production** (Development can be reset freely), so record field names are effectively permanent at launch. The SQLite index can be nuked and rebuilt at will. Settling this pre-build is therefore cheap and post-build is not — the one genuine urgency in the report, though not for the reason it gave.

**Binds the incoming geometry fields** (→ synced-geometry-fields, which inherits this): `size`, **`presetId`**, **`floatOnTop`** in the sidecar and record; `preset_id`, `float_on_top` as columns.

**Stale prose corrected in place** — the document contradicted *itself* before this decision (bundle-layout's stored set said `schema_version`; the store-locality data mapping and the mixed-version note said `schemaVersion`). Corrected at all sites rather than left as a dated amendment: a field name that reads wrong in three places keeps being read wrong.

*Swept 2026-07-31 (resolves review-004 F12).* The rule was written the same day several concerns were drained in, and **the drained prose was not swept with it** — so newer text reintroduced the very inconsistency the rule removed, on exactly the fields not yet written anywhere. Corrected since: the geometry and `editCounter` decisions rewrote their own sections; the retention pseudocode now reads `createdAt` / `retentionLastChangedAt`. **Quoted material from note-model is left verbatim** as the record of what arrived, with a scope note at the head of each drained block pointing at the canonical names — so nothing reads as current that isn't, and nothing is silently rewritten to say something its author didn't.

### Decision (2026-08-01) — `schemaVersion`: the migration procedure *(resolves review-005 F16)*

The field was baked in *"for clean future migration"* with no procedure, and five sidecar fields were added this week (`size`, `presetId`, `floatOnTop`, `lastVia`, `lastBy`) — the first real instance has already occurred. Three parts, each extending a principle already in force:

> 1. **A sidecar with a higher version than the engine understands → operate on the known fields, preserve unknown fields verbatim on rewrite, never lower the version.** The sidecar read path gets the same manners the record already has (unknown-field tolerance; never destructively overwrite what you don't understand). A v1.0 engine sharing an account with a v1.1 Mac keeps working on every note; only a genuinely unparseable sidecar falls through to the existing degrade-never-destroy recovery.
> 2. **Upgrades rewrite lazily, never as a launch sweep.** A sidecar is rewritten — and its version bumped — only when the note is next written for a real reason; additive fields need no rewrite at all (absent already means default / no opinion). An eager sweep would push every record in the account through sync and churn Time Machine for zero content change — and lazy is this document's standing posture (retention, GC, eligibility).
> 3. **The number versions the note record's serialized shape** — the struct `meta.json` and the `CKRecord` both mirror. SQLite is excluded: the index carries its own schema version in `meta` and migrates by rebuild (it is disposable). A SQLite-only change never touches `schemaVersion`.

Housekeeping: everything renamed or added pre-ship — the casing renames, the geometry fields, `lastVia`/`lastBy` — collapses into **v1 ships as version 1**, with the procedure in force from day one rather than invented at version 2.

#### Decision (2026-08-02) — documents carry their own version, under the same procedure *(resolves review-006 F9)*

Part 3 above scopes the number deliberately — it versions the note record's shape, and SQLite is excluded because it migrates by rebuild. **Documents are neither**, so the keyed-document payloads inherited no version field, no unknown-field tolerance, and no lazy-rewrite rule. The 2026-08-02 blob change is the first live instance: the per-device entry shape went from `{position, display, space, visible}` to `{position, display, space, visible, lastOpened}`, and nothing said what an older build does on meeting the new shape.

Two skew paths exist and the second is destructive:

- **Device documents** — read by a *restored* machine, which may run an older build than the Mac that last wrote the file. Additive-only, so tolerable; but "tolerable" was assumed, not stated.
- **Account documents** — written by **every** Mac. An older client merging the preset library per key rewrites entries it only partly understands, dropping newer fields inside them. That is exactly the destructive overwrite the sidecar rule was written to forbid, arriving through the payload the rule doesn't cover.

> **Each document payload carries its own `schemaVersion`, and the three-part procedure applies to it unchanged:** operate on known fields, **preserve unknown fields verbatim on rewrite**, never lower the version; rewrite lazily on the next real write, never as a sweep; and the number versions that payload's shape alone.

**Independent numbers, deliberately.** A document's version is not the note record's — they change for unrelated reasons, and coupling them would force a note-record migration every time a preset field is added. The note record, each document scope, and SQLite each version what they own.

**Per-key merge makes the preservation rule sharper, not weaker.** Because account documents merge per key, an old client touching one preset must preserve unknown fields *inside every other key* it writes back — the whole payload passes through it. Verbatim preservation is what makes an old client safe to run at all in a mixed-version account.

**v1 ships as version 1 here too**, so the procedure is in force from the first release rather than retrofitted — the same housekeeping call as the note record.

---

## Read-Model Index

### Context

*Rerouted from note-model (drain-triage 2026-07-22).* *(Scope note 2026-08-01 — this Context predates the three-tier re-partition: "window coords/size" and "float-on-top" have since left the machine-local tier (`size` and `floatOnTop` sync on the note record; durable placement lives in the per-device blob). The decided state is the three-category invariant in Sync Safety and the `window_state` re-partition. review-005 F1.)*

**Central SQLite index / read-model is the access pattern.** Do **not** parse every bundle at query time (cumbersome at hundreds of notes). A machine-local **SQLite** index projects every note (UID, derived title, tags, colour, timestamps, soft-delete) and also holds the Bucket-2 machine-local state (window coords/size, home-Space UUID, float-on-top, visibility, z-order, caches). `list` / search / filter-by-tag / sort hit **SQLite**; a note's full content is read **on-demand** (open / agent `read`).

**Kept in sync + rebuildable.** The engine maintains the index on write, **watches the store via FSEvents** for changes landing from folder-sync, and **reconciles on launch**. The index is **fully rebuildable** from the bundles. So: bundles = truth (travels); index = fast, disposable read model; machine-local state lives only in the index.

**Open here:** the SQLite schema, exactly what's projected, the FSEvents/launch reconciliation strategy (detecting external landings, partial writes mid-sync, deletions), **download-on-demand** for evicted bundles, and the self-write-vs-external-landing distinction (the engine's own atomic writes also fire FSEvents — don't reproject our own writes as if external).

*From: search-and-retrieval · discussion · 2026-09-12*

*(Scope note 2026-09-15 — the filename half of what arrived here has since been dropped. This block is left verbatim as the record of what search-and-retrieval sent on 2026-09-12; its deciding premise — "the filename is not in the note's text" — was falsified two days later when note-window settled that inserting a file writes its filename into the note as the link label. The corpus this document now feeds is `content.md` alone; see the 2026-09-15 revision on the decision below.)*

The read-model decision defines `notes_fts` as an FTS5 full-text index over `content.md`, refreshed inline by the engine on any note change, in the same transaction as the bundle write. search-and-retrieval has now decided what a query actually matches, and the corpus is wider than `content.md` in one direction and narrower in another.

**The rule: the index holds what the user put there.**

- **`content.md`** — as now.
- **Plus each referenced asset's `originalFilename`**, from the `meta.json` assets manifest. Reason: the filename is not in the note's text, but the chip renders it, so the user reads "budget-final.pdf" inside a note, searches it, and gets nothing. That visible-but-unfindable failure is the one users read as "search is broken", and eliminating it was the deciding factor of the whole corpus decision.
- **Minus the `fumi://` URL targets** — asset ids and note UIDs are machine addressing nobody typed. Link and image **labels** are kept, and so are external `https://…` URLs: the user pasted those, and *"which note did I save that link in?"* is a real query, sometimes with the domain as the only thing they remember. The principle is authorship, not visibility — a concealment rule would have stripped the external URL along with the ULID.

**One refinement that matters to the GC rule.** Filenames are drawn **per referenced id**, not per manifest entry. Without that, deleting a chip leaves the note findable by the removed file's name: deleting the chip does rewrite the note, but this topic's asset GC is *"a sweep never triggered by a write"* with a 24-hour young-asset grace, so the refresh runs while the manifest still lists the file and puts the name straight back. Drawing per referenced id makes removal close itself — the token leaves `content.md`, the note rewrites, the id is no longer referenced, the name drops in the same transaction — and it means **no second refresh trigger is owed**.

**What search-and-retrieval states is unchanged:** the index itself, its owner, its refresh point, and the inline same-transaction discipline. This is an amendment to the index's inputs only. One consequence recorded there rather than raised: between deleting a chip and the sweep collecting it, the file is still on disk and recoverable through version history, but unfindable by name — judged correct, since it is not in the note any more.

*From: search-and-retrieval · discussion · 2026-09-12*

*(Scope note 2026-09-15 — point 2 below is left verbatim as the record of what arrived, and its example no longer holds: the corpus draws no filename, so a pass reading content alone rebuilds complete search rows. **The rule it argues for survives untouched and was deliberately kept** — the pass draws whatever the corpus rule names, never a file by name. Point 1, the separate search derivation version, is unaffected. See the 2026-09-15 revision on the decision below.)*

Two things in the derivation-version machinery are revised by search-and-retrieval's decisions. Both concern the same pass.

**1. Scope — `notes_fts` gets its own derivation version.** The state-tiering here has a derivation-rule change invalidating *"the **Projection alone** — `notes`, `note_tags`, `notes_fts`, the preview"*, and the re-derivation pass recomputes *"title / tags / preview / FTS"*. note-model's own rule enumerates only *"the title, the tag-set, the preview"* — so FTS was inside the versioned set under this document's reading and outside it under theirs, and on note-model's reading a tokeniser change would reproject nothing and leave every search row wrong indefinitely.

Settled in search-and-retrieval: **the search index is separately versioned from title / tags / preview.** Reason: search is now plainly its own reading of a note, with its own corpus rule and its own inputs, deliberately different from the title/preview strip (it keeps inline tags and indexes code fences, both of which the strip removes). Coupling its version to theirs makes every search tweak drag a full recompute of values that did not change — visible to the user as how long the app spends reindexing after an update. Rejected alternative: one version for every derived reading, which is simpler but makes the common case pay for the rare one, and would have forced note-model's three-value enumeration to be widened. Accepted cost: two counters rather than one. A benefit of choosing this way is that note-model's enumeration stays true exactly as written and owes no amendment.

**2. Inputs — the pass must draw what the corpus rule names, not `content.md` by name.** The pass is defined as re-reading each `content.md`. Since the search corpus now also draws each referenced asset's `originalFilename` from the assets manifest, a pass reading content alone rebuilds search rows **without filenames** — not stale rows, *wrong* ones — on every note the user has not since edited. The user ships an update that fixes accent matching and silently loses attachment-name search. Stated as a rule rather than a file list deliberately, so a future corpus change cannot strand it the same way again.

**Adopted unchanged from this topic's machinery:** the derivation version held separately from the index's own schema version; a bump triggering a background, resumable, Projection-only pass; the pass writing nothing to the store and never bumping `modifiedAt`; and the rebuild-not-full-rebuild reasoning (a full rebuild would discard the CloudKit change token). search-and-retrieval also decided that the **version-history** index rebuilds as its own separate, slower background job rather than being folded into this pass — walking every snapshot on the same path would make an ordinary rule change an expensive foreground event.

*From: note-window · discussion · 2026-09-14*

This comes back out of the concern you rerouted to note-window today about a damaged sidecar and an unrecoverable filename. Working it turned up a contradiction between two of your own documents, and the resolution falsifies the ground one of your decisions is standing on.

**The contradiction.** note-model pins a non-renderable asset's content form as link syntax (`note-model.md:353`):

> **non-renderable** (PDF/Excel) → link syntax `[report.pdf](fumi://asset/<id>)` → the renderer draws it as a **chip**.

Your index-input decision rests on the opposite (`storage-and-sync.md:157`):

> **Plus each referenced asset's `originalFilename`**, from the `meta.json` assets manifest. Reason: **the filename is not in the note's text**, but the chip renders it, so the user reads "budget-final.pdf" inside a note, searches it, and gets nothing.

A chip whose Markdown form carries a label has the name in `content.md`. And your own corpus definition at `:183` keeps link labels — *"`content.md` with the `fumi://` URL targets stripped — link and image **labels** survive"* — so if the label is the filename, it was already being indexed by the general rule before the manifest pull was added. Both statements cannot hold.

**What settled it, and where the actual gap was.** Nothing in any document said what label is written when a file is inserted. Insertion is note-window's surface — drop, paste, and the band's `attach` picker all land at the caret — and none of those decisions said what goes in the brackets. Your document and note-model's drifted apart in that silence; the unrecoverable-filename question you sent over was a consequence of it rather than a problem in its own right.

note-window has now closed it:

> Inserting a file writes its filename as the link label. The chip renders the label. `originalFilename` stays on the record as what the file *is* — what it reveals as in Finder, opens as, and drags out as — and is no longer what the chip reads.

The reasoning is *inserting with no selection pre-fills the label*, decided there earlier the same day for note links, reaching the other token type: a token whose visible text is derived from elsewhere is a token whose words exist nowhere in the note's own bytes. Writing the name into the buffer at insert makes it the user's own text from that moment — and note-window accepted the consequence that a chip's label is therefore editable like any other link text, with the file underneath unaffected.

**The ask — does the manifest pull survive its own reason?** The stated ground is false, so the decision needs re-grounding either way. Two readings are live and note-window has no standing to pick between them:

- **The pull is now redundant.** At insert the label *is* the filename, so it is in `content.md` and the general label-survives rule already indexes it. The visible-but-unfindable failure the pull exists to eliminate cannot occur for an unedited chip, and dropping the pull would simplify both the corpus rule and the rebuild pass — which is the thing `:172` and `:261` had to state defensively precisely because the input reached outside `content.md`.
- **The pull still buys something narrower.** The label is editable, so a user who renames a chip to *"the deck"* has a note whose text no longer contains `budget-final.pdf` — and they may well search for the filename, since that is what the file still reveals and opens as. The pull would then be covering divergence between the label and the file's real name, which is a smaller and different job than the one it was written for.

Worth knowing which way it lands: note-window pins nothing here, and the chip's behaviour is unchanged under either answer.

**Two nearby sites take the same correction whichever reading wins**, since both restate the falsified ground rather than merely depending on it: `:172` (*"the filename is not in the note's text"* as the reason the rebuild pass must not read `content.md` by name) and `:261` (the same argument restated for the pass). If the pull goes, the rule those two exist to protect goes with it; if it stays, its reason needs rewording.

Nothing about the manifest, the asset child record, the on-disk `<ulid>.<ext>` naming, or the repair rule you decided today is touched by this. Your position that no filename is written and none is invented stands exactly as written — it simply turns out not to be the only copy of the name.

*A note on ownership: the corpus rule itself is search-and-retrieval's — your `:185` sibling check adopts it and settles the input path. A parallel concern is being delivered there for the corpus decision; this one is about `notes_fts`'s input and the rebuild pass, which are yours.*

### Decision (2026-07-23)

#### 2026-09-15 — revised
*Trigger: triage from note-window: "The filename is in the note's text — the index input rests on a premise that is now false" — inserting a file now writes its filename into the note as the link label, so the reason the index reached outside `content.md` has ceased to exist.*

**The manifest pull is dropped. `notes_fts`'s corpus is `content.md` alone** — the `fumi://` URL targets stripped, link and image labels kept, pasted `https://…` URLs kept. Nothing outside the note's own text feeds the row.

**Sibling check: search-and-retrieval — its decided text holds the corpus as `content.md` plus each referenced asset's `originalFilename`, minus the `fumi://` targets, on the principle of authorship rather than visibility. This decision contradicts the `originalFilename` half, which is their ground and not this document's to restate: the identical fork already sits in their queue from note-window, and the decision taken here was rerouted to them the same day so their document reconciles against an answer rather than deciding it blind. The authorship principle itself is untouched, adopted not re-decided, and is what carried this. note-window — its decided text holds that inserting a file writes its filename as the link label, that the chip renders the label, and that `originalFilename` stays on the record as what the file *is*; adopted, not re-decided.**

**Redundancy is the weaker half of the case and is not what decided it.** The pull is now redundant for an unedited chip — the label *is* the filename, so the general label-survives rule already indexes it — and a redundant input costs almost nothing, so on its own it would not justify reversing a decision this document argued at length. What decides it is the case where the pull is *not* redundant. A chip's label is ordinary link text, so it is editable:

```
user renames a chip's label to "the deck"

  note's text holds:      "the deck"
  note's text does not:   budget-final.pdf

  with the pull:  searching "budget-final" returns this note
                  the user reads it top to bottom and the word is nowhere in it
```

**That is the original failure inverted, and it breaks the property the corpus rule exists to hold.** Visible-but-unfindable was the failure that decided the corpus; findable-but-invisible is the same defect from the other side, and it is the worse-feeling one — a result the user cannot account for beats a miss they can explain. The rule that survives both readings is one sentence: **what you can read, you can search, and nothing matches on text you cannot see.**

**Authorship reads against the pull once the label is the user's own text.** The corpus principle is *what the user put there* — the pasted URL is in, the ULID the picker wrote is out. A relabel is an authorship act in exactly that sense: the user replaced the name with their own words, and indexing the name they removed is indexing what they took out. Same move as the per-referenced-id refinement below, which made a deleted chip's name drop in the note's own write rather than linger until a sweep — removal closing itself.

**Cost, named: a user who renames a chip loses filename search for that file.** Bounded and self-explaining — they still have the label they chose, which is what the note shows and what search now matches, and the file still reveals, opens and drags out under its real name. Nothing about the file is lost; one query term for it is.

**What deliberately does *not* go with it.** The concern reads the rebuild pass's defensively-stated input as existing only because the corpus reached outside `content.md` — *"if the pull goes, the rule those two exist to protect goes with it"*. It does not. The pass stays defined as drawing **whatever the corpus rule names**, never a file by name; the corpus simply resolves to one file again. That formulation is what stops the *next* corpus change stranding the pass silently, and it costs a reader one hop. Striking it because the corpus narrowed would re-arm the trap it was written for — this document's own rule about naming a dependency by the rule it follows rather than by the file it currently reads, which this decision reinforces rather than retires.

**The hot-path cost booked on 2026-09-14 comes back.** A note change no longer reads the manifest as well as the content, the index is derivable from `content.md` alone again, and the write path carries one input fewer.

**No second refresh trigger was ever owed and still isn't.** The per-referenced-id rule below exists so that deleting a chip drops its filename from the index on the note's own write; with no filename in the index at all, the question does not arise, and the GC sweep's deliberate laziness cannot reach search results because search no longer reads anything the sweep governs.

**One residual absent case, and it is a known shape rather than a new one.** An agent can emit a bare asset token with no label — `[](fumi://asset/<id>)` — and nothing then puts the file's name in the note's text, so that note is unfindable by the file's name. search-and-retrieval already accepted precisely this shape on the note-link side, where an empty-label pill renders the target's title and matches nothing, pricing it on frequency once the human insertion paths were closed. The asset side now matches it exactly rather than being an exception to it. What such a chip renders is note-window's, and already with them.

**Rejected: keep the pull for the renamed-chip case.** The narrower job is real — the file still is what it is, and a user may well search for it — and it loses on the inversion above: it buys back one query term at the price of the index matching on text the note does not contain, which is the property the corpus rule was written to protect.

#### 2026-09-14 — revised
*Trigger: triage from search-and-retrieval: "The FTS corpus is wider than content.md" — the index's inputs change, because the filename a chip renders is not in the note's text and the `fumi://` targets that are in it are machine addressing nobody typed.*

**Adopted.** The `notes_fts` row of the schema below is restated rather than amended in place:

> **`notes_fts`** — FTS5 full-text index for search. Its corpus is **`content.md` with the `fumi://` URL targets stripped** — link and image *labels* survive, and so do pasted `https://…` URLs — **plus the `originalFilename` of every asset the note's current content references**, drawn from the `meta.json` assets manifest **per referenced id, never per manifest entry**.

**Sibling check: search-and-retrieval — its decided text holds that the index holds what the user put there: `content.md` plus each referenced asset's `originalFilename`, minus the `fumi://` targets while keeping labels and pasted external URLs, on the principle of authorship rather than visibility. That is adopted, not re-decided; what is settled here is the input path — what the refresh reads, and when a filename leaves the index.**

**The per-referenced-id half is this topic's, and it is what makes removal close itself.** Asset GC is a sweep that never fires on a write, with a 24-hour young-asset grace on top, so at the moment a chip is deleted the manifest still lists the file:

```
delete chip  →  content.md rewritten, index refreshes inline
                manifest still holds  01JB4X → budget-final.pdf
   per manifest entry:  the name goes straight back in
                        note stays findable by a file it no longer has
   per referenced id:   id unreferenced → name drops, same transaction
```

Per referenced id, the index stays a function of the note's content plus a lookup keyed by what that content references — so **no second refresh trigger is owed**, and the GC sweep's deliberate laziness cannot leak into search results.

**The rebuildability invariant is untouched, and worth stating because the input widened.** `notes_fts` stays **Projection** — rebuilt by scanning bundles. It now projects from two files in the bundle rather than one (`content.md` and `meta.json`), both of which the feeding transaction already holds open. Nothing outside the bundle feeds it, which is the property the tier actually asserts.

**The inbound path composes without a special case.** A note arriving from CloudKit publishes its content and the asset records it references as one unit (atomic publish), and the manifest is reconstructed from those records — so the engine has the filenames at the moment it writes the bundle and refreshes the row. A bundle whose `meta.json` will not parse is already marked `unresolved` and retried rather than reprojected, so the row keeps what it had instead of losing its filenames; for a sync-off store with a damaged sidecar the manifest is the filename's only home, so search loses filename matching on that note. Content is still indexed either way. *(Corrected later the same day — this read "degrades search by that much **and nothing else**", which was wrong: the chip's label and the young-asset grace clock read the same table. See the sidecar-repair revision, review-009 F3.)*

**Cost, named: a second input on the hottest write path in the engine.** Every note change now reads the manifest as well as the content. It is the same transaction and the same file the write already touches, so the cost is a lookup rather than IO — but the index is no longer derivable from `content.md` alone, and anything later reasoning about *"reproject from content"* has to remember the second half.

**One glossed consequence corrected here, deliberately not rerouted.** search-and-retrieval recorded that the deleted file stays on disk but unfindable by name *"between deleting a chip and the sweep collecting it"*, which understates it in this topic's direction: retention defaults to **Forever**, so an older snapshot keeps linking that asset and the sweep may never collect it at all — and history's own corpus is text the note has held, which carries the `fumi://` token rather than the filename. The file is permanently on disk and permanently unfindable by name. **The window is not a window.** Their decision is untouched and still right on its own reasoning — it is not in the note any more — so nothing of theirs needs amending and reopening a decided topic to correct a gloss would cost more than the gloss does. Stated here instead, because this topic owns the retention rule that makes it permanent.

#### 2026-07-23

The machine-local SQLite index is a **rebuildable projection** of the bundles (truth); `list`/search/filter/sort hit it, full content is read on-demand.

**Schema (shape):**
- `notes` — `uid` (PK), derived `title`, `colour`, `created_at`, `modified_at`, `deleted` + `deleted_at`, cached **preview** snippet (so the list view never opens a bundle). *(Plus the synced fields that landed after this was written, projected like every other record field: `size`, `preset_id`, `float_on_top`. Swept 2026-08-01, review-005 F1. **`lastVia`/`lastBy` are deliberately not projected** — see the decision below; review-006 F10.)*
- `note_tags` (`uid`, `tag`) — the derived `#hashtag` set, for fast tag filtering.
- `notes_fts` — FTS5 full-text index over `content.md`, for search.
- `window_state` — this Mac's view of each note. **Current tuple, as of 2026-08-02:** (`uid`, `x`, `y`, `display_uuid`, `space_uuid`, `visible`, `last_opened`, `z_order`). Every column is **Derived** in this invariant's sense — nothing here is authoritative. The first seven mirror the per-device blob entry and are re-read from it on rebuild; `z_order` alone is disposable outright, recomputed from the running session. *(Restated as a tuple 2026-08-02 rather than amended a fourth time — resolves review-006 F1. **History, collapsed:** written 2026-07-23 as (`uid`, x/y/w/h, `space_uuid`, `float_on_top`, `visible`, `z_order`, `last_opened`) and labelled "Bucket-2 machine-local, never synced, never in the bundle"; `w/h` left 2026-07-31 — that is `size`, authored and synced, projected as a `notes` column; `float_on_top` left the same day for the note record; the remaining position columns were re-tiered from "cache of the settings zone" to re-read-from-the-blob later that day (review-005 F1/F2); `last_opened` moved from disposable to blob-carried 2026-08-02; `display_uuid` added 2026-08-02 by the restatement itself — see below.)*
- `meta` — the index's own schema version, **a separate derivation version** *(added 2026-08-03 — bumped whenever a title/tag/preview derivation rule changes; a mismatch at launch triggers a Projection-only re-derivation pass. See the drained-triage decision below.)*, **and the `CKSyncEngine` state blob** (the change-token / pending-queue the spike requires we persist — its machine-local home). *(Placement inside the disposable index is deliberate — the blob is Cache-tier, so a rebuild costs a full re-fetch from CloudKit, not data. Cost named and accepted 2026-07-31, review-005 F3.)*

**Feeding — engine is sole writer.** On any note change (local edit *or* CloudKit-applied inbound), the engine writes the bundle atomically then updates the row inline (re-derive title/tags, refresh FTS) in the same transaction. **No FSEvents in v1** — nothing outside the engine writes the store; FSEvents returns only for the *future folder driver*.

**Rebuildable + F5 recovery (missing/corrupt `meta.json`):** rebuild by scanning bundles. A bundle with `content.md` but a missing/unparseable `meta.json` → **recover `uid` from the folder name** (why we anchored it in both places), ~~**default the rest** (neutral colour, not-deleted, best-effort timestamps), rewrite a fresh `meta.json`, flag it~~ — **content is never dropped**. Only a bundle with no readable `content.md` is quarantined. Degrade, never destroy. *(**Superseded 2026-07-31** — this originally read "Bucket-2 state is lost on rebuild → cascade-render + Space-1 fallback — acceptable". Durable per-machine state is now **re-read from the local per-device blob** on rebuild — the settings zone is read only at first launch on a restored machine (review-005 F2); only `home-Space` still falls back. See below.)* *(**Default-the-rest superseded 2026-08-04** — defaulting and rewriting made an invented value indistinguishable from a chosen one, and per-field merge then propagated it account-wide. The repair now consults the record first and waits for `reconciled` before writing at all; `uid`-from-the-folder-name is unchanged. See the drained-triage decision below.)*

**Decision (2026-08-02) — `lastVia`/`lastBy` are not projected *(resolves review-006 F10)*.** The 2026-08-01 sweep added `size`, `preset_id` and `float_on_top` to `notes` as *"the synced fields that landed after this was written"*, while the bundle-layout stored set was swept the same day to a full set that also includes `lastVia` and `lastBy`. The two lists diverged with nothing said either way — the third time this document has caught that shape.

Said now, and the answer is not to project them:

> **Not every synced field earns a column. A column exists to answer a query — `list`, search, filter, sort — and nothing asks about last-writer attribution.**

The scrubber displays attribution from **version child records**, not from the note; the only reader of `lastVia`/`lastBy` is the engine composing an engine-originated snapshot, which is already holding the note record it is about to write. A column would be a second copy kept in step for no reader. The per-layer casing rule needs no binding for them either — there are no columns to name.

**Reversible at no cost, unlike the fields themselves.** SQLite migrates by rebuild, so if a sort-by-last-writer ever surfaces in management-window, the column lands in a rebuild — which is exactly why the projection is the cheap side of the ledger to be conservative on.

**Encryption (F7):** v1 does **no app-level at-rest encryption** — rely on the user's **FileVault** (local disk) + **CloudKit** in-transit/at-rest encryption. Revisit only if a security-conscious segment matters (a positioning/licensing question, not storage).

### Reopened (drained triage 2026-08-03) — a derivation version must force an index reprojection

*From: note-model · discussion · 2026-08-03.*

note-model ruled that its derived values are versioned, and routed the mechanism here:

> **The derivation rules carry a version. When it changes, the projection is rebuilt rather than trusted.**

Every derived value in the note model — derived title, tag-set, preview snippet — is a function of **content *and* of the code deriving it**. note-model changed one such rule the same day: tag parsing moved from "letters, digits, `-`, `_`, `/`" read as ASCII to Unicode letters/marks/digits plus emoji, with an NFC-normalised, locale-invariantly-folded key. Title derivation has known unsettled edge cases expected to tighten post-launch, so this recurs.

**The failure is not cross-Mac skew** — two Macs on different builds deriving different tag-sets is accepted and self-healing, since derived values are per-machine and never synced. **The failure is that the update itself changes nothing.** The index is *"fully rebuildable"*, but rebuildability is a capability, not a trigger: rows projected under the old rules are never revisited, so shipping the Unicode tag rule leaves `#café` and `#🔥` unfilterable on the **up-to-date** machine for every pre-existing note until each is individually edited. Unlike version skew, this never resolves on its own.

note-model asked for a derivation version persisted beside the index's schema version and compared at launch, and left four questions open: separate value or folded; full rebuild or narrower pass; synchronous or background; whether the CloudKit state blob in `meta` is affected.

#### Decision (2026-08-03) — the three-category invariant already scopes the repair

##### 2026-09-15 — amended
*Trigger: triage from note-window: "The filename is in the note's text — the index input rests on a premise that is now false" — the manifest pull was dropped from the corpus, and the entry below argues its input rule from an example that pull supplied.*

**The decision stands exactly as written; only the example under it has expired.** The pass draws **whatever the corpus rule names**, never a file by name — and it was kept deliberately when the corpus narrowed back to one file, against the concern's own reading that the rule goes with the pull. A rule that exists to stop the *next* corpus change stranding the pass is not spent by the corpus happening to be simple again. What no longer holds is the instance: a pass reading `content.md` alone now rebuilds complete rows, because there is no filename in the corpus to omit. Both counters and the single two-counter pass are untouched.

##### 2026-09-14 — revised
*Trigger: triage from search-and-retrieval: "notes_fts leaves the shared derivation-version pass" — the versioned set was enumerated one way here and another way in note-model, so a tokeniser change either recomputed values that hadn't moved or reprojected nothing at all.*

**The split is adopted: `notes_fts` carries its own derivation version, separate from the one governing title, tag-set and preview.** `meta` therefore holds three numbers — the index's schema version, the title/tags/preview derivation version, and the search derivation version.

**Sibling check: search-and-retrieval — its decided text holds that the search index is separately versioned from title / tags / preview, on the grounds that search is its own reading of a note with its own corpus and inputs, deliberately keeping what the title/preview strip removes (inline tags, code fences); note-model — its derivation-version rule enumerates "the title, the tag-set, the preview", and the split is what keeps that enumeration true exactly as written, so it owes no amendment. Both adopted, not re-decided; what is settled here is the mechanism — how many numbers `meta` holds and how many passes read them.**

**What was actually wrong was an ambiguity with two bad readings, not a missing feature.** The invalidation list here named `notes_fts`; note-model's named three values and stopped. Read this document's way, an update that fixes accent matching in search bumps the counter and recomputes every note's title, tag set and preview — none of which changed. Read note-model's way, the same update bumps nothing, and every note indexed under the old tokeniser stays wrong until the user happens to edit it, which for a note written and left alone is never. The second is the worse failure and the one the enumeration actually licensed.

**One pass, two counters — not two passes.** The background pass compares both numbers at launch and recomputes only what its mismatched counter names: a search-rule change rewrites FTS rows alone, a title-rule change rewrites `notes` / `note_tags` / preview alone, and an app update that moved both reads each bundle **once** and recomputes both from that read. Two independent jobs would walk the store twice in exactly the case an app update most often produces, and could both be walking it at the same time. Everything else about the pass is unchanged — background, resumable, serving the stale-but-not-broken rows meanwhile, writing nothing to the store, never bumping `modifiedAt`, leaving Cache and Derived untouched.

**The pass draws what the corpus rule names, never a file by name.** As written it *"re-reads each `content.md`"*, and that is now wrong rather than merely narrow: the corpus also draws each referenced asset's `originalFilename` from the assets manifest, so a pass reading content alone rebuilds search rows **without filenames** on every note the user has not since edited. Not stale rows — wrong ones, produced by the update that was supposed to fix search. Stated as a rule rather than a file list deliberately, so a later corpus change cannot strand it the same way: **the defect was a pass naming its input by filename while the corpus rule moved underneath it.** The same shape this document has caught three times before — a decision landing correctly at its new site while text depending on it stays put — except caught before shipping, and fixed by stating the dependency rather than by chasing the sites. The indirection costs a reader one hop to the corpus rule, which is affordable because that rule now lives two screens up in this document. Nothing else about the pass moves: it still writes nothing to the store, and reading the manifest is a read.

**Cost, named, and it lands on the part already called fragile.** This document names the bump discipline — a constant a developer must remember to change when they change a rule — as the one genuinely fragile part of the mechanism, and a second counter doubles what can be forgotten. Accepted because a forgotten bump **fails safe in both directions**: it leaves today's status quo rather than corrupting anything. Coupling, by contrast, has no safe direction — it guarantees the common case pays for the rare one on every release, and the user reads that as how long the app spends reindexing after an update.

**Rejected: one version for every derived reading.** Simpler by a number, and it was the status quo on this document's reading. It makes every search tweak drag a full recompute of values that did not move, and it would have forced note-model to widen an enumeration that is correct as it stands.

##### 2026-08-03

The rule is adopted without argument — it is note-model's ground, and the mechanism is small because both halves already exist here (`meta` holds the index's own schema version; the index is already rebuildable from bundles). **Sibling check: note-model — its decided text holds that derived values are versioned and that a rule change invalidates the projection; that is adopted, not re-decided, and only the "how the index learns" half is settled below.**

Three of the four questions collapse into one observation, which is that **this document already states the scope of the repair**:

> SQLite holds **Projection**, **Cache** and **Derived**. A derivation-rule change invalidates the **Projection alone** — `notes`, `note_tags`, `notes_fts`, the preview. Cache (change tokens, tombstones) and Derived (window state, re-read from the per-device blob) are not functions of the derivation code and are not stale.

- **A re-derivation pass, not a full rebuild.** A full rebuild discards the change token, and losing it *"costs a full re-fetch from CloudKit"* — a network round trip to repair a purely local recompute. The pass re-reads each `content.md`, recomputes title / tags / preview / FTS, and updates in place. **Rejected: reuse the full rebuild** (already implemented, so no new code) — it trades an expensive rebuild of untouched Cache-tier state for the saving of one small code path, and this is the path that runs on every update touching derivation, likely more often than a schema change ever will.
- **The `CKSyncEngine` state blob is unaffected** — note-model's expectation confirmed, and for a sharper reason than it had: not merely that nothing derived is synced, but that **the pass never touches `meta`** beyond the derivation version itself. The blob sharing the table is harmless because the table is not rewritten.
- **Two separate values, not one.** They answer different questions — the schema version asks *is the table the right shape*, the derivation version asks *were these values computed by the current rules*. **Folding them is what would make the narrow pass unreachable:** a single number bumped for two unrelated reasons forces every derivation change through schema-migration machinery, and every schema change through a full re-derivation. **Rejected: one "reproject everything" trigger** — simpler to write, and it discards the distinction that makes the cheap repair possible.

**Background, resumable, serving the existing rows meanwhile.** The precedent is the enable-time bulk backfill — *"background, non-blocking, resumable"* — and the reasoning transfers exactly. Blocking launch on a recompute over hundreds or thousands of notes contradicts the furniture premise (fumis should be on screen immediately). The rows being served are **stale, not broken**: mid-pass, `list` and filtering behave precisely as they did before the update, which is a state the user was already living in. **No progress indicator** — this is local file reads measured in seconds, not a sync with a quota or a network to fail on; the sync-status surface exists for states that can get stuck, and this one cannot.

**Two properties the concern didn't raise, both following from rules already in force:**

- **The pass writes nothing to the store and syncs nothing.** No bundle is touched and **`modifiedAt` is not bumped** — otherwise an app update would present as having edited every note, leaping the whole library up sort-by-recent and enqueueing the entire store for upload. Same family as the rule that recolour and geometry don't bump `modifiedAt`.
- **It runs after the launch reconciliation walk**, so notes the walk imports or updates are not derived twice.

**Cost, named:** a second repair path beside the full rebuild, and a constant that a developer must remember to bump when they change a derivation rule — a discipline no mechanism can enforce, and the one genuinely fragile part of this. It fails safe: forgetting the bump leaves the status quo the concern describes, rather than corrupting anything.

### Reopened (drained triage 2026-08-04) — sidecar repair defaults every field, but note-model rules the synced record beats a local default

*From: note-model · discussion · 2026-08-03.*

Coherence finding (conflict). note-model rules that a damaged field is restored from the synced record and defaulted only as a last resort:

> *"**The synced record beats a local default.** A defaulted field is a last resort — where the note's record is still available from CloudKit, the true value is restored from it and no default is invented. Damage is local; the record usually isn't."*

The F5 recovery above was written 2026-07-23, well before those damage rules landed, and defaults everything except the `uid` **and rewrites the sidecar** — with no consult of the record. Every field in that sidecar is a synced record field, so the invented values enter per-field merge as ordinary local edits:

```
Note is Blue everywhere.

  MacBook          meta.json corrupts (disk hiccup, killed mid-write)
     │
     ▼
  repair runs      "can't read it — colour defaults to Neutral"
     │             writes a fresh meta.json
     ▼
  sync             MacBook: Neutral (changed vs ancestor)
                   Server:  Blue    (unchanged)
     │
     ▼             per-field merge: the changed side wins
  Studio           Blue → Neutral.  Every Mac. No prompt.
```

`deleted` / `deletedAt` carry the sharper version — a defaulted `deleted: false` on a note sitting in Recently Deleted **un-deletes it everywhere** — and best-effort timestamps overwrite true ones. The merge is behaving correctly on its own terms; what it is given is an invention it cannot distinguish from a choice.

This was also the one decided path in the document that acted destructively on ambiguous evidence, against the posture every neighbouring rule takes — degrade-never-destroy, the absent-zone stop, *rare silent loss is worse than rare visible annoyance*.

#### Decision (2026-08-04) — repair is a write, and writes wait for reconciled; rendering doesn't wait

##### 2026-09-14 — revised
*Trigger: review finding — the repair was written for the sidecar's scalars and the assets manifest moved into the sidecar's stored set five days later, so a damaged sidecar leaves a chip with no name on it and nothing says whether the table is rebuilt (review-009 F3).*

**The reassurance first, because it bounds the whole question: the manifest is metadata *about* assets, not the record of *which* assets exist.** The files sit in `assets/`, and the references are `fumi://asset/` tokens in `content.md`. So rendering an asset and ref-counting it both survive a lost manifest untouched. What is lost is the **original filename** and **`addedAt`** — the chip's label, the search corpus's filename half, and the young-asset grace's clock. *(Amended 2026-09-15 — two of those three readers are gone, and the rule below is unaffected. note-window settled on 2026-09-14 that inserting a file writes its filename into `content.md` as the link label and that the chip renders **the label**, so a chip with a lost manifest entry still renders; and the corpus dropped the filename the same week, so search never reads the manifest at all. **What a damaged sidecar actually costs is the young-asset grace's clock, and knowing what the file is** — the name it reveals as in Finder, opens as, and drags out as. The reroute to note-window about what a nameless chip renders is theirs to close or drop; the question was asked before the label rule existed.)*

> **The assets manifest is reconstructed from the note's asset child records where the store has them, and nothing is invented where it does not.** An entry with no source stays absent: no filename is written, and an absent `addedAt` reads as **young**, so the sweep keeps the bytes rather than collecting an asset it cannot date.

**This is the August rule one level down, not a new one.** *"The synced record beats a local default"* was written about record fields, and the manifest is not a record field — but it is already *"reconstructed from asset records per-Mac, not a synced blob"*, which is exactly how a fresh Mac builds it in the first place. Repair reuses the path that already exists rather than inventing a repair path for it. The `reconciled` gate applies unchanged: a store that never had a sync relationship is trivially reconciled and simply has nothing to rebuild from; one that has waits for a completed fetch, so an entry is concluded genuinely unrecoverable rather than not-yet-seen.

**Absent reads as young, and the direction matters.** The grace exists so a sweep cannot land between an agent's two-call sequence — add the bytes, then write the token. Reading an undateable asset as *old* would reopen precisely that window on the notes least able to defend themselves. Reading it as *young* keeps bytes that might be collectable, which is the side degrade-never-destroy already errs on, and it self-corrects the moment a fetch restores the real `addedAt`.

**Nothing is written while the repair waits, which is why this costs nothing.** The same render-time-fallback-never-a-write shape the document has now landed four times: a note renders Neutral without storing Neutral, a dangling `presetId` renders plain authored geometry while keeping its binding, an unrecognised colour is preserved as-is, and an asset with no known name renders without one.

**Cost, named: a sync-off user with a damaged sidecar keeps a few undateable asset files indefinitely** — bounded to assets nothing references, since a referenced asset is retained anyway, and visible in the store-size figure rather than silent. That user also permanently loses those filenames, because the manifest was their only home; there is no better source to wait for, exactly as with every other sidecar field on a store with no sync relationship.

**One piece of this is not ours.** What a chip renders when it has no name — the file's kind drawn from its extension, which is on disk and not a guess, or no label at all — is a surface decision, and note-window owns the chip. *Rerouted to note-window triage (2026-09-14).* This topic's answer is only that no name is stored and none is invented.

##### 2026-08-04

**Sibling check: note-model — its decided text holds that the synced record beats a local default, that never-null fields have documented repair values (Neutral, the creation-default size), and that an unrecognised value is "preserved as-is and rendered as Neutral" rather than rewritten. All three are adopted, not re-decided; what is settled here is the mechanism — when the repair is allowed to consult, and when it is allowed to write.**

The asymmetry note-model names is what makes this fixable rather than a trade: **the corruption is on one disk and the truth is still on the server**, so in almost every occurrence of this failure the value being invented is one we could simply have asked for.

> **A damaged sidecar's repair consults the note's record first, and defaults only what the record cannot supply. The repair does not write until this store is `reconciled`. Meanwhile the note renders a fallback without storing one.**

Three parts, each reusing something already decided:

- **`uid` from the folder name is unchanged** — sound, and the reason the ULID mirrors into the folder name at all.
- **The gate is `reconciled`**, the predicate already serving retention purge, asset GC and the repair sweep. Its two clauses land exactly right here with no special-casing: a store that **never had a sync relationship is always reconciled**, has no record to consult, and therefore repairs immediately with defaults — the sync-off user's behaviour is unchanged from today. A store with a current or former sync relationship waits for a completed fetch, so a field is concluded genuinely absent rather than merely not-yet-seen.
- **The waiting state already exists.** A bundle whose `meta.json` fails to parse is marked **`unresolved` and retried** — the index's decided treatment for exactly this class of bundle. Nothing new is stored, and no fourth per-note sync state is invented.

**Rendering is not gated, and that is the whole reason this costs nothing.** The never-null invariants hold at display time from note-model's own repair values — Neutral, the creation-default size — **without those values being written**. This is the third application of a shape the document has already landed twice: the dangling `presetId` renders plain authored geometry while keeping its binding, and note-model preserves an unrecognised colour role while rendering it Neutral. A render is not a claim about what the note is.

**Precedent, and why this is one rule more rather than new machinery.** The document already says this three times, once almost verbatim: *"propagating deletions reconcile before asset repair runs — **a Mac that has not reconciled does not repair**, exactly as it does not purge"*; *"never purge from stale state"*; and the absent-zone rule's *stop, leave local truth untouched, require an explicit re-enable before re-uploading*. All three are the same principle — **a Mac that has not heard from the authority does not act on the authority's behalf** — and sidecar repair was the one destructive-adjacent write standing outside it.

**Rejected — mark the invented values and have the merge treat a marked field as "no opinion".** It reuses the *"absent in the ancestor means no opinion, never changed"* rule and was the obvious first shape. It loses because the marker has to be a real per-field addition to the sidecar and the record — the first thing either would carry about *how* a value got there rather than what it is — and it must then survive round-trips through builds that don't understand it, where an old client would read a marked field as an ordinary one. It buys nothing the gate doesn't already give.

**Rejected — accept the propagation.** The status quo, and the finding.

#### Journey — the gate was reached by dropping a framing, not by adding a mechanism

The first shape put to the user was **"repair runs, but holds its write until a fetch confirms it"** — the note is fixed locally and simply doesn't enqueue. It was chosen over the marker for needing no new field, and it is nearly right. But the user's objection was that it *"feels like a lot of machinery for an edge"*, and that objection was correct about the framing rather than the direction: holding a write invents a deferred-write state that nothing else in the document has, and it forced a follow-on question about whether *"repaired but not yet pushed"* needed a fourth value on the per-note sync status (`synced` / `pending` / `rejected`) — a state a user could see and not act on.

Both problems came from repairing first and deciding about the write second. Inverting it dissolves them:

> **Repair is a write, and writes wait. Rendering doesn't.**

Nothing is held, because nothing was produced yet. The bundle sits in the `unresolved` state it already had, and the sync-status surface gains no fourth value — the question that motivated it disappeared rather than being answered. The mechanism is one existing gate applied to one more sweep, which is what the objection was really asking for.

*(Worth naming because the two framings are behaviourally near-identical and the cheaper one is only visible from the second angle — the same shape as the dangling-preset decision, where "clear the binding, but own the write" lost to "don't write at all".)*

**Cost, named:** a note whose sidecar corrupts renders Neutral and default-sized until that Mac next completes a fetch — visible, harmless, and self-correcting, against a current behaviour that looks repaired while overwriting the truth on every Mac. For a sync-off user nothing changes at all, since there was never a better source to wait for.

## Sync Safety

### Decision — SQLite machine-local; the store holds only bundles; degrade-never-destroy

**Restated 2026-07-31 against v1 as it actually is *(resolves review-004 F3)*.** These four were written while *cloud-folder-is-the-store* was still live. store-locality then chose **local-truth + CloudKit transport**, and the lock-ins were never re-read — so half the section described a rejected architecture while reading as current constraints. **All four conclusions survive; two of the reasons don't.** Original wording is kept inline where the *reason* changed, since that is the part a reader would otherwise carry forward wrongly.

1. **SQLite lives machine-local** (`~/Library/Application Support/Fumi/`). ✅ **Conclusion stands, reason replaced.** *Was: "never in the synced folder — iCloud/Dropbox don't honour SQLite locking/WAL → corruption, with no conflicted-copy recovery for a binary DB."* **There is no synced folder in v1**, so that hazard cannot arise. It is machine-local now because it is a **per-machine cache and projection** (see the three-category invariant below) — nothing in it is authoritative for another Mac. The single-writer point is unchanged and still load-bearing: only the engine touches SQLite; CLI/MCP/windows go through it, never directly, which is what makes WAL safe.
2. **The store holds only bundles.** ✅ **Stands, rescoped** — *was "the synced folder holds only bundles"*, then "a local directory in Application Support". The store is a **subdirectory of the Fumi directory, not the directory itself** — as first restated, lock-ins 1 and 2 named the same path for contradictory contents, so the store contained the index it said it didn't. The store subdirectory still holds nothing but `.fumi` bundles; its siblings are drawn in the layout decision below. *(Rescoped 2026-07-31 — review-005 F3.)*
3. **Timestamps are engine-stamped in `meta.json`**, never fs mtime. ✅ **Stands unchanged** — mtime is still machine-local, still unreliable, still wiped by copy/restore.
4. **Rebuildability invariant.** ✅ **Stands, restated** — see the three-category version below, which supersedes both the original and its first amendment.

**Safety posture — degrade-never-destroy — stands entirely untouched.** It was never a property of the folder architecture.

**Struck: the mechanism pointer.** *"Mechanism (FSEvents debounce/settle, download-on-demand, the launch reconciliation walk) belongs to read-model-index"* — read-model-index subsequently decided **no FSEvents in v1** (the engine is the sole writer; nothing external lands in the store), and **eager sync dissolved download-on-demand** entirely. Only the launch reconciliation walk survives, and it lives with the rebuild rules.

<details><summary>Original four lock-ins, as written before store-locality</summary>
1. **SQLite lives machine-local** (`~/Library/Application Support/Fumi/`), never in the synced folder. iCloud/Dropbox don't honour SQLite locking/WAL → corruption, with no conflicted-copy recovery for a binary DB. The single-writer engine makes WAL safe — only the engine touches SQLite; CLI/MCP/windows go through it, never directly.
2. **The synced folder holds only bundles.** Nothing else.
3. **Timestamps are engine-stamped in `meta.json`**, never fs mtime (machine-local, unreliable across sync, wiped by copy/restore).
4. **Rebuildability invariant:** SQLite contains nothing but a projection of bundle contents plus disposable machine-local Bucket-2 state. Every must-travel field lives physically in the bundle; the DB is truly throwaway. *(Refined — final-review F3: this covers note **content**, projectable from bundles. **Deletion-state and sync-control state — change tokens, tombstones — are re-fetched from the sync authority (CloudKit), not bundles** (a hard-deleted note has no bundle to project from). So a rebuild = project content from bundles **+** reconcile deletions/tokens from CloudKit.)* *(**Restated 2026-07-31** — patched twice now for the same reason; the categories are stated properly in the state-tiering decision below rather than amended a third time.)*

</details>

### Decision (2026-07-31) — the invariant restated in three categories, and `window_state` re-partitioned *(resolves review-004 F5)*

The three-tier state model arrived as a passing note (*"Bucket 2 is never synced / disposable as a unit… now describes Bucket 3 only"*) and its consequences were never carried back into the decided text they invalidate. Three sites said the opposite; all are corrected in place.

#### The rebuildability invariant — restated, not patched again

The invariant said SQLite holds *"a projection of bundle contents plus disposable machine-local Bucket-2 state… the DB is truly throwaway"*. After today that is false: durable per-machine window state in SQLite is a **cache of the settings zone**, not a projection of any bundle. This is the *second* time the invariant has needed the same repair — it was already amended for change tokens and tombstones, which are also re-fetched rather than projected. So it is restated with the categories named, rather than amended a third time:

> **SQLite holds exactly three kinds of thing:**
> 1. **Projection** — derived from bundle content. Rebuilt by scanning bundles. *(notes, note_tags, notes_fts, preview)*
> 2. **Cache** — a local copy of state whose authority is remote. Rebuilt by **re-fetching from the sync authority**. *(change tokens; tombstones)*
> 3. **Derived** — genuinely disposable, rebuilt from local sources. *(resolved rect, z-order, last-active, caches; the window-state columns, re-read from the local per-device blob file)*
>
> **The DB stays throwaway.** What the original claim got wrong was not *whether* it can be discarded but *where each part is rebuilt from* — and one of the three sources is not the bundles.

*(**Re-tiered 2026-07-31, later the same sitting** — review-005 F2. As first restated, Cache also listed durable per-machine window state, "authority is remote… re-fetched from the settings zone" — which contradicted per-device-settings' Mechanics ("the local copy is authoritative; the CloudKit record is its backup") and has no rebuild source at all for a no-sync user. The local copy won, made concrete as a real file: the per-device blob lives in Application Support outside SQLite, the settings-zone document is its backup, and SQLite's window-state columns are Derived from the blob. The authority chain is drawn in per-device-settings.)*

##### Two vocabularies share the word "Derived" — stated so they stop colliding *(resolves review-006 F1)*

The three categories above classify **SQLite columns**. note-model's tiers classify **attributes**. They are different questions with one overlapping word, and the collision is not hypothetical — the 2026-08-02 `last_opened` entry wrote *"Durable, not Derived"* about a *column*, which reads as contradicting this invariant while describing exactly the mechanics the invariant prescribes.

| | Whose | The question it answers | Values |
|---|---|---|---|
| **Attribute tier** | note-model's state model | *If this Mac is wiped, should it come back?* | Note · Machine · Derived |
| **Column category** | this invariant | *Where does a rebuild get this from?* | Projection · Cache · Derived |

> **An attribute's tier and its column's category are independent, and a Machine-tier attribute is routinely a Derived column.** Position, home display, home-Space, visibility and `last_opened` are all Machine-tier — durable, they survive a wipe — *and* all Derived columns, because the durability lives in the per-device blob and SQLite merely re-reads it. Nothing is contradictory about that pairing; it is the normal shape for everything the blob carries.
>
> Only an attribute that is **Derived in both senses** — `z_order`, last-active, the resolved rect — is disposable outright: no blob entry, nothing to come back.

When either word appears unqualified from here on, it means the **column category** — this document's own scheme. Attribute tiers are named as such.

#### The rebuild recovery — corrected

*"Bucket-2 state is lost on rebuild → cascade-render + Space-1 fallback — acceptable"* directly contradicted the reason the per-device facility exists (losing every note's position is *"the loss of the product's value on that machine"*). A rebuild now **re-reads durable per-machine state from the local per-device blob**. *(**Re-tiered 2026-07-31** — this first read "re-fetches from the settings zone", which fails outright for a no-sync user and prefers a debounced backup over fresher local truth; review-005 F2. The settings-zone document is read only at first launch on a restored machine.)*

**`home-Space` remains the one genuine casualty** — macOS Spaces carry no identity across an erase-and-reinstall, so it cannot be restored however durable the tier claims to be, and the Space-1 fallback stands. That was always true; it is now the *only* part still true.

#### `window_state` re-partitioned

The table mixed all three tiers in one place. It splits by rebuild source, not by convenience:

- **Machine-tier (authority: the local per-device blob)** — position, home display, home-Space, visible/hidden, **`last_opened`**. Written to the blob, mirrored to the settings-zone document as backup, re-read from the blob on rebuild. Their **columns** are Derived — see the two-vocabularies note above; the durability is the blob's, not SQLite's. *(Re-tiered 2026-07-31 — was "cache of the settings zone"; review-005 F2. **`last_opened` added 2026-08-02** — it was listed under the disposable bullet below. Bullet relabelled from "Durable" 2026-08-02, review-006 F1 — "Durable" belonged to neither scheme.)*
- **Disposable outright (Derived in both senses)** — `z_order`, last-active, the resolved rect. Never leave the machine, no blob entry, nothing to restore, recomputed.
- **Gone** — `float_on_top`, which is now a synced field on the note record.

#### The display column — a genuine gap the restatement forced, not a labelling fix *(review-006 F1)*

Restating the tuple exposed something four in-place amendments had hidden: **the table had no display column**, while the Machine-tier bullet lists "home display", the blob entry carries `display`, and display identity has its own decision (display UUID, main-display fallback).

It was an omission rather than a choice, and the choice is forced anyway: **position is stored display-local.** A row holding `x=200, y=400` and nothing else is uninterpretable — 200,400 *on which screen?* The resolved rect is computed from (position, display), so a table carrying position without display can't produce the one value it exists to serve. `display_uuid` is therefore added, mirroring the blob like every other Machine-tier column, and resolving through the same fallback when the UUID doesn't match an attached display.

**Rejected: derive the display from the blob at read time and keep it out of SQLite.** It would make one column special — read from the blob while its siblings are read from the table — for no saving, since the blob entry is being read anyway.

#### Misdirected instruction corrected

The geometry entry says *"strike float-on-top from the Bucket-2 list in Per-Device Settings"* — that list (coordinates, home display, home-Space, visibility) never contained it. **The actual site was the `window_state` schema above**, which is where the strike has been applied.

### Reopened (drained triage 2026-08-02) — `last-opened` is Machine-tier in note-model but Derived in the re-partition

*From: note-model · discussion · 2026-08-01.*

Coherence finding (conflict). note-model classified `last-opened` as Machine-tier — durable, per-device backed up — explicitly resolving review-004 F7; this topic's `window_state` re-partition filed `last_opened` under Derived (disposable, never restored), and the per-device blob map omits it.

> note-model.md · Decision — the state model: "*`last-opened` sits in **Machine**, not Derived *(resolves review-004 F7 — it was dropped from both inventories in the tier rewrite)*. The Derived tier is defined as **rebuildable**, and `last-opened` is not reconstructible from anything — so it cannot live there, and it is a user-visible sort axis worth keeping across a reinstall.*"

> storage-and-sync.md · `window_state` re-partitioned: "**Derived (disposable)** — `z_order`, `last_opened`, the resolved rect. Never leave the machine, never restored, recomputed."

Neither document cites the other on this attribute. note-model's classification is argued (not reconstructible → cannot be Derived by definition; user-visible sort axis → losing it on a wipe is a bug); this topic's placement appears in a mechanical column-split list, and the per-device blob map (`noteId → {position, display, space, visible}`) has no `last-opened` slot — so as decided, the durable tier's mechanism cannot carry a value the model says is durable.

#### Decision (2026-08-02) — adopted; `last_opened` moves to Durable and gains a slot in the blob map

**note-model's classification stands and this topic's placement was a misfile, not a position.** The Derived tier is defined two paragraphs above as *"genuinely disposable, rebuilt from local sources"*; `last_opened` has no local source — nothing in the store records when a window was last brought up. A field that fails a tier's definition is in the wrong tier regardless of what argued it there, and nothing argued it there: the bullet was splitting SQLite columns by rebuild source and `last_opened` travelled with its table neighbours.

**Sibling check: note-model — its decided text places `last-opened` in Machine, on the grounds that Derived means rebuildable and this is not reconstructible; the classification is adopted verbatim rather than re-argued.** Ownership is note-model's (it owns the attribute model and the tier definitions); the mechanism — the blob entry shape — is this topic's, and is supplied below.

**`last-active` is a different thing and stays Derived.** note-model's Bucket-3 inventory lists *"z-order/last-active"* — which note is currently frontmost, a z-order companion recomputed from the running session — while `last_opened` is a per-note timestamp driving a user-visible sort. The re-partition's disposable-outright bullet now names `last-active` so the two stop reading as one entry.

**Mechanism — the blob map entry gains a timestamp:** `noteId → {position, display, space, visible, lastOpened}`. Nothing else changes: same blob, same debounce, same exclusive-writer property, same authority chain (blob authoritative, settings-zone document its backup, SQLite's column Derived from the blob).

**The scopes coincide, which is the check worth having.** The map holds entries only for notes with placement state on this Mac — and a note cannot have been opened here without having been placed here, nor carry a `lastOpened` without having been opened. So the field never forces an entry that wouldn't exist anyway. Entries survive soft-delete and are pruned by the hard-delete cascade, so `lastOpened` inherits both behaviours for free — a note restored from Recently Deleted returns to its place *and* its position in the recents sort.

**Cost, recorded rather than raised as a fork.** `last_opened` changes on a cadence unlike anything else in the blob: position and visibility change when the user moves or closes a note, this changes every time they merely look at one. Since the blob is rewritten whole and pushed on a debounce, it becomes the field most likely to dirty the blob, and deep-dive-001's amplification finding (no intra-field delta; every other Mac fetches the full blob and discards it) applies to it more often than to its neighbours. Two things bound the cost and neither needs deciding here: the debounce already collapses a burst of glances into one write, and the value is a **sort axis where approximate is indistinguishable from exact** — nobody can tell whether a note was last opened at 14:02 or 14:20, so a flush that lags by hours loses nothing observable. The build is free to fold `lastOpened` into blob writes happening anyway and flush it lazily otherwise; correctness never depends on freshness. Blob size grows by one short timestamp per placed-note entry against deep-dive-001's ~168 B/entry envelope — arithmetic on that figure, not new research, and well inside the margin the scoped map already bought.

**This is the third finding of one shape** — after the store-locality restatement and the casing sweep, a decision landing correctly at its new site while its old text stayed put. Here the sweep crossed documents: note-model corrected its own inventory under review-004 F7 and this topic's column list, written separately, was never re-read against it.

#### Decision (2026-08-02) — `lastOpened` stamps on focus; absent sorts last; recents are per-Mac by design *(resolves review-006 F2)*

The entry above described the field as changing *"every time they merely look at one"* — a feel, not a trigger. The document made five events plausible (unhide, window focus, double-click from Finder, an agent `read` over MCP/CLI, restore from Recently Deleted) and named none, and the read side was blank too.

> **`lastOpened` is stamped when the note's window takes focus on this Mac**, coarsened by the blob's existing debounce.

**Rejected: stamp on unhide.** Tempting, because `close = hide` makes "open" mean *hidden → visible* in the product's own vocabulary. It fails the shape Fumi exists for: a fumi pinned to the desk and worked in daily is never hidden, so it would stamp once — when first placed — and never again, ranking the most-used note as the least recent. A recents axis that inverts on the primary use case is worse than none.

**Focus fires often, and that is affordable only because of what the entry above already established** — this is a sort axis where approximate is indistinguishable from exact, so the debounce absorbs a burst of clicks into one write. The two decisions hold each other up: without the coarseness licence, focus-stamping would be the worst possible field to put in a whole-rewrite blob.

**It also preserves the scope coincidence, which is the real constraint.** Focus requires a window; a window requires placement. So an agent-created note never opened here still has no blob entry, exactly as the map-scope decision requires.

**The actor-parity rule does not reach this.** *"The actor model does not privilege one actor over another"* governs **authorship** — we don't snapshot before an agent writes because we don't snapshot before a human types. Reading is not writing, and `lastOpened` is a fact about *this Mac's desk*, not about the note: an agent reading over MCP has opened nothing on anyone's desk. That is why the attribute is Machine-tier rather than travelling with the note. **Sibling check: note-model — its decided text places `last-opened` in Machine as "a user-visible sort axis worth keeping across a reinstall" and says nothing about the triggering event; the trigger is mechanism and therefore this topic's, and nothing in note-model's actor model is contradicted by excluding agent reads.**

**Read side, two answers the document owed:**

- **A note with no entry sorts last.** Never opened on this Mac is genuinely the oldest thing, and it belongs at the bottom of the list rather than missing from it — consistent with the index degrading rather than hiding content.
- **Recents differ per Mac, deliberately.** The value is device-scoped, so your MacBook's recents are your MacBook's. Recorded as intended rather than left to surprise, in the same family as *"float cannot differ per Mac"* and the `home-Space` casualty — the pattern being that a per-machine truth is stated, not discovered.

**Cost, named:** "recently opened" now means *recently looked at*, which is a slightly different promise than the label implies — and it complements rather than duplicates `modifiedAt` (recently *edited*). The sort's name, the absent-entry treatment and whether the surface implies *on this Mac* are management-window's. *Rerouted to management-window triage (2026-08-03).*

**Safety posture — the index degrades, never destroys.** A partial / unparseable / evicted / vanished bundle is marked *unresolved* and retried — never an immediate purge, never a derived-state deletion. Consequences: `list`/search hit the projection (so absence of content bytes doesn't break browsing); a truncated `meta.json` fails JSON parse → the engine treats the bundle as "not settled" and waits.

**External raw deletion** (user deletes a `.fumi` bundle directly in Finder) is **out-of-contract, best-effort** — consistent with format-posture (external editing unsupported). Fumi notices it's gone and stops surfacing it; no recovery guarantee for a bypass of the app. *(One external-write carve-out, 2026-08-01: a bundle whose content hash disagrees with the index's projection at launch — a selective Time Machine restore — is imported as a deliberate local edit, never silently reverted. See the Time Machine restore decision in folder-drivers-and-backup; review-005 F13.)*

*Mechanism* (FSEvents debounce/settle, download-on-demand, the launch reconciliation walk) belongs to **read-model-index**. *(**Struck 2026-07-31** — no FSEvents in v1 and eager sync dissolved download-on-demand; only the launch reconciliation walk survives, and it lives with the rebuild rules. See the restated lock-ins above.)*

### Decision (2026-07-31) — the Application Support layout drawn; the store is a subdirectory *(resolves review-005 F3)*

Four artifacts had accumulated in `~/Library/Application Support/Fumi/` with no address: the SQLite index, the per-device blob (a real file as of the authority-chain decision), the `CKSyncEngine` state blob, and the per-Apple-ID store partitions plus the quarantined stores `switchAccounts` produces. The internal layout was never drawn, which is how lock-ins 1 and 2 came to contradict each other.

**The store is a subdirectory of the Fumi directory; "holds only bundles" scopes to it:**

```
~/Library/Application Support/Fumi/
├─ store partition(s), per Apple ID   ← "the store": .fumi bundles, nothing else
├─ quarantined stores from account switches
├─ SQLite index                       ← disposable (projection + cache + derived)
├─ per-device blob                    ← durable, deliberately apart from the index
└─ account documents                  ← durable: preset library, retention (+2026-08-02)
```

*(**Re-drawn 2026-09-14** — the Apple ID sits **above** four of these tenants, not beside one: the store partition, the note-placement half of the per-device blob, the account documents and the index all partition per account and quarantine together. Only the blob's app-level values — swatch, chrome, opacity — are machine-scoped and shared across accounts. See the partition decision in store-locality; review-009 F2.)*

These are **roles, not final names** — exact file/folder naming is build detail. What is decided: the five tenants and their separations — the blob and the account documents apart from the disposable index (the Time-Machine distinguishability the per-device decision requires), quarantines apart from live partitions, and bundles alone in the store.

**The `CKSyncEngine` state blob stays in SQLite's `meta` table, deliberately.** It is Cache-tier: losing it in a rebuild costs a **full re-fetch from CloudKit, not data** — a cost now named rather than discovered. The alternative (a separate state file beside the blob) buys a cheaper rebuild but adds an artifact whose own corruption is a new failure mode.

#### Decision (2026-08-02) — account documents get an address, as the fifth tenant *(resolves review-006 F8)*

This decision opened by naming its own motive — *"four artifacts had accumulated in `~/Library/Application Support/Fumi/` with no address"* — and then drew four tenants while the keyed-document decision's **account-scoped** payloads (the preset library; retention + `retentionLastChangedAt`) went unlisted. They fit none of the four: not bundles, not quarantines, not in SQLite's three categories, and not the device blob.

They must be readable locally, and for one class of user the local copy is the *only* copy:

- **`presetId` resolution is a launch-time, every-render operation** — the render-time fallback exists precisely because the library may be unavailable, and it should not be unavailable merely because the app restarted offline.
- **Retention eligibility is *"a wall-clock computation each Mac runs independently"*** — it cannot wait on a fetch.
- **A sync-off user has no zone at all**, and the "reconciled" definition explicitly serves them: *"Retention, GC, and repair work fully for sync-off users."* That is only true if the retention setting is on their disk.

> **Account documents are a fifth tenant of the Fumi directory**, durable, outside SQLite, alongside the per-device blob — same criteria, same reasons: Time-Machine-captured and distinguishable from the disposable index.

They inherit the blob's write and recovery discipline unchanged (atomic write; an unreadable file recovers from the settings zone where one exists, else defaults — for retention, the Forever default, which is the safe direction since nothing becomes eligible). **The one difference from the blob is authority**, and it is already decided elsewhere: the device blob has an exclusive writer so the local file is authoritative, while account documents are written by every Mac and merge per key against the ancestor. The local copy is therefore a **working copy of a shared document**, not the authority — so a corrupt one is re-fetched rather than re-pushed.

### Decision (2026-09-14) — a local write that cannot land: retry, stay visible, never block *(resolves review-009 F5)*

The far side of failure is modelled exhaustively here — `quotaExceeded` degrades with a persistent indicator, `serverRejectedRequest` shows as a per-note `rejected`, an absent zone stops and waits, a corrupt blob recovers from the zone, a corrupt sidecar waits for `reconciled`. The near side had nothing: **the disk fills and autosave cannot write the bundle.** Under local truth that is the one failure with no second copy to fall back on, and *"every durable local write enqueues"* means a write that never lands never enqueues — so the transport never reports it either.

What the user meets is the product's opening promise inverted. Autosave was the keystone precisely so that *"nothing is ever unsaved → close is silent, no prompt, ever"*, and close is weightless **because** it is recoverable. With the write failing and nothing said, closing a fumi discards the text — the Stickies unsaved-document failure arriving through the back door of the app built to kill it.

> **A durable local write that cannot land is retried. While it is failing the engine says so — once, at the store level, not per note — and editing is never blocked. Nothing is discarded by the engine; the text stays where the user can still reach it.**

**Store-level, because that is what the failure actually is.** A full disk fails every write, not one note's; a per-note flag would raise the same alarm on every fumi on screen and say less than one line would. Same posture as the absent zone — degrade visibly, never act destructively on a condition we do not control — and the same reason a quota pause is one indicator rather than an annotation on content.

**Deliberately thin, on the user's steer: a user whose disk is full has a bigger problem than their notes app.** No new per-note state, no held-buffer machinery, no recovery flow. The condition is recorded and reported; nothing is built to survive it.

**The honest limit, written down rather than papered over:** nothing survives quitting while the disk is refusing writes. The text is in the running engine and on screen, and that is the whole guarantee. Telling the user early is what makes it actionable at all — they can copy what matters out while it is still in front of them.

**One knock-on named, because it is counter-intuitive.** The dirty predicate is `hash(content.md) ≠ hash(latest snapshot)`, so a failed write leaves it reading **clean** — the flush that protects unsnapshotted typing will not fire. That is correct rather than broken here: with every write failing there is nothing to flush *into*, and a snapshot is a write like any other. It is worth stating because the predicate's whole virtue elsewhere is that it *"cannot lie"*, and this is the one condition under which it reports something the user would not expect.

**Rejected: go read-only while the store cannot be written.** A real alternative, and the one some apps take — it at least stops the user typing into a void, so nothing is composed that cannot be kept. It loses because it removes the app at the exact moment it is being used as scratch space, and because blocking editing is the one thing this document has refused at every turn (write-locking, the sync toggle, the absent-zone stop all keep editing alive). The fork was put to the user, who declined to treat it as one — a disk full enough to refuse writes is already a bigger problem than a notes app — which is also the mandate for the thinness above.

**No reroute owed for the surface.** status-and-alerts already carries a row for *the user did something and it did not work*; what was missing was a condition for it to report, which is this topic's, and is now recorded. Nothing there needs reopening.

### Elevated — the eviction/availability question is foundational → see Store Locality

The "evicted bundle" hazard (review F3) turned out bigger than a sync-safety detail: it's a direct consequence of *where the source-of-truth lives* relative to an evictable cloud folder. Elevated to its own subtopic, **store-locality**.

## Store Locality

### Context

Surfaced by the eviction hazard (review F3) and pushed hard by the user: cloud providers routinely **evict** file bytes to dataless placeholders to save disk — iCloud "Optimize Mac Storage", Dropbox online-only / Smart Sync, OneDrive Files On-Demand, Google Drive streaming. It is *not* iCloud-specific; it's generic dataless-placeholder behaviour. If the **authoritative** bundles live in the cloud folder, eviction can make a note's content locally-unavailable (offline + low disk = unreadable). User requirement: v1 fully-featured, "we can't have" content removed — resolve, don't gloss.

**No reliable cross-provider pin exists.** "Keep Downloaded" / "Make Available Offline" is a per-provider *Finder* action, not a public API a third-party app can call to force non-eviction on an arbitrary folder. So we can't simply flag our bundles non-evictable.

**Two paradigms — the line real apps split on:**
- **Cloud-folder-is-the-store** (Obsidian's free vault): bundles live in the folder *as* truth → inherits eviction pain; mitigation is user guidance ("disable Optimize Storage", "Keep Downloaded") + download-on-demand. Obsidian's own paid Sync exists precisely because the free model hits this wall.
- **Local-truth + cloud-as-transport** (Apple Notes/Bear via CloudKit; DEVONthink / 1Password / Things via a local DB + a sync *store*): the live store is local & non-evictable; the cloud folder is a **replica/transport**, never the live truth. Eviction can never hurt availability. Cost: ~2× content on disk, and the engine owns merge (rather than delegating to folder-sync's conflicted-copy behaviour).

Note: this is orthogonal to the bundle *format* (bundle-layout stays decided — `.fumi` package, `meta.json` sidecar). Store-locality is only about *where the authoritative copy lives*.

**Open — decision pending** (foundational; reverses note-model/discovery's "bundles in the synced folder ARE truth; backup + multi-Mac fall out for free").

### Exploration (in progress)

**CloudKit as a third path — best understood as a *transport driver under local-truth*, not a rival.**
- "iCloud only" is ambiguous: iCloud *Drive folder* only does **not** solve eviction (it's the worst offender); iCloud via *CloudKit* **does** (DB record sync, no file placeholders — local store stays materialised).
- CloudKit pros: eviction-immune; Apple builds the sync engine (change-tokens, delta sync, `CKAsset`, server-side conflict *detection*); would largely *solve* multi-mac-concurrency; no infrastructure, free within user-scaled quota.
- CloudKit cons: iCloud-only (kills multi-provider + local-only); data lives in an opaque Apple container → violates "your data is in a folder you own" and "the location is yours"; **excludes the confidential-notes/lawyer persona** (data on Apple's servers); feasibility on a Developer-ID + private-API + notarized app needs verification (iCloud entitlements + provisioning profile — possible for direct-distribution but real plumbing).
- **Reframe:** discovery's "backends = drivers + settings" already anticipated this. Fix **local-truth** as the store; make sync **pluggable**: a **folder driver** (local / iCloud Drive / Dropbox — serves everyone incl. lawyer) ships first; a **CloudKit driver** is a clean later/premium option. **Only Option B's local-truth makes a CloudKit driver possible at all** (Option A has no local store to sync) → CloudKit is an argument *for* local-truth, and folder-vs-CloudKit becomes a deferrable driver-level choice, not a now-or-never fork.

**Replica sync semantics (the honest core of Option B).**
- Local-truth does **not** yield a single global source of truth — it relocates the multi-writer problem. With three copies (Mac A truth, shared mirror, Mac B truth), truth is *per-note, per-edit*, resolved by a **convergence protocol**.
- **Version vector per note** (per-device counters, stored in `meta.json`, rides in the bundle): inbound dominates → fast-forward; local dominates → ignore (also how the engine recognises its *own* mirror writes echoing back via FSEvents); concurrent → **preserve both**, surfaced in-app. Strictly better than folder-sync's `conflicted copy` files (precise detection, in-app resolution, no metadata-vs-content false conflicts). **This version-vector machinery is exactly what CloudKit would provide for free** — it *is* the cost of the folder driver.
- **Manual edit of the replica:** B introduces a truth/replica divergence class A lacks. Detect via content-hash mismatch vs the vector-recorded version; import best-effort as an "unknown-device" external edit, **never silently discard**, conflict-preserve on collision. Not a *supported* workflow (format-posture), but not punished. The `.fumi` **opaque package** already makes casual mirror-editing unlikely (needs "Show Package Contents").
- **Honest point for Option A:** A has *no* truth/replica divergence (folder *is* truth); B must manage one. Real cost of B, weighed against eviction-immunity.

### Direction (converging — 2026-07-22)

**Option A is out.** Relying on detecting providers' `conflicted copy` files is unacceptable — a new/unknown sync service or a changed naming convention silently breaks us (user). Safety must be **structural, not heuristic**.

**Store = local-truth (Option B family).** The authoritative bundle lives in a local, non-evictable store; sync is a transport over it.

**Conflict handling = never auto-resolve; keep-both-and-surface.** Reliable auto-merge isn't achievable (even git hits merge conflicts); on a genuine concurrent divergence the engine preserves *both* versions and surfaces the conflict rather than silently picking one. Expected rare (single-user tool; fast syncs make same-note-two-Macs-at-once an edge case). *UI mechanism → note-window (to reroute):* not two windows — one fumi flagged with a conflict badge/colour (a macOS error affordance) opening a tabbed "version 1 / version 2" reconciler.

**Transport — leaning CloudKit as the v1 driver, behind a pluggable sync-driver seam** (folder / multi-provider / SFTP deferred as future drivers):
- CloudKit is still local-truth (not a reversion to A) — it's a *transport* choice.
- Advantages that directly answer the above: **structural conflict detection** (server change-tokens, not filename heuristics — kills the brittle-detection problem outright); Apple's sync engine for free (**much less bespoke merge code** — de-risks the owned-merge worry); **no ~2× local-disk premium** (syncs to iCloud servers, not a second local folder); nails the student/backup persona (automatic, "just works"); on-brand ("professional, clean, perfectly Apple, just works").
- Costs now accepted (user relaxed these): iCloud-only (no Dropbox / local-only); data in Apple's opaque container rather than a user-owned folder (the "folder is your data" ethos softens to "it just syncs"). The confidentiality/lawyer objection is deliberately wound back — a small segment, iCloud is a standard trusted sync path, not a reason to bend the architecture.
- **"Kicking the can" — inverted:** CloudKit uses Apple's solved engine *now*; the *bespoke multi-provider folder-sync engine* is the harder thing, correctly deferred until real demand for non-Apple drivers.
- **Gate (verify, don't assume):** CloudKit on a **Developer-ID direct-distribution + private CGS/SkyLight APIs + notarized** app — needs iCloud entitlements + provisioning profile. Generally possible for direct-dist apps but an unusual combo; if blocked/painful → fall back to the folder-driver (Option B with folder transport). Candidate for a small feasibility spike.

### Decision (locked — 2026-07-22, spike-confirmed)

Feasibility spike (`.cache/fumi/discussion/storage-and-sync/spike-cloudkit-seam.md`) cleared the gate. **store-locality = local-truth; v1 transport = CloudKit via `CKSyncEngine`, behind a bundle-level sync-driver seam.**

- **Feasible on our stack.** Apple lists CloudKit + Push as Developer-ID capabilities; App Sandbox is optional (and our private CGS Space APIs *require* non-sandbox — requirements align); notarization is a malware scan, not a private-API audit. One non-obvious build step: embed a **Developer-ID provisioning profile** authorising the restricted iCloud entitlements (→ build-and-release). ~~**Floor: macOS 14+** (CKSyncEngine).~~ *(Amended 2026-09-11 — the `CKSyncEngine` availability floor is **14.0** and that measurement stands, verified in the SDK header by platform-support's research. What is no longer true is that it sets the **project** minimum: the floor moved to **15+** on 2026-08-30 in space-homing, on the Space-placement route rather than on CloudKit, and platform-support fixed the supported range as a product fact on 2026-09-11. CloudKit is now slack beneath the floor, not the thing setting it.)*
- **Primitive = `CKSyncEngine`** (bring-your-own-store). `NSPersistentCloudKitContainer` rejected — it'd force Core Data, contradicting the bundle model. Apple ships a reference sample.
- **Eviction fully solved (confirms T1).** CloudKit is record + `CKAsset` sync, *not* file mirroring — **no dataless placeholders**; assets materialise only when fetched, into our own store. Fumi's local bundles are never OS-evicted. The hazard that opened this topic is gone under this transport.
- **Keep-both is native.** `serverRecordChanged` returns client + server + **ancestor** (true three-way); on genuine divergence the note enters a **`conflicted` state** with the divergent version as a **subordinate conflict-record** (*not* a new note — see multi-mac-concurrency / final-review F7), surfacing both — never LWW/auto-discard.
- **The seam (spike F5):** driver protocol defined at *bundle level* (`enqueueLocalChange(noteID)`, `apply(remoteChange)`, `resolveConflict(local, remote, ancestor?)`, `accountState`, plus a durable-delete primitive) — **not** CloudKit primitives. All CKRecord/CKAsset/zone/state/push specifics live *inside* the CloudKit driver; a future folder driver implements the same protocol (`ancestor = nil`, version-vector substitutes; tombstone-as-file). Preserves T4 pluggability.
- **Keep the seam vs go all-in CloudKit (final-review reflection):** we lean heavily on CloudKit mechanisms (child records, ancestor conflict, tombstone-as-record, account-state) — but they stay **inside the driver**, so they foreclose nothing. **Decision: v1 CloudKit-only, keep the thin seam.** It keeps folder-sync / own-folder / no-iCloud reachable **without a rewrite** *and* keeps the core **testable + CloudKit-decoupled** (clean code — justifies the seam even if no 2nd driver ever ships). Discipline to hold: no CloudKit type ever leaks into the core. **Honest caveat:** a folder driver is a **real future project, not a bolt-on** (it re-implements in files what CloudKit gives free — tombstone propagation, version-vector conflict, snapshot-file sync, FSEvents reconciliation, partial-write handling). Dropping the seam to go all-in CloudKit was **considered and rejected**: modest code saving vs permanently foreclosing the own-folder future + losing testability.

**Derived / rippled decisions:**
- **Data mapping (refined — final-review F8):** one `CKRecord` per note (`recordName = <ulid>` — identity-in-record, F1). **`meta.json` maps field-by-field to discrete record fields — no verbatim blob, nothing double-stored** (on-disk `meta.json` and the record fields are two engine-maintained serializations of the same data). Synced discrete fields: `colour`, `createdAt`, `modifiedAt`, `deleted`, `deletedAt`, `schemaVersion` *(plus `size` / `presetId` / `floatOnTop` — see synced-geometry-fields; `lastVia` / `lastBy` / `lastDevice` — see the attribution decision, 2026-08-01, and the device-stamping decision, 2026-08-23; `editCounter` **dropped 2026-07-31**)*. `content.md` → a `CKAsset`; **each asset → its own child record** (its `CKAsset` + `originalFilename` / `addedAt` ~~/ `excluded` flag~~ — *field struck 2026-08-09, hard limit*) — the assets manifest is *reconstructed* from asset records per-Mac, not a synced blob. **Not synced:** `title`/`tags` (re-derived from content locally) + machine-local window state *(swept 2026-08-01 — this read "all Bucket-2 window-state (machine-local, SQLite only)", stale twice over: geometry intent now syncs on the record, and the durable placement tier lives in the local per-device blob (mirrored to the settings-zone document), with only the Derived remainder SQLite-only. See the three-category invariant. review-005 F1)*. Version snapshots and conflict candidates are likewise child records. *(**A conflict candidate also carries its writing device's key**, added 2026-08-23 — see multi-mac-concurrency.)*
- **Soft-delete → a flag on the record/meta** (not a CloudKit delete); propagates Recently-Deleted across Macs, preserves restore. *(Leans soft-delete-mechanism toward flag over trash-folder — confirm there.)*
- **Hard-delete → tombstone** (persistent deleted-id set) so a delete isn't resurrected by another Mac's re-upload or a restore. **Resolves review F6.**
- **Assets (F4 resolved):** on-disk name = generated id (`<ulid>.<ext>` — *amended 2026-08-04, was `<short-id>`; note-model pinned a ULID*), original filename kept in a `meta.json` assets manifest (`id → {originalFilename, addedAt}`); `fumi://asset/<id>` references the id; each asset → a `CKAsset`.
- **Account handling (final-review F4):** the local store is **partitioned by Apple ID**. **Sign-out** → keep running on local truth (stops syncing; resumes on sign back into the *same* account). **Sign-in as a different account** (`switchAccounts`) → **quarantine** the current account's store on disk (intact, *not* deleted), close its open windows, load/create the new account's store (sync from its CloudKit). Notes "disappear" from view under B but return intact on signing back into A — the same model as Apple Notes/Photos (content follows the Apple ID); never *lost*. **Never merge accounts** (A's notes never touch B's iCloud). The no-account/local-only store is its own partition (binds to the first account that enables sync). Re-scoping the existing zone to the new account is explicitly **rejected** (data leak).

**Decision (2026-07-31) — the store lives in Application Support *(resolves review-004 F2)*.**

store-locality settled *that* truth is local and non-evictable but never said **where**, and four decided or drained items had quietly assumed a browsable location.

> **The store lives in `~/Library/Application Support/Fumi/`.** Not `~/Documents`, not a user-chosen folder.

**Why (user, firm):** applications that plant a folder in `~/Documents` are a long-standing pet hate. Application Support is the correct macOS home for application-managed data the user does not hand-edit — which is exactly the format posture already decided (accessible for backup, **not** a supported read/edit path). It is also covered by Time Machine, so the backup posture and the per-device-blob placement constraint both hold unchanged. **Rejected: `~/Documents/Fumi` or any visible location** — it would make three earlier decisions read more naturally, which is not a good enough reason to colonise the user's Documents folder.

**Consequences, recorded rather than glossed:**

- **Double-click-to-open survives but stops being a promoted entry path.** It still works — the UTI is registered and a `.fumi` bundle opens in Fumi — but it is a *side-effect* of the format, not a route the product suggests or designs for. The bundle-layout framing of it as *"a free and natural entry path"* is overstated for a folder nobody browses.
- **The opaque-package decision stands, on a narrower justification.** *"Finder shows one opaque item"* now describes a folder that is rarely visited. It still protects `content.md` + `meta.json` + `assets/` as a unit for anyone who does go in — via Time Machine, a backup trawl, or curiosity — and it costs nothing. Kept for integrity, not for browsing.
- **External raw deletion stays out-of-contract**, and becomes considerably rarer.
- **"No folder picker in v1" is now trivially consistent** — there is nothing to pick.
- **The discovery-era framing is formally retired.** *"No hosted cloud; the storage location is yours"* has now been softened twice: once by CloudKit (data lives in Apple's container), and now by this (the local store is neither user-chosen nor user-visible). The honest current position is **"your notes are yours and they just sync"**, not "your notes are files in a folder you picked". Positioning should not claim the latter.
- **Bears directly on quick-look-preview** (still open): its stated premise is *"notes are real files in a user-visible location, so previewing them where they live costs the user nothing"*. That premise is now false.

**Amendment (2026-07-31) — the seam is kept, but its justification narrows to testability.**

The original decision rested on two reasons. One has weakened and one has not:

- *"Keeps folder-sync / own-folder / no-iCloud reachable without a rewrite"* — **weak now.** This pays only if that future arrives, and the user's current read is that it very likely won't: iCloud provides what Fumi needs, and a folder driver is a real project nobody is planning to start.
- *"Keeps the core testable and CloudKit-decoupled"* — **unchanged, and now load-bearing alone.** Testing sync logic against a live CloudKit container is miserable; against an in-memory fake it is ordinary. Good engineering practice on its own terms, independent of any second driver.

> **The seam is a testing seam, not a portability seam.**

Consequence for its shape: a seam built so "another driver could land" carries abstraction a testing seam doesn't need. It can be **thinner, and shaped for a fake** rather than for a hypothetical folder implementation. The discipline that no CloudKit type leaks into the core still holds — that is what makes the fake possible — but the folder driver stops being a design target and becomes, at most, a possibility the shape doesn't foreclose.

**Open, forced by the spike:**
- **50 MB per-`CKAsset` ceiling** vs copy-only large attachments → a required v1 **large-asset policy** (chunk / cap / exclude-with-warning). → asset-storage subtopic. *(Settled 2026-08-09 as a **hard cap**; exclude-with-warning held the position for six weeks and was retired.)*
- ~~**Min macOS = 14+** — confirmed (CKSyncEngine floor; a project-wide constraint → build-and-release / planning).~~ **Superseded 2026-09-11 — the project minimum is macOS 15+, and it is not this topic's to state.** The `CKSyncEngine` 14.0 availability annotation is real and unchanged — re-measured 2026-09-11 on the 26.5 SDK, `grep -B4 '@interface CKSyncEngine :' "$(xcrun --show-sdk-path --sdk macosx)/System/Library/Frameworks/CloudKit.framework/Headers/CKSyncEngine.h"` → `API_AVAILABLE(macos(14.0), ios(17.0), tvos(17.0), watchos(10.0))`. It simply stopped being the binding constraint when the floor moved to 15 on 2026-08-30 (space-homing, on the Space-placement route: Chromium restricts `NSWindowRestoresWorkspaceAtLaunch` to macOS 14 and earlier and uses a private class from 15 onward, so a 14 floor risked two placement implementations inside the supported range). **platform-support** owns stating the supported range as a product fact (macOS 15.0.0 and above); **build-and-release** keeps enforcement — the bundle minimum, the appcast, and what a below-floor user meets at install. Nothing in this topic's transport, eviction or seam reasoning depends on the number.
- Provisioning-profile lifecycle (does an expired embedded profile break runtime sync?) → verify at build-and-release.

### Decision (2026-08-01) — every durable local write enqueues; the transport owns timing *(resolves review-005 F15)*

The seam had `enqueueLocalChange(noteID)` and a push-driven transport, but nothing stated what *triggers* the enqueue for an ordinary edit — every autosave, a debounce, blur, or the snapshot cadence. The answer is load-bearing three places: it sizes the divergence window between Macs, it defines what the per-note sync state (`synced`/`pending`/`rejected`) actually reports to management-window, and it is independent of the dirty predicate (unsnapshotted and unpushed are separate conditions — only one had a definition).

> **Every durable local write enqueues.** Autosave lands in the bundle → `enqueueLocalChange` fires; likewise any synced-field write (geometry, colour, `lastVia`). **Enqueue is an idempotent marker, not an upload** — `CKSyncEngine` keeps a deduped pending set (documented; deep-dive-001) and its scheduler owns wire timing.

Fifty autosaves in a burst are one pending entry. The divergence window collapses to the scheduler's own latency — the smallest it can be, which matters because the expensive path (a `content.md` conflict and the reconciler) grows with that window. `pending` gains its honest meaning: *saved locally, not yet confirmed by the transport* — what a user reading the column assumes.

**Rejected:** enqueue-on-blur / on the settle window — couples transport to history cadence and buys minutes of avoidable divergence on exactly the note being actively typed into; a dedicated enqueue-debounce — a second knob doing what the engine's dedup and scheduler already do.

### Decision (2026-09-14) — the Apple ID partitions the whole directory, not just the store *(resolves review-009 F2)*

`switchAccounts` was specified precisely and narrowly: *"quarantine the current account's store on disk (intact, not deleted), close its open windows, load/create the new account's store"*. The Application Support layout then drew five tenants and partitioned exactly one of them. The other four — the index, the per-device blob, the account documents, and the quarantines themselves — were never asked the question.

What the user meets is the promise half-kept. Their notes come back from a second Apple ID intact, as decided. Their **desk** has no answer: the blob is the sole authority for every note's placement on this Mac and its map is keyed by `noteId` of one account's notes, so under the second account it is either overwritten with that account's placements — losing the first account's desk, which is *"the loss of the product's value on that machine"* and the reason the durable tier exists at all — or shared and keyed by notes half of which do not exist locally.

**Retention is the sharper case, because it is destructive.** Retention and `retentionLastChangedAt` are account-global settings that drive a purge, and the preset library beside them merges per key against *that account's* ancestor. A value carried across accounts is the shape *"Never merge accounts (A's notes never touch B's iCloud)"* rules out for notes, arriving through the settings door — and unlike a stray preset, a shorter retention destroys history.

> **The Apple ID is the partition boundary for everything account-scoped in the Fumi directory — the store, the note-placement map, the account documents and the index — and a switch quarantines the whole partition, not the store alone.**

**The index partitions rather than rebuilds.** It is disposable, so nuking it on every switch would be correct; partitioning it is simply better, because its `meta` table carries the `CKSyncEngine` state blob, and discarding that *"costs a full re-fetch from CloudKit"* every time the user switches back. Account switching is a repeated act for anyone who does it at all, so paying a full library re-fetch each way is a cost with nothing bought. A directory is cheaper.

> **The per-device blob splits, because it was never one kind of thing.** Its note-placement map is account-scoped and partitions with the store. Its app-level values — the active swatch pointer, the Light/Dark/System chrome flag, global opacity — are **machine**-scoped, not account-scoped, and stay put across a switch.

**Sibling check: note-window — its decided text places the active swatch machine-local on the reasoning that *"the note is synced but its look and feel doesn't have to be"*, with viewing conditions as the supporting argument (a Studio Display in a bright office and a laptop in the dark are not the same instrument). That is adopted, not re-decided; it is also what settles the split, since neither reason mentions an Apple ID and signing into a work account is not a change of display.**

**The split is the one genuine judgement here; the rest is forced.** Everything keyed by a note belongs to the account that owns those notes — mechanical. Appearance belongs to the machine. Partitioning the blob wholesale would have restyled the user's Mac on signing into a work account, which nothing in the swatch decision asks for and which reads as a bug rather than a policy.

**Consequence for the settings zone, small and benign.** Each account's zone holds that account's device document, so the machine-level values are backed up once per account the user signs into — the same three values written in two places. Harmless: each device document still has exactly one writer, the values are identical, and on a restore whichever account signs in first restores them.

**Cost, named: quarantine takes more with it, and the layout gains a boundary.** A switch now parks a partition rather than a folder, and the Application Support layout is drawn with the account above four of its tenants instead of beside one. Accepted because the alternative is not a simpler design but an undefined one — the four unpartitioned tenants were an omission, and the two ways of resolving it silently are *lose the desk* and *leak a destructive setting across accounts*.

## Asset Storage

*Decided 2026-07-22. Physical realisation of note-model's copy-only assets.*

- **On-disk naming = generated id.** Each asset stored as `<ulid>.<ext>` inside the bundle's `assets/`; the original filename + add-time live in a `meta.json` **assets manifest** (`id → {originalFilename, addedAt}`). In-content refs use `fumi://asset/<id>` (the id, never the filename); an in-body chip for a non-renderable asset renders the stored `originalFilename`. *(Originally read "the **note-level** chip" — note-level attachments no longer exist; see the 2026-07-30 decision below.)* Collision-free, rename-safe (resolves review F4). Each asset → one `CKAsset` under CloudKit. *(Amended 2026-08-04 — this read `<short-id>.<ext>`; note-model pinned the asset id as a **ULID** on 2026-08-03, which is 26 characters and not short. Same field, one description now.)*
- **Large-asset policy = a hard limit.** *(**Superseded 2026-08-09** — this read "exclude-with-warning (v1)", and the whole accept-then-exclude mechanism below it is retired. Original kept for the reason it was chosen, since the reason it lost is not the reason it was picked. See the drained-triage decision at the end of this subtopic.)* The 50 MB per-`CKAsset` ceiling means a big attachment (video) can't sync as a single asset. **An asset over the ceiling is refused at the moment it is added and never enters the bundle** — one rule whatever the sync state. Honest cost: with link/alias dropped for v1, an oversized file cannot go in a fumi at all until chunking ships.
  - ~~*Cross-Mac data condition (final-review F6):* the manifest entry carries an **`excluded` (local-only) flag**, set at attach time and synced with the note — so other Macs render an explicit *"too large to sync — on [origin Mac]"* placeholder (a distinct state, never "loading"), and version-history snapshots referencing it show the same.~~ *(**Struck 2026-08-09** — there is no `excluded` flag and no placeholder: nothing over the ceiling is ever admitted, so no Mac can be missing bytes another holds. The flag's field is gone from the child record and the placeholder's copy — which this topic and note-window had specified differently — is moot on both sides.)* Fully-eager sync (F2) removed the "not-yet-fetched" state; with `excluded` retired, **sync produces no absent-asset case at all**. *(Refined 2026-07-30 — this originally read "the only absent-asset case, no ambiguity", which rules out the `missing` **state** rather than this **cause** of it; superseded again 2026-08-09, when the cause itself disappeared. `missing` remains reachable by agent error or a damaged bundle.)* ~~Storage owns the flag; note-window owns the attach-time warning + the placeholder.~~ *(Struck 2026-08-09 — the warning becomes a refusal, whose surface is note-window's; rerouted there.)*
- *Open (later):* **chunked-asset spanning** to lift the 50 MB limit. ~~**content-hash id / dedup** (identical drops dedupe → helps quota). v1 uses a plain generated id.~~ *(**Dropped 2026-08-04**, not deferred — no available mechanism reaches the quota saving that justified it. See the decision below.)*

### Reopened (drained triage 2026-07-30) — note-level attachments no longer exist; two "fixed inputs from note-model" are stale

*From: note-model · discussion · 2026-07-30.*

**note-model has killed note-level attachments as a concept.** Two places in this topic still carry it, one of them explicitly as an inherited constraint from note-model:

1. **"Fixed inputs from note-model (carried, not re-litigated)"** — *"`assets/` is the source of truth; in-content refs use `fumi://asset/<id>`; **a note-level attachment = an asset not referenced by content**."* The last clause is no longer a fixed input. Strike it.
2. **Asset-storage decision** — *"the **note-level chip** renders the stored `original_filename`."* There is no note-level chip. `original_filename` is still needed (an in-body chip for a non-renderable asset renders it), but the *note-level* framing goes.

**What replaced it — an invariant, not a preference:**

> **Every asset is referenced by content.** There is no second placement kind.

**Why, and note that this topic's own decisions are half the reason.** The two-kind model defined a note-level attachment as *"an asset in the bundle not referenced by any `fumi://asset` token in content"*. That state was killed from both directions:

- **This topic's ref-count GC** — *"keep an asset while any version links it; **GC when the last link drops**"* — makes an asset referenced by nothing **garbage** by definition.
- **note-window dropped it user-facing** — *"Note-level attachments are dropped as a user-facing concept… there is no separate footer/attachment area"* — so the GUI never deliberately creates one.

So the state note-model called a feature is the state this topic collects and note-window won't produce. Both had already agreed; note-model was the last to know.

**Nothing is lost.** The case it appeared to serve — *"I removed it but want it back"* — is answered by note-window's delete rule (*"deleting a chip removes the reference, not necessarily the file. The asset survives while retained versions still link it, then is GC'd at retention"*), i.e. by **version history**, which is this topic's ref-count model working as designed.

**The one thing that needs a decision here — an ordering window the invariant opens.**

If every asset must be referenced by content, and GC collects any asset nothing links, then **an asset whose bytes are copied into `assets/` *before* its token is written to `content.md` is referenced by nothing in the gap between those two writes.** Under **retention Off**, where collection is immediate, that is a collectible asset mid-drop.

Whether this is actually reachable depends on something this topic's text doesn't currently pin down: **is GC retention-boundary-driven, or can it run immediately when the last link drops?** If the former, the window is not reachable and this needs only a note; if the latter, it needs one of:

- the **token lands before (or atomically with) the bytes**, or
- the asset add is a **single atomic operation** over `content.md` + `assets/` + the manifest, or
- **GC exempts assets younger than a threshold**.

note-model has no view on which — the constraint originates from its invariant, the mechanism is this topic's.

### Reopened (drained triage 2026-07-30) — absent assets: `excluded` is the only case *sync* produces, but `missing` still exists

*From: note-model · discussion · 2026-07-30.*

*(**Scope note 2026-08-09** — `excluded` has since been retired by the hard limit, so the three-state table quoted below is note-model's model as it stood, not as it stands. It is left verbatim as the record of what arrived. Current state: **present** and **missing**, the latter reachable only by agent error or a damaged bundle.)*

note-model ruled on what a **dangling `fumi://asset/<id>` reference** means, and the ruling was routed to note-window (visuals) and agent-surface (whether to refuse such a write) but **not here** — an omission, since this topic owns the transport guarantees that decide whether the state is even reachable.

**note-model's model — three states:**

| State | Meaning |
|---|---|
| **present** | bytes are here — renders |
| **excluded** | record exists, bytes deliberately not synced (this topic's >50 MB local-only rule). Exists elsewhere, on the origin Mac. Actionable, not an error. |
| **missing** | no record. Genuinely unavailable. |

The base rule mirrors note links: **a token whose asset is absent renders as a placeholder and is never rewritten or removed**, because the target may return and destroying the reference makes recovery impossible.

**Where the two documents appear to disagree.** This topic states: *"a distinct state, never 'missing/loading'… Fully-eager sync (F2) removed the 'not-yet-fetched' state, so **this is the only absent-asset case → no ambiguity**."*

**Reconciliation — both are right about different halves, and neither said which half.**

> **`excluded` is the only absent-asset case *sync* can produce. `missing` is an error state, not a transport state.**

This topic's claim holds for transport, and it kills one of the three routes note-model listed — *"a restore or sync arriving out of order"* — outright: eager download means bytes and record arrive together, so a synced note cannot present a token whose asset is still in flight. **note-model accepts that and has struck the route.**

But `missing` does not only arise from transport. **An agent can write a `fumi://asset/<id>` token for an id that never existed** — no sync guarantee covers that, because the token never described a real asset. A partially-restored or hand-damaged bundle is the same shape. So the state is reachable, just never *by this topic's doing*.

**What this topic may want to adjust:** the phrasing *"never 'missing/loading'"* reads as ruling the **state** out rather than ruling out that **cause** of it. Renderers still need a missing case; it is simply never one sync created.

**Two things worth confirming here:**

1. **Does eager sync also guarantee ordering against *local* writes?** The entry above flags a window where an asset's bytes land before its content token, leaving it momentarily unreferenced and GC-eligible. Same ordering question, other direction.
2. **Does a version-history snapshot referencing an `excluded` asset behave as this topic already says** (*"version-history snapshots referencing it show the same"*) under note-model's rule that a snapshot records the reference and never rewrites it? note-model believes yes — flagging only because the two were decided independently.

*Consequence already sent to agent-surface: if `missing` is reachable **only** through agent error, refusing an unresolvable token at the surface becomes considerably more attractive than it looked when the state had a transport cause.*

### Decision (2026-07-30) — GC timing, and the absent-asset states

Both drained concerns resolve together, because both turn on *when garbage collection runs*.

#### The invariant is accepted, and this topic had already implied it

note-model's *"every asset is referenced by content; there is no second placement kind"* costs nothing here — the ref-count rule already made an asset that nothing links **garbage by definition**, so the "attachment referenced by nothing" state was collectable before it was killed. Both topics had agreed without noticing. The two stale inheritances are struck: the *"a note-level attachment = an asset not referenced by content"* fixed input, and the *"note-level chip"* wording (an in-body chip for a non-renderable asset still renders `originalFilename`).

#### The ordering window it opens — closed three ways

The gap: the engine copies bytes into `assets/` and writes the manifest entry *before* the `fumi://asset/<id>` token reaches `content.md`. In between, the asset is referenced by nothing — which is exactly the definition of garbage. Reachable only under **retention Off**, where no historical version holds a link, so dropping a reference makes an asset collectable at once.

All three mitigations are taken, and they are not redundant:

- **A. The asset add is atomic** — bytes, manifest entry and content token land as one engine operation, so no observer ever sees the intermediate state. The engine is already the single writer doing atomic writes; this is the database-transaction shape (with no "not at all" branch — it simply all happens at once).
- **B. GC is a sweep, never synchronous with a write** — it runs at the retention purge pass, and on launch/idle. Nothing requires immediate collection; it is an eventual operation.
- **C. Young-asset grace — never collect an asset younger than 24 hours**, regardless of links.

**Why C survives even though B looks like it covers it.** B removes the *causal* link between writing and collecting; it does not remove *coincidence*. An agent working through MCP/CLI adds an asset and writes the referencing content as **two separate calls**, and nothing coordinates those with the sweep — a scheduled sweep can simply land between them. **B makes the collision unlikely; C makes it impossible.** A closes the path we control, C covers the one we don't. 24 hours is far beyond any legitimate multi-step write, and the cost of being wrong is one stray file on disk for a day.

#### Ordering against local writes (note-model's first confirmation)

Answered by A rather than by any sync guarantee: the add is atomic, so there is no window against local writes at all, and C covers the agent sequence A cannot reach.

#### Snapshots referencing an oversized asset (note-model's second confirmation)

Confirmed, and it needs no special case. A snapshot records the reference and never rewrites it; the asset carries the `excluded` flag; so on another Mac that snapshot renders the same *"too large to sync — on [origin Mac]"* placeholder the current content would. One state, one treatment, history included. *(**Moot 2026-08-09** — no snapshot can reference an oversized asset, because no bundle holds one. The rule it rested on is unchanged and still load-bearing elsewhere: a snapshot records the reference and never rewrites it. See the drained-triage decision at the end of this subtopic.)*

#### Cross-Mac GC — deletion is advisory, not authoritative *(resolves review-004 F9)*

The ref-count rule was reasoned in a single-machine frame. GC runs independently on **every** Mac, so three cases needed answers.

**1. The dereference race.** Mac A computes "last link dropped" and deletes the asset record while Mac B is concurrently adding a reference — or resolving a conflict that links it. The freshness rule (sweep only against reconciled state) narrows the window to the seconds between sync completing and the delete committing, but cannot close it.

It doesn't need closing, because the fix is to make the delete **advisory**:

> **A Mac that still holds a live reference to a deleted asset re-uploads it.**

Eager download means every Mac holds the bytes *and* the complete version→asset link set, so a Mac that disagrees with a collection can simply repair it. The race becomes self-correcting: A collects, B still links it, B restores it, both converge with the asset present. Worst case is a brief flap and one small re-upload.

**Deliberately the opposite rule to notes, and the asymmetry is the point.** A hard-deleted *note* gets a tombstone precisely to prevent resurrection — a deleted note returning is the failure. For an asset, **resurrection is the correct outcome**: an asset something still references ought to exist. So **asset records get no tombstone**.

**Rejected: a designated GC owner, and two-phase deletion.** Both buy coordination the self-healing rule makes unnecessary, and an owner is (as with purge ownership) the Mac most likely to be switched off.

**2. Conflict candidates count as versions for ref-counting**, for as long as they exist. Otherwise resolving a conflict collects assets the *surviving* candidate still links, and an unresolved candidate outliving retention takes its assets with it.

~~**3. Collecting an `excluded` asset's record is the origin Mac's call.** The `excluded` flag is synced state but the bytes exist on exactly one Mac; a Mac that never held them must not be able to delete the record and strand them (or leave bytes with no manifest entry).~~ *(**Struck 2026-08-09** — with the hard limit there is no asset whose bytes live on exactly one Mac, so no Mac can be the only one able to collect it. Cases 1 and 2 above are unaffected: every Mac holds every asset, which is what made advisory deletion self-healing in the first place. See the drained-triage decision at the end of this subtopic.)*

*Scope note — there is no dedup, and there is no plan for one.* Every asset carries its own minted ULID, so the same image pasted on two Macs is **two assets with two ids**, syncing independently. Two Macs hold the *same* asset only through sync, never through recognition — the dedup-collision case **cannot arise**. *(Reworded 2026-08-04 — this read "content-hash id / dedup is on the deferred list… cannot arise **yet**", which made a GC rule conditional on a direction since dropped. See the decision below.)*

#### `excluded` vs `missing` — a phrasing fix, not a reversal

This topic's *"never missing/loading"* ruled out the **state** when it meant to rule out a **cause** of it:

> **`excluded` is the only absent-asset case *sync* can produce. `missing` is an error state, not a transport state.**

The transport claim holds and kills one of the three routes note-model originally listed — *"a restore or sync arriving out of order"* — outright, since eager download means bytes and record arrive together (note-model has struck that route). But `missing` stays reachable by non-transport means: an agent writing a token for an id that never existed, or a partially-restored bundle. Renderers still need a missing case; it is simply never one sync created.

*(**Superseded 2026-08-09** — the hard limit retires `excluded` entirely, so the sentence in the quote loses its subject. What replaces it is stronger and simpler: **sync produces no absent-asset case at all**, and `missing` is the only absent state, reachable by agent error or a damaged bundle. The second half — `missing` is an error state, not a transport state — is unchanged and now unqualified. See the drained-triage decision at the end of this subtopic.)*

### Reopened (drained triage 2026-08-04) — content-hash asset id is still on the deferred list, but note-model rejected it as identity

*From: note-model · discussion · 2026-08-03.*

Coherence finding (conflict). note-model settled asset identity on 2026-08-03 (its review-005 F3) as **a ULID, globally unique, opaque, minted when the bytes are copied into `assets/`**, and ruled content-addressing out as an identity mechanism on a correctness argument:

> *"**Rejected: content-addressing (an id derived from a hash of the bytes).** Tempting — it deduplicates identical files for free. But it makes the same bytes in two notes **one asset**, so deleting the chip in note A drops a ref-count that note B depends on, and the ref-counting rule stops being a per-note statement. It also makes the id unstable under any re-encode of visually identical content. Deduplication is a storage optimisation; identity is not the place to buy it."*

This topic predates that ruling and carried **"content-hash id / dedup"** on its deferred-for-later list in three places — the Asset Storage open-items line, the cross-Mac GC scope note (*"the dedup-collision case cannot arise **yet**"*), and Summary → Open Threads. The `yet` is the tell: it read as a direction the design intended to take. A second, smaller discrepancy rode along — the on-disk filename was described as `<short-id>.<ext>` in two places, where note-model pinned a ULID.

The concern's own reading was that the two positions are not wholly incompatible: dedup as a **storage optimisation** (two distinct ULIDs, one stored blob underneath) survives note-model's rejection, and is the half that saves quota. So the proposal was to restate the deferred item as storage-layer-dedup-only rather than drop it.

#### Decision (2026-08-04) — dropped, not restated: no surviving mechanism reaches the quota saving that justified it

The deferred item was written for exactly one benefit — *"identical drops dedupe → helps quota"*. Tested against what is actually available, **neither surviving form delivers it**, and a deferred item that cannot reach its own justification is worse than none: it reads as a plan for quota where there isn't one.

**Sibling check: note-model — its decided text pins the asset id as a globally-unique ULID minted on copy-in and rejects content-addressing as identity; and its self-containment invariant holds that "every asset a fumi renders is owned by that note and stored in its bundle. Nothing it depends on lives outside, under anyone else's control." Both are adopted, not re-decided. What is decided here is only whether this topic keeps a deferred dedup item, which is this topic's own shelf.**

**Content-hash as identity — out, and this topic has the stronger stake.** note-model's ref-counting argument is not merely persuasive from here; the ref-count it names is *this document's* asset GC (*"keep an asset while any version links it; GC when the last link drops"*). Content-addressed ids would make that rule stop being a per-note statement, so the challenge path the concern left open is one this topic has no interest in walking.

**Storage-layer dedup — survives the identity ruling, and dies on a different invariant.** Two ULIDs over one stored blob means the shared blob lives **outside both bundles**, which is precisely the ownership violation self-containment forbids — the same invariant that killed link/alias for v1. A `.fumi` lifted out of the store would carry manifest entries pointing into a table that didn't travel with it, and this document's own Time Machine and restore paths assume a bundle is whole.

**The one form that dodges that saves nothing where it matters.** APFS `clonefile` gives two real, independently-deletable files in two bundles that share disk extents copy-on-write — self-containment intact, no second ref-counting scheme, because the filesystem owns it. But **iCloud still receives two `CKAsset` uploads**, and a receiving Mac writes two separately-downloaded files with no clone relationship between them. So the mechanism is local-disk-only, and local disk was never the constraint: note-model already priced the duplicate at *"a few hundred KB"* and accepted it as the cost of a bundle that always travels intact.

> **Duplication is the design, not a gap in it.** The same image in two notes is two ULIDs, two files, two uploads, both copies on every Mac — and two independent ref-counts, so deleting one note never reaches the other's asset. That cost is what copy-only bought.

**What handles the scenario, then — the levers already decided, none of which needed the dedup item to exist:** **retention** as the space lever (assets pinned by in-window versions are the far larger consumer than duplicates); ~~**`excluded`** for anything over the 50 MB ceiling~~ *(struck 2026-08-09 — the ceiling is a hard limit and admits nothing to exclude; the two remaining levers carry it alone, and the store-size indicator carries more of the weight than it did, since everything admitted is now also uploaded)*; and the **store-size indicator**, which is what makes the cost visible rather than silent — the same reasoning that made Forever the safe retention default. *(Named the "quota indicator" until 2026-08-09; it reports the store's own bytes, not iCloud's — review-008 F5.)*

**A second, independent reason, from the user: the duplicate population is thin.** *"I can't imagine many occasions where the same asset would appear in multiple notes."* Worth recording because it is not what the decision turns on — the mechanisms fail on their own terms whether the case is common or rare — but it is what makes the accepted cost comfortable rather than merely reasoned. The only routes to a duplicate are deliberate: the same file dropped into two notes, a passage carrying an asset token copied between notes, or a note duplicated. Version history is not one of them — snapshots **ref-count the same asset**, they never copy it.

**Chunked-asset spanning stays deferred**, unaffected: it is real, reachable, and lifts a ceiling rather than promising a saving.

**Consequence for the GC rule, small but worth having:** the cross-Mac scope note's *"cannot arise **yet**"* becomes **cannot arise**. Two Macs hold the same asset only through sync, never through recognition, and now permanently so — one fewer conditional in a rule whose job is deciding whether bytes get deleted.

**Cost, named:** a user who pastes one large image across many notes pays for it many times, on every Mac and against quota, with no dedup coming. Recorded as accepted rather than pending. **Rejected: keep the line, reworded to storage-layer dedup only** — it would preserve the appearance of a quota plan while naming a mechanism that either breaks self-containment or doesn't touch iCloud. *(If the same-asset-in-many-notes case ever proves common in practice, APFS cloning is a build-level optimisation to reach for — not a design deferral, and it still does not restore the quota framing.)*

### Reopened (drained triage 2026-08-09) — make the sync size ceiling a hard limit and retire `excluded`

*From: note-model · discussion · 2026-08-08.*

note-model asks this topic to replace **accept-then-exclude** with a **hard limit**: refuse an oversized asset at the moment it is added, so `excluded` never comes into existence.

**What forced it.** note-window raised a case against note-model's materialisation rule — *"on any write to `content.md`, a token naming an asset the destination bundle does not hold is materialised: the bytes are copied in, a new id is minted, that token rewritten; an id that cannot be resolved is left exactly as written and renders `missing`"*. That rule has two branches, and `excluded` opens a third neither covers:

```
Mac 1                                  Mac 2 (no bytes)
  note A ── asset 01J9 (58 MB)           note A ── record 01J9, excluded ✓
            bytes here                             bytes not here
                                         ⌘C the passage → ⌘V into note C
                                         materialise: nothing here to copy
                                         note C: no asset, no record
```

The id **resolves to a record** — this topic's per-asset child record syncs even when its `CKAsset` does not — while the bytes are unavailable locally. So materialisation cannot complete. note-window's requirement was that the destination read `excluded`, never `missing`, since note-model's own table calls `missing` *"an error state, not a transport state"* and note-window's two-state visual treatment was designed on that frequency.

**note-model's answer was to remove the case rather than answer it.** With a hard ceiling there are no records without bytes, so the rule's two existing branches are complete as written. The only remaining route to *"id resolves, bytes absent"* is a damaged or partially-restored bundle — already `missing`, already an error state, already served by leaving the token untouched so a restore can return it.

**Two mechanisms were tried first and are recorded as rejected**, so they are not re-proposed:

- *Deferral* — don't mint until the bytes can be copied; the token keeps pointing at the source id, which names a record with `excluded` set, and materialisation completes on a Mac that holds the bytes. Rejected because materialisation fires **on write**: until something writes to note C, note C sits there rendering an asset out of note A's bundle — a live cross-bundle reference, breaking *"every asset a fumi renders is owned by that note and stored in its bundle"* in the plainest form. It also leans on this topic's per-note ref-counting looking the other way, since note C's link is invisible to note A's count.
- *Background repair* — hang completion off the launch reconciliation walk rather than a write, so any Mac holding the bytes heals the token without the note being opened. Strictly better, and rejected on **payoff rather than risk**: the repaired copy is itself over the ceiling, so on the Mac where the paste happened nothing visible changes before or after. What it buys is the note rendering on the *other* Mac; what it costs is a duplicate of the file on that Mac's disk, an index of cross-bundle tokens, and a content mutation with no user write behind it — which must either snapshot (a phantom version credited by the engine-originated attribution rule to whoever last wrote a note nobody touched) or not snapshot (a content change entering no history, in a model built on that being impossible).

**Two stale inputs corrected on the way in**, both against this document. note-window cited a transient form of the case — record arrived, `CKAsset` still downloading — which **does not exist**: fully-eager sync removed it, and note-model already struck *"a restore or sync arriving out of order"* on that basis. And the garbage-collection objection to deferral is weaker than it looks, because retention defaults to **Forever**, so old versions keep linking the asset and the last link rarely drops at all. Neither changed the outcome.

#### Decision (2026-08-09) — adopted: nothing over the ceiling enters a bundle, and `excluded` is retired

**Sibling check: note-model — its decided text holds that the case is removed at source rather than answered (*"The ceiling becomes a hard limit, applied at every entry route — drop, paste, remote fetch — and refused at the moment of the attempt instead of accepted-and-then-excluded"*), that the rule holds whatever the sync state, and that an oversized remote fetch degrades to a plain link exactly as a failed fetch does. All adopted, not re-decided — note-model wrote them contingent on this topic ruling, and this is the ruling. Its self-containment invariant reverts to the stronger availability-and-ownership form it carried before `excluded` forced the restatement.**

**Sibling check: note-window — its decided text holds a two-state absent-asset treatment (`excluded` / `missing`), the metadata line *"Not synced — over the size limit"*, the mirror label *"60 MB · Local only"* on the Mac holding the bytes, and *"Nothing is said at drop time"*. Retiring `excluded` removes the state the first three describe and makes the fourth untenable — a refusal must say something. Rerouted to note-window rather than decided here; the refusal's surface is theirs.**

> **The per-asset size ceiling is a hard limit. An asset over it never enters a bundle — the attempt is refused at every entry route (drop, paste, remote fetch), at the moment it is made. There is no `excluded` state.**

**Enforcement sits at the entry route, not at upload.** The refusal happens before any bytes are copied into `assets/`, before a manifest entry exists and before a child record is minted — which needs no new machinery, because **the asset add is already atomic**. Bytes, manifest entry and content token land as one engine operation; the hard limit is simply that operation declining to start. Nothing partial is ever created, so there is no half-added asset to clean up and no window for the GC sweep to find one.

**One rule, whatever the sync state.** A store with sync off is not exempt, tempting as it is — that user has none of the constraint that motivates the ceiling, and is exactly the user the cost below falls on. Exempting them means enabling sync later either refuses assets already in the store or reintroduces `excluded` by the side door to carry them. The limit holds unconditionally so the store is **sync-ready at every moment**.

**The cost, named rather than discovered later: a single-Mac user loses a capability.** Today an oversized file dropped into a note becomes a working local-only asset; under the hard limit it is refused, and with link/alias dropped for v1 there is no other route — the file cannot go in a fumi at all. That is a real capability removed to serve a constraint that user does not have. Accepted on two grounds. First, accept-then-exclude was never a clean capability either: the file appears to work and then silently isn't there on the other Mac, which is a promise half-kept, and a refusal at the moment of the drop is at least honest — the user still has the file where they got it. Second, this is explicitly a **v1 constraint, not a design position**; the intended fix is to remove the limit, not to live with it.

**The reversal is purely additive, which is what makes accepting the cost cheap.** Lifting the ceiling later — **chunked-asset spanning**, which stays this topic's deferred route, or whatever else lands — invalidates no note already written: every bundle stays valid and the limit simply relaxes. Nothing is owed on the way back out, and pre-launch there is no data, so the change costs nothing now and a migration later. Same shape as deferring the `fumi://` scheme registration.

**What this strikes.** Each site is amended in place rather than left to be read as current:

- the **`excluded` flag** on the per-asset child record — the record's field set is now `CKAsset` + `originalFilename` + `addedAt`;
- both **placeholder strings** (*"too large to sync — on \[origin Mac\]"*, at the large-asset policy and in the snapshot paragraph) — no placeholder is owed, because no such asset exists to place;
- the **attach-time warning**, which becomes a refusal;
- ***"an `excluded` asset's record is the origin Mac's to collect"*** — a GC ownership rule with nothing left to own;
- the parenthetical that ***"a version's ref is only as available as the note's current large asset"***;
- ***">50 MB assets are excluded from CloudKit entirely — the one thing history can't restore off-Mac"***, which stops being true: everything a bundle holds now syncs, so history restores everywhere;
- **`excluded` as a space lever** in the dedup decision — retention and the store-size indicator carry that alone now.

**The absent-asset story becomes single-cause.** `missing` is the only absent state, and it is reachable only by **agent error** (a token written for an id that never existed) or a **damaged bundle**. Sync produces no absent assets at all — a stronger claim than the phrasing fix this document made in July, and it replaces it. The consequence already sent to agent-surface sharpens accordingly: refusing an unresolvable token at that surface is now the only thing standing between an agent and the one remaining absent state.

##### What that claim needs from the upload side *(2026-08-09, resolves review-008 F6)*

As stated it covered **download** only, where eager sync applies — *"bytes and record arrive together"*. Uploads had no equivalent rule, and this document models failures there, so three routes led straight back to a record-without-bytes:

```
Mac 1   drop image → assets/, token in content.md, child record minted
        content record uploads    ✓
        asset child record        ✗   serverRejectedRequest (permanent)

Mac 2   fetches the note. Token resolves to nothing.
        → renders `missing` — produced by sync
```

- **A split batch.** The content record and its asset children are separate records, with no atomicity or ordering stated anywhere — so a Mac could fetch content carrying a token whose child record had not landed.
- **A permanent rejection.** `serverRejectedRequest` is a state already named here, with a per-note `rejected` value already recorded for it. An asset permanently rejected while its note's content syncs produces exactly the shape `excluded` was invented to describe, arriving through the transport instead of the entry route.
- **`quotaExceeded`.** The same question softened: whether the pause is whole-zone or per-operation decides whether content can land alone.

> **A note's content and the asset records it references publish as one unit. Content is never published without the assets it references.**

**The local counterpart already exists, and this is its missing half.** The atomic add makes bytes, manifest entry and content token *"land as one engine operation, so no observer ever sees the intermediate state"*. Atomic publish is the same sentence pointed at the wire, and it closes all three routes with nothing invented: a split batch is not a valid batch; a permanently rejected asset means the note's new content does not publish either, leaving the note `pending` and then `rejected` — states already recorded and already routed to management-window to render; and a quota pause stops the unit rather than half of it.

**Cost, named: one bad asset stalls that note's content sync entirely**, and the note diverges across Macs until it clears. Taken over the alternative — publishing a note that renders broken on every other Mac while telling nobody — on the trade this document has now made repeatedly: *rare silent loss is worse than rare visible annoyance*. The stall is visible by construction, because the per-note sync state is what shows it.

**Whether `CKSyncEngine` can be driven to batch that way is an implementation check**, alongside the `CKAsset` ceiling and the 750-reference limit. If it cannot, the claim weakens rather than the design breaking — and it is better to learn that against a stated rule than to discover the gap from a user's broken note.

**Rejected: keep the ceiling soft and take note-model's fallback.** They recorded one that stands on its own — when materialisation cannot obtain the bytes, the paste writes **plain Markdown text and no `fumi://` token at all**, built from `originalFilename` and the reason, both of which our record already carries. It is the failed-fetch rule applied without an exception, and it costs only that the reference is lost in the destination and that the same paste behaves differently on different Macs. It loses not because it fails but because it preserves the thing generating the work: `excluded` has been expensive out of proportion to what it buys — a restatement of the self-containment invariant, a third absent-asset state two other topics had to model, a GC ownership rule, a placeholder two topics specified differently, and this concern — all to serve a temporary engineering shortfall. The fallback is recorded as unreachable rather than as a live alternative.

**Rejected: exempt stores with sync off.** Covered above — it is the side door back to `excluded`.

#### Absorbed by the same decision: the placeholder copy this topic and note-window specified differently *(2026-08-09)*

*From: note-window · discussion · 2026-08-07.*

A coherence finding arrived independently of the hard-limit ask and is resolved by it, so it is recorded here rather than amended on its own terms. It reported that the `excluded` UX was decided twice, in a surface this topic had delegated:

- **The placeholder copy.** This topic named the string in two places (the large-asset policy and the snapshot paragraph), both as *"too large to sync — on \[origin Mac\]"*. note-window decided on 2026-08-06 that the asset child record carries **no device provenance** and that adding a field for it was not worth it, settling instead on copy naming the reason — *"Not synced — over the size limit"* — which reads off the `excluded` flag. So one label had two specifications, and this topic's named a machine no field could identify.
- **The attach-time warning.** Sharper, being a behaviour rather than a string: this topic assigned note-window *"the attach-time warning"*, and note-window had considered exactly that surface and rejected it — *"Nothing is said at drop time"* — putting the fact permanently on the chip's metadata line on the source Mac instead (*"this Mac: chart-final.mov · 60 MB · Local only"*), on the reasoning that *"a label that is always right beats a lesson that has to be remembered, and costs less"*.

**Both halves are struck by the hard limit rather than reconciled.** There is no `excluded` asset, so there is no placeholder to specify at either end and nothing for a specification to extract two strings for; and the delegated warning is gone, replaced by a refusal whose surface is rerouted to note-window as its own ask. The finding's stated risk — a specification building two labels and a warning the owning topic decided against — is unreachable.

**One thing in it survives and is not a correction.** note-window's *"No which-Mac field is chased"* still holds, and is now permanently moot rather than a judgement that might be revisited: no asset's bytes live on one Mac, so there is no machine for a placeholder to name. Recorded so the question is not reopened later as an unfinished thread.

**The fork this topic did own, before the hard limit removed it: add a device key to the asset child record so the placeholder could name the Mac.** note-window judged the field not worth adding, but the field would have been this topic's, so the judgement was open to challenge here. It was tested and declined on three grounds, recorded because the same instinct will recur wherever a surface wants to name a machine:

- **The name is not cheaply producible.** The key would be the hardware platform UUID, and resolving it to something human means reading the per-device documents — which live in the **settings zone**, while the asset child record lives in the note zone. Drawing a placeholder would mean a cross-zone read.
- **The value goes wrong in exactly the cases it is needed.** The platform UUID does not survive replacement hardware (*"restore onto replacement hardware starts on defaults"*), and stale-device removal is `lastSeenAt` plus a manual action — so an asset added on a Mac since traded in or removed names a device with no document. Both fall back to a reason string, meaning the reason string ships regardless and the field is additive rather than alternative.
- **Elimination already does the work at this scale.** A two-Mac user reading *"the bytes are not here"* knows where they are. The name earns its keep at three-plus machines, which is not the population this is sized for.

**What would have changed it: an actionable placeholder.** If there were something the user could *do* on the named Mac, the name would be worth the machinery. There is not — the file is over the ceiling wherever they stand.

*(Now permanently moot rather than declined: with no asset's bytes on a single Mac, there is no machine for a placeholder to name. Recorded so the question is not reopened as an unfinished thread.)*

*(Considered and not taken: amend the two strings to note-window's copy first, then strike them. The finding was raised against a mechanism that no longer exists two days later — dating an amendment to text about to be removed would put a correction in the record for a state the document never shipped.)*

#### What bounds a bundle in aggregate — nothing, deliberately *(2026-08-09)*

*From: note-model · discussion · 2026-08-09.*

A second concern rode alongside the hard-limit ask, and it is the one live design question of the pair. **The ceiling is framed per asset everywhere it appears** — the child record's flag, the *"oversized asset"* wording, the product statement *a fumi holds files up to X*. Nothing bounds what a bundle holds **in total**.

**Why the soft ceiling hid it.** Under accept-then-exclude, aggregate transport size was self-limiting by construction: the big things were exactly the things that stayed local and never entered CloudKit. The per-asset rule was doing double duty — capping the largest single upload *and* capping how much of a heavy note ever left the Mac. Retiring `excluded` removes the second job and nothing replaced it. Everything admitted is now also everything uploaded, and duplication is deliberate here (*"the same image in two notes is two ULIDs, two files, two uploads, both copies on every Mac"*), so identical bytes count twice:

```
ceiling = 50 MB per asset (hard)

note N:  asset 1  49 MB   ✓ admitted, uploaded, on every Mac
         asset 2  49 MB   ✓
         …
         asset 40 49 MB   ✓   → ~2 GB in one note, every rule satisfied
```

**A near-miss worth recording: the 750-reference limit is not an aggregate bound.** The same Apple data-size-limits table that fixes the per-asset ceiling also gives **maximum number of source references to a single target (where the action is delete self) = 750**, and the hard-delete cascade gives every child record such a reference — which looked, while this was being argued, like a structural cap of 750 children per note, roughly 36 GB of assets. *(**Corrected 2026-08-09**, review-008 F2 — the child-record-ceiling decision taken later the same sitting settles that a child beyond the budget is **created without a reference** rather than refused. So 750 bounds how many children the free cascade covers, never how many a note has, and there is no structural cap on child count or on aggregate bytes.)* **The answer to what bounds a bundle in aggregate is: nothing** — which is what this decision says anyway. None of the three reasons below rested on the 750, and the paragraph discounted it even when it was believed (*"not… anything a design would call a bound"*). *(The same constant is a live question for version snapshots and conflict candidates — settled as its own subtopic under Soft-Delete Mechanism, where the cascade lives.)*

> **The per-asset ceiling is the only byte bound on a bundle. There is no per-bundle limit, and the store-size indicator is the backstop.**

**Three reasons, in the order they carry weight.**

- **A per-bundle cap produces a refusal the user cannot see the cause of.** *"That file is too big"* names something actionable — pick a smaller file. *"This note is full"* names a state with no visible cause and no obvious remedy: the user cannot see the bundle, does not know what is in it, and has no notion of a note having a capacity. The hard limit was accepted partly *because* a refusal at the drop is honest; a per-bundle refusal is the opposite, and would undo that on the same surface.
- **The exposure is the user's own storage, and it is surfaced.** The **store-size indicator** exists to make consumption visible rather than silent — the same reasoning that made Forever the safe retention default. A user filling their own storage with their own files is a cost they can see and act on, not a failure the store should pre-empt.
- **The population is thin.** Notes carrying dozens of near-limit assets are the same rare shape that made the duplicate-asset cost comfortable, and the routes to one are all deliberate.

**Rejected: a per-bundle ceiling alongside the per-asset one.** It buys a bound nobody is hitting at the price of the least explicable refusal in the product.

**Rejected: leave it unstated.** That is the status quo the concern is against, and it is the actual failure mode — a bound inherited from a valve that no longer exists reads as a decision when it is an accident. The point of the entry was that the answer should be *chosen* when the number is chosen.

**Named dependency: this leans on the quota indicator harder than anything else does.** It is the entire backstop. If it turns out to be a management-window nice-to-have rather than something the engine reliably feeds, this decision is the one that needs revisiting — not the ceiling.

##### The backstop, defined — it is a store-size indicator, and it never was an iCloud-quota one *(2026-08-09, resolves review-008 F5)*

###### 2026-09-14 — revised
*Trigger: review finding — the three buckets are cut by artifact kind, and on this document's own reasoning the bytes retention frees are asset bytes, so the breakdown cannot answer the one question the indicator exists for (review-009 F4).*

The figure and its purpose stand; **the cut is wrong.** As specified — *"current content, retained history, assets"* — a user asking *if I move retention from Forever to 90 days, how much comes back?* reads a negligible history bucket and concludes there is nothing in it, while the recoverable bytes sit in an assets bucket that mixes two unrelated populations: images the note's current text still shows, which retention never touches, and images only a retained snapshot is still holding, which is exactly what it frees.

That is this document's own July finding pointed back at it — *"snapshots are markdown, so text is negligible… **Assets are the entire bill**, and they are ref-counted by version-links — so retention is asset garbage collection wearing a history-policy label."* A kind-based cut buries the lever in the bucket that is not named after it.

> **The breakdown is cut by lever, not by artifact kind. An asset counts in the bucket of whatever pins it — still referenced by the note's current content, it is Current; held only by retained history, it is History — and an asset pinned by both counts once, as Current.**

**Sibling check: management-window — its discussion has not started and holds no decided text on the indicator; the split settled here is untouched, the engine records the bytes and management-window renders them. No overlap found.**

**Pinned-by-both counts as Current, and the direction is the whole point.** Retention would not free that asset, so counting it under History inflates what the lever appears to buy. That error is the dangerous one: the user acts on it, shrinks retention, destroys history, gets back nothing like the figure they read — and the 30-day grace is then all that stands between them and having thrown it away for no return. Counting once also keeps the buckets summing to the total, which a figure meant to be read at a glance has to do.

**This is the cut the indicator's own justification asked for and did not get.** It exists because *"a total alone would show the problem without pointing at the lever"*, and is *"attached to the controls the user actually has (retention, deleting notes, not dropping the same image into ten fumis)"*. A bucket therefore names **what action frees it**, never what kind of bytes it holds. Same principle downward: a note in Recently Deleted counts whole — content, history and assets together — under the bin, because emptying it is the single action that frees all of it.

**Honesty caveat, written in rather than left to be discovered.** Shrinking retention does not free those bytes immediately: the eligibility clock's 30-day grace delays the purge, by design, so a user can change their mind. The History figure therefore reports **what retained history is holding**, not what today's action returns today. Stating it is cheaper than a user watching the number not move for a month and concluding the purge is broken.

**Rejected: keep the kind-based cut.** *Assets* is the more intuitive label to read, and it loses to the fact that reading it answers nothing — the user's question is never *how many bytes are images*, it is *what can I get back and how*.

###### 2026-08-09

The dependency above was named and left standing, and pulling on it found that the thing depended upon had no definition and could not have had one. **The only quota state this document ever decided is an exhaustion signal**: `quotaExceeded` → *"a persistent non-nagging indicator says backup is paused"*, which fires when it is already too late to be a lever. The sync-visibility decision then enumerated exactly what the engine records — overall state (syncing / paused / stopped) and a per-note state (synced / pending / rejected) — with **no usage figure anywhere**. Three decisions nonetheless rest on consumption being visible *before* exhaustion: Forever retention (*"a screenshot-heavy user meets a signal and can reach for the lever"*), accepted duplication, and the aggregate bound above. That is precisely the failure the sync-visibility decision warned against — *"designing the panel later and finding the state was never recorded, so there is nothing to render"*.

**It could not have been an iCloud figure.** CloudKit surfaces `quotaExceeded` when the line is crossed and exposes no API for container or account usage — so *"how full is your iCloud"* was never available to the engine, which is why nothing could say what fed the indicator. *(Held with the same confidence as the other platform constants here, and verified at implementation alongside them.)*

> **The engine records the size of the store on disk — total bytes, broken down by the levers that move it: current content, retained history, assets. `quotaExceeded` stays a separate, reactive signal.**

**What changes is what the number means, and it is the more useful number.** Not *how full is your iCloud* but *how much space Fumi is taking* — the figure attached to the controls the user actually has (retention, deleting notes, not dropping the same image into ten fumis). The three decisions that lean on it are served better by it than by the quota reading they thought they were getting.

**It also works with sync off, which the iCloud framing never could.** A store-size figure is a local measurement, so it is identical on a machine that never signs in — and finite local disk is exactly that user's bound, the same constraint this document already recognises when it says retention and GC *"work fully for sync-off users, whose finite disk is the point"*. The backstop was otherwise absent for precisely the users the hard limit's accepted cost falls on hardest.

**Cost, named: the name.** *"Quota indicator"* appears at several sites and is what made it read as reporting iCloud; it is a **store-size indicator**, and the sites are corrected. The split is unchanged — **the engine records the bytes; management-window renders them** — and the breakdown is specified here because a total alone would show the problem without pointing at the lever.

#### The number — 50 MB stands, and it is Apple's, not ours *(2026-08-09)*

note-model declined to set the figure and asked this topic to revisit it, on the grounds that a soft ceiling and a hard refusal are different kinds of number: the first is a judgement about what is practical to upload, the second is a product statement — *a fumi holds files up to X* — and might want a rounder one.

**The question dissolved on checking the provenance rather than by choosing.** This document asserts a *"50 MB per-`CKAsset` ceiling"* in four places, and nothing here established it — deep-dive-001 researched CloudKit's limits and pinned the **1 MB per-record** limit, noting explicitly that assets are *excluded* from it. So the figure looked like it might be inherited rather than sourced, which matters much more for a refusal than for a valve.

It is sourced. Apple's CloudKit Web Services Reference data-size-limits table gives **maximum record size (not including Asset fields) = 1 MB** and **maximum file size of an Asset field = 50 MB**. The number is the platform's, so there is nothing for this topic to pick: X cannot exceed it, and choosing below it would refuse files iCloud would accept.

**Two caveats, recorded because the figure is now load-bearing in a way it wasn't.** That table lives in Apple's **archived** library. And a **250 MB** figure circulates in third-party write-ups, phrased as an Apple *recommendation* for what to put in an asset rather than a stated cap — no Apple page behind it that this session could find, and "recommends no more than" is guidance, not a limit. The two don't reconcile, and the higher one is the unattributed one.

**Verified at implementation rather than pre-build.** The empirical test is trivial and definitive — attempt an oversized upload and see what the server says — and it beats another documentation reading, so it does not need the pre-build spike. **If the real limit is higher, the ceiling lifts to it.** That costs nothing to defer: raising the limit is purely additive, every bundle already written stays valid, and no migration is owed. The one thing not deferred is the *shape* — hard refusal at the entry route — which is what the rest of this decision fixes; only the number is provisional.

*(Nothing in the accepted trade above depends on the figure. A single-Mac user loses the same capability at 50 MB as at 250 MB; the difference is only how often.)*

## Soft-Delete Mechanism

### Context

*Rerouted from note-model (drain-triage 2026-07-22). Genuinely open.*

Soft-delete state is intrinsic → must travel/back-up (a soft-deleted note is *archived*: deleted to keep it and restore it). Two candidate mechanisms:

- **Move the bundle into a trash subfolder** — the filesystem *is* the archived state; travels; restore by moving back. Very `.Trash`-like.
- **A stored flag** inside the bundle's `meta.json`.

To decide here. (Product side, from discovery: delete → "Recently Deleted" bin with restore / hard-delete, no auto-purge — that's the UX; this subtopic is the *storage* representation. Discovery's **dismissible confirm prompt was later dropped** by note-window — see the 2026-07-31 decision below.)

### Decision (2026-07-22)

**Soft-delete = a flag** (`deleted` + `deleted-at`) on the record/`meta.json`, **not** a trash-subfolder move. Under CloudKit there's no shared folder to move into; the flag propagates Recently-Deleted across Macs as an ordinary field change (preserving restore); the opaque package meant a trash *folder* bought no browsability anyway; and it's simpler. The bundle stays in place with `deleted = true`; the read-model filters deleted notes out of normal `list` into a **Recently-Deleted** view. Soft-deleted notes **still sync** (bin consistent across Macs).

**Hard-delete = record delete + tombstone** (persistent deleted-id set) so a delete isn't resurrected by another Mac's re-upload or a restore (resolves review F6). **No auto-purge** — notes sit in Recently Deleted until the user clears them (discovery's call).

**Tombstone home + TTL (final-review F3):** the tombstone lives as a **CloudKit deletion record** (tiny UID + timestamp) — durable, cross-Mac, and it **survives a local index rebuild** (rebuild re-fetches sync-state from CloudKit, not only bundles — see the refined invariant in Sync Safety). A Time-Machine-restored bundle whose record was hard-deleted is caught by the tombstone and *not* re-uploaded. **TTL = ~1 year** (tiny records; generous enough to outlast any realistic offline/restore lag, then retire → bounded growth). It's a **driver-owned durability primitive** — CloudKit = a deletion record; a future folder driver would use a tombstone *file*; the core just says "hard-delete UID X durably." Silent-discard risk is narrow: hard-delete is always preceded by soft-delete (already synced `deleted=true`), and a suppressed re-add carrying genuinely newer content is **surfaced, not dropped**.

### Decision (2026-07-31) — hard-delete cascade, and the tombstone TTL retested *(resolves review-004 F10)*

**Cascade — specified, was only implied.** The data mapping gives a note child records for every asset, every version snapshot and every conflict candidate; hard-delete was written as a single record delete, and CloudKit does not cascade by default.

- **Child records are created with a delete-self reference to the note**, so CloudKit removes them — and the version snapshots' markdown `CKAsset`s with them — when the note record goes. No manual enumeration, nothing to forget.
- **Locally the bundle goes wholesale** — `content.md`, `assets/`, `versions/`, the directory itself.
- **Partial failure therefore reduces to orphans** (children whose parent no longer exists), which the existing sweep collects. No bespoke reconciliation.

**Ordering consequence, from the advisory-asset rule:** **note deletions reconcile before asset repair runs.** A Mac that has not yet seen the hard-delete still holds live references, and under advisory deletion would dutifully *re-upload* the assets it is about to remove. Reconciling the note first makes the references vanish with the bundle, so nothing is resurrected. (Asset resurrection is correct only while something genuinely still links it.)

*(**Generalised 2026-08-01** — the rule was written for hard-delete only, but a retention purge has the same shape: it deletes version records everywhere, any Mac may run it, and an unreconciled Mac's local version records still reference the assets the purge just unlinked — its repair sweep would re-upload what the account deliberately purged. The rule is a property of **any propagating deletion that unlinks assets**, stated once: **propagating deletions — hard-deletes and retention purges alike — reconcile before asset repair runs; a Mac that has not reconciled does not repair, exactly as it does not purge.** Repair becomes symmetric with the "never purge from stale state" gate — both destructive-adjacent sweeps run only against reconciled state — and the advisory re-upload stays as the self-heal for genuine races, never the mechanism that undoes deliberate deletion. Cost: a long-offline Mac delays its repair sweep until it reconciles — repair is a health pass, and running it on stale state is the bug. review-005 F9.)*

**Tombstone TTL (~1 year) vs a Forever retention default — retested, unchanged.** The two numbers were chosen against different questions and do not need to agree: the tombstone stops a *note* being resurrected by a stale re-upload; retention governs how long *history* lives — and after a hard-delete there is no history left to retain, since the snapshots cascaded with the note.

The case worth testing was the reverse: a Time-Machine-restored Mac reappearing **after** the tombstone expires, carrying a note it still holds. It holds up in both directions:

- Restoring a backup old enough to contain a hard-deleted note means restoring from ancient history — a **deliberate act**, and at that horizon resurrection is the *intended* outcome, not a failure.
- A normal reinstall-and-restore takes the **most recent** backup, which matches the state at the time of the wipe — so the deleted note isn't in it.
- Inside the TTL nothing is silently lost anyway: the existing rule surfaces a suppressed re-add carrying genuinely newer content rather than dropping it.

Low-stakes in both directions, which is why ~1 year is adequate without being precise.

#### The cascade has a documented ceiling — kept anyway, because the overflow already has a home *(2026-08-09)*

Surfaced while settling the aggregate-bundle question in asset-storage. Apple's data-size-limits table — the same one that fixes the 50 MB per-asset ceiling — gives **maximum number of source references to a single target, where the action is delete self: 750**. Every child of a note is created with exactly that kind of reference, so **assets, version snapshots and conflict candidates draw on one budget of 750 per note**.

Assets cannot realistically reach it. **History can, and the default is what makes it reachable**: retention defaults to Forever, and a note worked in on ~200 days a year accumulates roughly that many snapshots — the budget is gone inside four years, with assets drawing on the same pool. Blur-settle collapses a working session into one snapshot rather than one per edit, so that is the pessimistic read rather than the expected one, and a non-Forever retention keeps the count flat; neither makes the ceiling go away for the note that gets used every day for years.

> **Delete-self stays. A child beyond the budget keeps its reference to the note and drops only the *action*, so it is identified exactly as its siblings are — it simply isn't auto-deleted, and becomes an ordinary orphan when the note goes.**

*(Sharpened 2026-08-09, review-008 F4 — this first read *"created without one"*, which was wrong in a way worth keeping visible. **A reference carries an association and an action, and only the action is capped**: Apple's limit is on references *"where action is delete self"*. Dropping the whole reference would have cost the only note↔child association this document names — the asset child record's fields are stated exhaustively as `CKAsset` + `originalFilename` + `addedAt`, with no parent uid — and that bites long before deletion, since the assets manifest is *"reconstructed from asset records per-Mac"* and eager download rebuilds `versions/` from version child records. An unattributable child is not merely un-cascaded; it is unusable on every other Mac. Keeping the reference costs one enum value.)*

**The overflow path is the July cascade's, and it works because the child still names its parent.** That decision says partial failure *"reduces to orphans (children whose parent no longer exists), which the existing sweep collects. No bespoke reconciliation."* A child beyond the budget is that case exactly — the sweep does not care *why* a child outlived its parent, only that it can tell. So the degradation is: the free cascade covers the first 750, the sweep covers anything past it, and the only cost is that the surplus is collected on a sweep rather than by the server, at a horizon almost no note reaches.

**The orphan sweep, specified** *(review-008 F4)*. It was cited at both sites that rely on it and defined at neither — no trigger, no freshness gate — while deleting records, which is the shape every other destructive-adjacent sweep here is gated for. Today's decision makes it a routine path rather than a partial-failure residue, so it takes the same terms as asset GC, with no new machinery:

> **The orphan sweep runs at the retention purge pass and on launch/idle, never synchronously with a write, and never from stale state — a Mac that has not reconciled does not sweep, exactly as it does not purge or repair.** A child whose referenced note no longer exists is collected; a child whose note this Mac simply hasn't fetched yet is not, which is what the gate is for.

The gate's two clauses land here as they do everywhere else: a store that never had a sync relationship is always reconciled and sweeps immediately; one with a current or former relationship waits for a completed fetch, so *"the note is gone"* means gone rather than not-yet-seen. Without that, an unreconciled Mac would read every note it hasn't downloaded as a deleted parent.

**Rejected: replace delete-self with an engine-written cascade.** The obvious move once the ceiling is known, and wrong — it pays for the rare case up front, on every note, by hand-writing enumeration and deletion that CloudKit does for free and cannot forget. 750 is a lot; designing around a limit we may never hit costs more than the limit does. *(The user's argument, and it is the same instinct as the young-asset grace: cover the case you cannot control cheaply, rather than rebuilding the path you can.)*

**Verified empirically at implementation, alongside the `CKAsset` ceiling.** Same provenance caveat — the source table is archived — and two things this session could not establish either way: whether the figure is current, and how the server behaves at the wall (refuses the reference, or refuses the save). The answer changes only *when* the overflow path starts running, never what it is.

**UX rerouted** (storage owns the flag, not the surfaces):
- Recently-Deleted **bin** (list, restore, delete-permanently, clear) → **management-window** (landed in its Triage).
- Per-note **delete action + deleted-state visuals + double-click-a-deleted-bundle** → **note-window** (landed in its Triage). *(Originally read "delete action + dismissible confirm prompt + …" — the confirm was dropped; see below.)*

### Reopened (drained triage 2026-07-30) — the delete confirm prompt has been dropped; update references

*From: note-window · discussion · 2026-07-27.*

Several decisions here reference the delete UX as including a **"dismissible confirm prompt"** (this subtopic, and the reroute notes to note-window). **note-window has revised that decision: ordinary delete now happens immediately, with no prompt.**

**Why.** Discovery framed delete as "the one destructive act" and gave it a confirm. But *this topic* then settled soft-delete as a **reversible flag** — the note keeps syncing, is filtered into Recently Deleted, and **never auto-purges**. That removed the destructiveness the confirm existed for. Confirming a fully reversible action is the "unnecessary prompt" discovery's own principle forbids, and it contradicted the reasoning that made **close** weightless (close is light *because* it's recoverable). Validated live: **Apple Notes deletes with no prompt**, as do Mail and Finder — the macOS line is *reversible → no prompt; irreversible → confirm*.

**Nothing in the storage mechanism changes** — soft-delete flag, tombstones, no auto-purge, Recently-Deleted filtering all stand exactly as decided. This is purely about the **UX references**: where this topic's prose says the delete UX includes a confirm prompt, that is no longer accurate.

**Where the confirm went:** to **permanent deletion** in the Recently-Deleted view → rerouted to **management-window**. Also relevant: note-window added a **one-time first-delete notification** ("you can always recover this from Recently Deleted"), which is what makes dropping the prompt safe.

#### Decision (2026-07-31) — accepted; prose corrected, mechanism untouched

Accepted without argument, because **this topic is what removed the destructiveness the confirm existed for**: soft-delete is a reversible flag that keeps syncing, filters into Recently Deleted, and never auto-purges. Confirming that is confirming an undo — the "unnecessary prompt" discovery's own principle forbids, and the line macOS itself draws (Notes, Mail and Finder all delete without one; *reversible → no prompt, irreversible → confirm*).

**Storage-side check, since a UX reversal can quietly move a storage requirement — nothing moved.** Soft-delete flag, hard-delete + tombstone, TTL, no auto-purge, Recently-Deleted filtering all stand. The point worth naming: **the confirm was never a storage guarantee**, so removing it lowers none. Recoverability lives in the flag, and always did — which is precisely why the prompt turned out to be redundant.

**And the confirm is now correctly positioned relative to this topic's mechanism.** Where one does survive — permanent deletion, in management-window — it guards the **hard-delete + tombstone** path, which is the genuinely irreversible one storage owns. The prompt moved to the act that can't be undone.

Stale references corrected in place (the Context line and the note-window reroute bullet).

## Folder Drivers And Backup

### Context

*From the discovery brief.*

**Backends = "drivers + settings".** iCloud Drive, Dropbox, Google Drive, and plain local folder are the **same driver** — each is "a folder on disk that syncs itself", so one file-in-a-folder store covers them all at once. Start simple (iCloud + Dropbox first). Only **network backends (SFTP, hosted API)** are genuinely separate drivers — deferred.

**Backup + multi-Mac fall out for free** by pointing at a synced folder. Student → iCloud (automatic backup/restore); lawyer → local/own store (confidentiality); the dev runs **no infrastructure**. **No hosted cloud** — "no cloud" means "no *hosted* cloud; the storage location is yours." A hosted **Fumi Sync** is a possible deliberate *later* product.

**On the radar:** copy-only assets mean every asset byte lives in the store, so a note with a large video multiplies cloud-quota + sync-bandwidth (review observation). Which folder-sync services first, the folder-picker / storage-setup UX, and backup/restore behaviour (is restore just "point at the folder"?) all sit here. *This subtopic is downstream of store-locality — its "backup falls out for free" premise depends on that decision.*

*From: onboarding-and-permissions · discussion · 2026-09-15*

`onboarding-and-permissions` has decided that **the first-run screen's iCloud sync toggle is pre-enabled when an iCloud account is present.** That contradicts this topic's 2026-08-04 ruling — *"the sync toggle ships default-OFF and onboarding is where enabling gets encouraged"* — at the first-run surface, and the correction is yours to take or refuse rather than ours to make.

**The shape of first run, for context.** It is one screen: two toggles (iCloud sync, launch at login), then Continue, with the notification permission dialog firing as the screen is dismissed. Both toggles carry defaults, and the defence of that shape is that Continue-without-reading is a complete and correct path — the only real protection against three decisions standing between a new user and their first fumi.

**What forced the question.** A background review found the screen at odds with itself in two ways.

The no-screen option had been rejected on the ground that *a silent default is not neutrality; it is a decision made for the user and hidden from them.* But a rendered-but-unread screen produces the same outcome by a different route: the offer was made, nobody answered, and with a default-off toggle the answer recorded is **no**. The argument that killed the no-screen option applied to the screen's own default.

The screen was also internally inconsistent. Launch at login is recommended *and* pre-enabled; sync was recommended and pre-refused, with nothing in either topic's record saying why two recommendations carry opposite defaults.

**The worked case.** Someone installs Fumi on their **second** Mac. Their fumis are already in iCloud. First run appears, they press Continue without reading, and they land in an empty app while their library sits in the cloud. For that user, "ignoring the screen is a complete and correct path" is false in every sense — and it is the case most likely to produce a bad first impression, because they have already decided they like the product.

**The counter-position, weighed and rejected.** Default-off means no user's notes leave their Mac without an explicit yes, which is a defensible privacy posture for a product whose pitch is that your notes are files you own. If that had been the reason for the default, the repair would have run the other way: qualify the ignore-the-screen claim and find some other way to catch the second-Mac user. It was rejected because this topic's own 2026-08-04 entry names onboarding as the place enabling gets encouraged — a default set against that encouragement makes the recommendation decoration.

**What the onboarding decision covers, precisely:**

- The toggle is **pre-enabled on the first-run screen** when an iCloud account is present.
- With **no iCloud account** the control stays disabled with its explanatory note, unchanged — there is nothing to pre-enable.
- The user sees the toggle, sees it on, and can switch it off before Continue. What changes is only that inattention now lands on the recommended outcome rather than against it.

**What it does not touch**, and these are recorded as untouched in the onboarding decision's sibling check: toggle-off is pause rather than destroy; enabling triggers a background, non-blocking, resumable bulk backfill with quiet progress; there is deliberately no in-app "remove my data from iCloud" action.

**The ask.** Does your default-off ruling stand as a statement about the *running app's* preference only — in which case first run pre-enabling it is consistent and your entry may want a clause saying so — or does it govern the first-run screen too, in which case the onboarding decision is wrong and should be reversed? Either answer is fine; what cannot stand is the project holding both positions with neither record acknowledging the other.

### Decision (2026-07-23)

#### 2026-09-15 — revised
*Trigger: triage from onboarding-and-permissions: "The sync toggle is pre-enabled at first run, against this topic's default-off ruling" — their first-run screen pre-enables the toggle where this entry says it ships off, and neither record acknowledged the other.*

> **"Default OFF" is a statement about the preference the app ships with, not about what the first-run screen proposes. With an iCloud account present, first run offers sync **on**; the user sees it, and can switch it off before continuing. With no account there is nothing to offer and the control stays disabled.**

**Sibling check: onboarding-and-permissions — its decided text pre-enables the first-run toggle when an iCloud account is present, leaves the control disabled with its explanatory note when there is none, and keeps the user's ability to switch it off before Continue. Adopted, not re-decided; the first-run surface is theirs. What is settled here is the scope of this topic's own ruling and the consequence it carries back.**

**The two statements were never in conflict; the ruling simply predates the screen.** It was written on 2026-07-23 as one clause of a sentence about the shipped configuration — *"no folder picker in v1; an iCloud sync on/off toggle, default OFF; onboarding asks and encourages enabling it"* — at a point when onboarding had not been designed and "default" could only mean the stored preference's initial value. The screen proposes and **Continue writes**: the preference is off until the user acts, and pressing Continue is the act. Nothing about the app's shipped state changes.

**Rejected: read it as a privacy posture — nothing leaves the Mac without a deliberate yes — and reverse them.** This is the real alternative and it was tested rather than waved past. It requires holding that a screen the user did not read is not consent; and if that holds, the screen is doing no work at all, since its entire defence is that Continue-without-reading is a correct path. It would also leave the second-Mac user — library in iCloud, empty app on screen, already sold on the product — with no route in at all. The clause this topic wrote *itself* settles the direction: onboarding is named as the place enabling gets encouraged, and a default set against that encouragement makes the encouragement decoration.

**What makes the pre-enabled default honest is already built, and it is the distinction the reversal argument turns on.** Enabling triggers a **visible backfill** — the quiet *"Backing up… N of M"* progress decided in this same entry — so the user who pressed Continue blind learns within seconds that their notes are going to iCloud. A silent default is a decision hidden from the user; this one announces itself on the next screen they look at. That was decided for a different reason and it is what makes this affordable.

**Cost, named, and it is sharper than the concern has it — because it is ours.** This topic ships **no in-app way to remove your data from iCloud**, deliberately: macOS owns it, and it would be the only destructive remote action Fumi has. One of that decision's three reasons was *nobody asked for it*, and it was taken when turning sync on was something a user did on purpose. Pre-enabling inverts who needs it: the person most likely to want the data back out is now the one who never chose to put it there, and the answer they get is System Settings.

**That decision is re-tested here and stands.** The two reasons that carried it are untouched — macOS genuinely owns the purge, and building the only destructive remote action in an app whose posture is degrade-never-destroy is a bad trade at any level of demand. What the inversion changes is the *third* reason, which was never load-bearing. **Rejected: ship a purge action now that inattention can enable sync** — it answers a discoverability problem with a destructive feature. **Where the off switch lives, and that the purge is in System Settings, is copy — onboarding's screen and its surfaces, not machinery here.** They hold both facts already; this records why they now matter more than they did.

#### 2026-07-23

- **v1 ships CloudKit only.** Folder / Dropbox / SFTP / multi-provider drivers are **deferred** behind the sync-driver seam — they slot in later without redesign (and restore the own-folder / no-iCloud option).
- **The seam is transport-agnostic by design** — pitched at "reconcile local bundles with a remote replica", so "remote replica" is abstract:
  - **CloudKit driver:** replica = CloudKit's server DB, reached by *API*. Two-way, **push-driven** (silent APNs push → fetch delta; near-real-time), plus launch/foreground fetch backstop — *not* polling. Send = enqueue `CKRecord` upload.
  - **Folder driver (future):** replica = a *destination folder* in the user's iCloud Drive/Dropbox. Send = write the bundle into it; receive = **FSEvents** on files the third-party service drops in. No sync API of ours — the service does the transport.
  - Both keep **local-truth** (the folder is a replica, not truth — eviction stays harmless; this is "Option B with folder transport"). Asymmetry the seam absorbs: CloudKit supplies a true *ancestor*; the folder driver has none → falls back to the `meta.json` version-vector (+ can detect the service's `conflicted copy` files). Hence `resolveConflict(local, remote, ancestor?)`.
- **No folder picker in v1.** An **iCloud sync on/off toggle, default OFF**; onboarding asks and encourages enabling it.
- **No-iCloud account** (a valid macOS state) is **detected** via CloudKit account status (`CKAccountStatus = noAccount`); Fumi then doesn't offer sync/backup — the app still works fully on local truth. Signing in is a macOS action, not a Fumi flow; detect + gate gracefully. **No iCloud → no backup.**
- **Backup posture (v1):** CloudKit (multi-device + device-loss recovery) + Time Machine (local versioned store ~~+ the large local-only assets~~ — *struck 2026-08-09: the hard limit admits no local-only assets, so Time Machine's leg is the versioned store alone*) + Recently-Deleted (accidental delete). Onboarding nudges iCloud-on so the never-lose-content promise holds.
- **Enable-time sync + failure modes (final-review F5):** flipping the toggle *on* triggers a **background, non-blocking, resumable bulk backfill** of the whole library (quiet "Backing up… N of M" progress; `CKSyncEngine` owns batching/backoff). **`quotaExceeded` (iCloud full) → degrade *with a visible signal*, never silently** — notes stay in local truth (editing never blocked), a persistent non-nagging indicator says backup is paused, retry on space free. Transient throttle / `serviceUnavailable` → CKSyncEngine auto-backs-off, surface only if persistent. **Toggle *off* = pause, not destroy** — CloudKit data left intact (back on → resume, no re-upload), local truth untouched. *(Struck 2026-07-31: this originally continued "a separate, explicit 'remove my data from iCloud' action exists for a real purge". **Fumi will never ship that action** — see the decision below.)* Through-line: never block editing, never silently drop the backup guarantee, never destroy on a toggle.
- **Versioned note-history** pulled out into its own subtopic (`version-history`) — to discuss, not yet assumed in or out.

### Decision (2026-07-31) — no in-app iCloud purge, ever; an absent zone is a stopped state *(resolves review-004 F11)*

**"Remove my data from iCloud" is dropped — not deferred, dropped.** It was recorded on 2026-07-23 as the counterpart to *toggle-off = pause, not destroy*, with **no rationale written beside it** — a tell that it arrived as symmetry rather than as a requirement.

- **macOS already owns it.** System Settings → iCloud → Manage → per-app delete. Apple's own apps largely don't duplicate it.
- It would be **the only destructive remote action Fumi owns**, in an app whose posture is degrade-never-destroy.
- Nobody asked for it.

*(Re-tested 2026-09-15 and kept.* **The third reason has inverted and it was never the load-bearing one.** *Onboarding now pre-enables the first-run sync toggle where an iCloud account exists, so the user most likely to want their data out of iCloud is the one who never chose to put it there — and the answer they get is System Settings. The first two reasons are untouched, and shipping the only destructive remote action in the product to answer what is really a discoverability problem is the wrong trade. Where the off switch lives, and that the purge is in System Settings, is onboarding's copy. See the 2026-09-15 entry under Folder Drivers And Backup.)*

The **iCloud sync toggle stays**, unchanged: on/off, default off, pause-not-destroy. A control labelled *sync* must never mean *and delete my cloud copy* — you turn sync off on a laptop you're taking somewhere, not to purge a backup.

**But dropping the button does not drop the problem** — which is the finding's real point. The zone can vanish from causes Fumi doesn't control and can't prevent: the user purging via System Settings (the very affordance we now point at), an expired or invalidated change token, a container reset, account-level upheaval. All of them arrive identically: *the zone we expected is not there.*

> **An absent zone is never evidence of intent.** Fumi cannot distinguish a deliberate purge from a token expiry or an Apple-side fault — they are the same signal. So it always means **"I have lost my sync relationship"**, never "the user wants this deleted" and never "the server is authoritative and my notes are gone".

Behaviour: **stop syncing. Leave local truth completely untouched. Tell the user. Require an explicit re-enable** before either re-uploading or adopting whatever is (or isn't) there.

**Both naive readings rejected, and each is bad in a different direction:**

- **Re-upload from local truth** — every other Mac cheerfully undoes the purge the user just performed.
- **Treat the absent zone as mass deletion** — local truth is destroyed on every other Mac, which is the single worst thing this document could permit.

This collapses every cause into one state with one honest answer, and it is the same posture already taken for `quotaExceeded`: **degrade visibly, never act destructively on ambiguous evidence.**

#### Sync visibility — storage owns the *state*, management-window owns the *surface*

The same finding's second half: nothing anywhere would reveal a note that is stuck, permanently rejected (`serverRejectedRequest`, oversized record) or simply hasn't synced in weeks. That matters more after this session than before it, because several decisions taken today **degrade quietly by design** — an absent zone stops and waits, ~~oversized assets stay local-only~~ *(struck 2026-08-09 — the hard limit refuses them visibly instead, one fewer silent degradation)*, an unreconciled Mac declines to purge. All correct, all silent, and silent degradation needs somewhere to become visible or the guarantee lapses without anyone noticing.

**It is not a feature to build here, though.** Two things separate:

- **Quota is an OS concern.** macOS surfaces "iCloud Storage Full" itself and Apple's own apps lean on that rather than reimplementing it. Third-party apps that show anything keep it modest and put it in settings or a sidebar (Bear, Things, Ulysses, Obsidian Sync) — **none annotate content**. Fumi follows: a system notification plus a line in the management window, **never on the fumi itself**.
- **The states invented in this session are ours alone.** Nothing outside Fumi knows that syncing stopped because a change token expired, or that one note is being permanently rejected. The OS cannot report those.

> **The engine records the state; management-window renders it.** Overall state (syncing / paused / stopped) and a per-note state (synced / pending / rejected). Nearly free — `CKSyncEngine` surfaces this already and its state blob is persisted regardless.

Same split this topic has used throughout (soft-delete flag ours / bin theirs; `excluded` flag ours / placeholder theirs — *that example retired 2026-08-09 with the flag; the split it illustrates is unchanged*). It costs nothing now and avoids the failure that actually bites: designing the panel later and finding the state was never recorded, so there is nothing to render. **→ management-window** (display), **→ this topic** (state).

### Decision (2026-08-01) — Time Machine restore: full restore is an offline Mac catching up; selective restore imports at launch as a deliberate edit *(resolves review-005 F13)*

Time Machine is a named backup leg — the *only* one a sync-off user has, ~~and the only home anyone has for >50 MB excluded assets~~ *(struck 2026-08-09 — no such assets exist under the hard limit)* — but what happens on restore was never written. Two shapes, opposite treatment:

> **A full restore is an offline Mac catching up — no new machinery.** Disaster recovery brings back all of `Application Support/Fumi/` as one coherent old state (bundles, index, per-device blob). First launch reconciles exactly as a Mac offline since the backup date: per-field merge fast-forwards notes only the server moved, both-moved raises the ordinary keep-both conflict, tombstones remove notes hard-deleted since the backup, the per-device blob restores the desk. Sync bringing restored notes current is *correct* — a full restore means "give me my Mac back", not "revert my notes".

> **A selective restore into a live store stays out-of-contract, but becomes recoverable at launch.** Dropping a single `.fumi` bundle from Time Machine into a live store is an external write nothing watches (no FSEvents in v1) — a live engine's next write can clobber it, a named v1 limitation. The **launch reconciliation walk gains one rule**: a bundle whose content hash disagrees with the index's projection (and is not an engine write) is imported as a **deliberate local edit** — the user put that file there on purpose. It enters ordinary merge: server unmoved → the restored text wins and propagates (the flush snapshots what it replaces); server moved → a visible keep-both conflict. **Never silently reverted by the next fetch.** The supported shape is **restore, then relaunch** — one line for onboarding/docs to carry.

## Multi-Mac Concurrency

### Context

*Rerouted from note-model / discovery (drain-triage 2026-07-22). The meaty deferred problem.*

**Live multi-Mac concurrency/conflict** — two always-on engines writing one synced store across machines. Folder-sync services "resolve" this with ugly `note (conflicted copy).md` files (review F2: these land *inside* the `.fumi` package, producing malformed bundles the read-model must handle). Backup/restore and single-active-machine are clean; a genuine *live multi-Mac* conflict-resolution design is the hard open work.

Space-homing degrades across machines for free (a restored note's home-Space UUID isn't present on another Mac → the existing Space-1 fallback fires; content ports perfectly) — so this subtopic is about *content/metadata* conflict, not window state.

*From: note-window · discussion · 2026-08-22*

note-window settled what the version panel's attribution row renders (`via` + `by`, no user-vs-agent field). Alongside it, the **conflict reconciler**'s row label was found to rest on a fact nothing produces. The spike fixed the label as **"This Mac · 11:26"** / **"MacBook Pro · 11:25"**, and no decision in any document says which Mac a candidate came from — or that the record knows.

**What the record model holds today.** Attribution on a version child record is **`via`** (`app` / `cli` / `mcp`) and **`by`** (optional, self-reported), and *"version snapshots and conflict candidates are likewise child records."* `via` answers *which door the write came through*; neither field answers *which machine*. The device key — the **hardware platform UUID** — exists only on the per-device record, which nothing links a candidate to.

**The ask.** A conflict candidate records the **device key of the Mac that wrote it**.

**Why the reconciler needs it and version history doesn't.** A conflict is the one place two rows sit seconds apart, written by the same person, where *which of my Macs* is the discriminating question — *"I edited that one on the laptop this morning"*. In version history the timestamp answers *when* and the attribution row answers *who*, and a third fact per row is noise. note-window's decision therefore shows device identity in the **reconciler only**, so the ask is scoped to the candidate rather than to every snapshot.

**Whether a candidate's origin is already knowable was left to this topic** — the part note-window could not settle from what is written down. Keep-both stores *"the divergent version as a subordinate conflict-record on the same note"*, and the conflict is detected by whichever Mac pushes second, so on **that** Mac the local side is its own and the candidate is the arriving one. What the **other** Mac sees once it fetches is not stated anywhere, so the local-versus-remote assignment may not be symmetric across the two machines.

**Cost, as note-window understands it:** one key on a record that already exists, written at the moment the candidate is created, and never merged — a candidate is immutable in the same way a snapshot is. **The fallback is designed and complete either way**: where the writing device cannot be identified or named, the row reads **"Another Mac"**, so refusing this costs the precision, not the reconciler.

*Tightly coupled to store-locality:* if truth is local + engine-owned transport, we own merge (no conflicted-copy files); if cloud-folder-is-truth, we inherit them.

### Decision (2026-07-22) — absorbed by CloudKit / `CKSyncEngine`

The "deferred hard problem" is **resolved, not deferred** — the CloudKit transport dissolves it.

- **`CKSyncEngine` owns cross-device sync** (one shared private zone). Single-writer is *per-Mac* (each local engine); CloudKit reconciles across machines. No two-engines-on-one-folder, no `conflicted copy` files.
- **Three-way conflict detection** via CloudKit's client + server + **ancestor**: both-sides-changed-vs-ancestor = genuine conflict; one-sided = fast-forward.
- **Precedence = per-note edit-counter** in `meta.json` (over timestamps — queued edits can share a timestamp). Full version-vector is reserved for the *future* folder driver (which has no ancestor). *(**Dropped 2026-07-31** — per-field merge against the ancestor retired it before it shipped; see below.)*

#### Decision (2026-07-31) — `editCounter` is dropped, not defined *(resolves review-004 F7)*

The review asked what increments it, whether it counts per note or per Mac, and how two Macs incrementing from the same value break a tie — none of which was ever specified, for a field the data mapping calls out as one that *"must sync"*.

The right answer turned out not to be a definition. **Per-field merge against the ancestor retired the counter before it shipped**, and the walk-through is short:

| Case | What decides it |
|---|---|
| Two Macs change **different** fields | Both apply — no winner needed |
| Two Macs change the **same scalar** | The second write lands and wins |
| Two Macs change **`content.md`** | Keep both — nothing is picked |

There is no remaining case in which a counter arbitrates anything. The ancestor comparison does the job it was invented for, and does it per field rather than per note.

**So it is dropped from v1**, on the same reasoning applied to the folder driver: don't ship what nothing reads. It remains **reversible** — CloudKit permits *adding* fields to a deployed schema; it is renaming and removing that it does not — so if a future driver ever needs a precedence input, one can be added then.

**Rejected: keep it as cheap insurance.** The insurance is for the folder driver, which is no longer a design target (see store-locality's narrowed seam justification). Unlike the seam, the counter has no testability argument holding it up — it would be a permanent field on every note record, carried for a project nobody plans to start.
- **Resolution rule:**
  - **Disjoint parts changed** (e.g. colour on one Mac, `content.md` on another) → **auto-merge, silent, safe** — different record fields/assets, no prose blended.
  - **Same part changed concurrently** (both edited `content.md`) → **keep-both**: the note enters a **`conflicted` state**, the divergent version stored as a **subordinate conflict-record on the same note** (same UID/bundle), surfaced via a conflict badge + tabbed reconciler (→ note-window). **`content.md` is never blended, only ever kept.**

  **Conflict lifecycle (final-review F7):** the divergent side is **not a separate note** — this **supersedes** the earlier "new record id / forked bundle" framing (which would sprout a phantom duplicate that syncs, accrues its own history, and needs a tombstone on resolution). Instead: *one* note, `conflicted`, with candidate version(s) as subordinate records that sync (reconcile from any Mac). History stays with the one note; assets stay in its one shared bundle (ref-counted). **Resolution** (in note-window's reconciler): snapshot the pre-resolution state first (undoable), write the chosen content to `content.md`, delete the conflict-records — **now-unreferenced assets are left for the sweep** *(restated 2026-08-01 — this read "GC now-unreferenced assets", a synchronous collection triggered by a write, which asset-storage's mitigation B ("GC is a sweep, never synchronous with a write") explicitly forbids; the wording predated B and was never swept. One GC discipline, zero exceptions — the sweep's young-asset grace and reconciled-state gate exist precisely because write-triggered collection is the dangerous shape, and resolution — deleting ref-counted candidates on a note two Macs have both been touching — is where that danger peaks. review-005 F10)* — **no phantom note, no hard-delete, no tombstone (F3 not invoked).** Never auto-discards a candidate; only explicit resolution drops the loser. *(**Extended 2026-08-01 — resolution snapshots both sides.** As written, the exits were asymmetric: choosing the candidate preserved both texts (the pre-resolution snapshot holds the local side), but choosing the **local** version deleted the candidate — real prose from another Mac, which the whole keep-both apparatus exists to protect — without it ever entering history. Silent loss on the destructive branch, against the document's own rare-silent-loss-beats-visible-annoyance test, and explicit resolution of the conflict was never informed consent to erasure. Now the **losing candidate is snapshotted before the conflict-records are deleted**, unconditionally — when the loser is the local side, only-if-changed dedup collapses the overlap for free. Attribution follows the work-captured rule: the candidate's author where the record carries it, absent means unknown. The loser drops from the note, never from history. Whether the scrubber labels a never-live version → note-window. review-005 F11.)*
- **Mixed Fumi versions on one store (resolves review F8 [set 001]):** CloudKit records tolerate unknown fields (a newer version adds fields an older one ignores); `schemaVersion` guards a client against destructively overwriting fields it doesn't understand.
- **Single-active-machine** (the common case) stays conflict-free; live multi-Mac is now handled.

### Decision (2026-08-23) — a conflict candidate stamps its writing device, and so does the live side

*Trigger: triage from note-window: "A conflict candidate should record which device wrote it" — the reconciler's row labels were pinned to real device identity, and note-window asked this topic whether a candidate's origin is already knowable.*

**It is not knowable, and the reason matters more than the answer: the assignment is asymmetric.** Two Macs edit the same note; B pushes second and gets `serverRecordChanged`. B keeps one side in `content.md` and demotes the other to a candidate — *which* side it keeps is not pinned by anything decided here, and it does not need to be, because **the asymmetry holds under either convention**. Say B keeps its own: the server then holds `content.md` = B's text with A's text as the candidate. Both Macs fetch that same pair — and the decided lifecycle says *"candidate version(s) as subordinate records that sync (reconcile from any Mac)"*, so both are first-class readers. On **B**, live is its own and the candidate is the other Mac's. On **A**, live is *B's* text and the candidate is *A's own*. Identical records, identical rule, exactly inverted meaning. Flip the convention and the inversion simply moves to the other Mac: whichever side the detector elects, "live" is *its* choice, and "this Mac" is a different Mac for each reader.

Nothing in the records breaks the tie. `via` is `app` on both sides (same person, same door); `by` is absent or identical; the hardware platform UUID lives only on the per-device record, which nothing links a candidate to. So a local-versus-remote label is correct only on the Mac that detected the conflict — which is precisely the Mac least likely to be the one asking *which of my Macs was that*.

**Two fields, both free of merge machinery:**

| Row in the reconciler | Where the key comes from |
|---|---|
| live side (`content.md`) | `lastDevice` on the note record, beside `lastVia` / `lastBy` |
| candidate | the writing device's key, stamped on the conflict-record at creation |

**Why the second field is not scope creep.** The ask as delivered names the candidate alone, which labels one row and leaves the row above it bare. `lastDevice` costs nothing new: `lastVia`/`lastBy` already exist for exactly this purpose, are updated on content writes, and merge per-field second-write-wins. The same push that makes B's text live sets all three to B's values, so the live row is correct **by construction** — no new rule, no new write path, no ordering to get right.

**The candidate's key is immutable**, like the record carrying it; the note record's is second-write-wins, like its two siblings. Neither touches the conflict machinery, and the exclusive-writer exemption is irrelevant here — these are note-scope records, not device documents.

**Two limits held deliberately:**

- **Not projected into SQLite.** Same argument that kept `lastVia`/`lastBy` out of `notes`: a column exists to answer a query, and the only reader is the reconciler, which is already holding the records.
- **Not extended to version snapshots.** note-window scoped device identity to the reconciler — in history the timestamp answers *when* and the attribution row answers *who*, and a third fact per row is noise. Where a losing candidate becomes a snapshot under *resolution snapshots both sides*, the key rides along in the record but nothing renders it.

**Sibling check: note-window — its decided reconciler renders real device names on both sides with `CURRENT` marking which you keep, and its Open Threads record this field and the ComputerName field as pending here, with "Another Mac" standing until they land. This satisfies that expectation and does not disturb the attribution row, which stays `via` + `by` with no device fact in it.**

**Cost, named:** two fields on the note record's synced set and one on a child record, plus the `schemaVersion` procedure they fall under (v1 ships as version 1, so this is a pre-ship addition rather than a migration). Where either key is absent or unresolvable the row reads **"Another Mac"** — the designed fallback, which is why neither field is load-bearing for the reconciler shipping.

### Decision (2026-09-14) — a conflict candidate lives in the bundle, beside `versions/` *(resolves review-009 F1)*

Every other durable artifact in this design got both halves of an address — a version snapshot is a file under `versions/` **and** a child record; an asset is a file in `assets/` **and** a child record. A conflict candidate only ever got the cloud half: *"version snapshots and conflict candidates are likewise child records"*, and *"the divergent version stored as a subordinate conflict-record on the same note (same UID/bundle)"* — which denies a forked bundle without saying where the bytes sit on the Mac that has to render them.

Both places it could have been are enumerated lists that excluded it. The bundle's contents are spelled out three times (bundle-layout, the hard-delete cascade, the rebuild path) and a candidate appears in none; SQLite's **Cache** tier is enumerated as *"change tokens; tombstones"*, so a candidate held only there is a third member the invariant does not have. Whichever way this landed, a stated list grew.

> **A conflict candidate's text is a file inside the note's bundle, a sibling of `versions/`. The child record is its synced half, exactly as for a snapshot.**

**Sibling check: note-window — its decided reconciler seeds the version panel with the candidates, previews each in the note itself, and holds the frame still while switching between them; it specifies what is rendered and never where the bytes live. No overlap on placement, and nothing there needs revising.**

**The deciding case is sync being switched off with a conflict still open.** Conflicts only arise through sync, which makes a Cache-tier home look defensible — the authority is remote, so a rebuild re-fetches. It fails on one ordinary act: a user turns the iCloud toggle off with a conflict unresolved, which is *pause, not destroy* and a perfectly normal thing to do. That store is now **disabled-after-enabled**, which this document's own definition reads as **not reconciled** — no fetch will complete again — so the next index rebuild takes the candidate and nothing can bring it back. That is silent loss of prose the user wrote, against the test this document has applied repeatedly: *rare silent loss is worse than rare visible annoyance*. The whole keep-both apparatus exists to stop exactly that, and it would have been undone by where the bytes were parked.

**It also puts the text where it is already destined to end up.** *Resolution snapshots both sides* — the losing candidate enters history unconditionally before the conflict-records are deleted. Under this placement that is a move within the bundle rather than a materialise-from-elsewhere, in the one flow this document already identifies as where the danger peaks (*"deleting ref-counted candidates on a note two Macs have both been touching"*). Two further rules land for free: candidates *"count as versions for ref-counting, for as long as they exist"*, so the link set the GC sweep reads sits beside the version link set rather than in a disposable projection; and the hard-delete cascade takes *"the directory itself"*, so a candidate needs no cascade rule of its own.

**Tier, stated because the invariant asks:** the candidate file is bundle content like any other, so its projection into SQLite is **Projection** — rebuilt by scanning bundles. Cache keeps its two members unchanged.

**What this extends.** The bundle's content list gains a fourth entry at the three sites that enumerate it. Eager download already rebuilds `versions/` from version child records; candidates ride the same path, being the same kind of record.

**Cost, named: a bundle can hold text that is not the note's content.** Anything walking a bundle has to know that — the rebuild, a backup trawl, a curious user in "Show Package Contents". Accepted because the alternative pays for a tidier enumeration with the one thing this topic refuses to risk, and because `versions/` already established that a bundle holds more than its current text.

**Rejected: hold the candidate in SQLite's Cache tier.** Its case is real — a candidate is transient by intent, and keeping the bundle's enumeration stable has value. It loses on the sync-off case above, and secondarily on the ref-count: a link set in the disposable projection makes asset collection depend on state a rebuild discards, where the `reconciled` gate is a guard rather than a guarantee.

## Version History

*Decided 2026-07-23. "Do it right or defer" → doing it properly (not deferred).*

- **Model:** per-note **version history** = append-only, **immutable markdown snapshots** of `content.md`. Immutability → snapshots never conflict → sync trivially. Local: in the bundle (`{ulid}.fumi/versions/…`; travels + Time-Machined). CloudKit: one small **child record + markdown `CKAsset` per snapshot**, parent = the note. Text snapshots are KB → cheap (all **downloaded eagerly** — see below).
- **Scope = `content.md` text only** (colour / tags / window-state are not "content history"). Inline code + Mermaid are text → snapshotted for free (never assets). *(Revised — snapshots also record the authored `size` and `presetId`; see the geometry-snapshot decision below.)*
- **Cadence:** snapshot when **focused-but-idle** (activity then ~1 min no typing) **or on blur**, always **only-if-changed** (content-hash dedup). Never a raw timer; never identical content. *(Generalised 2026-07-31 — "blur" now means **done with the note**, which covers actors that never hold focus; plus a dirty-flush rule. See the cadence decision below.)*
- **Assets — ref-count by version-links** (resolves the tricky bit; = the user's "track the linking, not the bytes"): each snapshot records which assets it links. Keep an asset while **any** version (current *or* in-window history) links it; GC when the last link drops. Removing an image just drops one link — bytes persist while an older snapshot needs them, GC'd when that snapshot prunes. → faithful history (old versions keep images), no orphan bloat, bounded by retention. ~~(>50 MB local-only assets: a version's ref is only as available as the note's current large asset — consistent.)~~ *(Struck 2026-08-09 — nothing over the ceiling is admitted, so every asset a version links is present on every Mac. See asset-storage's hard-limit decision.)*
- **How snapshots sync (clarifying the model — final-review F1):** under **CloudKit** the bundle is *local truth*; snapshots do **not** sync "for free" by sitting in `versions/`. The engine explicitly maps each snapshot to a **CloudKit child record + markdown `CKAsset`** and syncs *that* (exactly as the note itself: bundle local, `CKRecord` synced). A fresh Mac pulls the note records + their version child records and rebuilds the local bundles incl. `versions/`. *(Only under the future **folder driver** would `versions/` files ride along automatically as part of the folder.)*
- **Everything downloads eagerly (final-review F2):** all snapshot markdown **and** their assets download to every Mac *(the qualifier here read "(synced, ≤50 MB)" until 2026-08-09 — with the hard limit every asset a bundle holds is synced, so it is dropped rather than struck)* — **no lazy asset fetch, no "downloading…" state to design.** Consistent with local-truth (it's *all* on your Mac), offline-complete (any old version fully viewable incl. images), and asset-GC stays exact (every Mac has the complete version→asset link set → collect an asset when no version references it, driven by retention-purge). Storage cost = images removed from current content but still referenced by an in-retention historical version — bounded by retention (the user's disk + their Off/30/…/Forever choice). *(Rejected: an eager-text / lazy-bytes split — it saves marginal storage but forces a whole not-yet-downloaded asset UI + fetch/offline wiring in the history viewer. Not worth it.)* ~~(>50 MB assets are excluded from CloudKit entirely — see asset-storage / F6 — the one thing history can't restore off-Mac.)~~ *(Struck 2026-08-09 — the ceiling became a hard limit, so nothing a bundle holds is absent from CloudKit and **history restores everywhere**. The eager-download claim above is now unqualified.)*
- **Retention (decided):** a single **time-based** setting (no count cap) — **Off / 30 / 90 / 180 / 365 days / Forever**, ~~default 90 days~~ **default Forever** *(changed 2026-07-31 — retention is asset GC, not history policy; see the retention decision below)*. **Account-global, not per-device (F1):** history is synced + restores on a fresh Mac, so retention is one **account-level** setting and a **purge propagates** — it deletes the version child records (and local `versions/`) everywhere, *not* a local-only eviction. (Corrects the earlier "purely local" framing.)
- **Restore** replaces current `content.md` with the snapshot **and snapshots the pre-restore state first** (restore is itself undoable).
- **UI → note-window** (✓ rerouted — the genuinely hard part): slide-out history sidebar / popover / scrubber + restore affordance.
- **Premium → commercialization** (✓ rerouted): strong paywall candidate (alongside the CLI/MCP agent surface); nuance — gate *history/snapshots*, likely **not** iCloud sync itself. The free/premium boundary is commercialization's to set.

### Reopened (drained triage 2026-07-30) — cadence misses agent writes; add author attribution

*From: note-window · discussion · 2026-07-26.*

Surfaced while deciding note-window's editing model, which foregrounded **concurrent agent writes to open notes** as the normal case (Fumi's notes live open on the desktop; agents write `content.md` via MCP/CLI through the engine).

**The gap.** The settled snapshot cadence is *"focused-but-idle (activity then ~1 min no typing) **or** on blur, always only-if-changed."* Both triggers assume **a human is typing**. For an **agent write to a note the user never focuses**, neither fires — *focused-but-idle* needs activity-then-pause that never happened, and *blur* needs focus that was never held. So agent-authored changes may get **no snapshot at all**, or only much later, bundled into a subsequent human edit.

(Note: an earlier framing of this as "open notes never blur" was wrong — **open ≠ focused**; notes lose focus constantly. The idle and blur triggers are fine for human editing. The hole is specifically *agent writes to an unfocused note*.)

**Why it matters:** agent edits are precisely the ones a user most wants history for — to see what changed and revert it. Version history is also a premium candidate, so this is a headline-feature gap, not an edge case.

**Proposed fix (user-confirmed):**
1. **Agent writes via MCP/CLI trigger the same versioning** as human edits — add an agent-write trigger to the cadence, capturing the note's **pre-write** state (debounced, still only-if-changed). Mirrors the existing rule that restore snapshots the pre-restore state first. Content-hash dedup prevents spam.
2. **Tag every version with its author** — who changed it: the user, or an agent (identified by client — MCP / CLI — and ideally which agent). Consistent with discovery's rejection of a persistent "Written by Claude" byline *on the note surface*: attribution belongs in the version record, not as note chrome.

**Split:** the cadence trigger + the author field on the snapshot model are **this topic's**; *displaying* attribution in the history scrubber is **note-window's** (recorded there under Version-History UI).

#### Decision (2026-07-31) — one cadence for every actor; the definition was too narrow, not the model

The gap is real and the fix is smaller than the entry proposed. **The proposed pre-write capture is rejected** — on the governing principle that the entry itself was reaching for:

> **The actor model does not privilege one actor over another.** A human and an agent are both just actors using the system through different surfaces.

We do not snapshot before a human types. So we do not snapshot before an agent writes. The pre-write proposal quietly encoded "agent edits are the dangerous ones", which is the wrong frame — and, as it happens, unnecessary.

**What was actually wrong was the definition of `blur`**, which had been read as *"the window lost focus"* when the thing it means is:

> **blur = done with the note.**

- **GUI** — focus leaves the note. Unchanged.
- **CLI / MCP** — **the call ends.** The write is complete; the actor is done with the note. That *is* the blur event for a surface that never holds focus.

**The idle-while-focused trigger simply doesn't apply to CLI/MCP**, and doesn't need an equivalent: a call is not streamed. You don't type a CLI invocation into the note keystroke-by-keystroke — you compose it, hit enter, and it arrives complete. There is no mid-edit pause to detect. (MCP may later split work across several calls; the rule is unaffected, since each call still has a knowable end.)

So nothing about the model changes. One cadence, one set of triggers, a definition wide enough to fit every actor.

**Post-write, not pre-write.** The snapshot taken at a call's end captures the note *after* that actor's write — exactly as a human's blur captures what they just typed. An actor's output enters history the moment they're done with it.

#### The dirty flush — the one case post-write alone would lose

> You're typing. Forty seconds in, so the idle trigger hasn't fired and you haven't blurred: your paragraph is in the note but not yet in history. An agent write lands and replaces the content.

The agent's write snapshots at call end, so *its* output is captured — your forty seconds is gone and was never in history to return to.

> **A write to a note carrying pending unsnapshotted changes flushes a snapshot first — whoever is writing.**

Not an agent safeguard; a general rule about not discarding unsnapshotted work because something is about to overwrite it. Symmetric in both directions: a human typing over an agent's not-yet-snapshotted output gets the same protection. *(Sharpened 2026-08-01 — the flush guards **cross-channel** overwrites; same-channel succession inside the settle window is a burst, not a flush trigger. Read literally, the rule would have made every second call of a burst a flush. See the burst-settle decision below — review-005 F6.)*

**Mechanics:** an incoming write to a dirty note flushes the pending snapshot, which **resets the idle timer**; the incoming write then snapshots at its own done-moment. Two clean snapshots, no lost work, and the reset can't produce a duplicate because only-if-changed already prevents it (post-flush the note isn't dirty and content-hash dedup catches anything else).

*(**Corrected 2026-08-01** — this arrived as "the note carries a **dirty** flag — set on first change after a snapshot, cleared when one is taken", a stored flag with no stated home; wherever it lived it could lie (in memory an engine restart cleared it, in SQLite a rebuild did — either way the flush found nothing and typed-but-unsnapshotted work never entered history, through the seamless-restart path build-and-release requires). Dirty is now the derivable predicate below — review-005 F5.)*

#### Decision (2026-08-01) — dirty is a derivable predicate, not stored state *(resolves review-005 F5)*

> **`dirty(note)` ≜ `hash(content.md)` ≠ `hash(latest snapshot's content)`** — "unsnapshotted changes pending" *means* current content differs from the latest snapshot, so it is computed from those two durable inputs, never stored.

Both inputs sync — content in the bundle, snapshots as eagerly-downloaded child records — so the predicate is **correct by construction across engine restart, SQLite rebuild, and Macs**. The cross-Mac property comes free and a stored flag could never have had it without syncing: Mac B's agent write correctly flushes what was typed on Mac A seconds earlier, because B computes the same answer from the same synced inputs. Content-hashing already exists in this design (burst dedup); a new note with no snapshots is dirty iff content is non-empty, so the first flush captures pre-write state, which is right.

**Cost:** a hash comparison on the write path, and the latest snapshot must be locally known — already guaranteed by eager download. SQLite may cache the latest-snapshot hash per note for cheap checks — Derived tier; correctness never depends on the cache. Rejected: a stored flag in any home — in memory or SQLite it lies after a restart or rebuild; in the bundle it syncs as state what is properly a comparison, and can still disagree with the truth it summarises. The predicate cannot lie.

**Bursts** stay debounced — an agent making ten rapid writes is one logical change, not ten versions. *(**Corrected 2026-08-01** — the debouncer is the **settle window** below, not content-hash dedup: dedup only collapses *identical* content, and a burst's writes (append, revise, append) are never identical, so the two cadence sentences were giving different version counts for the ordinary multi-call agent. review-005 F6.)*

**Net effect: every change is snapshotted by someone's done-moment**, while a human typing still isn't snapshotted keystroke-by-keystroke — the timer and blur produce a sane density for the way fumis are actually used (jump in, make a quick note, jump out).

#### Decision (2026-08-01) — per-call + settle window; the flush outranks the settle *(resolves review-005 F6)*

*"Snapshot at call end"* and *"bursts are one logical change"* contradicted each other for the ordinary multi-call agent, and the burst debounce was never given a window. Reconciled:

> **A call end arms or extends a short settle window. Same-channel calls inside the window extend it — one snapshot at settle, the burst's one logical change. A write from a different channel mid-window fires the flush first, unconditionally. The flush is never debounced.**

- **Window magnitude: seconds, not minutes** — ~5 s, exact value tuned in build. The idle trigger keeps its ~1 min; they are different instruments.
- ***"Every change is snapshotted by someone's done-moment"* survives with one refinement:** for a rapid same-channel sequence, the done-moment is the burst's **settle** — exactly as a human's is the pause after typing, not each keystroke.
- **Cost, named:** the last seconds of a burst sit unsnapshotted until settle — precisely the window the cross-channel flush already covers if anyone else arrives.

#### Attribution — record what we know, never what we'd have to guess

Two fields on the snapshot, and no third one:

- **`via`** — the channel: `app` | `cli` | `mcp`. The engine knows this from the connection the write arrived on; nobody asserts it and nobody can spoof it. **Stored explicitly for the GUI too** — "empty means app" is an implicit encoding that breaks the day empty starts meaning "written by an older version".
- **`by`** — **optional, self-reported**: a CLI flag / MCP field the caller may set (`"Claude"`, a model name). Absent means **unknown**, and unknown displays as nothing rather than a guess.

**Deliberately no `user | agent` field.** It cannot be determined: the CLI is a shared surface the user genuinely uses, so the channel does not imply the actor, and nothing else can tell us. Storing that boolean would be storing a guess. `via` + `by` is exactly what is knowable; any *"by me / by Claude"* framing is a **display** decision built from the two, and display is note-window's (its scrubber already owns showing attribution).

**`by` is advisory provenance, not authenticated identity** — a client claims it and we believe it. That is correct for a single-user local tool with no threat model, but it must be written down so nothing later is built to trust it.

**Rejected — an environment variable** carrying the actor's name: a subprocess-launched agent inherits the environment and would claim to be the user.

**Note the field syncs.** `via` and `by` ride on the version child record, so a client-supplied string propagates to every Mac and persists as long as the snapshot does.

*Addendum (2026-07-31, resolves review-004 F13).* The finding is that the original proposal assumed a write carries an identity, which nothing in the epic establishes — correct, and answered above: `via` is knowable from the connection and cannot be claimed, `by` is optional and self-reported, absent means unknown, and there is deliberately no `user | agent` field because it is not determinable.

**`by` is not the per-device key, and the two must not be conflated.** The device key identifies **a machine**; `by` claims **an actor**. Tying them would attribute a note edited on the Mac Mini to *"Mac Mini"* rather than to whoever — or whatever — wrote it, and would silently turn an advisory claim into a hardware fact. Different questions, different fields, no relationship.

#### Decision (2026-08-01) — engine-originated snapshots: attribution describes the work captured, never the trigger *(resolves review-005 F4)*

*"The channel the write arrived on"* gives the wrong answer the moment the engine takes a snapshot on its own initiative — and it takes three: the **dirty flush**, the **pre-restore** snapshot, and the **pre-resolution** snapshot in the conflict flow. Run the flush under the stated rule: your forty seconds of typing, an agent write lands, the engine flushes your paragraph into history — on the agent's connection. The scrubber shows your paragraph labelled `mcp`: the snapshot that exists to protect the human's work from the agent **credits it to the agent**. Pre-restore and pre-resolution are quieter — no arriving write at all, so their `via` was simply undefined.

> **A snapshot's `via`/`by` describe the work captured, never the event that triggered the capture.**

For every ordinary snapshot the two coincide — your blur captures your typing — which is why the ambiguity stayed invisible until the flush split them apart. Under this rule the flush credits the note's **last writer**; pre-restore and pre-resolution snapshots do the same, since they preserve someone's authored state.

**Rejected — a fourth channel value (`engine`).** Truthful and useless: it answers *"who took the photo"* when the scrubber is asking *"whose work is in it"*.

**Mechanics — last-write attribution becomes two synced fields on the note record** (`lastVia`, optional `lastBy`), updated on content writes, merged per-field like every other scalar (second write wins — correct: they describe the latest content write). Synced because the engine only knows the last writer *while running* and *on its own Mac* — for the rule to hold across a restart, and across Macs now that the dirty predicate lets Mac B flush work typed on Mac A, the attribution must ride with the note. Where it is genuinely unknowable (a note predating the fields), `via` falls back to the absent-means-unknown honesty `by` already has — never fabricated.

**Cost:** two more synced scalar fields riding along with content writes that already sync.

### Reopened (drained triage 2026-07-30) — retention default should be Forever, and purging must be lazy with an eligibility clock

*From: note-window · discussion · 2026-07-27.*

Two changes proposed to the settled retention model (`Off / 30 / 90 / 180 / 365 / Forever`, **default 90**).

**1. The default should be Forever, because retention is really asset garbage collection, not history policy.**

Snapshots are **markdown only** — assets are ref-counted and stored once, so versions don't duplicate them. The text is therefore negligible: 100 notes × 100 versions × a couple of KB is ~20MB, which never needs purging.

**The real cost is assets.** Under Forever, an asset is retained while *any* version references it — so every image ever pasted into any note lives forever, even after it's removed from the note. A heavy screenshot user accumulates real gigabytes, and because this syncs, it consumes **their iCloud quota**.

So the setting isn't "how long do we keep your history" (which sounds like discarding their work) — it's **"how much space should history use"**. That reframing argues for **Forever as the default**, with the setting retained as a *space lever* for the minority with heavy assets, rather than a policy everyone is silently subject to. Losing history by default, to reclaim space most users aren't consuming, is the wrong trade for a notes app.

*(Considered and rejected by the user: Time-Machine-style **thinning** — keeping every version recently, then daily, then weekly. More machinery, and versions still silently vanish.)*

**2. Purging must be lazy, and the grace clock must not be measured from a version's own age.**

The failure mode the user identified: retention is 90 days, a version is 80 days old (fine). The user shrinks retention to 30. That version is now *50 days past retention* — a naive "purge N days past retention" deletes it **immediately**, which is precisely the surprise the confirm was meant to prevent.

**Proposed algorithm — start the clock when a version becomes *eligible*, not from its age:**

```
eligible_since = max(createdAt + retention, retentionLastChangedAt)
purge when now > eligible_since + grace
```

- Shrinking retention makes a batch newly eligible, and they all start a **fresh grace period from now**, regardless of how old they are.
- **Increasing retention back within the grace window makes them ineligible again** and discards the clock — so "I shrank it, confirmed, then changed my mind five minutes later" loses nothing. This was an explicit user requirement.
- **Grace should be generous — 30 days proposed** — so a mistaken shrink stays recoverable for a month. The user's steer: *"quite tolerant… we shouldn't be aggressive with trimming."*

**Related, routed separately:** the **confirm** shown when shrinking retention (naming how many versions across how many fumis will be destroyed) → **management-window**, since the setting lives in its settings surface.

#### Decision (2026-07-31) — default **Forever**, with a lazy eligibility clock and a 30-day grace

**Both proposals accepted.** The reframe is what carries it: snapshots are markdown, so text is negligible (100 notes × 100 versions ≈ 20MB, which never needs purging). **Assets are the entire bill**, and they are ref-counted by version-links — so retention is **asset garbage collection wearing a history-policy label**. The setting is therefore not *"how long do we keep your history"* but **"how much space should history use"**.

*Concrete:* paste twenty screenshots a week; a year later most are deleted from the notes themselves, but each is still referenced by some older version — so each is still on **every** Mac (eager download) and still counting against iCloud quota.

**Default = Forever.** *(Was 90 days.)*

- **Rejected: default 90 days** — it silently discards history everyone keeps, to reclaim space most users are not consuming. Losing work by default is the wrong trade for a notes app.
- **The decider is that Forever's failure mode is already visible.** `quotaExceeded` was settled as *degrade with a persistent indicator, never silently* — so a screenshot-heavy user meets a signal and can reach for the lever *(and the store-size indicator, defined 2026-08-09, is the one that fires before exhaustion rather than at it)*. A 90-day default has **no equivalent signal**: history simply isn't there when you go looking.
- The setting survives as a **space lever for the minority**, not a policy everyone is silently subject to.
- *(Previously considered and rejected by the user: Time-Machine-style thinning — more machinery, and versions still vanish silently.)*

**Purging is lazy, and the clock starts at eligibility — not at a version's age.**

```
eligible_since = max(createdAt + retention, retentionLastChangedAt)
purge when now > eligible_since + grace
```

**Grace = 30 days.** The failure it prevents: retention is 90, a version is 80 days old, the user shrinks to 30 — that version is now *50 days past retention*, and a naive "purge N days past retention" destroys it immediately, which is precisely the surprise the confirm exists to prevent. Starting the clock at **eligibility** means a shrink makes a batch newly eligible and they all begin a **fresh grace period from now**, however old they are. **Raising retention back inside the window makes them ineligible again and discards the clock** — an explicit user requirement ("I shrank it, confirmed, then changed my mind five minutes later" must lose nothing). Generous by intent: *"quite tolerant… we shouldn't be aggressive with trimming."*

**The pair is coherent:** under a Forever default **nothing is ever eligible**, so the clock is **dormant for almost everyone**. It activates only for someone who deliberately shrank the window — exactly the person the change-my-mind protection is for.

**Related, routed:** the confirm shown when shrinking retention (naming how many versions across how many fumis will be destroyed) → **management-window**, where the setting lives.

#### Decision (2026-07-31) — purging never runs from stale state *(resolves review-004 F16)*

The eligibility clock was designed on one Mac and assumes conditions that only hold there: retention is **account-global**, purges **propagate as record deletions** (not local evictions), and eligibility is a **wall-clock computation each Mac runs independently**.

Three of the four sub-questions resolve cheaply:

- **Clock skew** — a non-issue. A 30-day grace absorbs any skew a Mac could plausibly carry.
- **Who purges** — **any Mac may.** Record deletions are idempotent and propagate, so several Macs computing the same eligibility and deleting the same records converge harmlessly. **Rejected: a designated purge owner** — the owner is precisely the Mac most likely to be shut in a drawer.
- **Offline across the shrink *and* the undo** — this is the whole finding, and it has an exact failure condition. A Mac that reconnects and **syncs settings first** sees retention restored and a fresh `retentionLastChangedAt`, finds nothing eligible, and purges nothing. It destroys history *only* if it sweeps against **stale local state** — the shrink it heard about, without the undo it didn't.

> **Never purge from stale state.** A purge sweep runs only after settings have reconciled with the sync authority; a Mac that cannot reach it does not purge at all.

Composes with the asset-GC decision, where collection is already a sweep on launch/idle rather than write-triggered — so the sweep has a natural point at which to gate on freshness.

#### Decision (2026-08-01) — "reconciled" defined, in two clauses *(resolves review-005 F14)*

Three destructive-adjacent sweeps now gate on the predicate — the purge above, asset GC's *"sweep only against reconciled state"*, and repair (the generalised reconcile-before-repair rule) — and it was never defined. Worse, under any remote-fetch reading it inverts for the **default configuration**: sync is default-OFF, so those Macs never reconcile and never purge — retention (*"how much space should history use"*) silently inert for exactly the users with no iCloud quota but the same finite disk. "No iCloud → no backup" was recorded; "no iCloud → no reclamation" never was, and is not intended. Defined from what the gate actually asks — *could this state have changed somewhere I haven't looked?*:

> **A store that has never had a sync relationship is always reconciled** — local state is total state; there is no elsewhere. Retention, GC, and repair work fully for sync-off users, whose finite disk is the point.
>
> **A store that has (or had) a sync relationship is reconciled per zone when a fetch has completed this engine session** — the zone's change token brought current, all inbound changes applied. Unreachable, stopped (the absent-zone state), or disabled-after-enabled all read as **not reconciled**: an authority exists whose changes this Mac may not have seen, so the destructive sweeps wait.

**Conservative edge, named:** a Mac whose user enabled sync and later turned it off keeps its history forever — retention goes inert on that machine, because the account may still contain other Macs racing shrinks and undos it can no longer see. The right side to err on (the absent-zone posture already errs this way), and visible rather than silent: the store-size indicator still shows history growing.

**Left open, and now the second thing to need it:** `retentionLastChangedAt` is **account-global settings** — not a note, not a note's child, not per-device. per-device-settings deliberately left that zone question open; this is the second item requiring the same answer.

### Reopened (drained triage 2026-07-30) — snapshots should record note geometry (revises "content-only")

*From: note-window · discussion · 2026-07-27.*

Surfaced while designing the **version-history browse UI**. This topic settled version snapshots as **content-only**. That should be revised: **a snapshot should also record the note's geometry (size) at the moment it was taken.**

**The problem it fixes.** A note that once held ten lines was sized to fit them. The user later deletes most of it and shrinks the note to two lines. Now they scrub back through history to that ten-line version — with content-only snapshots, it renders inside a two-line note as a cramped scroll box. History becomes hard to read at exactly the moment it matters, and restoring gives a **half-restored state**: the text is back, but the shape it lived in isn't. A snapshot is a record of *how the note was*, and its size was part of how it was.

**Why the obvious objection doesn't apply.** The concern was that this would fill history with noise and make restore resize windows unexpectedly. Both dissolve on a distinction that was being collapsed: **what *triggers* a snapshot and what a snapshot *records* are different things.**
- **The cadence is unchanged** — content-only, only-if-changed (plus the agent-write trigger above). **Resizing a note does not create a snapshot.** No new history noise.
- **Restore isn't a surprise**, because the geometry animates continuously as the user scrubs through versions — they watch the note grow back. It's visible, not a jump at the end.

**What's being asked of this topic:** add a geometry field to the snapshot model. Small, additive, and it doesn't touch the cadence, retention, ref-counting or restore-snapshots-first behaviour.

**Caveat to handle:** a snapshot taken on a 27" display may be larger than the screen it's previewed on. The recorded geometry must be **clamped to the current display** on preview/restore — animate toward the recorded size, bounded by what actually fits.

**note-model has since ruled on *what* a snapshot records** (see Synced Geometry Fields): the authored (Note-tier) `size`, never the resolved rect; `presetId` alongside it; restore writes both back to the note tier, preview writes nothing.

*(Scope note 2026-08-09 — the clamp caveat above is note-window's ask as it arrived, not as it stands. They amended it on 2026-08-06: a **bound** snapshot has its Size axis re-resolved against the current display rather than clamped, because the clamp never fires on a smaller screen and the preview then misrepresents what committing produces. Nothing this topic decided moves; see synced-geometry-fields.)*

---

## Per-Device Settings

### Context

*Rerouted from note-window (2026-07-29), extended by note-model (2026-07-30). Drained 2026-07-30.*

note-window settled the *policy* and needs the *mechanism* from here.

**What was decided there (reference — do not re-decide):** Fumi ships **ten fixed swatches** (a swatch = a whole role→colour set; there is no user authoring). A note stores a **role**, which lives on the note and **syncs normally**. The **active swatch** — which set renders those roles — is **machine-local**: *"the note is synced but its look and feel doesn't have to be"* (user). The role is the identity and syncs; the swatch is presentation and reasonably differs per Mac, the way macOS treats appearance itself. Viewing conditions are the supporting argument — a Studio Display in a bright office and a laptop in the dark are not the same instrument.

**The requirement:** machine-local **but still backed up**, so a reinstalled Mac gets its swatch back rather than silently reverting to the default. A local-only preference file fails this; a plain synced value fails the machine-local requirement.

**Proposed mechanism, for this topic to confirm or replace:** persist the pointer into the user's **private CloudKit database keyed by a stable per-device identifier**, so every Mac writes and reads its own record. Worth settling here because it is a **general shape, not a one-off** — anything else that is per-machine-but-should-survive-reinstall wants the same treatment, and note-window's swatch pointer just happens to be the first instance.

**Answer to question 4, from note-model (2026-07-30):** **yes — window and display state wants exactly this shape**, which tips this from one stored value into a small per-device-settings facility.

note-model has amended its state model from two buckets to **two axes, three tiers**. The old two-bucket test asked only *"does this travel between Macs?"*; the durability question — *"if this Mac is wiped, should it come back?"* — was never asked, and note-window's swatch pointer is the case that exposed it.

- **Bucket 1 — the note.** Travels + backed up; in the bundle.
- **Bucket 2 — the machine.** Per-machine, **backed up per-device**. Window coordinates (display-local), **home display**, home-Space, open/hidden visibility. *This is the tier the facility serves.*
- **Bucket 3 — derived.** Per-machine, genuinely disposable, rebuildable: resolved rect, title/preview caches, search index, z-order/last-active.

**Why position moved into the durable tier:** Fumi's premise is notes as furniture — they live in places. Losing every note's position on a reinstall means rebuilding the desktop by hand, which is the loss of the product's value on that machine rather than graceful degradation. The original *"precise coordinate restoration isn't worth engineering"* was a **cost** argument predating this facility; once it exists for the swatch pointer, the marginal cost of putting window state in it is small.

**Two consequences for the mechanism:**

1. **Volume is different from a swatch pointer.** This is per-note, not per-app — hundreds or thousands of rows per device, written on every move and resize, rather than one value changed rarely. Whether that is one per-device record holding a window-state blob, or a record per note per device, is this topic's call and the answer probably differs from the single-value case.
2. **`home-Space` is best-effort inside a durable tier.** macOS Spaces have no identity surviving an erase-and-reinstall, so it cannot actually be restored even though it sits in Bucket 2 by intent; it falls back to Space 1. Worth knowing so the mechanism isn't designed to guarantee something the OS denies.

**Also note:** *"Bucket 2 is never synced / disposable as a unit"* — quoted in this topic's read-model text — now describes **Bucket 3 only**. The data-mapping line *"Not synced: … all Bucket-2 window-state (machine-local, SQLite only)"* needs the same re-reading: still not *synced* between Macs, but no longer SQLite-only, since it must survive a wipe.

**Specific questions:**

1. **Is a stable per-device key actually available and durable** across OS upgrades, and what does it do on hardware replacement or a restored-from-backup Mac? (note-window accepts that a genuinely new Mac starts on the default — that is correct behaviour, not a failure — but the boundary should be known rather than assumed.)
2. **Does this belong in the same CloudKit container/zone as note data**, or a separate settings zone? Per-device records that fan out with device count have different lifecycle needs from note records.
3. **Is there a purge story for records belonging to a Mac the user no longer has?** Without one these accumulate silently forever.
4. **Does anything else already want this shape** — window/display state (answered: yes), the Light/Dark/System chrome flag, global opacity (note-window flags opacity as having no decided home at all)?

**Note the pointer must be a stable id, never a swatch name** — three of the ten swatches were renamed inside a single discussion session, so name-keying would have broken already.

*From: note-window · discussion · 2026-08-22*

note-window settled what the version panel's attribution row renders (`via` + `by`, no user-vs-agent field). Alongside it, the **conflict reconciler**'s row label was found to rest on a fact nothing produces. The spike fixed the label as **"This Mac · 11:26"** / **"MacBook Pro · 11:25"**, and no decision in any document says where *"MacBook Pro"* comes from.

**What the record model holds today.** The device key is the **hardware platform UUID** (`IOPlatformUUID`) — an identifier, not a name. This subtopic holds one record per device carrying *"that device's whole picture"*, with the property that **each device is the exclusive writer of its own record** and *"nobody queries another Mac's layout."* Nothing anywhere carries a human-readable device name.

**The ask.** Add the device's own display name to the per-device record — one field, written and refreshed by the only Mac that can know it.

**The source is free and already the platform's answer**, measured on the user's Mac while this was discussed:

```
scutil --get ComputerName   → Lee’s MacBook Pro
scutil --get LocalHostName  → Lees-MacBook-Pro
hostname                    → Lees-MacBook-Pro.local
```

*(Re-run 2026-08-23 — same three values, apostrophe included: `ComputerName` carries the typed apostrophe `’`, the other two carry the ASCII-slugged form. The slug is not merely hyphenated, it is transliterated, which is the second reason not to render it.)*

**ComputerName**, not the hostname — the hostname is the Bonjour-derived slug, machine-shaped and hyphenated. ComputerName is what the user sets in System Settings → General → About → Name, and what every other Mac already shows them in AirDrop and Finder's sidebar. Readable from a non-sandboxed app with no permission (SystemConfiguration's `SCDynamicStoreCopyComputerName`; `Host.current().localizedName` is the Foundation shortcut), and the dynamic store publishes changes, so a rename is observable rather than needing a relaunch. *(Confidence: high on the value; the exact call and the change-observation mechanism are a build detail worth a small check, the same posture as the `IOPlatformUUID` note.)*

**Why this record rather than stamping the name onto each write.** note-window decided the name is **resolved at display time from the device record, never stamped on the version** — the same shape as this epic's *"a home is intent; where a note sits is resolution; fallbacks resolve but never rewrite."* Store the key, resolve the presentation. The user's stated expectation is that renaming the Mac renames it in Fumi, and resolution gives that for free, including on rows written a year ago; stamping would leave history full of a name they no longer use.

**Two properties of the per-device record make it the natural home**, both already decided here: its owner is its **exclusive writer**, so a name written there can never conflict or need merging; and it already **refreshes `lastSeenAt` whenever that Mac syncs**, so the name rides an existing write rather than adding a trigger.

**One thing this does change:** *"nobody queries another Mac's layout"* stops being true of the whole record. The **name** is read cross-device, by design. The layout map is not, and nothing here asks it to be.

**Sync-off and no-iCloud users** never see another Mac's name because they have no other Mac's record — which is exactly the degradation note-window designed for. Where the name cannot be resolved — no device record, never synced, purged, or an unreadable ComputerName — the reconciler row falls back to **"Another Mac"**, a complete and honest label on its own. Device identity shows in the **reconciler only**, not in version history, where the timestamp answers *when* and the attribution row answers *who*.

*From: onboarding-and-permissions · research · 2026-09-15*

Queue entry `002-storage-facts-the-first-run-flow-must-sequence-around`, delivered from this topic to `onboarding-and-permissions` on 2026-08-04, has been worked. Its three facts are absorbed and the first-run flow is being designed around them. One internal inconsistency surfaced while doing so, and it belongs back here rather than being quietly worked around.

**The two statements.** Under fact 2, the case for encouraging sync at onboarding is given two legs, the second added deliberately once durable per-device state landed:

> "not merely *your notes are backed up*, but **'your notes and your desk come back'**. Window placement — every note's position, home display, home-Space, visible/hidden, and last-opened — is durable per-machine state backed up to a per-device CloudKit record. With sync off there is no authority to back it up to, so a wipe loses the desk as well as the notes."

Under fact 3, describing what a sync-off user still has:

> "Time Machine remains the fallback for a same-Mac wipe-and-restore (the store and the per-device blob both live in Application Support, which Time Machine captures), and it is the only backup leg a sync-off user has."

**They cannot both be right.** If Time Machine captures the per-device blob, then a sync-off user who restores the same Mac from Time Machine recovers the desk along with the notes. "A wipe loses the desk as well as the notes" is then false for any user with Time Machine running — which is most users who would care about the argument in the first place.

What sync actually buys, stated without overreach: a second Mac, and a backup leg that is not Time Machine. Both are real and worth saying. Neither is "you lose your desk."

**Why this matters beyond tidiness.** The desk argument was written to be used — it is the encouragement copy onboarding would draw on. `onboarding-and-permissions` has since settled its framing stance with the user:

> **Recommend sync. Frame it on what sync gives. Do not dramatise what declining costs.**

The user was explicit: *"we don't need to dramatise the negative choice by the user... erring on positive to frame it in a positive way to encourage it, but not negativize it."* The desk-loss line fails that on both counts — it is loss-framed, and it overstates. The same material works as a positive: *your notes and your desk follow you to every Mac.* That is true, it needs no Time Machine caveat, and it encourages without threatening.

**What is asked of you:** reconcile the two statements. Either the per-device blob is not in fact recoverable from Time Machine in the way fact 3 describes — in which case fact 3 is the one that needs correcting, and the consequence is larger than this — or the desk-loss framing of the encouragement leg should be withdrawn and restated as a positive. Onboarding has taken the second reading for its own copy, but which of the two facts is wrong is yours to settle.

*Unchanged and not in question: the toggle ships default-off, onboarding is where enabling is encouraged, and the encouragement itself. `onboarding-and-permissions` adopted all three.*

### Decision (2026-07-30)

**Naming first, because it misleads:** this is not a *settings* facility. It is a **durability class** — data that is per-machine **and** must survive a wipe. Two unlike things share it: a handful of app-level values (active swatch pointer, chrome Light/Dark/System, global opacity) and, far bigger, **every note's placement on this Mac** (position, home display, home-Space, visible/hidden). The second is per-*note* data that is not *note* data — it never travels; it is this machine's view of the notes. The swatch pointer was simply the first instance and gave the tier its misleading name.

*(Clarifying a confusion worth recording: the **role/token** a note carries is Bucket 1 and syncs. The **swatch** — which of the ten role→colour sets renders those roles — is the machine-local value. Role travels, presentation doesn't.)*

#### Shape — one record per device, holding that device's whole picture (chosen)

**Options weighed:**

- **A. A record per `{note, device}` pair** — mirrors the note-record model. Three Macs × 1,000 notes = **3,000 records**, each rewritten whenever a note is nudged. Rejected.
- **B. One record per device (chosen)** — the app-level values plus a `noteId → {position, display, space, visible, lastOpened}` map, serialized, rewritten whole on a debounce. **Three records total.** *(Map scoped 2026-07-31 — entries only for notes with placement state on this Mac; see the blob-ceiling decision below. `lastOpened` added 2026-08-02 — the durable tier gaining the slot note-model's Machine-tier classification requires; see sync-safety's `window_state` re-partition.)*

**Why B, beyond the obvious count argument.** Per-device records have a property note records don't: **each device is the exclusive writer of its own record.** No other Mac ever writes it, so there is no conflict, no ancestor comparison, no merge policy — *none* of the machinery settled in synced-geometry-fields applies here, by construction. The standard objection to a blob is that it can't merge; here nothing ever needs to. Nobody queries another Mac's layout, so the per-note addressability A buys is addressability no reader wants. *(Amended 2026-08-23 — narrowed, not withdrawn: the record gained a display-name field that other Macs **do** read. The **layout** stays unread cross-device, so this argument for B is untouched. See the 2026-08-23 decision below.)*

**Nothing lands in the bundle.** A was never "put it in the bundle and it comes along" — the bundle is the *travels* tier, so machine-local state in it would sync everywhere, the exact inverse of the requirement. And under CloudKit the bundle is local truth that syncs **nothing** by itself (the correction version-history already absorbed): every synced thing is an explicit record we map and push. So A would have meant deliberately tracking, queueing and reconciling 3,000 records to represent data no one queries per note.

**Purging is a delete of one record**, not a sweep of thousands — which is what makes the purge story below trivial rather than a migration.

#### Device key (answers question 1)

The **hardware platform UUID** (`IOPlatformUUID` via IOKit — reachable because Fumi is deliberately non-sandboxed). It survives OS upgrades and a wipe-and-reinstall, which is precisely the case the facility exists for, and resets on new hardware — which note-window already accepts as correct.

**Accepted limit:** a Time Machine restore onto **replacement** hardware gets a new UUID, so the machine that feels most like "the same Mac" starts on defaults. Named rather than discovered later. *(Confidence: moderate on the API specifics — worth a small spike before build.)*

A locally-generated UUID was rejected outright: it lives in the local store, so a wipe destroys it and the Mac returns as a stranger — the exact failure being designed against.

#### Purge (answers question 3)

Each record carries **`lastSeenAt`**, refreshed whenever that Mac syncs. Stale devices are **listed for the user to remove** (storage ours, UI management-window's) — **not auto-deleted.** Deleting someone's desk layout because a Mac sat in a drawer for a year is the wrong default, and the cost of keeping it is one small record per Mac ever owned. Bounded, so laziness is affordable.

#### No-iCloud degradation

The facility's justification is *"machine-local but backed up"*, and with sync off there is no authority to back up to — so window layout is **not durable** for those users. This is folded into the existing **"no iCloud → no backup"** line rather than special-cased: no backup is no backup, and no mechanism works around its absence. ~~It becomes another thing onboarding leans on when encouraging sync (*your notes and your desk come back*).~~ *(Struck 2026-09-15 — the caveat below is not a footnote to "not durable", it contradicts it for anyone running Time Machine, and the encouragement built on top of the unqualified phrasing was exported to onboarding and used. Read the two together: **without sync, window layout is durable exactly as far as Time Machine reaches** — a same-Mac wipe-and-restore, and replacement hardware too, since the blob is the local authority and its map is keyed by note rather than by machine. See the 2026-09-15 decision at the end of this subtopic.)*

**One real caveat, and it is actionable.** The backup posture already counts **Time Machine**, which does cover a wipe-and-restore on the *same* Mac — including the per-device blob, since it lives in Application Support. That fallback only holds if the durable per-device state is stored where Time Machine actually captures it and is kept **distinguishable from the disposable SQLite index**. Placing the blob next to a throwaway cache — or anywhere conventionally excluded from backups — would silently destroy the only fallback a no-iCloud user has. Cheap now, invisible bug later.

#### Mechanics

Writes are **debounced**; the blob is rewritten whole. The **local copy is authoritative**; the CloudKit record is its backup, read at first launch on a restored machine and otherwise write-only from that Mac's perspective.

##### Decision (2026-08-02) — the blob debounce is a local-write coalescer, not a transport knob *(resolves review-006 F3)*

The upload-enqueue decision states *"every durable local write enqueues"* and explicitly **rejects** a dedicated enqueue-debounce as *"a second knob doing what the engine's dedup and scheduler already do"* — while this section has debounced writes as its whole shape. Read flat, those contradict. They don't, because they govern different layers, and the distinction is worth stating since `lastOpened` now exercises it constantly:

> **The debounce coalesces rewrites of the blob *file*; the enqueue rule governs what happens *after* a file write.** Once the blob is written it enqueues exactly like any other durable local write, and `CKSyncEngine`'s scheduler owns the wire timing from there. Nothing here second-guesses the transport.

The reason the enqueue decision rejected a debounce does not apply: enqueue is an idempotent marker over a deduped pending set, so debouncing it buys nothing. A blob rewrite is not a marker — it is serializing and rewriting the whole map, which genuinely should not happen once per pixel of a drag.

**Magnitude, matching the instrument it most resembles:** a quiet period of **seconds — ~5 s, tuned in build**, the same order as version-history's burst settle window and for the same reason (collapse a burst of related activity into one operation). Deliberately not the idle trigger's ~1 min: a user who drags a note and immediately quits should not lose the move. `lastOpened` is the one field free to ride a **longer lazy flush** rather than arming a rewrite of its own — it is a sort axis where hours of lag is invisible, so it folds into blob writes happening anyway.

This bounds the cost deep-dive-001 quantified: the amplification multiplier is the number of blob writes, and the debounce is what sets it.

#### Decision (2026-07-31) — the authority chain drawn; the blob is a real file *(resolves review-005 F2)*

The review caught this section and the three-category invariant (sync-safety) asserting opposite authorities for the same data, decided a day apart: the invariant filed durable per-machine window state under **Cache** — *"authority is remote… rebuilt by re-fetching from the sync authority"* — while Mechanics above says *"the local copy is authoritative; the CloudKit record is its backup."* Not stale prose — two architectures. The concrete fork: after a SQLite corruption-and-rebuild on a running Mac, does the engine adopt the settings-zone copy (a debounced backup, possibly missing the last minute of nudges)? And what does a no-iCloud user — who has no settings zone — rebuild placement from at all? If the answer is "nothing", a corruption rebuild loses every note's position: the exact rebuild-the-desk-by-hand failure the durable tier was created to prevent.

**Local-copy-authoritative wins, made concrete:**

> - **The per-device blob is a real file** in Application Support, outside SQLite, where Time Machine captures it. This is the landing site the no-iCloud caveat above required — *"stored apart from the disposable SQLite index"* — but never placed. The blob file is the authority.
> - **The settings-zone document is that file's backup** — read once, at first launch on a restored machine; otherwise write-only from this Mac's perspective (unchanged).
> - **SQLite's window-state columns are Derived** — re-read from the blob on rebuild, never from the zone. The invariant's Cache tier keeps only change tokens and tombstones, state whose authority genuinely is remote.

Why this way round: it is the only version that works with sync off — a rebuild re-reads the local blob identically with or without iCloud — and the remote copy is by construction staler than the local truth a rebuild just lost. Cost: one more on-disk artifact in Application Support; its exact placement belongs to the still-open Application Support layout question.

Old sites corrected in place: the invariant's Cache/Derived lists, the rebuild-recovery correction, the `window_state` re-partition bullet, and read-model-index's schema parenthetical.

##### Decision (2026-08-02) — the blob is written atomically, and a corrupt one is a second legitimate read of the zone *(resolves review-006 F4)*

Making the blob the sole authority for the desk gave it the one property this document is otherwise rigorous about protecting, and then said nothing about protecting it. `meta.json` mandates *"atomic writes (temp-file + rename) so folder-sync can never catch a torn state file mid-write"*; a truncated sidecar has a defined outcome; and the Application Support layout decision rejected a separate `CKSyncEngine` state file partly because it *"adds an artifact whose own corruption is a new failure mode"*. The blob is exactly such an artifact, is now rewritten on *viewing* as well as arranging, and had neither guarantee.

> **The blob is written atomically — temp file plus rename, the same rule as `meta.json`** — so a crash mid-write leaves the previous blob intact rather than a truncated one. No new mechanism; the discipline already exists for the sidecar and the reason is identical.

> **An unreadable blob is a lost local authority, not a lost desk.** Recovery in order: **(1)** the settings-zone document, if this account has one — **the second legitimate read of the zone**, alongside first-launch-on-restore. **(2)** With no zone (sync-off, or unreachable), placement falls back to defaults: cascade-render and the Space-1 fallback, exactly as a fresh machine. Never a silent overwrite of the zone copy from an empty local state — the corrupt file is discarded, and the zone's copy is the better authority precisely because the local one just failed.

**Why the second read doesn't reopen the authority question.** *"Read once, at first launch on a restored machine"* was written to stop the engine preferring a debounced backup over fresher local truth. When the local file is unreadable there is no fresher truth to prefer — the ordering is unchanged, the case simply wasn't enumerated.

**Cost, named:** a sync-off user whose blob corrupts rebuilds the desk by hand — the failure the durable tier exists to prevent, arriving through the one door it cannot close. That is the same shape as *"no iCloud → no backup"* rather than a new gap, and Time Machine remains their fallback since the blob lives where it is captured. Atomic writes are what make it improbable; the zone is what makes it recoverable for everyone else.

#### Display identity (2026-07-31) — UUID, with a main-display fallback that is needed regardless *(resolves review-004 F15)*

The device key was interrogated carefully; **display** identity was never asked about — and now needs answering, because home-display sits in the durable tier, position is stored display-local, and a preset can bind the display axis.

The failure it prevents: *wipe the Studio, reinstall, restore. Per-device state returns saying note X sits at 200,400 **on the second display**. Which physical screen is that?* Without an answer, restoring a layout puts notes on the wrong screens, or nowhere.

> **Key on the display UUID. On any failure to resolve it — absent, replaced, unrecognised — fall back to the main display.**

**Options weighed:**

- **Display UUID (chosen)** — macOS exposes one per display; survives rearrangement, which is the common case. Does not survive swapping a monitor for an identical replacement, and never survives a new machine.
- **A descriptor** (resolution + model + arrangement position) — fuzzier, but a same-model replacement would match. Rejected as the primary key: it invites confident *wrong* matches, and the failure mode of a wrong match (notes on the wrong screen) is worse than the fallback.
- **Don't identify at all** — always place on the main display. Rejected: it discards durable layout on multi-display Macs, which is most of the point.

**The fallback is not a consolation prize — it is required whatever we key on**, because a display can simply be absent at launch (laptop undocked, monitor off). So the UUID is an optimisation over a fallback that must exist regardless, which is what makes it safe to choose a key that sometimes fails.

Same shape as the Space rule (a vanished Space falls back to Space 1), and the same honesty: **display identity is best-effort inside a durable tier**, exactly as `home-Space` already is.

#### Addendum (2026-07-31) — durability without a sync authority *(resolves review-004 F6)*

Already answered by the no-iCloud degradation decision above, with one clause it raises that was not: **the argument that moved position into the durable tier assumed this facility exists.** note-model's reasoning was that *"once it exists for the swatch pointer, the marginal cost of putting window state in it is small"* — but a default-off user has no facility at all, so window state is durable in principle and disposable in practice for the majority, on first run.

**This does not reverse the tiering.** A user with no sync authority has no backup of anything, and window state is no worse off than the note content beside it. The tier says **where this state belongs when an authority exists**, not that one is promised. Same posture as *"no iCloud → no backup"*, applied consistently rather than special-cased.

~~What it does add is a second concrete argument for onboarding to lean on when encouraging sync: not merely *your notes are backed up* but **your desk comes back**.~~

*(**Struck 2026-09-15.** This is the sentence that exported the desk-loss argument, and it is wrong three ways — false for anyone running Time Machine, unable to be restated as *follows you to every Mac* because each Mac keeps its own desk by design, and beaten by Time Machine outright on replacement hardware. **The tiering argument above is untouched** — it never depended on this; the addendum reached for a second use of its own conclusion on the way past. What sync adds for the desk is narrow and stated as such in the 2026-09-15 decision at the end of this subtopic: a user with no Time Machine, and recovery when the blob file itself is unreadable.)*

**Question 2 (same zone as note data, or a separate one) is answered below** — see the keyed-document decision, which settles it for all three pieces of non-note state at once.

### Decision (2026-07-31) — a keyed-document primitive on the seam, and a separate settings zone *(resolves review-004 F4)*

The decided data mapping is note-shaped throughout — one `CKRecord` per note, with assets, version snapshots and conflict candidates as its children — and so is the driver seam: `enqueueLocalChange(noteID)`, `apply(remoteChange)`, `resolveConflict(...)`, `accountState`. **Three separately-decided things now need to sync and none is a note or a note's child:**

1. **Account-global retention** (version-history: *"one account-level setting and a purge propagates"*) plus `retentionLastChangedAt`.
2. **The preset library** — synced-geometry-fields requires it, or a `presetId` dangles on arrival. note-model placed it at account level and handed the physical home here.
3. **Per-device settings** — the record-per-device decided above: per-account, but not per-note.

Each was settled with "the zone question is left open". Three decisions were therefore resting on an unbuilt foundation.

#### The seam gains one primitive, not three

> **`enqueueDocument(scope, key)` / `applyDocument(scope, key, payload)`**, where `scope` is `account` or `device`.

All three clients use it: retention and the preset library are **account**-scoped documents; per-device settings are **device**-scoped, keyed by the platform UUID. The CloudKit driver maps documents to records; a future folder driver maps them to files. **No CloudKit type reaches the core** — the stated discipline holds, and the folder driver inherits an obvious implementation instead of a hole.

Rejected: **writing per-device records directly against CloudKit**, outside the protocol. It is a second sync channel, it leaks CloudKit into the core, and it leaves the folder driver with nothing.

#### A separate settings zone — the argument is traffic, not tidiness

Custom zones are the conventional home for synced app data in CloudKit, and they carry **per-zone change tokens** — which is precisely what mixing these would entangle.

**Per-device state is high-frequency and irrelevant to every other Mac**; note data is low-frequency and relevant to all. Share a zone and dragging notes around on one Mac bumps the note zone's token, so every other Mac wakes, fetches, and finds only a device record it ignores. Separate zones decouple the traffic.

**Account and device documents share the one settings zone.** It is small, and generous debouncing on device writes (a quiet period, or on blur — never per drag) keeps churn low enough that a third zone would be over-building. If device churn proves noisy in practice, splitting it out is contained precisely *because* it sits behind the seam. *(The blob-ceiling decision below records the deep-dive numbers this deferral was waiting for.)*

**Confidence:** high on the shape — the seam addition and the zone split are ordinary CloudKit structure. Lower on multi-zone `CKSyncEngine` ergonomics, which folds into the spike already flagged for the platform UUID rather than being assumed.

#### Decision (2026-07-31) — account-scope merge rule: per key, against the ancestor *(resolves review-005 F7)*

The device scope's exemption from conflict machinery is by construction — exclusive writer. The account scope has no such property: **every Mac writes retention and the preset library**, and no merge rule was stated for either. Whole-blob last-write-wins silently drops a preset authored on another Mac (rename "Reading corner" on the Studio while the MacBook authors "Meeting sidebar"; the second push erases the first — no conflict, no trace). Retention is sharper: `retentionLastChangedAt` feeds a purge that destroys history, and *"never purge from stale state"* gates **when** a purge runs, not **which setting wins the race**.

> **Account-scoped documents are keyed structures that merge per key against the ancestor — never whole-blob.** Each key follows the scalar rules already decided for note fields: second write wins per key; absent in the ancestor means no opinion.

- **Preset library** — the key is the preset's **stable id** (name-keying was ruled out long ago: three swatches were renamed in one sitting). Concurrent rename-here / add-there touch different keys and both survive. A genuine same-preset race takes the second write — visible annoyance, not silent loss.
- **Retention** — the value and `retentionLastChangedAt` travel as **one key**, so the purge gate always sees a coherent pair.

**Cost, named:** the account scope buys back part of the machinery the device scope opted out of — the primitive grows an ancestor comparison and a per-key merge path for account documents only. *"Documents are simpler than notes"* now holds for one scope, not both.

#### Decision (2026-08-02) — a removed key is a tombstoned key; preset deletion must survive a stale writer *(resolves review-006 F5)*

The rule above defines an *added* key, a *changed* key, and an ancestor-absent key. It never defines a key **present in the ancestor and absent on one side** — which is how a deletion looks. That was survivable while the preset-delete cascade existed as a second signal; after the cascade was struck earlier today, *"deleting a preset touches the preset library and nothing else"*, so **key removal in this document is the entire deletion mechanism**.

Left undefined, the naive merge resurrects: an offline Mac reconnects and pushes a library that still contains the key, the key is present on one side and absent on the other, and nothing distinguishes *deleted* from *not yet seen*.

**And the resurrection is loud rather than harmless, because of the strike's own reasoning.** Dangling bindings self-heal — *"when the settings zone catches up, the preset applies again"* — so a resurrected preset does not merely reappear in a library nobody is looking at: every note that had been rendering plain authored geometry **re-binds and changes shape**, from no user act anywhere. The property that made dangling safe is what makes an accidental revival visible across the desk.

> **A deleted preset's key is retained with a deleted marker, not removed.** It merges per key like any other — second write wins — so a stale writer pushing the live version loses to the marker rather than beating an absence.

**Sibling check: management-window — its decided preset-editor behaviour is "no cascade, no rewriting of note records, no 'N notes use this preset' prompt", which this leaves untouched: the marker is internal to the library document and the editor still deletes by a single gesture.**

**Which precedent, and why this one.** The document has settled this question twice in opposite directions, each time for a stated reason:

- **Notes get a tombstone** — *"precisely to prevent resurrection"*; a deleted note returning is the failure.
- **Assets get none** — *"resurrection is the **correct** outcome"* for something a live reference still needs.

**Presets take the notes side.** An asset is resurrected *because something still points at it* — the reference is the evidence that the deletion was wrong. A preset's dangling references are not evidence of anything: they persist by design, forever, precisely so that a legitimate return can re-bind them. So the asset rule's self-correcting logic has no analogue here, and its outcome — silent revival — is the thing to prevent.

**Cheapest possible form, deliberately.** A marked key reuses the per-key merge with no new primitive, no second channel, and no tombstone TTL machinery: the library is small and bounded by what a user authors, so markers accumulate at a rate that never matters. **Rejected: a separate deletion set** — a second structure to keep in step with the one it describes.

**Costs, named:** preset ids accumulate as markers rather than vanishing (trivial at library scale), and **re-creating a deleted preset mints a new id rather than reviving the old one** — consistent with the same-name ruling recorded earlier today in synced-geometry-fields: a same-named preset is a different preset, and old dangling bindings correctly do not attach to it.

### Decision (2026-07-31) — the blob checked against the record ceiling; the map scoped to placed notes *(resolves review-005 F12; deep-dive-001)*

Shape B was chosen on record *count* and never checked against CloudKit's per-record *size* limit — this document's own habit with ceilings (the 50 MB `CKAsset` limit generated the entire large-asset policy) applied everywhere but here. A deep-dive established the numbers, commissioned instead of folding the question into the pre-build spike: the limit is a documented constant, not emergent runtime behaviour, so it is researchable without code.

**What the research established** (deep-dive-001, 2026-07-31):

- **The limit is 1 MB per record — current documented Apple fact**, stated in the live `CKRecord` reference. Assets are excluded; **no per-field limit exists**, so splitting the map across fields buys nothing.
- **Computed envelope:** naive `Codable` JSON ≈ 168 B/entry → **~168 KB at 1,000 notes (16% of 1 MiB)**, crossing at **~6,250 notes**; binary plist moves the crossing to ~15,800, gzip to ~37,000 (nearly half the naive payload is two UUID strings with a handful of distinct values). Crossings ±20% — Apple never disambiguates MB vs MiB nor defines what counts toward the limit, and nothing was validated against a live container.
- **The sharper cost is amplification, not the ceiling.** CloudKit has no intra-field delta — the finest addressable unit is a whole field value — so every debounce window uploads the entire map (~1,000× amplification at 1,000 notes; ~3.4 MB up on a heavy layout day). And because `CKSyncEngine` has no `desiredKeys` and account + device documents share the settings zone, **every other Mac fetches the full blob and discards it** — the wake-fetch-ignore pattern the zone split was created to kill, one level down. (Inference from two documented facts; not observed.)
- **The ceiling's failure mode is soft.** An oversized save is rejected — the *backup leg* degrades while the local blob file stays authoritative. The desk never breaks; degrade-never-destroy covers the cliff.

#### Shape B stands, and the map is scoped

> **The map holds an entry per note with placement state on this Mac** — notes actually opened and arranged there — never per stored note. An agent-created note never opened as a window has no entry. Entries **survive soft-delete** (restore from Recently Deleted puts the note back *where it was* — the furniture premise) and are **pruned by the hard-delete cascade**, like everything else it prunes.

The scope is what closes the ceiling structurally rather than deferring it: the store may hold thousands (agents writing via CLI place nothing), but the map is bounded by what a human physically arranges on screens — nobody owns 6,000 chairs. The 16%-at-1,000-notes figure becomes the pathological case, not the expected one.

Two cheap commitments baked in now:

- **The document field is `Bytes` from day one, never `String`** — the 2.5–6× encoding hatches stay available post-launch without a schema change.
- The crossing numbers above are dated, so the assumption is checkable rather than folklore.

#### `CKAsset` spill — named as the hatch, deliberately not taken

It raises the ceiling to 50 MB and is Core Data's own documented pattern. As a default it is worse, not safer: every save becomes record-write **plus a separate file upload** (temp file on disk, upload token, more round trips); fetched asset bytes land in a staging area macOS reclaims and must be copied out immediately — new failure surface on the restore path, the path that must never be flaky; and **amplification is unchanged** — assets have no delta either. Paying that per save to insure a soft-failure ceiling the scope already bounds is the wrong trade. Adopting it later is a CloudKit-driver-internal change behind the seam — this deferral does not get more expensive with time.

#### The third-zone deferral gets its awaited input

The zone decision deferred splitting device documents out (*"if device churn proves noisy in practice"*). The deep-dive quantified the noise — other Macs re-download the full device blob each debounce window. Still deferred: the placed-notes scope shrinks the blob and the debounce bounds frequency. But the revisit trigger is now concrete rather than vibes: **if device churn is noticeable in practice, device documents move to their own zone** — contained behind the seam, as the deferral said.

### Decision (2026-08-23) — the device record carries its own display name, and the no-cross-read property narrows to exclude it

*Trigger: triage from note-window: "The per-device record should carry that Mac's ComputerName, so another Mac can name it" — the conflict reconciler's row label was pinned as a real device name, and nothing in the model produces one.*

**The device document gains one field: the Mac's own `ComputerName`**, read from SystemConfiguration and refreshed on the same write that already refreshes `lastSeenAt`. No new trigger, no new record, no merge path — the exclusive-writer property means a field only its owner writes can never conflict.

**`ComputerName`, not the hostname.** `LocalHostName`/`hostname` are the Bonjour-derived slug (`Lees-MacBook-Pro`); `ComputerName` is the name the user typed in System Settings and the one AirDrop and Finder's sidebar already show them (`Lee's MacBook Pro`). Picking the slug would render a name the user never chose and doesn't recognise as theirs.

**Resolved at display, never stamped.** A reader holds a device key and looks the name up; nothing writes a name onto a version or a conflict candidate. This is the same shape as *a home is intent; where a note sits is resolution* and as role-versus-swatch: store the identity, resolve the presentation. It buys the behaviour the user expects for free — rename the Mac and every row renames, including rows written a year ago. Stamping would freeze history full of a name they've abandoned, and would have to be migrated to undo.

**The property this narrows, stated exactly.** *"Nobody queries another Mac's layout"* was load-bearing in choosing a blob over per-note records — the addressability option A bought was addressability no reader wanted. That argument survives intact and is deliberately not reopened: **the layout map remains unread cross-device.** What narrows is the sentence's scope, from the record to the record minus one field:

> Each device is the exclusive writer of its own record. Every field is written only by its owner. **The display name is the one field other devices read**; the layout map, the swatch pointer and the chrome values are never read by another Mac.

Recorded as a narrowing rather than left to erode, because the blob-versus-records decision rests on it and a future reader needs to know which half still holds.

**Cost, named.** A reader now needs the other device's document to render a name — one small fetch from the settings zone, which the reconciler already has cause to touch. Where it isn't there (never synced, purged, sync off, unreadable name) the row reads **"Another Mac"**, which note-window already designed and which is honest on its own. That fallback is what keeps this non-load-bearing: refusing it would have cost the names, not the reconciler.

**Sibling check: note-window — its decided reconciler text renders real device names on both sides with `CURRENT` marking which you keep, and its Open Threads already record this field and the conflict-candidate device key as pending here, with "Another Mac" standing until they land. This satisfies that expectation rather than contradicting it; nothing there needs revising.**

**Confidence:** high on the shape and the value. Moderate on the exact API surface — `SCDynamicStoreCopyComputerName` and its change notification are a build-time check, the same posture already taken on `IOPlatformUUID`.

### Decision (2026-09-15) — the Time Machine fact stands; the desk leg is withdrawn rather than restated

**Sibling check: onboarding-and-permissions — its research records the framing stance as settled (*recommend sync, frame it on what sync gives, do not dramatise what declining costs*), and records the desk material as surviving in positive form, *"your notes and your desk follow you to every Mac"*. The stance is adopted, not re-decided, and this decision follows it. The surviving positive is contradicted — it is false on this topic's own per-device mechanism — and was rerouted back to them the same day, research-side, since their research document is what records it. Their toggle default-off, onboarding-encourages, and no-iCloud-no-backup positions are untouched.**

**Fact 3 is right and fact 2's second leg is the error.** Measured rather than assumed, since the concern flagged that correcting fact 3 instead would be the larger consequence: `tmutil isexcluded ~/Library/Application\ Support` → `[Included]` (and `tmutil isexcluded ~/Library/Caches` → `[Excluded]`, which is the contrast the blob's placement was chosen against). Time Machine captures the per-device blob; that is not a convenience claim, it is a constraint this topic imposed on itself — the blob was placed in Application Support, apart from the disposable index, *specifically* so Time Machine would capture it distinguishably, and the no-iCloud caveat that demanded it is still in force. Correcting fact 3 instead would unpick the blob's placement, the authority chain and the corrupt-blob recovery path; nothing supports doing that, and the concern's own framing anticipated the consequence would be larger.

**Three things are wrong with the desk leg, and only the first was reported.**

- **It is false with Time Machine running.** The reported half: a sync-off user restoring the same Mac gets the desk back with the notes.
- **The desk does not travel, so it cannot be framed as following you.** This is the half onboarding's proposed replacement gets wrong. **Each Mac keeps its own desk, deliberately** — placement is per-device state and no Mac reads another Mac's layout; that property is *why* Shape B was chosen over per-note records, and the display name is the single narrow exception recorded against it in 2026-08-23. The settings-zone copy exists for a **restored** machine, read once at its first launch, not for a second one.
- **On replacement hardware, sync is the weaker leg of the two.** The device key is the hardware platform UUID and a restore onto replacement hardware *"starts on defaults"* — already recorded here. Time Machine has no such limit: the blob file is the local authority and its map is keyed by note, not by machine, so restoring it brings the desk back on new hardware. The leg written to argue *sync saves your desk* loses to Time Machine in the scenario a user most fears.

> **What sync adds for the desk is narrow and is now stated as such: it covers a user with no Time Machine, and it is the recovery source when the blob file itself is unreadable.** Both are real; neither is encouragement copy.

**The leg is withdrawn from the encouragement, not restated.** Three carve-outs on one line — true only without Time Machine, does not travel, loses on replacement hardware — is three too many for first-run copy, and each one would have to be either said or silently relied on. The notes leg needs no footnote and carries the recommendation alone.

**Why this got written in the first place, recorded because the shape recurs.** The addendum that produced it was arguing a *tiering* question — window state belongs in the durable tier — and reached for a second use of the argument on the way past: if the tier needs a sync authority, onboarding gains a reason to encourage sync. That inference was sound about the tier and wrong about the user, because the tier's fallback leg (Time Machine) was decided in a different subtopic and never brought into the same sentence. **A decision that hands another topic a ready-made argument is making a claim on that topic's behalf, and it is not held to the standard the decision itself was held to.** The two facts sat four paragraphs apart in this document for six weeks and were only put side by side by the topic that tried to use them.

**Nothing in the mechanism moves.** The tier, the blob, the authority chain, the device key, the purge, the display name, the debounce and the corrupt-blob recovery are all exactly as decided. What changed is one argument this topic exported.


---

## Synced Geometry Fields

### Context

*Rerouted from note-model (2026-07-30), plus its same-day correction. Drained 2026-07-30.*

> **Field names in the drained material below predate the per-layer casing rule** and are reproduced as they arrived. Canonical names are in the decision at the end of this section: `size`, `presetId`, `floatOnTop` on the sidecar and record; `preset_id`, `float_on_top` as SQLite columns.

note-model ruled on a question rerouted to it from note-window — *is a note's size intrinsic or machine-local?* — and the answer **overturns a decision this topic has already closed**. Written firmly because that is where note-model landed after considerable pressure-testing, but **open to challenge**: if this topic's mechanism makes it wrong, say so and note-model reopens.

**The two direct contradictions in this document:**

1. **Data mapping** — *"**Not synced:** `title`/`tags` … + all Bucket-2 window-state (machine-local, SQLite only)."* Geometry is no longer all Bucket-2.
2. **Central SQLite index / read-model** — lists *"window coords/**size**"* as Bucket-2 machine-local state. `size` has moved.

**The ruling.** The governing rule is the third application of one the epic has landed twice already (note-window's *"a home is intent, not a location — fallbacks resolve without rewriting"*):

> **Geometry *intent* travels. Resolved geometry does not.**

- **`size`** — Bucket 1, **synced**. The *authored* size, in absolute points. Content-anchored: a user sizes a note to fit what's in it, and macOS points are density-independent, so the same point size preserves content fit on any display.
- **`preset_id`** — Bucket 1, **synced**. A **preset UID** (or empty = freely placed). A *name* is portable where a coordinate is not: "left rail" means the same thing on a 13" laptop and a 27" Studio.
- **Position, home-Space, home-display, and the resolved rect** — all stay **Bucket 2**, unchanged. Position is stored display-local (note-window), and the resolved rect — what a safety-net fit or a preset binding computes for *this* display — is a per-machine derived cache.

**Correction landed the same day — `float_on_top` is a THIRD new synced field.** note-model's earlier entry said *"two new synced discrete fields are therefore needed"*; **it is three**. `float_on_top` sits in the `window_state` table annotated *"the Bucket-2 machine-local state (never synced, never in the bundle)"*, and that annotation is now wrong for it too — **float-on-top moved to the Note tier: it is intrinsic and syncs**, alongside `size` and `preset_id`. Strike float-on-top from the Bucket-2 list in Per-Device Settings above (it was written before note-model moved it). **Net: three new synced discrete fields — `size`, `preset_id`, `float_on_top` — and `float_on_top` leaves `window_state` entirely.** It currently appears in neither the `meta.json` stored set nor the synced discrete field list, so **there is presently no home anywhere for a synced float flag**; one is needed.

**Why float-on-top is note state** (the reasoning, so this topic can challenge it rather than just absorb it). The original placement was explicitly *parked*, not decided — *"closer to coordinates than to Markdown. (Seen both ways; parked in B2 for now.)"* That comparison stopped working once the model knew **why** coordinates are machine-local: a coordinate is anchored to *hardware*, meaningless without a display arrangement. Float-on-top has **no display dependence at all**. The decisive argument is asymmetric discoverability, resting on note-window's decision that a floated note has **no persistent indicator** (*"a floated note is self-evidently floating; that on-top-ness **is** the signal"*). If the flag syncs and the user didn't want it, the note is floating in their face on the other Mac — noticed in seconds. If it doesn't sync and they did want it, the note sits quietly behind other windows with **no cue anywhere** that it was meant to float. A wrong-but-visible state beats a wrong-but-invisible one. **Accepted cost:** float cannot differ per Mac. Judged the rarer want.

**Axis composition:** a preset is note-window's three independently-toggled axes (Size · Position · Display), so a binding does not wholesale override geometry — **each axis is sourced from the preset where it sets that axis, otherwise from its normal home: size → Bucket 1, position → Bucket 2, display → the note's home display.** Mixed units need no special handling; re-resolution is idempotent for absolute values.

**`preset_id` is a new *kind* of field for this schema.** It is a reference to an entity that lives **outside the note record** — a preset. The per-note-record model has no precedent for that. Two consequences:

- **The preset library must sync** (note-model decided it should be account-level, not machine-local), otherwise a reference dangles on arrival. Where the library physically lives is this topic's and management-window's, not note-model's — but the *requirement* originates in the ruling.
- **References are UID-keyed, never name-keyed.** Names orphan on rename (management-window's editor supports rename) and collide silently across Macs. Built-in tiling layouts use the same mechanism with reserved opaque UIDs.
- **Decision (2026-08-02) — bind writes through on every axis; unbind and deletion freeze *(resolves review-006 F7)*.** The review noted that with `presetId` written by only bind and unbind, what *else* each act writes was half-covered: note-model's *"applying a preset also writes the resolved geometry into `size`"* is quoted here but never restated, and the **position** axis — whose home is the per-device blob, this topic's mechanism — had nothing at all.

  **Sibling check: note-model — its decided text holds that applying a preset writes the resolved geometry into `size` so that "a note is never dependent on the preset surviving"; that principle is adopted, not re-decided.** The only part genuinely this topic's is the axis whose storage we own:

  > **Bind writes the resolved value into each axis's normal home** — `size` to the note record (synced), position to the per-device blob (per-machine). **Unbind and preset deletion change nothing on screen**: the note keeps the geometry it was given until something changes it again.

  Writing through is what makes the render-time fallback honest — a dangling binding renders *current* stored geometry rather than a stale pre-bind value. Reverting on unbind would be the "note moves under your hands" failure a third time, and would need a shadow pre-bind value with no other reader; freezing needs no extra state, since the stored value is already what's on screen.

  **Boundary worth stating: re-resolution still writes nothing.** A display change or an edit to the preset recomputes the rect and renders it — the stored values move only on a deliberate act. That keeps the write invariant intact and ties blob churn to gestures rather than to every screen change. *Cost:* after a preset is edited, the stored position is the bind-time one, so a later dangle falls back slightly behind — the same authored-vs-resolved gap `size` already carries.

- **Deletion is already handled without this topic's help:** applying a preset also writes the resolved geometry into `size`, so a note is never dependent on the preset surviving. If the preset doesn't resolve, the note falls back to plain authored geometry. *(**Corrected 2026-07-31** — this arrived as "`preset_id` clears and the note falls back", but the clear is a machine-derived write to a synced field, which the write invariant below forbids. The fallback is render-time; the binding survives. See the dangling-preset decision at the end of this section — review-005 F8.)*

**The write invariant — the part most likely to interact with this topic's mechanism:**

> A synced geometry field is written by a **deliberate act, occurring on exactly one machine**. It is never written by a value each machine derives independently.

Manual resize, applying a preset, and an agent write are all deliberate and all write. **Safety-net fitting and preset re-resolution are derived on every machine and never write.** This is what prevents a two-Mac ratchet: a 27"-authored note opened on a 16" laptop is *fitted for display only*, so Bucket 1 keeps the authored value and the Studio never hears anything back. (The user's own analogy: tmux ratchets to the smallest attached client because a terminal is one shared character grid with no authored-vs-resolved split available. Fumi has that split, so the failure is structurally impossible rather than merely avoided.)

**Also decided, and relevant to live sync:** a synced size change is **honoured at open, never pushed to an already-open window** on another Mac — otherwise a note resizes under the user's hands. Consistent with this epic's rejection of write-locking and with the rule that the conflict reconciler must not animate geometry. *(**Superseded** by the decision below — "at open" assumes a close/reopen cycle fumis don't have. Replaced by unfocused/on-blur.)*

**Open question this topic must rule on — geometry and the conflict model.**

note-model asserted *"geometry conflicts are last-writer-wins, no conflict UI"* on the grounds that two Macs both resizing is low-stakes and does not warrant a prompt. **That was asserted without consulting this topic's machinery, which is not last-writer-wins** — it is `edit_counter`/ancestor precedence, with a divergent note becoming a single `conflicted` note whose candidate child records surface in note-window's reconciler. Two things follow that note-model cannot settle:

1. **Does a geometry write bump `edit_counter`?** note-model decided geometry does **not** bump `modified_at` (same rule as colour — pure metadata must not leap a note up sort-by-recent; the same holds for a float toggle). If it also does not bump `edit_counter`, the precedence input this layer uses to pick a winner is absent, and whether such a write propagates deterministically or can be silently dropped is undefined. If it *does* bump `edit_counter`, the two counters diverge in meaning and that needs stating.
2. **Can a geometry write trip the note-level conflict flow?** A geometry write on Mac B concurrent with a content edit on Mac A may produce exactly the conflict UI the "no conflict UI for geometry" rule says must not exist. If conflict granularity is the whole note record, that rule may not be honourable as stated.

**Answers this topic's version-snapshot-geometry item.** note-model has ruled on *what* a snapshot records:

- **The authored (Bucket 1) `size`, never the resolved rect.** A resolved rect is machine-specific, so a snapshot holding one would be meaningless on a second Mac — the exact failure this ruling exists to prevent. note-window's preview treatment assumes it: an **unbound** snapshot previews at its recorded size, while one carrying a `presetId` has its **Size axis re-resolved against the current display** — and **preview never moves the note**, only size animates. *(Citation replaced 2026-08-09 — this quoted *"animates the note to that version's recorded size, **clamped to the current display**"*, which note-window amended on 2026-08-06: the clamp never fires on a smaller display, so a half-height preset captured on a 27" Studio recorded 720 and previewed at 80% of a ~900pt laptop screen, while Restore produced 450. The conclusion above is unaffected — their amendment restates it, and their companion decision pins Restore to the authored value floored at the minimum window size, never the display fit. **What this topic stores is what makes their fix possible**: re-resolution needs the authored `size` **and** the `presetId`, both of which the snapshot already carries; a stored resolved rect would have foreclosed it.)*
- **`preset_id` alongside it.** The binding is part of the note's geometry intent, and a version is a historical state of the note. It degrades with no new machinery: restoring a `preset_id` whose preset has since been deleted hits the existing fallback — the binding is kept but doesn't resolve, so the recorded `size` renders. *(Wording corrected 2026-07-31 — was "binding clears"; clearing is deliberate-act-only under the dangling-preset decision below. review-005 F8.)*
- **Restore writes both to Bucket 1** (a deliberate act on one machine). **Preview writes nothing** — transient and derived.

note-model's position is that geometry should never be able to produce a user-visible conflict — a resize is not worth a reconciler. **How that is achieved is this topic's call**, and if the mechanism makes it impossible, note-model would rather hear that and revisit than have the rule quietly not hold.

### Decision (2026-07-30)

Three parts: the fields land as reported, conflict granularity is **per field**, and the *application* rule note-model wrote is **replaced** — it doesn't survive contact with how fumis are actually used.

#### 1. The fields — accepted, and `size` re-confirmed rather than inherited

`size`, `presetId`, `floatOnTop` join the note record as synced discrete fields (casing per the per-layer rule — sidecar and record camelCase, columns `preset_id` / `float_on_top`). `floatOnTop` leaves `window_state`.

`size` was re-tested rather than absorbed, since note-model's ruling arrived as a fait accompli. **The case against syncing it:** you may *want* a per-Mac size — small and glanceable on the laptop, opened up wide on the Studio where you work in it. Syncing removes that; any deliberate resize propagates everywhere. **Why it loses:** *nothing signals it.* Size doesn't sync and you wanted it to → your content sits in a wrong-shaped container on the other Mac with no cue why (the user's case: a note grown on one Mac, still three lines tall on the other, all the new text hidden behind a scroll). Size *does* sync and you wanted per-Mac sizes → you see it instantly and drag. **Wrong-but-visible beats wrong-but-invisible** — the same test that moved `floatOnTop` to the note tier and that killed the delete confirm, now used three times in this epic.

Structural reinforcement: version snapshots record `size`. A machine-local size would make a snapshot's recorded geometry meaningless on any other Mac — the exact failure the authored-vs-resolved split exists to prevent. Syncing `size` is what makes snapshot geometry coherent at all.

#### 2. Conflict granularity = per field. Only `content.md` can raise the reconciler

Resolves the first of note-model's two questions, and generalises past geometry.

> **`content.md` is the only unmergeable thing. Every other field is a scalar where one value replaces another — so no metadata change can ever produce a conflicted note.**

CloudKit's unit is the whole `CKRecord` — `serverRecordChanged` hands back client, server and ancestor, and the *client* decides. So granularity is entirely our call, and the merge is done **per field against the ancestor**:

- changed vs ancestor on one side only → that side's value wins;
- changed on both sides → `content.md` keeps both (conflicted note + candidate child records, existing behaviour); any other field takes the write that lands second, silently.

**Why not record-level.** The user's own framing — *"if I change a note on one system, that means that's how I want that note to look; if I then change the content on another, that's what I want the content to look like"* — describes two wishes that don't compete. Field-level grants both. Record-level makes you pick one version of the whole note and **silently discards the other change**: you'd open a tabbed content reconciler, choose the version with your new sentence, and throw away the recolour without ever being shown it. The reconciler is a content UI; handing it a metadata divergence hides the very thing being decided. Frequency doesn't settle this (concurrent same-note editing across two Macs on one Apple ID is near-zero either way) — **asymmetry of failure** does: rare silent loss is worse than rare visible annoyance.

**Ancestor comparison is what stops a later write clobbering an earlier one.** A save uploads the *whole* record, so a Mac that only edited text still sends its stale `size`. Comparing against the ancestor is what makes that harmless: `size` unchanged-vs-ancestor locally, changed on the server → the server's value wins **even though the local write landed later**. "Last write wins" only ever adjudicates two writes to the *same* field; it is never "the last device to touch anything wins the record". No per-field timestamps are needed.

**The alarming case that turns out safe** — the delete flag. Mac A soft-deletes, Mac B edits text: disjoint, so both apply, and the note sits in Recently Deleted *with the newer content*, fully restorable. Delete racing restore is the same shape — whichever lands second wins and both directions are undoable. **Soft-delete's reversibility is what makes silent resolution acceptable on the one scalar where it would otherwise be frightening.**

**Two details on the merge, added 2026-07-31 *(resolves review-004 F8)*.**

*Fields the ancestor doesn't have.* The comparison needs a "before" copy, and a newer `schemaVersion` can introduce fields that copy predates. Example: the ancestor holds `colour` + `content` from v1.0; v1.1 adds `floatOnTop`; Mac A (v1.1) floats the note while Mac B (v1.0) edits text. There is nothing in the ancestor to compare `floatOnTop` against.

> **Absent in the ancestor means "no opinion", never "changed".**

Treating "can't compare" as "changed" would read as *both sides changed it* and manufacture a conflict over a field only one Mac knows exists. Pairs with the existing rule that a client never destructively overwrites fields it doesn't understand — that guard covered writing; this covers comparing.

*The folder driver has no ancestor — recorded as a constraint, deliberately not solved.* The whole per-field merge rests on the ancestor, which **CloudKit supplies and a folder driver would not**: a version vector reports *that* two copies diverged, never *which fields* did. A future driver would therefore have to keep a **shadow copy of last-synced state** to serve as an ancestor, or degrade to whole-record keep-both — the record-level behaviour rejected above.

**Not designed now.** The folder driver is a future project that **may never be built** (the user's read: iCloud likely provides everything needed). Solving it now would be solving a problem we don't have. What is recorded is the constraint itself: **the seam's `ancestor` is optional in signature but load-bearing in practice** — cheaper to know here than to discover mid-build.

**Consequence — no precedence counter is needed at all** (resolves note-model's second question). Metadata-only writes never feed a precedence decision the reconciler reads, so the question *"does a geometry write bump the counter?"* dissolves — `editCounter` was subsequently **dropped** (see multi-mac-concurrency, 2026-07-31). The existing rule stands unchanged: recolour / float / geometry don't bump `modifiedAt`, so they never leap a note up sort-by-recent.

**Write-locking reconsidered and re-rejected — now on structural grounds, not taste.** A lock needs a live coordinator: both Macs must agree who holds it *before* an edit. Local truth + sync-as-transport + the iCloud toggle defaulting **off** + offline editing as a first-class case means an offline Mac can neither acquire nor check one. Either editing blocks when offline (unthinkable) or the lock is advisory and doesn't prevent the divergence it exists for.

#### 3. Application rule — replaces "honoured at open"

note-model's *"a synced size change is honoured at open, never pushed to an already-open window"* is **superseded**. It assumes an open/close cycle that Fumi's premise denies: fumis are furniture, left open on the desktop indefinitely, so "at open" may never arrive and the synced size would sit unapplied forever — quietly undoing the decision to sync it at all.

It is also the **second appearance of one collapsed distinction**. The version-history triage entry already corrected *"open notes never blur"* with **open ≠ focused** — notes lose focus constantly, because the user is working in their editor with the fumi sitting there. "At open" collapses the same two things again.

> **A synced geometry change applies when the note is not focused — immediately if it is already unfocused, otherwise on blur.**

Covers the never-closed note completely (it picks the change up seconds later, the moment the user clicks away) while still never resizing a note under the hands of someone typing in it — the only thing the original rule protected. Reuses the idle-or-blur cadence shape version-history already needs.

**Rejected — a "this note was updated on {Mac}, sync it?" prompt or status icon.** It prompts for a reversible, low-stakes, self-evident change, which is what discovery's no-unnecessary-prompts principle forbids and what killed the delete confirm. Worse, *no* has no coherent meaning: refusing a sync creates a note that has knowingly declined a value — a divergence state to model, store and eventually reconcile, permanently, over a window size. A resized note is self-evidently resized. If it feels jarring once built, an indicator is note-window's to add.

**Accepted quirk (deliberately not treated as a bug).** After a merge, an open window still shows the old rect while the authored `size` is the new one; reopening fixes it. If the user *resizes* before that, they drag from the stale on-screen rect and the other Mac's resize is lost. Correct rather than broken — they resized the note in front of them, deliberately, which is exactly what the write invariant says is authoritative. Flagged for feel-testing in the build.

**Cross-topic note → note-model:** its "honoured at open" wording is replaced by the unfocused/on-blur rule above; the reasoning was sound, the usage pattern it assumed isn't Fumi's. Its "geometry conflicts are last-writer-wins, no conflict UI" position is **upheld**, but via per-field merge rather than LWW on the record.

### Decision (2026-07-31) — dangling presets: render-time fallback, never a write *(resolves review-005 F8)*

The drained fallback — *"if the preset vanishes, `preset_id` clears and the note falls back to plain authored geometry"* — was filed as needing no machinery. But the clear is a **write to a synced field**, propagating to every Mac, and it would be **triggered independently on each machine** by a local observation (does the preset resolve right now?) — verbatim what the write invariant forbids.

**The zone split makes this reachable routinely, not theoretically.** The preset library lives in the settings zone, notes in the note zone, each with its own change token and **no fetch-order guarantee between them**. A new Mac's first sync can land the note zone first: notes arrive carrying `presetId` bindings whose library hasn't been fetched yet. Under the naive rule that Mac concludes every preset vanished, clears every binding — and **syncs the clears back**, permanently destroying valid bindings account-wide from a machine that was merely mid-download. Same window on restore, and on re-enable after the absent-zone stop. Version history inherits whatever happens, since snapshots record `presetId`.

> **Failure to resolve `presetId` is a render-time fallback, never a write.** The note renders plain authored geometry while keeping its binding; when the settings zone catches up, the preset applies again. Self-healing, nothing destroyed.

**`presetId` is written by exactly two deliberate acts:** bind and unbind — a gesture aimed at *that note*, on one machine. Invariant-clean: one machine acting on intent, not many machines reacting to absence. *(**Corrected 2026-08-02** — this originally read "three deliberate acts", the third being a **preset-delete cascade** in which the deleting Mac also cleared the binding on affected notes. That clause contradicted the rule two paragraphs above it, and it was struck. See the entry below.)*

**Cost, named:** a binding can dangle indefinitely. The dangle is harmless (renders plain, forever) and is **tolerated, not swept** — a repair sweep would be precisely the per-machine derived write the invariant refuses. *(Corrected 2026-08-02 — the cost was originally framed as the cascade's leak: "an offline Mac binds a preset concurrently with its deletion elsewhere, and the cascade never sees that note". With no cascade, dangling is not a leak but the ordinary state.)*

#### Decision (2026-08-02, drained triage) — the cascade is struck; deletion writes nothing to notes

*From: note-model · discussion · 2026-08-01.*

note-model reported this as a conflict against its own decided rule: *"`preset_id` is never cleared by preset deletion. It **dangles**. … **The only thing that ever clears `preset_id` is a binding-breaking gesture**."* It is not a genuine disagreement between two positions — **it is one document contradicting itself**. The rule stated two paragraphs above ("failure to resolve is a render-time fallback, never a write") and the cascade clause cannot both hold: the cascade is a write triggered by a resolution failure the user caused deliberately, which is the same shape the rule exists to forbid, merely with a nicer trigger.

The clause was written while closing F8 and never checked against the rule it sits under. F8's problem was an **unowned** write — each Mac clearing on local observation — and the fix reached for *"make it owned"* rather than *"delete the write"*. The invariant only forbids per-machine derived writes; it never required that a clear exist at all.

**Struck. Deleting a preset touches the preset library and nothing else.** The two options are indistinguishable on screen — a note whose binding doesn't resolve renders its stored `size` either way — and diverge only when the preset comes back (restore, re-creation with the same id, or the settings zone finishing a sync): dangled notes re-bind by themselves, cascaded ones are orphaned permanently. Everything else the cascade did was cost: one preset deletion pushing a `presetId` change to every bound note across every Mac, and a before/after break in each note's version history at the moment of deletion (snapshots record `presetId`).

**Sibling check: note-model — its decided text holds that `preset_id` is never cleared by preset deletion and only a binding-breaking gesture clears it; this correction adopts that rule verbatim rather than re-deciding it.** Ownership sits there: what `presetId` *means* is note-model's, the sync mechanism is this topic's, and the offending sentence was this topic's to strike. **management-window** independently decided its preset editor does *"no cascade, no rewriting of note records, no 'N notes use this preset' prompt"* — so the cascade had no surface to be invoked from either.

**Not reliably a cascade anyway, which is the sharper argument.** An offline Mac binding a preset concurrently with its deletion elsewhere is never swept, so the cascade bought *usually*, not an invariant — while F8 already tolerated exactly that leak. Paying a write fan-out to reduce the count of a state you tolerate is the worst of both.

#### Decision (2026-08-02) — a re-resolving binding reaches the screen under the existing unfocused/on-blur gate *(resolves review-006 F6)*

Striking the cascade made dangling the ordinary state rather than a leak, which raised a question the fallback never answered: **when the preset comes back, when is the note allowed to change shape?**

The self-healing clause says only *"when the settings zone catches up, the preset applies again"*. So a note that has been rendering plain authored geometry — possibly for weeks, since a dangle is *"tolerated, not swept"* — can snap to a preset rect at a moment nothing user-visible caused: the settings zone landing on a new Mac, a re-enable after the absent-zone stop, a preset restored from backup. The document treats *"a note resizes under the user's hands"* as precisely the failure the application rule exists to prevent.

> **The existing gate applies unchanged: a re-resolved preset takes effect when the note is not focused — immediately if it is already unfocused, otherwise on blur.**

**Why the gate reaches this even though no write occurs.** The write invariant classifies preset re-resolution as derived-never-written, and the application rule was authored for *synced field* changes arriving from another Mac — so on a literal reading neither covers a local re-derivation. But the gate protects against a thing seen, not a thing written: its subject is when a geometry change is **allowed to reach the screen**, and the user cannot tell whether the rect that just moved under their cursor came from a synced field or a local resolution. Same failure, same guard. **Rejected: apply immediately because nothing was written** — invariant-correct and user-hostile.

**Nothing new is built.** The gate already exists and already runs on every note; this states that resolution changes enter through it rather than around it.

**Recorded, not a decision needing one:** a preset deleted and later *re-created* under the same name does not reattach — a fresh authoring gesture mints a new id, and this design ruled out name-keying long ago (names get renamed and collide; ids don't). Self-healing covers restore and re-sync (same id), not re-creation. Correct rather than a gap: a same-named preset is a different preset.

---

## Quick Look Preview

### Context

*Rerouted from note-window (2026-07-26). Drained 2026-07-30.*

Surfaced from a reference app (`pluk-inc/markdown-preview`, MIT) that ships a **Quick Look extension** giving `.md` files system-wide previews in Finder without launching the app.

**The idea:** do the same for **`.fumi` bundles** — select one in Finder, hit space, see the note's rendered content. Cheap, very Mac-native, and it fits the product: notes are real files in a user-visible location, so previewing them where they live costs the user nothing.

**Why it lands here:** storage-and-sync owns the `.fumi` bundle as a Finder-visible artifact — it settled the **opaque-package** decision (needs "Show Package Contents"), external-deletion behaviour, and the format posture. Quick Look is fundamentally "what Finder does with a `.fumi`". *(Adjacent owners if you'd rather move it: **onboarding-and-permissions** already holds `.fumi` UTI-registration timing, which Quick Look depends on; **build-and-release** would own shipping it as an app extension. Note-window owns the rendering rules the preview would reuse.)*

**Worth deciding:** whether it's v1 or later, whether the preview is read-only (almost certainly), and whether it reuses note-window's rendering treatments (it should, for consistency).

### Decision (2026-07-31) — dropped *(resolves review-004 F14)*

**Not deferred — dropped.** Two independent reasons, either sufficient.

**1. The premise is gone.** The idea rests on *"notes are real files in a user-visible location, so previewing them where they live costs the user nothing"*. The store now lives in **`~/Library/Application Support/Fumi/`** (decided the same day, store-locality). **Nobody browses Application Support and hits space on a bundle.** The use case the feature served does not exist.

**2. A feasibility gate was never asked.** The framing treated the open questions as *v1-or-later / read-only / rendering reuse* — all downstream of something unexamined: **Quick Look previews ship as app extensions, which are sandboxed**, and Fumi is deliberately **non-sandboxed** because the private CGS/SkyLight Space APIs require it. A sandboxed extension reading `content.md` out of our store is the same class of gate the CloudKit-entitlement combination was — and that one was settled with a spike, not an assumption.

Reason 1 is decisive on its own; reason 2 would have needed a spike to answer even if the premise had held. **Rejected: keep it open and spike the sandbox question** — paying for an investigation into a feature whose use case has just been removed.

*(Should the store ever become user-visible, this reopens with reason 2 still outstanding.)*

---

## Summary

### Key Insights

1. **The sidecar beats frontmatter on the axis that matters later.** Keeping metadata out of `content.md` puts metadata-only edits (recolour, soft-delete) on a *different file* from content edits, shrinking the multi-Mac conflict surface. The only content-correlated field is `modifiedAt`, whose sync staleness is cosmetic.
2. **Package-by-extension is the clobber-proofing lever.** `{ulid}.fumi/` as an opaque package protects the whole bundle as a unit and travels through folder-sync (the bundle *bit* would not). *(Its double-click-opens-in-Fumi consequence survives but stopped being a promoted entry path once the store moved to Application Support.)*
3. **Cloud eviction is not an iCloud quirk — it's the defining constraint on store architecture.** Every provider evicts bytes; there's no cross-provider pin API. So "where does the authoritative copy live" is foundational, not a detail.
4. **`content.md` is the only thing that can't be merged — and that one fact sizes the whole conflict model.** Once granularity is per field against the ancestor, prose is the only field where "keep both" is the honest answer; every scalar takes the second write silently. It retired the precedence counter, dissolved "does geometry raise a reconciler?", and made the delete flag safe to auto-resolve.
5. **Rare *silent loss* is worse than rare *visible annoyance*.** Used to choose per-field over record-level conflict, to sync `size`, to default retention to Forever, and to make an absent zone stop rather than act. Frequency arguments kept pointing the wrong way; asymmetry of failure kept pointing the right one.
6. **A decision that lands is only half the work — the text it invalidates is the other half.** Four separate findings were one failure: store-locality, the three-tier state model and the casing rule each invalidated prose that was never re-read, so the document read as current while describing rejected architecture. Correct at the *old* site, not just parenthetically at the new one.
7. **A Mac that has not heard from the authority does not act on the authority's behalf.** Stated for purging, for asset repair, and for the absent zone before anyone noticed it was one rule — and sidecar repair was the single destructive-adjacent write standing outside it, inventing a value the merge could not distinguish from a choice. The companion is what makes the gate cheap: **rendering is never gated.** A fallback shown is not a value stored, so a note can degrade on screen while the record it would have overwritten stays intact.
8. **Derive, don't store — a predicate defined by the question it answers cannot lie.** Used three times in one review pass: dirty became `hash(content) ≠ hash(latest snapshot)` (survives restart/rebuild, computes identically on every Mac — a stored flag can lie after a crash); "reconciled" was defined from what the gate asks (*could this state have changed somewhere I haven't looked?* — which makes a never-synced store trivially reconciled); and the dangling-preset fallback became render-time derivation instead of a per-machine write to a synced field.
9. **Removing machinery transfers load onto neighbours that were sized before the transfer.** Both 2026-08-02 changes were deletions — a cascade struck, a field moved into an existing carrier — and in both cases the residue wasn't stale claims at the change site but weight landing elsewhere: the account-document merge became the *whole* of preset deletion (so a removed key needed a meaning it never had), and the blob acquired a field that changes on *viewing* rather than arranging (so its debounce, its torn-write story and its payload versioning all became load-bearing). The follow-through question after a removal is not "what did this contradict" but **"what is now carrying this alone?"**
10. **A valve can be doing two jobs, and removing it only announces one.** The soft ceiling capped the largest single upload *and* capped how much of a heavy note ever left the Mac — the second job was invisible because nothing ever named it. Retiring `excluded` published the first change loudly and the second not at all, and the aggregate-bundle question existed only in the gap. Same family as insight 9: after a removal, ask what the removed thing was quietly carrying, not just what it contradicted.
11. **Check a constant's provenance before you make it load-bearing.** 50 MB sat in this document four times as though it were a platform fact, on no source anyone here had read, and it was fine — a soft ceiling that is slightly wrong costs nothing. Turning it into a refusal changed what the number had to survive, and the check was one page fetch. It happened to be Apple's; the same fetch produced the 750-reference limit, which nothing had noticed at all.
12. **When two schemes share a word, the collision is invisible until someone writes the sentence.** note-model's attribute tiers and this document's column categories both have a value called *Derived*, meaning different things — and nothing surfaced that until a correction wrote *"Durable, not Derived"* about a column and it read as self-contradiction. Naming both vocabularies cost a paragraph; the ambiguity had already produced one wrong-looking sentence and would have produced more.
13. **Name a dependency by the rule it follows, never by the file it currently reads.** The re-derivation pass said it re-reads `content.md` — true when written, and quietly wrong the moment the corpus rule grew a second input. A pass pinned to a filename cannot notice that the rule moved; a pass pinned to *"whatever the corpus rule names"* cannot be stranded by the next change either. Related to insight 6 but the opposite remedy: that one is about sweeping the sites a decision invalidated, this one is about writing the site so there is nothing to sweep.
14. **A rule written for the members of a set that were in view is never asked of the rest.** Three separate gaps turned out to be one shape: every durable artifact got an on-disk *and* a synced address except the conflict candidate; the Apple ID partitioned the store and none of the four tenants beside it; and failure was modelled exhaustively on the remote side and not at all on the local one. In each case nothing was decided wrongly — the question simply stopped at the edge of what was on the page when the decision was written. The tell is a decision phrased about *this* thing where a set exists: the check is to name the set and walk it, which costs a minute and is the only thing that finds these.
15. **Two documents can contradict each other about a fact that belongs to a third which never stated it.** note-model had a chip's content form as a labelled link; this document had the filename flatly not in the note's text. Neither cited the other, and neither was careless — the fact they disagreed about was *what label gets written at insert*, which is note-window's surface and had never been decided there. The disagreement was a symptom of the silence, not of either document drifting, and it stayed invisible because each document was internally consistent. The tell is a premise stated as flat fact about someone else's surface, with no citation to a decision there: that is not a shared assumption, it is two guesses that happen not to have met. Related to insight 6 and pointing the other way — that one is about sweeping the sites a decision invalidated; this one is about a decision resting on a site that never existed.
16. **A rule earned by a complication outlives the complication.** The re-derivation pass was written to draw *whatever the corpus rule names* rather than `content.md` by name, precisely because the corpus had grown a second input. When that input was dropped a day later, the obvious tidy-up was to drop the indirection with it — and it would have re-armed the exact trap it was written for, since the rule guards the *next* corpus change, not the last one. A rule's cost is paid once at writing; its value is paid out on changes that haven't happened yet, so "the reason for this is gone" is not a reason to remove it unless the reason was the only one it could ever have.
17. **An argument exported to another topic is never held to the standard the decision that produced it was held to.** The desk-loss line was written in passing by a decision about *tiering* — window state belongs in the durable tier, therefore onboarding gains a reason to encourage sync — and the second half was a claim on another topic's behalf, made in a sentence nobody was reviewing as a claim. It was false for anyone running Time Machine, on a fact sitting four paragraphs away in this same document, and it survived six weeks because the only reader positioned to put the two side by side was the topic that eventually tried to use it. The tell is a decision that ends by handing someone else a line to say: that line is doing a different job from the decision above it, and the decision's own rigour does not extend to it.
18. **A label written from the detector's seat reads backwards from every other seat.** "This Mac / Another Mac" is correct on the machine that caught the conflict and inverted on the machine that fetches the result — the records are identical, the rule is identical, only the reader moved. The tell is a label whose meaning is a *relationship* to the reader rather than a fact on the record; the fix is to store the fact and resolve the relationship per reader. The same move as *store the role, resolve the swatch* and *a home is intent, where a note sits is resolution*, arriving for a third time from a new direction.

### Open Threads

Nothing remains open *within* storage-and-sync except one conditional obligation on the purge path (below) — quick-look-preview decided-as-dropped, child-record-ceiling added and settled 2026-08-09. Rerouted concerns absorbed: from note-model, the preset-delete cascade, `last-opened`'s tier, the derivation version, the content-hash dedup deferral, sidecar repair ordering, then on 2026-08-09 the **hard size limit** and the **aggregate-bundle bound**; from note-window, the twice-decided `excluded` placeholder copy and a stale citation of their preview wording (both absorbed by decisions rather than fixed on their own terms), then on 2026-08-23 the **device display name** and the **conflict candidate's writing-device key**; from platform-support, on 2026-09-11, the **project OS floor** — four sites here restated macOS 14 as the project minimum after the floor moved to 15, and each was amended to keep the `CKSyncEngine` 14.0 availability fact while surrendering the floor claim; from search-and-retrieval, on 2026-09-14, the **FTS corpus**, which widened the index's inputs beyond `content.md` and put the filename-drop on the note's own write rather than on the GC sweep, and the **search derivation version**, which split `notes_fts` out of the shared counter and restated the re-derivation pass's input as the corpus rule rather than a filename; from note-window, on 2026-09-15, **the falsified index-input premise** — inserting a file writes its filename into the note as the link label, so the filename *is* in the note's text and the manifest pull was dropped a day after it was widened, taking the corpus back to `content.md` alone while the rule-shaped input statement was deliberately kept; from onboarding-and-permissions, on 2026-09-15, **the desk-loss argument**, withdrawn rather than restated once their first-run work put this topic's own two statements side by side — Time Machine's coverage of the blob measured and standing, the exported encouragement leg gone, and the positive they had taken to replace it gone with it — and **the first-run sync default**, where the default-off ruling was scoped to the shipped preference so their pre-enabled toggle is consistent with it. What leaves this topic:

- **Rerouted to downstream topics:** conflict-display UI + per-note delete UX + version-history browse/restore UI + version-author display + whether the scrubber labels a resolution-loser version that was never the note's live content + **the refused-drop surface** (2026-08-09 — the hard limit retires `excluded`, so their two-state absent-asset treatment loses a state and their *"nothing is said at drop time"* position cannot hold: a refusal must say something, and what it says is theirs) + **what an asset chip renders when its filename is unrecoverable** (2026-09-14 — a damaged sidecar on a sync-off store loses the assets manifest permanently, and this topic invents no name; the file's kind from its extension, or no label, is theirs — *landed in their triage, which reopened that topic*; **likely moot as of 2026-09-15** — their own label rule, settled while working that concern, puts the chip's text in `content.md`, so a chip with no manifest entry still renders; theirs to close or drop) → **note-window**; Recently-Deleted bin + retention-shrink confirm + sync-status surface + stale-device removal + the `lastOpened` sort's name, its absent-entry treatment and its per-Mac scoping → **management-window**; version-history as a premium/paywall candidate → **commercialization**.
- **Rerouted to onboarding-and-permissions** (2026-09-15, research-side — their research document is what records it): the desk leg is withdrawn rather than restated, and the positive they had taken for their copy — *your notes and your desk follow you to every Mac* — is false on this topic's per-device mechanism, since each Mac keeps its own desk by design. Their framing stance, toggle default-off, onboarding-encourages and no-iCloud-no-backup positions are untouched. The landing reopened their research and flagged their discussion to reconcile against it.
- **Rerouted to search-and-retrieval** (2026-09-15): dropping the manifest pull settles the input path but contradicts their decided corpus text, which still names `originalFilename` as a second input. The identical fork was already queued there by note-window; what went across is the answer reached here and the argument that carried it, so their corpus decision reconciles against a decision rather than being taken blind. **If they reach the opposite answer the manifest read returns** — a wording change at four sites here, nothing built.
- **Landed in note-model** (2026-08-03, by that topic's own absorption): "honoured at open" replaced by unfocused/on-blur, and its no-conflict-UI-for-geometry position upheld via per-field merge rather than LWW. Both are recorded there; this entry previously read as a note still to carry.
- **Cross-topic notes, all landed 2026-08-04:** `.fumi` UTI registers only after first run, sync toggle default-OFF with onboarding encouraging it (~~*"your notes **and your desk** come back"*~~ — *the desk leg was withdrawn 2026-09-15, not restated: it is false with Time Machine running, the desk does not travel between Macs by design, and Time Machine beats sync on replacement hardware; the notes leg carries the encouragement alone, and the correction was rerouted back to onboarding-and-permissions research-side*), and no-iCloud → no backup — *rerouted to onboarding-and-permissions triage (2026-08-04)*; Developer-ID provisioning profile for the iCloud entitlement, the floor (sent as **macOS 14+** — *the project minimum has since moved to 15+, decided 2026-08-30 in space-homing on the Space-placement route and stated as a product fact by platform-support on 2026-09-11; `CKSyncEngine`'s own 14.0 availability is unchanged and now sits slack beneath it*), and the unverified question of whether an expired embedded profile breaks sync at runtime — *rerouted to build-and-release triage (2026-08-04)*; the retirement of the *"the storage location is yours"* framing — *rerouted to positioning-and-audience triage (2026-08-04)*.
- **Spike before build:** platform-UUID durability across OS upgrade / hardware replacement, and multi-zone `CKSyncEngine` ergonomics. One spike, two questions.
- **Verified at implementation, not before:** whether `CKSyncEngine` can be driven to publish a note's content and its asset records as one batch (the atomic-publish rule); and the real `CKAsset` size ceiling. 50 MB is Apple's documented figure but the source table is archived; an oversized upload attempt settles it, and the limit lifts to whatever it proves to be — purely additive either way. Same check covers the **750 delete-self references per record** limit from the same table, including how the server behaves at the wall.
- **Conditional on history search shipping — the retention purge gains index work it does not do today** *(recorded 2026-09-14)*. search-and-retrieval decided version history is searchable behind an *include history* switch, with the history corpus indexed as **deduplicated blocks** rather than one document per snapshot; dedup stays correct without storing which version each block came from because **purge holds the text of the version it is deleting** — block it, decrement a per-block live-version count, drop anything reaching zero. That decrement lands on this topic's purge sweep, which today deletes records behind the `reconciled` gate and carries no index responsibility whatever. Missed, the failure is theirs and sharp: **text a user set a retention period specifically to destroy stays queryable.** Recorded rather than designed because it is cleanly conditional — no history index, no block counts, purge unchanged — and because search-and-retrieval marked history search *"purely additive… the first thing to drop if v1 needs scope back"*. Where the blocks physically live (a column on `notes_fts`, or their own table beside it) is build detail; what is owed here is the purge rule. *Read correctly on the second pass: their "separate, slower background job" is about **indexing work**, not a second query surface — their own priority rule (incremental updates outrank backfill, for every corpus including live notes) is a queue in front of one index, not two indexes.*
- **Deferred within storage (later, not v1):** chunked-asset spanning to lift the 50 MB `CKAsset` limit — **promoted 2026-08-09 from an optimisation to the intended fix**, since the ceiling is now a hard refusal and the capability it costs comes back only when the limit lifts. Purely additive when it lands.
- **Dropped, not deferred:** an in-app "remove my data from iCloud" action (macOS owns it); a Quick Look extension (its user-visible-store premise died, and a sandbox gate was never asked); `editCounter` (retired before shipping); **content-hash asset dedup** (2026-08-04 — content-hash *identity* breaks the per-note ref-count this topic's GC rests on, a shared blob store breaks self-containment, and the one form that breaks neither — APFS cloning — saves local disk but not the iCloud quota the item existed for).

### Current State

- **Decided — bundle-layout:** a fumi is `{ulid}.fumi/`, an opaque macOS package (marked by extension so it survives folder-sync), containing `content.md` (pure Markdown) + `assets/` (copy-only) + a `meta.json` **JSON sidecar** for intrinsic state (canonical `uid`, `schemaVersion`, `colour`, `createdAt`, `modifiedAt`, soft-delete, `size`, `presetId`, `floatOnTop`, `lastVia`/`lastBy`/`lastDevice`, **plus the assets manifest** `id → {originalFilename, addedAt}` — atomic writes). Folder name is a deterministic mirror of the UID; JSON is the identity anchor. UTI registered declaratively via Info.plist / Launch Services.
- **Decided — metadata-sidecar-format (naming):** casing is **per layer, not per record** — `meta.json` and the `CKRecord` are serializations of the note and mirror the struct (**camelCase**); SQLite is the query index (**snake_case**). Inverts note-model's report: `schemaVersion` was the only correct field; `createdAt` / `modifiedAt` / `deletedAt` / `originalFilename` / `addedAt` are the renames. Columns unchanged. Rejected: one convention everywhere (every surface already has an explicit mapping site, so matching names buy almost nothing).
- **Decided — store-locality:** local-truth in **`~/Library/Application Support/Fumi/`** (never `~/Documents`, no picker); **v1 transport = CloudKit via `CKSyncEngine`** (spike-confirmed on Developer-ID + private-API + notarized; `CKSyncEngine` is available from macOS 14.0 — *the project minimum is **15+**, set on the Space-placement route rather than on CloudKit and stated by platform-support; amended 2026-09-11, this read "macOS 14+" as though this topic set the floor*). Eviction solved. The driver seam is **kept, but as a testing seam, not a portability seam** — the folder driver is no longer a design target. Account handling partitioned by Apple ID — **and as of 2026-09-14 that boundary covers the whole directory, not just the store**: the note-placement map, the account documents (retention, preset library) and the index all partition per account and quarantine together, since the first two are keyed by one account's notes or destroy that account's history, and the index partitions rather than rebuilds so switching back resumes sync instead of re-fetching the library. **The per-device blob splits** — its placement map follows the account, its app-level values (swatch, chrome, opacity) are machine-scoped and stay put, because nothing in the reasoning that made appearance machine-local mentions an Apple ID. **Every durable local write enqueues** — enqueue is an idempotent marker in the engine's deduped pending set; the transport's scheduler owns wire timing, so `pending` means *saved locally, unconfirmed by the transport*.
- **Decided — sync-safety:** four lock-ins restated against v1 — SQLite machine-local (now because it is a per-machine *cache*, not because folder-sync would corrupt it), the store holds only bundles (**rescoped: the store is a subdirectory of the Fumi directory**, beside the index, the per-device blob and account quarantines — the Application Support layout is drawn by role, names deferred to build; the `CKSyncEngine` state blob stays in SQLite's `meta`, re-fetch cost accepted; **account documents added 2026-08-02 as the fifth tenant** — the preset library and retention must be readable locally, and for a sync-off user the local copy is the only copy), timestamps engine-stamped, rebuildability restated below. Posture = degrade-never-destroy. External raw deletion out-of-contract and now rare. FSEvents / download-on-demand pointers struck. **A local write that cannot land** (2026-09-14, the near side of failure the document had never modelled): retried, reported **once at the store level** — a full disk fails every write, not one note's — and **editing is never blocked**; nothing is discarded by the engine and the text stays on screen where the user can still reach it. Deliberately thin, on the user's steer that a full disk outranks their notes app: no per-note state, no held-buffer machinery. The honest limit is stated — nothing survives quitting while the disk refuses writes — and one counter-intuitive knock-on with it: the dirty predicate reads **clean** when a write fails, so the unsnapshotted-work flush does not fire, which is correct because there is nothing to flush into. status-and-alerts' existing *did something and it did not work* row renders it; no reroute is owed.
- **Decided — read-model-index:** SQLite holds exactly three things — a **projection** of bundle content (rebuild by scanning bundles), a **cache** of remotely-authoritative state (re-fetch: change tokens, tombstones), and **derived** state (rebuild from local sources: resolved rect, z-order, last-active, and the window-state columns re-read from the local per-device blob). Still throwaway; what differs is where each part rebuilds *from*. **The three categories classify columns, not attributes** — note-model's tiers answer *does this survive a wipe*, these answer *where does a rebuild get this from*, and they share the word "Derived": a Machine-tier attribute is routinely a Derived column, which is the normal shape for everything the per-device blob carries. `window_state` re-partitioned accordingly and **restated 2026-08-02 as a current tuple** (`uid`, `x`, `y`, `display_uuid`, `space_uuid`, `visible`, `last_opened`, `z_order`) rather than amended a fourth time — the restatement forced `display_uuid`, absent by omission though position is stored display-local and therefore uninterpretable without it. `float_on_top` gone to the note record. **`lastVia`/`lastBy` are deliberately not projected** — a column exists to answer a query and nothing asks about last-writer attribution; the scrubber reads version child records, and the only other reader is the engine already holding the note record. **`meta` carries a derivation version separate from the schema version** — bumped when a title/tag/preview rule changes, compared at launch, and a mismatch triggers a **Projection-only re-derivation pass**: background, resumable, serving the stale-but-not-broken rows meanwhile, writing nothing to the store and never bumping `modifiedAt`, and leaving Cache and Derived untouched (a full rebuild would discard the change token and force a CloudKit re-fetch to repair a local recompute). Separate values are what make the cheap repair reachable at all. **Split again 2026-09-14 — `notes_fts` carries its own derivation version**, so `meta` holds three numbers (schema, title/tags/preview, search): coupled, every search tweak dragged a full recompute of values that hadn't moved, while note-model's enumeration of the versioned set — *title, tag-set, preview* — licensed a tokeniser change reprojecting nothing at all. The split keeps that enumeration true as written and owes it no amendment. **One pass, two counters** — the launch pass compares both and recomputes only what its mismatched counter names, reading each bundle once when an update moved both; and **the pass draws whatever the corpus rule names rather than `content.md` by name** — kept deliberately on 2026-09-15 when the corpus narrowed back to one file, since the rule exists to stop the *next* corpus change stranding the pass, not the last one. Cost: a second constant a developer must remember to bump, taken because a forgotten bump fails safe where coupling has no safe direction. **`notes_fts`'s corpus is `content.md` alone** — the `fumi://` targets stripped, link and image labels kept, pasted `https://` URLs kept — **restated 2026-09-15**, when the manifest pull was dropped: note-window settled that inserting a file writes its filename into the note as the link label, so the name the user reads on a chip is the note's own text and the label-survives rule already indexes it. Redundancy is not what decided it — a chip's label is editable, and with the pull a note renamed to *"the deck"* would still match `budget-final.pdf`, findable by a word that appears nowhere in it. That is the visible-but-unfindable failure inverted, against the one property the corpus holds: what you can read, you can search, and nothing matches on text you cannot see. Accepted cost: renaming a chip loses filename search for that file, the label the user chose standing in its place. The index is derivable from `content.md` alone again — one input on the write path, still Projection tier, still rebuilt by scanning bundles. The corpus rule itself is search-and-retrieval's, whose decided text still names the filename; the decision was rerouted to them the same day. Engine sole writer, no FSEvents in v1. **Recovery = recover `uid` from the folder name, then consult the note's record before inventing anything — and write nothing until the store is `reconciled`** (2026-08-04): a never-synced store is trivially reconciled and defaults immediately as before, while a synced one waits for a completed fetch, so a corrupt sidecar can no longer push an invented Neutral or a `deleted: false` account-wide through per-field merge. The damaged bundle sits `unresolved` and retried — the state it already had — and **renders** note-model's repair values without storing them, the same render-time-fallback-never-a-write shape as a dangling `presetId`. Content is never dropped. **Extended 2026-09-14 to the assets manifest**, which moved into the sidecar after the repair rule was written: the manifest is *metadata about* assets, not the record of which exist (files live in `assets/`, references are tokens in the text), so rendering and ref-counting survive its loss; it is **reconstructed from the note's asset child records** where the store has them, nothing is invented where it does not, and an absent `addedAt` reads as **young** so the sweep keeps bytes it cannot date. A sync-off store with a damaged sidecar loses those filenames permanently — their only home — and what a nameless chip renders is note-window's. No app-level encryption in v1 (FileVault + CloudKit).
- **Decided — multi-mac-concurrency:** **conflict granularity is per field, against the ancestor.** `content.md` is the only unmergeable field and the only one that can raise the reconciler; every other field takes the second write, silently — so no metadata change (colour, float, geometry, even the delete flag) can produce a conflicted note. **Absent in the ancestor means "no opinion", never "changed"** (version skew). **No precedence counter.** Mixed versions tolerated via unknown-field + `schemaVersion`, whose migration procedure is defined: higher-version sidecars are operated on known-fields-only with unknown fields preserved verbatim; upgrades rewrite lazily on next real write, never as a launch sweep; the number versions the note record's shape (SQLite versions itself separately and migrates by rebuild); v1 ships as version 1. **Document payloads carry their own `schemaVersion` under the same procedure** (added 2026-08-02) — independent numbers, since a preset field landing must not force a note-record migration; verbatim preservation of unknown fields is what makes an old client safe in a mixed-version account, and it bites hardest on account documents, which every Mac writes. Write-locking re-rejected on structural grounds (an offline Mac can't reach a coordinator). **Resolution snapshots both sides** — the losing candidate enters history before the conflict-records are deleted; explicit resolution drops the loser from the note, never from existence. Now-unreferenced assets are left for the sweep, never GC'd inline. **A conflict candidate stamps the device key of the Mac that wrote it, and the note record gains `lastDevice` beside `lastVia`/`lastBy`** (2026-08-23) — because the local-versus-remote assignment is **asymmetric**: the detecting Mac keeps its own text live and demotes the divergent side, so the Mac that *fetches* the pair sees the identical records mean the opposite thing. Two keys let each reconciler row resolve its own name; neither is projected into SQLite and neither extends to version snapshots. **A candidate's text lives in the note's bundle, a sibling of `versions/`** (2026-09-14) — the local half no decision had ever given it, settled against a Cache-tier home because switching sync off with a conflict open leaves that store permanently unreconciled, so the next rebuild would take prose the user wrote and nothing could fetch it back; it also puts the text where *resolution snapshots both sides* sends it anyway, and lets the hard-delete cascade's *"the directory itself"* cover it for free. The folder driver's missing ancestor is recorded as a constraint on that project, not solved.
- **Decided — synced-geometry-fields:** `size`, `presetId`, `floatOnTop` join the note record; `size` re-confirmed because a machine-local size makes snapshot geometry incoherent. Application rule **replaces note-model's "at open"**: a synced geometry change applies when the note is **unfocused** (immediately, or on blur) — fumis are left open indefinitely, so "at open" may never fire. **A dangling `presetId` is a render-time fallback, never a write** — the note renders plain authored geometry, the binding survives and self-heals when the settings zone catches up; the field is written only by **bind and unbind**, never by per-machine resolution failure and **never by preset deletion** — the delete cascade was struck 2026-08-02 as self-contradictory with the render-time rule, matching note-model's and management-window's decided positions. **A returning preset reaches the screen through the existing unfocused/on-blur gate** — that gate guards what is *seen*, not what is written, so a local re-resolution enters through it rather than around it. **Bind writes through on every axis** (`size` to the note record, position to the per-device blob), and **unbind and preset deletion freeze** — the note keeps the geometry it was given until something changes it again; re-resolution still writes nothing. Rejected: record-level granularity, write-locking, a sync-me prompt or status icon, reverting to a pre-bind position on unbind.
- **Decided — per-device-settings:** a **durability class**, not a settings bag. Shape = **one record per device** holding that Mac's whole picture (app-level values + every note's placement), rewritten whole on a debounce (**a local-write coalescer, not a transport knob** — once written, the blob enqueues like any durable write and the scheduler owns wire timing; ~5 s, tuned in build); each device is its record's **exclusive writer**, so no conflict machinery applies. **The blob is written atomically** (temp + rename, the `meta.json` rule), and an unreadable one recovers from the settings zone — the second legitimate read of it — or falls back to defaults where no zone exists. Key = hardware platform UUID (restore onto replacement hardware starts on defaults). **Displays keyed by UUID, falling back to the main display** — a fallback needed regardless, since a display can be absent at launch. Purge = `lastSeenAt` + user-initiated removal, never automatic. No iCloud → folded into "no iCloud → no backup", **but qualified 2026-09-15**: Time Machine captures the blob, so without sync the desk is durable exactly as far as Time Machine reaches — a same-Mac wipe-and-restore, and replacement hardware too, where sync is the *weaker* leg because the device key is the hardware UUID and new hardware starts on defaults. **The desk-loss argument this topic exported to onboarding is withdrawn, not restated** — it is false with Time Machine running, and it cannot be turned into *"your desk follows you to every Mac"* because each Mac keeps its own desk by design (no Mac reads another's layout — the property Shape B rests on). What sync adds for the desk is narrow and is now stated as such: a user with no Time Machine, and recovery when the blob file itself is unreadable. **The blob is a real file in Application Support, outside SQLite, and is the authority**: the settings-zone document is its backup (read once at first launch on a restored machine), and SQLite's window-state columns are Derived from the blob — a rebuild re-reads it identically with or without iCloud. **The map is scoped to notes with placement state on this Mac** (entries survive soft-delete, pruned by the hard-delete cascade) and each entry carries `{position, display, space, visible, lastOpened}` — `lastOpened` re-tiered from disposable to blob-carried 2026-08-02, adopting note-model's Machine-tier classification (nothing can reconstruct when a window was last raised). **It stamps on window focus** — not on unhide, which would never re-fire for a fumi permanently on the desk, and not on an agent `read`, which places nothing and so would break the scope coincidence. It is the one field that changes on *viewing* rather than arranging, so it dirties the blob most, and being a sort axis it may be flushed lazily since approximate is indistinguishable from exact. A note with no entry sorts last; recents differ per Mac by design. The scope bounds the map structurally under CloudKit's documented 1 MB record limit (~168 KB at a pathological 1,000 placed notes; crossing ~6,250); the field is `Bytes` from day one; `CKAsset` spill is the named driver-internal hatch, deliberately not taken. **The record also carries that Mac's `ComputerName`** (2026-08-23), refreshed on the write that already refreshes `lastSeenAt` and resolved at display time rather than stamped, so renaming a Mac renames it everywhere including in old rows — which **narrows** *"nobody queries another Mac's layout"* to the record minus one field: the display name is read cross-device, the layout map is not, and the blob-over-records argument stands on the half that still holds.
- **Decided — non-note synced state:** the seam gains **one primitive** — `enqueueDocument(scope, key)` / `applyDocument(scope, key, payload)`, scope `account` or `device` — serving account-global retention, the preset library and per-device settings alike. Mapped to a **separate settings zone**, because per-device state is high-frequency and irrelevant to other Macs while note data is neither. No CloudKit type reaches the core. **Account-scoped documents merge per key against the ancestor, never whole-blob** (second write wins per key; preset keys are stable ids; retention value + `retentionLastChangedAt` travel as one key) — device documents never merge at all, exclusive writer. **A deleted preset's key is retained with a deleted marker, not removed** (2026-08-02) — with the cascade struck, key removal *is* deletion, so an absence would let a stale writer resurrect the preset and silently re-bind every note whose dangling binding self-heals; presets take notes' anti-resurrection side rather than assets' (a preset's dangling references persist by design, so they are not evidence a deletion was wrong). Account documents also have **a local on-disk home** and **their own `schemaVersion`**; the local copy is a working copy of a shared document, not the authority, so a corrupt one is re-fetched rather than re-pushed.
- **Decided — child-record-ceiling:** the delete-self cascade's documented limit is **750 source references per target**, one budget shared by a note's assets, version snapshots and conflict candidates — reachable in practice only by a long-lived note under the Forever retention default. **Delete-self is kept, not replaced:** a child beyond the budget **keeps its reference and drops only the action** — a reference carries an association as well as a cascade, and only the cascade is capped, so the child stays identified (it is the sole note↔child linkage, and the manifest and `versions/` are both rebuilt from child records) and becomes an ordinary orphan when the note goes. **The orphan sweep is specified** rather than inherited unexamined: retention-purge pass plus launch/idle, never synchronous with a write, and gated on `reconciled` like every other destructive-adjacent sweep — otherwise an unreconciled Mac reads every not-yet-fetched note as a deleted parent. Rejected: hand-writing the cascade, which pays for the rare case on every note to dodge a limit most never approach. Verified empirically at implementation with the `CKAsset` ceiling — same archived source, and how the server behaves at the wall is unestablished.
- **Decided — asset-storage:** `<ulid>.<ext>` filenames + `meta.json` manifest; **the size ceiling is a hard limit** (2026-08-09) — an asset over it is refused at every entry route (drop, paste, remote fetch) at the moment of the attempt and never enters a bundle, one rule whatever the sync state, so `excluded` is retired along with its record field, its placeholder and its GC ownership rule. Accepted cost: a single-Mac user cannot put an oversized file in a note at all, a real capability traded for a store that is sync-ready at every moment and honest at the point of the drop rather than half-kept on the other Mac; the fix is **chunked-asset spanning** post-launch, and lifting the ceiling is purely additive so nothing is owed on the way back out. **The number is Apple's** — the documented per-`CKAsset` maximum, not a judgement of ours, so there was nothing to choose; it is verified empirically at implementation (the source table is archived, and an unattributed 250 MB recommendation circulates), and the ceiling lifts to whatever the real limit proves to be. `missing` is now the only absent-asset state, reachable only by agent error or a damaged bundle — **sync produces no absent assets at all**, which the upload side earns via **atomic publish**: a note's content and the asset records it references publish as one unit, so a split batch, a permanently rejected asset and a quota pause all stall the note (visible as `pending` / `rejected`) rather than publishing a token that resolves to nothing. The local atomic add's missing half. **No per-bundle byte ceiling** — the per-asset limit is the only byte bound and the **store-size indicator** is the backstop, since a *"this note is full"* refusal names a state the user cannot see the cause of, where *"that file is too big"* names something actionable; and there is **no aggregate bound at all** — the 750-delete-self-reference limit looked like one mid-argument, but child-record-ceiling settles that a surplus child is created without a reference, so it bounds the free cascade rather than child count. **Every asset is referenced by content.** **Duplication is the design, not a gap** — the same image in two notes is two ULIDs, two files, two uploads and two independent ref-counts, which is the cost copy-only bought; **content-hash dedup is dropped rather than deferred** (2026-08-04), since content-hash *identity* breaks the per-note ref-count, a shared blob store breaks self-containment, and APFS cloning — the one form that breaks neither — saves local disk but not iCloud quota. Retention and the **store-size indicator** are the space levers *(`excluded` struck from this list 2026-08-09 with the flag itself; the indicator carries more of the weight than it did, since everything admitted is now also uploaded)*. **The indicator is defined** (2026-08-09): the engine records the store's bytes on disk with a per-lever breakdown — because CloudKit exposes no container-usage API, so an iCloud figure was never available; **the buckets re-cut 2026-09-14** from artifact kind to **lever** — an asset counts where it is pinned (current content → Current, retained history only → History, both → Current, counted once), and a note in Recently Deleted counts whole under the bin — because retention frees *asset* bytes, so a kind-based cut buried the lever in the bucket not named after it and told a user asking *what does shrinking retention get me* to look at the negligible one. Counting a both-pinned asset as Current is the safe direction: the opposite inflates the lever's apparent payoff, and the user acts on it. The History figure reports what history is **holding**, not what today's shrink returns today — the eligibility grace delays the purge by a month by design, and saying so beats a user watching the number sit still and concluding the purge is broken. `quotaExceeded` remains a separate reactive signal, and the store-size figure works identically with sync off, where finite local disk is the bound. The ordering window that opens is closed three ways, none redundant: **atomic add**, **GC as a sweep never triggered by a write**, and a **24-hour young-asset grace** (the sweep can still coincide with an agent's two-call sequence; only the grace makes that impossible). Cross-Mac: **asset deletion is advisory** — a Mac still holding a live reference re-uploads, so the race self-heals. **No tombstone for assets**, deliberately the opposite of notes, because resurrection is the *correct* outcome for something still referenced. Conflict candidates count as versions for ref-counting. ~~An `excluded` asset's record is the origin Mac's to collect. `excluded` is the only absent-asset state *sync* produces; `missing` remains reachable via agent error or a damaged bundle.~~ *(Both struck 2026-08-09 by the hard limit — every Mac holds every asset, so no collection is any one Mac's, and the absent-asset story is single-cause.)*
- **Decided — soft-delete-mechanism:** flag (`deleted` + `deletedAt`), not a folder move; still syncs; filtered into a Recently-Deleted view; **no confirm on ordinary delete** (it is fully reversible — the confirm moved to permanent deletion, which guards the irreversible path). Hard-delete = record delete + tombstone (~1 year, retested and unchanged), **cascading to child records via delete-self references**; locally the bundle goes wholesale; orphans are swept. **The cascade's documented ceiling is 750 delete-self references per record** — one budget shared by assets, snapshots and conflict candidates, reachable only by a long-lived note under Forever retention — and it is **kept rather than replaced**: a child beyond the budget keeps its reference and drops only the action, staying identified while becoming an ordinary orphan for the sweep, which is **specified** as retention-purge-plus-launch/idle behind the `reconciled` gate. Hand-writing the cascade to dodge a limit most notes never approach would cost more than the limit does. **Propagating deletions — hard-deletes and retention purges alike — reconcile before asset repair runs** (a Mac that has not reconciled does not repair, exactly as it does not purge), or an unsynced Mac would re-upload assets it is about to delete. No auto-purge.
- **Decided — folder-drivers-and-backup:** v1 CloudKit-only. No picker; the stored preference ships **OFF**, and **that is a statement about the shipped preference, not about what first run proposes** *(scoped 2026-09-15)*: with an iCloud account present onboarding's first-run screen offers sync **on**, visible and switchable before Continue; with no account there is nothing to offer. The ruling predates the screen — it was one clause about the shipped configuration, and Continue is the act that writes the preference. Rejected: reading it as *nothing leaves the Mac without a deliberate yes* and reversing onboarding — that requires holding an unread screen to be no consent, which makes the screen pointless and strands the second-Mac user in an empty app. The **visible backfill** is what keeps a pre-enabled default from being a silent one. Named cost: this topic ships no in-app iCloud purge, decided partly on *nobody asked for it* and taken when enabling was explicit — re-tested and kept, since the reasons that carried it (macOS owns the purge; degrade-never-destroy) are untouched, and answering a discoverability problem with a destructive remote action is the wrong trade. Where the off switch and the purge live is onboarding's copy. No-iCloud detected → no backup. Backup = CloudKit + Time Machine + Recently-Deleted. **Time Machine restore defined**: a full restore is an offline Mac catching up (existing merge/tombstone rules, nothing new); a selective restore into a live store is out-of-contract but imported at the launch walk as a deliberate local edit (hash-mismatch vs projection), never silently reverted — supported shape is restore-then-relaunch. **An absent zone is never evidence of intent** — indistinguishable from a purge, a token expiry or an Apple-side fault, so it always means *"I have lost my sync relationship"*: stop, leave local truth untouched, tell the user, require explicit re-enable. Both naive readings rejected (re-upload undoes a deliberate purge; treating it as mass deletion destroys local truth). **The engine records sync state; management-window renders it.**
- **Decided — version-history:** synced append-only immutable markdown snapshots (CloudKit child records, **everything downloaded eagerly**); asset ref-count-by-link; restore snapshots the pre-restore state first. **One cadence for every actor** — `blur` means *done with the note*: focus leaving for the GUI, the call ending for CLI/MCP (no idle layer there — a call isn't streamed); a call end arms a **~5 s settle window** (same-channel calls extend it — a burst is one snapshot at settle; the cross-channel flush outranks the settle and is never debounced). **A write to a note with pending unsnapshotted changes flushes a snapshot first, whoever is writing** — "pending" is the derivable predicate `hash(content) ≠ hash(latest snapshot)`, never a stored flag, so it survives restart/rebuild and computes identically on every Mac. Snapshots record the authored `size` and `presetId` alongside content. Attribution = **`via`** (channel: `app`/`cli`/`mcp`, engine-known, unspoofable) + **`by`** (optional, self-reported, absent means unknown) — deliberately no user-vs-agent field, since the CLI is a shared surface and the actor isn't determinable. **Attribution describes the work captured, never the trigger**: engine-originated snapshots (dirty flush, pre-restore, pre-resolution) credit the note's last writer, carried by two synced fields on the note record (`lastVia`, optional `lastBy`); no `engine` channel value. Retention is **account-global**, **default Forever** (retention is asset GC, not history policy — and Forever's failure mode is visible via the store-size indicator, where a shorter default's is not), purged **lazily** from an eligibility clock with a **30-day grace**, and **never from stale state** — where "reconciled" is defined in two clauses: a never-synced store is always reconciled (local state is total state — retention/GC/repair work fully for sync-off users), and a store with a current or former sync relationship reconciles per zone by a completed fetch this engine session (unreachable / stopped / disabled-after-enabled = not reconciled, sweeps wait).
- **What the sweeps settled**, in the order they landed: retention↔sync reconciliation, eager download, tombstone home, account-switch partitioning, enable-time backfill/quota, oversized-asset placeholder, conflict-note lifecycle, CKRecord field mapping; then state-tiering fallout, non-note synced state, conflict-model specification, asset GC across Macs, destructive remote-state events, store location, and a stale-prose sweep; then the per-device authority chain, the Application Support layout, account-document merge, engine-originated snapshot attribution, the derivable dirty predicate, the burst settle window, dangling presets, purge/repair ordering, resolution snapshotting both sides, "reconciled" defined, the blob ceiling researched via deep-dive-001, Time Machine restore, upload enqueue, and the `schemaVersion` procedure; then the two-vocabularies split and the `window_state` restatement that forced `display_uuid`, `lastOpened`'s stamping trigger and read semantics, the blob's debounce layer and its torn-write story, preset-key deletion in the account merge, the re-resolution gate, bind-writes-through, the account documents' local home, document payload versioning, and the unprojected attribution fields; then two surviving `excluded` sites, the 750 limit mistaken for an aggregate bound, the assets manifest missing from the sidecar's full set, the overflow child's lost linkage and the unspecified orphan sweep, the store-size indicator behind an iCloud-quota name, and atomic publish on the upload side.
- **What the rerouted concerns changed** — from note-model: the preset-delete cascade struck, `last-opened` re-tiered, the derivation version given its reprojection mechanism, **content-hash dedup dropped rather than deferred**, **sidecar repair ordered behind `reconciled`**, and on 2026-08-09 the **hard size limit** and the **aggregate-bundle bound**; from note-window: two concerns absorbed by those decisions rather than fixed on their own terms, on 2026-08-23 the **device display name** and the **conflict candidate's writing-device key**, which together make the reconciler's row labels resolvable on both Macs, and on 2026-09-15 **the index-input premise falsified by their own insertion rule** — the filename is written into the note as the link label, so the manifest pull was dropped and the corpus returned to `content.md` alone, the rule-shaped pass input kept against the concern's own reading, and the corpus half rerouted to its owner; from onboarding-and-permissions, on 2026-09-15, **the desk-loss argument withdrawn** — their first-run work put this topic's own two statements side by side and found them incompatible; Time Machine's coverage of the blob stands and the exported encouragement leg does not, nor does the positive they had taken to replace it, since the desk does not travel between Macs by design — and, the same day, **the default-off ruling scoped to the shipped preference**, so their pre-enabled first-run toggle is consistent with it rather than a contradiction of it, with the visible backfill carrying the honesty and the absent in-app iCloud purge re-tested and kept as the named cost; from platform-support, on 2026-09-11, **the project floor surrendered to the topic that owns it** — this document's four restatements of macOS 14 as the project minimum were amended, keeping `CKSyncEngine`'s 14.0 availability as the measurement it always was and dropping the claim that it sets the range. None of this topic's reasoning moved: CloudKit is slack beneath a floor set on the Space-placement route.

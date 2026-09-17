# Reference Imports — one home for shared material, whatever the phase and whatever the file

A file the user shares is an import. Today an import is a markdown file that arrives at discovery's opener, lands in `.workflows/{wu}/imports/`, and reaches every later phase as knowledge-base chunks. The screenshots a research session was handed in Fumi are the same thing arriving later and in a shape the knowledge base cannot embed — and nothing in the system could land them, so two sessions invented `{phase}/assets/{topic}/` by hand and committed around the engine. Opened 2026-09-17.

## Motivation

- **No way to land a file after the opener.** Discovery's confirm-trigger is the only path into `imports/` (`workunit create --import`, once, at the work-type commit). The roadmap loop has a mid-session **Shared files** branch (`workflow-roadmap/references/session-loop.md`, `engine roadmap import`); research, discussion, investigation, and an existing epic's discovery session have none. A file shared mid-session is read ad hoc and never lands.
- **Binaries cannot land at all.** `normaliseBasename` appends `.md` to every name, so a jpeg would land as `x.jpeg.md`, and the knowledge index the transaction spawns reads it as utf8 and either refuses (a dotted topic) or embeds garbage. The same coercion already breaks a `.txt` import today: `design.txt` lands as `design.txt.md`, its topic is `design.txt`, and the index call fails behind a warn-don't-block.
- **The scoped commit cannot carry an invented directory.** `commit --topic research/{topic}` names the research file and its triage queue; a session that put images beside them got `ok: true` and untracked files. The peer session's report: `?? .workflows/fumi/research/assets/`.
- **The material has to survive to the build.** An onboarding flow captured in eleven screenshots is reference for the discussion, for the spec, and for the implementer. A description woven into the discussion is not enough; the picture has to be openable from the spec.

## Rulings

- **R1 — Reference material is an import, wherever and whenever it arrives.** One home, `.workflows/{wu}/imports/`, one manifest field, `imports[]`, for every phase and every file type. Whether a file is digested once or kept linked is decided in the conversation, per work unit; a directory name never encodes that use. There is no `assets/` directory.
- **R2 — Every import records its origin.** `origin` is a required field on every `imports[]` entry: `discovery` (the opener or a discovery session), `roadmap` (project-level material), or `{phase}/{topic}` for a phase session that landed it. Absence never means anything; migration 059 backfills every existing entry.
- **R3 — The file's type decides only whether the knowledge base embeds it.** A markdown-ish source (`.md`, `.markdown`, `.txt`, `.text`, or no extension) normalises to `{stem}.md` and is indexed as today. Any other source keeps its extension, lowercased, and is tracked but never indexed: the engine never spawns `knowledge index` for it, the bulk discovery never lists it, and `knowledge index <path>` refuses it by name with the policy as the reason.
- **R4 — Landing mid-session is one self-committing verb and no gate.** `engine workunit import {wu} <path>… --from discovery|{phase}/{topic}`: validate every path first, copy, record, index what embeds, one confined commit. The session lands, links, and carries on — the roadmap's shape, with the origin added.
- **R5 — A linked import travels with the document.** A document links its import by relative path (`../imports/{name}` from a phase file, `../../imports/{name}` from a specification). Absorb rewrites, in the documents it moved, the link targets its own dedupe renamed. Promote carries into the cross-cutting unit every import a moved document links and every import a moved topic attached. Spec construction links, never copies, an import a decision rests on.
- **R6 — Topic lifecycle never touches imports.** The material is the work unit's. Topic cancel and reactivate leave `imports/` and `imports[]` alone; a rerouted concern that points at an import points at material its topic's cancel cannot orphan.
- **R7 — Imports are reference, not product assets.** A logo, a font, a fixture the product ships is copied out of `imports/` into the codebase by the implementation. The workflows are not an asset pipeline.
- **R8 — Only a path-bearing source lands.** A drop from Finder or Photos arrives with a path and lands. A clipboard paste arrives as image bytes in the message with no file behind it, and vision cannot emit the bytes back; the session asks for the file saved somewhere and lands that.

## The settled shape

### The entry

```json
{ "path": "imports/dockset-05-material.jpeg", "imported_at": "2026-09-17T09:41:00.000Z", "origin": "research/onboarding-and-permissions" }
```

`origin` is one predicate beside the thread-origin predicates in `kernel/manifest-schema.cjs`: `discovery` or `roadmap`, or `{phase}/{topic}` with the phase one of `IMPORT_PHASES = ['research', 'discussion', 'investigation']` and the topic a plain name. The one door that takes an origin from outside — the verb — validates it; the landers that stamp a constant need no check; absorb's re-aim produces a valid one because its topic passes the same plain-name rule. The field surface stays the unvalidated repair hatch, as it is for thread origins. The roadmap's `roadmap.imports[]` entries carry `origin: "roadmap"`, and `roadmap state` carries the field through instead of dropping it.

### Names

`normaliseBasename` splits the source name at its last dot. The stem is normalised as today (lowercased, runs of non-alphanumerics collapsed to `-`, trimmed). An extension in the markdown-ish set, or none, yields `{stem}.md`; any other yields `{stem}.{ext}` with the extension lowercased. A leading-dot basename, whatever follows the dot, still returns `null` and is reported under `skipped_imports`. `dedupe` suffixes the stem, never the extension: `{stem}-2.{ext}`. Both helpers stay shared by create, the roadmap import, absorb, and the new verb.

The knowledge base's flat identity for an import stays the `.md` basename without extension. A non-`.md` import has no identity: `deriveIdentity` refuses `.workflows/{wu}/imports/{name}.{ext}` and `.workflows/.roadmap/imports/{name}.{ext}` with `imports are tracked on the manifest; only markdown imports are indexed`, and `collectFlatEntries` and the roadmap walk exclude it by a named predicate rather than by the shape regex alone.

### Landing

`engine workunit import <wu> <path> [<path> …] --from <origin>` — implemented in `domain/workunit-import.cjs`, sharing the plan/copy/record discipline with `createWorkUnit` and `importRoadmapFiles` through one extracted helper.

Refused when: the work unit does not exist or is not `in-progress`; `--from` is absent, not a valid origin, `roadmap` (the product layer's own, with its own verb), or a `{phase}/{topic}` naming no phase item; any path is missing, is not a regular file, or cannot be read (the whole call fails with `missing_imports` on the payload, nothing copied — a dropped folder never half-lands; one shared check serves every lander); every source skips on normalisation. In one lock hold: plan and dedupe against the directory and the batch, copy each file (mode `0644`, whatever the source's), push `{path, imported_at, origin}`. After the lock: `knowledge index` for each landed `.md` (warn-don't-block); `commitTailWithKb` over `.workflows/{wu}/imports`, `.workflows/{wu}/manifest.json`, and the store dirt, message `workflow({wu}): import {n} file(s) for {origin}`, and on a failed commit a retry note naming the confined scope — `engine commit {wu} --imports`, the one scope `engine commit` gains here — so the retry never sweeps a peer's dirt. The dispatch beats presence on `--from`'s phase and topic after the domain call, as `topic absorb` does, and only while that item is live; a terminal item is neither beaten nor cleared (a landing is not a session's close), and a bare `discovery` origin beats nothing. Response: `{ op: 'import', imports: [{path, origin}], skipped_imports, warnings?, committed, note? }`.

`workunit create --import` stamps `origin: "discovery"`; `roadmap import` stamps `origin: "roadmap"`. Both skip the index spawn for a non-`.md` landing.

### Movements

**Absorb** already moves `imports[]` with the feature's entries and dedupes against the epic's directory. Two additions inside the same lock hold, after the documents and the files are at their final paths and before the epic manifest is saved: every entry whose origin is `{phase}/{feature}` is rewritten to `{phase}/{topic}`; and for every import the dedupe renamed, the two moved documents have each link target `../imports/{old}` rewritten to `../imports/{new}` — a link in the relative form documents write (any depth of `../`), an exact substitution bounded by a non-name character, every rename in one pass, applied only to the documents this absorb moved, idempotent on a re-run. A path that merely contains `imports/` — a repository path cited in prose — is never touched. The result carries `renamed_imports: [{from, to}]` and the receipt says so. This is a content substitution in the domain ring; the invariant is that the engine rewrites only a path its own rename broke, in a document its own move relocated. One grammar for the link lives in the landing helper and serves absorb's rewrite and promote's scan alike.

**Promote** moves the specification and its source discussions and nothing else today. It gains a carry: every import a moved document links in that relative form (in the specification or a moved discussion) and every import whose origin names a moved discussion (`discussion/{source}`) is *copied* to `.workflows/{to}/imports/{name}` with its entry, origin unchanged, into the cross-cutting manifest's `imports[]`. A copy, not a move: another topic of the epic may link the same file. Copied `.md` imports are indexed at the cross-cutting identity; the epic's remain. The whole-unit pathspecs already carry the files, and the receipt counts what was copied.

**Pivot**, **work-unit cancel**, **topic cancel**, **topic reactivate**: unchanged. The bulk re-index and remove are manifest-driven and already skip what the shape excludes.

### The document

The session lands the file, reads it (vision for an image), and links it from the phase document by relative path with the link text saying what the file shows — `![Dockset's fifth onboarding screen, the permissions ask](../imports/dockset-05-material.jpeg)`. The description around the link is the searchable record; the link is what a later reader opens. The document's own commit is unchanged: the import committed itself.

Spec construction, at the exhaustive extraction: an import a source links and a decision rests on is linked from the spec as `../../imports/{name}` with the same text — the reference carries, its content is never pasted in. Imports are not a new spec input type; the link rides inside the extracted content.

### The prose

One shared reference, loaded as a protocol beside `rerouted-concerns.md` where each phase loads its protocols and entered from the step that recognises what the user's message carries: the research wrappers' **A** and `session-loop.md`'s *Explore*; `discussion-session.md`'s **A** and its *Discuss* step; the investigation skill's Step 3 above its resumed/fresh split, entered from the symptom interview's reference-gathering question, and its Step 6 beside `analysis-checkpoints.md`, entered from a section beside *Asking the User*; the discovery session loop's *Recognise intent* branch, mirroring the roadmap's **Shared files** line. The protocol: a path the user offers lands via the verb with the session's origin, each path single-quoted (a screenshot's name carries spaces; a `~` path is written out in full; a single quote inside a path is written `'\''`); `missing_imports` renders the engine's re-prompt (`render import-reprompt`, the one surface every landing door uses — the opener's confirm-trigger, the roadmap's two landings, and this protocol), ends the turn, and re-enters the landing over the corrected paths together with the ones the refusal did not name, or, on the re-prompt's skip, lands nothing for them; any other refusal is said in the engine's words and nothing is linked; on a landing, `skipped_imports` (a leading-dot source, or a name that normalises away) and `warnings` are said in passing, and a `note` means the landing's commit is pending and the retry it names runs before the session's next write; a pasted image with no path gets a one-line ask for the saved file, the turn ends, and the answer re-enters the landing; the landed name is the response's `imports[].path`, never the name the user typed, since the engine normalises and dedupes; the file is read for the conversation and linked from the document at the next write. No gate: the asks end the turn, nothing else does.

## Rejected shapes

- **An `assets/` directory, per phase and per topic.** The de facto convention. Encodes a use (referenced, not digested) that the conversation decides, duplicates landing, provenance, commit confinement, absorb, and promote for a difference that is one branch in the indexer, and leaves cancel and cross-topic reroutes to orphan-tracking.
- **Absence of `origin` meaning discovery.** A field whose absence carries meaning is a field nobody can validate. Backfill instead.
- **Refuse absorb on a basename collision.** Simpler than a rewrite, but it hands the user a rename-and-relink chore for a case the engine caused and can undo exactly.
- **Move imports at promote.** Breaks any other epic document that links the same file.
- **Recover a clipboard paste from the session transcript.** The bytes are there, but reading Claude Code's transcript format is a dependency on an internal.
- **A new spec input type for imports.** Sources and consult references are decision records with an incorporation status; an import is material a decision cites. The link inside the extracted content is the whole relationship.
- **Surface imports on the dashboards by name.** Eleven screenshots listed above an epic's map is noise; the counts stay, and the linking document is where an import is met.

## Consequences

- **Legacy `{name}.txt.md` imports** stay as landed; their index call has always failed and keeps failing. New `.txt` sources land as `{name}.md` and index. No rename migration: the session log's Imports lines name the old files.
- **The discovery session-log template and the roadmap session template** list `imports/{filename}`, not `imports/{filename}.md`.
- **`imports_count`** counts every entry, binaries included; `MATERIAL` blocks and the absorb summary are unchanged.
- **Roadmap pull** does not carry roadmap imports into the pulled unit; unchanged and out of scope.
- **Fumi's two hand-rolled directories** are moved into `imports/` by hand in that project: no migration ships for an improvised path.
- **`workflow-knowledge/SKILL.md`, `CLAUDE.md`, `commands.md`, and the user-facing `docs/`** stop saying imports arrive only at the opener and are always indexed; the presence beat table and `CLAUDE.md`'s presence list name the verb; the docs for research, discussion, and investigation say a shared file lands in `imports/` and is linked.
- **The re-prompt's paths render as a code block** (data, never a blockquote) with a skip row, so a user who cannot produce the file is never locked out of creating the work unit; its wording covers a folder and an unreadable file, not only a missing one.
- **The opener's fenced invitations** name screenshots, not only the instruction above them.
- **Discovery's launchpad** reads a markdown import as prose and an image with vision, and names anything else rather than opening it; the opener's invitation names screenshots among what a user might share; the session log records a landing under Edits as the roadmap's does (`Imported: {filename}`), and the log's exploration links the file where it is discussed.
- **The paths in every documented landing call are quoted** — the opener's `--import`, the roadmap's, and the verb's.

## Engine surface

| Surface | Change |
| --- | --- |
| `kernel/manifest-schema.cjs` | `IMPORT_FIXED_ORIGINS`, `IMPORT_PHASES`, `isImportOrigin` |
| `domain/import-landing.cjs` (new) | the shared landing discipline — extension-aware `normaliseBasename`/`dedupe`, the regular-file check, plan, copy `0644`, entry with origin, `isIndexableImport`, `importArtifact`, the one import-link grammar |
| `domain/workunit-create.cjs` | lands through the helper; `origin: "discovery"`; index only `.md` |
| `domain/workunit-import.cjs` (new) | `importWorkUnitFiles(cwd, wu, paths, {origin})` — refusals (including a `roadmap` origin and an origin naming no item, read through `itemOf`), the lock hold, index, the confined tail commit whose retry note names `--imports` |
| `domain/roadmap-session.cjs`, `domain/roadmap.cjs` | `origin: "roadmap"`; index only `.md`; `roadmap state` carries `origin` |
| `domain/workunit-absorb.cjs` | shape regex accepts any extension; the topic name held to the schema's plain-name rule; origin rewrite; the link rewrite; `renamed_imports`; index only `.md` |
| `domain/workunit-promote.cjs` | the import carry: link scan + origin join, copy, entries, index at the new identity |
| `engine.cjs` | `workunit import` dispatch with `beatQuietly` on the origin while its item is live; `commit --imports`, the confined scope the retry note names; usage lines |
| `render.cjs`, `projections/transactions.cjs` | `render import-reprompt --file` (every landing door's `missing_imports` re-prompt: the paths as a code block, a prompt row and a skip row); `render promote-receipt --imports <N>`; the absorb receipt's renamed row wrapped by the engine |
| `migrations/059-backfill-import-origins.cjs` | every work unit's `imports[]` → `origin: "discovery"`; the project manifest's `roadmap.imports[]` → `origin: "roadmap"`; entries already carrying one untouched |
| `references/commands.md` | the verb, the origin vocabulary, the roadmap import paragraph |
| `src/knowledge/index.js` + bundle | the two `deriveIdentity` refusals; the named exclusion in `collectFlatEntries` and the roadmap walk |
| `projections/transactions.cjs`, `render.cjs` | the absorb receipt's renamed-links line |

## Test plan

- `test-engine-workunit-create.cjs` — `.txt` lands as `.md`; `.jpeg`/`.PNG` keep a lowercased extension; dedupe suffixes the stem; every entry carries `origin: "discovery"`; the index spawn is skipped for a binary and made for a `.md`; the exact-keys assertion updated.
- `test-engine-workunit-import.cjs` (new) — happy path and the beat over every `IMPORT_PHASES` origin and bare `discovery`; the entry shape; `0644` on the copy; refusals (missing unit, completed unit, bad origin, `roadmap`, an origin naming no item, missing path or a directory copies nothing, all-skipped, a leading-dot source skipped); an epic topic named differently from its work unit beats its own row; an absolute out-of-project source lands; dedupe against the directory and the batch; the confined commit stages the imports directory and the manifest and nothing else dirty; KB failure warns and the commit still lands; the retry note names `--imports` on a failed commit; a terminal item's existing presence row survives a landing untouched.
- `test-engine-commit-door.cjs` — `commit --imports` stages the imports directory and the manifest and leaves a peer's dirt alone.
- `test-engine-roadmap.cjs` — `origin: "roadmap"` on landing; `roadmap state` carries it; a binary lands with no warning, so no index spawn; a directory refuses.
- `test-engine-workunit-absorb.cjs` — origin rewritten from the feature's name to the topic's; a renamed import's link rewritten in the moved discussion and research and nowhere else; two renames in one pass, each link on its own new name; a repository path containing `imports/` in prose untouched; an unrenamed import's link untouched; `renamed_imports` in the result and the receipt; idempotent re-run; a binary entry accepted by the shape check; an untrimmed topic refused.
- `test-engine-workunit-promote.cjs` — an import linked by the spec, one linked by a moved discussion, one attached by a moved discussion and linked by nothing, one belonging to an unmoved topic: the first three copied with entries, the fourth not; a prose mention of `src/imports/{name}` carries nothing; the epic keeps its files and entries; `.md` copies indexed at the new identity; the receipt's copied count.
- `test-engine-render-surfaces.cjs` — `import-reprompt` over one and several missing paths.
- `test-migration-059.cjs` — work-unit entries backfilled, roadmap entries backfilled, entries with an origin untouched, no-op, idempotency, malformed manifest skipped, content preserved.
- `test-knowledge-discovery.cjs`, `test-knowledge-cli.sh` — `imports/diagram.png` not discovered by the bulk walk; `index` on it refused with the policy message, not the structure message; the roadmap twin.
- `test-pipeline-simulation.cjs` — a scenario lands a binary and a markdown import from a research session, absorbs into an epic over a colliding name, and promotes carrying the linked import; the state audit holds every `imports[]` entry to the path shape and the origin predicate after every mutation.
- Prose cases: `research-lands-a-shared-image` (a feature research session is handed an image whose filename carries spaces and capitals, lands it through the verb before any write, links it by the landed name, and the write-up's commit leaves nothing untracked; `calls_in_order` puts the import before the first research write) `investigation-lands-a-shared-screenshot` (the symptom-gathering question bank's screenshot answer lands and is linked from the investigation file), and `research-lands-a-shared-image-after-a-wrong-path` (a wrong path first: the engine refuses, the re-prompt renders, the turn ends, the corrected path lands). All snapshotted; both claim the read of the landed file and the link, never what the pixels show — the fixture images are blank, and what the picture depicts comes from the user's words. Every research, discussion, and investigation case that runs a session wrapper declares the shared reference in `files`, as it declares `rerouted-concerns.md`.

## Build plan

Design doc standalone (PR0). Three implementation slices, each one agent, each reviewed against the tree before the next opens, stacked in landing order.

- **PR1 — engine.** Everything in the engine surface table but the knowledge base and the receipt line; migration 059 with its test; `commands.md`; the simulation scenarios. Green on `npm test`, `npm run test:cli`, `npm run typecheck`.
- **PR2 — knowledge base.** `src/knowledge/index.js`, the rebuilt bundle, `workflow-knowledge/SKILL.md`, the discovery and CLI tests.
- **PR3 — prose, docs, cases.** The shared reference and its four loads; the spec-construction line; the two templates; `CLAUDE.md`; the two prose cases with snapshots; `node tests/prose/run.cjs select --diff main` run and the intersecting cases named.

## Log

- 2026-09-17 — Second review pass, from the fix commits outward. What it found: both re-prompt loops had no give-up exit and told the user a dropped folder "could not be found"; the roadmap's genesis landing call was still unquoted; the re-prompt rendered its paths as a hand-wrapped blockquote; the absorb receipt's renamed row overflowed the width; a single quote in a path defeated the quoting rule; the origin predicate barred a leading dash no other name rule bars, so absorb could write an origin the audit rejects; the retry note contradicted the engine's own note contract; the protocol relayed neither `warnings` nor a pending commit; the opener's fenced invitations never named a screenshot; the user docs still said opener-only; the protocol's stop-and-retry arms had no case. Rulings: one re-prompt surface for every door, with a skip exit; `engine commit --imports`; the dash guard dropped; a terminal item neither beaten nor cleared; the docs ride the stack; the new modules' comments held to the bar main now carries.
- 2026-09-17 — Review pass over the open stack (#1201 → #1202 → #1204), eight dimensions, verified against the tree and scratch worlds. What it found: the landing protocol asked twice with no stop and routed every refusal but `missing_imports` into the read-and-link section; the documented call left a screenshot's spaced filename unquoted; the verb's retry note prescribed a work-unit-wide commit; a `{phase}/{topic}` origin naming no item landed and wrote a phantom presence row; a dropped folder passed the existence check and half-landed; the link grammar was spelled twice and matched any `imports/` in prose; the confirm-trigger's hand-drawn re-prompt menu was owed to the engine by the edit that touched its file; fifty session cases did not declare the new shared reference. Every fix folded into the layer it corrects; this record rewritten to the settled shape.
- 2026-09-17 — Opened from a Fumi research session's report: eleven onboarding screenshots with no supported home, hand-committed under an invented `research/assets/{topic}/`. Agreed in conversation: imports is the home, not a hack (the digest-versus-reference split does not partition the files; every mechanical need is shared); `origin` is required and backfilled, never absent-means-discovery; a clipboard paste with no path is asked for as a file; absorb handles a collision by rewriting the links its rename broke. R1–R8.

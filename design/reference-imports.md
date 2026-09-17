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

`origin` is validated at every write by one predicate beside the thread-origin predicates in `kernel/manifest-schema.cjs`: `IMPORT_FIXED_ORIGINS = ['discovery', 'roadmap']`, or `{phase}/{topic}` with the phase one of `IMPORT_PHASES = ['research', 'discussion', 'investigation']` and the topic a plain segment (no dot, no slash). The roadmap's `roadmap.imports[]` entries carry `origin: "roadmap"`, and `roadmap state` carries the field through instead of dropping it.

### Names

`normaliseBasename` splits the source name at its last dot. The stem is normalised as today (lowercased, runs of non-alphanumerics collapsed to `-`, trimmed). An extension in the markdown-ish set, or none, yields `{stem}.md`; any other yields `{stem}.{ext}` with the extension lowercased. A dotfile still returns `null` and is reported under `skipped_imports`. `dedupe` suffixes the stem, never the extension: `{stem}-2.{ext}`. Both helpers stay shared by create, the roadmap import, absorb, and the new verb.

The knowledge base's flat identity for an import stays the `.md` basename without extension. A non-`.md` import has no identity: `deriveIdentity` refuses `.workflows/{wu}/imports/{name}.{ext}` and `.workflows/.roadmap/imports/{name}.{ext}` with `imports are tracked on the manifest; only markdown imports are indexed`, and `collectFlatEntries` and the roadmap walk exclude it by a named predicate rather than by the shape regex alone.

### Landing

`engine workunit import <wu> <path> [<path> …] --from <origin>` — implemented in `domain/workunit-import.cjs`, sharing the plan/copy/record discipline with `createWorkUnit` and `importRoadmapFiles` through one extracted helper.

Refused when: the work unit does not exist or is not `in-progress`; `--from` is absent or not a valid origin; any path is missing (the whole call fails with `missing_imports` on the payload, nothing copied); every source skips on normalisation. In one lock hold: plan and dedupe against the directory and the batch, copy each file (mode `0644`, whatever the source's), push `{path, imported_at, origin}`. After the lock: `knowledge index` for each landed `.md` (warn-don't-block); `commitTailWithKb` over `.workflows/{wu}/imports` and `.workflows/{wu}/manifest.json`, message `workflow({wu}): import {n} file(s) for {origin}`, a retry note naming that scope. The dispatch beats presence on `--from`'s phase and topic after the domain call, as `topic absorb` does; a bare `discovery` origin beats nothing. Response: `{ op: 'import', imports: [{path, origin}], skipped_imports, warnings?, commit }`.

`workunit create --import` stamps `origin: "discovery"`; `roadmap import` stamps `origin: "roadmap"`. Both skip the index spawn for a non-`.md` landing.

### Movements

**Absorb** already moves `imports[]` with the feature's entries and dedupes against the epic's directory. Two additions inside the same lock hold, after the documents and the files are at their final paths and before the epic manifest is saved: every entry whose origin is `{phase}/{feature}` is rewritten to `{phase}/{topic}`; and for every import the dedupe renamed, the two moved documents have each link target `imports/{old}` rewritten to `imports/{new}` — an exact substitution bounded by a non-name character, applied only to the documents this absorb moved, idempotent on a re-run. The result carries `renamed_imports: [{from, to}]` and the receipt says so. This is the first content substitution in the domain ring; the invariant is that the engine rewrites only a path its own rename broke, in a document its own move relocated, and nothing else.

**Promote** moves the specification and its source discussions and nothing else today. It gains a carry: every import a moved document links (`imports/{name}` in the specification or a moved discussion) and every import whose origin names a moved discussion (`discussion/{source}`) is *copied* to `.workflows/{to}/imports/{name}` with its entry, origin unchanged, into the cross-cutting manifest's `imports[]`. A copy, not a move: another topic of the epic may link the same file. Copied `.md` imports are indexed at the cross-cutting identity; the epic's remain. The whole-unit pathspecs already carry the files.

**Pivot**, **work-unit cancel**, **topic cancel**, **topic reactivate**: unchanged. The bulk re-index and remove are manifest-driven and already skip what the shape excludes.

### The document

The session lands the file, reads it (vision for an image), and links it from the phase document by relative path with the link text saying what the file shows — `![Dockset's fifth onboarding screen, the permissions ask](../imports/dockset-05-material.jpeg)`. The description around the link is the searchable record; the link is what a later reader opens. The document's own commit is unchanged: the import committed itself.

Spec construction, at the exhaustive extraction: an import a source links and a decision rests on is linked from the spec as `../../imports/{name}` with the same text — the reference carries, its content is never pasted in. Imports are not a new spec input type; the link rides inside the extracted content.

### The prose

One shared reference, loaded as a protocol beside `rerouted-concerns.md` where each phase loads its protocols and entered from the step that recognises what the user's message carries: the research wrappers' **A** and `session-loop.md`'s *Explore*; `discussion-session.md`'s **A** and its *Discuss* step; the investigation skill's Step 6 beside `analysis-checkpoints.md`, entered from a section beside *Asking the User*; the discovery session loop's *Recognise intent* branch, mirroring the roadmap's **Shared files** line. The protocol: a path the user offers lands via the verb with the session's origin; `missing_imports` re-prompts; `skipped_imports` is said; a pasted image with no path gets a one-line ask for the saved file; the file is read for the conversation and linked from the document at the next write. No gate.

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
- **`workflow-knowledge/SKILL.md`, `CLAUDE.md`, and `commands.md`** stop saying imports arrive only at the opener and are always indexed; `commands.md` gains the paragraph `roadmap import` never had.

## Engine surface

| Surface | Change |
| --- | --- |
| `kernel/manifest-schema.cjs` | `IMPORT_FIXED_ORIGINS`, `IMPORT_PHASES`, `isImportOrigin` |
| `domain/workunit-create.cjs` | extension-aware `normaliseBasename`/`dedupe`; the shared land helper (plan, copy `0644`, entry with origin); `origin: "discovery"`; index only `.md` |
| `domain/workunit-import.cjs` (new) | `importWorkUnitFiles(cwd, wu, paths, {origin})` — refusals, the lock hold, index, the confined tail commit |
| `domain/roadmap-session.cjs`, `domain/roadmap.cjs` | `origin: "roadmap"`; index only `.md`; `roadmap state` carries `origin` |
| `domain/workunit-absorb.cjs` | shape regex accepts any extension; origin rewrite; the link rewrite; `renamed_imports`; index only `.md` |
| `domain/workunit-promote.cjs` | the import carry: link scan + origin join, copy, entries, index at the new identity |
| `engine.cjs` | `workunit import` dispatch with `beatQuietly` on the origin; usage lines |
| `migrations/059-backfill-import-origins.cjs` | every work unit's `imports[]` → `origin: "discovery"`; the project manifest's `roadmap.imports[]` → `origin: "roadmap"`; entries already carrying one untouched |
| `references/commands.md` | the verb, the origin vocabulary, the roadmap import paragraph |
| `src/knowledge/index.js` + bundle | the two `deriveIdentity` refusals; the named exclusion in `collectFlatEntries` and the roadmap walk |
| `projections/transactions.cjs`, `render.cjs` | the absorb receipt's renamed-links line |

## Test plan

- `test-engine-workunit-create.cjs` — `.txt` lands as `.md`; `.jpeg`/`.PNG` keep a lowercased extension; dedupe suffixes the stem; every entry carries `origin: "discovery"`; the index spawn is skipped for a binary and made for a `.md`; the exact-keys assertion updated.
- `test-engine-workunit-import.cjs` (new) — happy path over a binary and a markdown source with `--from research/{topic}` and bare `discovery`; the entry shape; `0644` on the copy; refusals (missing unit, completed unit, bad origin, phase outside `IMPORT_PHASES`, missing path copies nothing, all-skipped); dedupe against the directory and the batch; the confined commit stages the imports directory and the manifest and nothing else dirty; KB failure warns and the commit still lands; the presence beat on the origin's topic.
- `test-engine-roadmap.cjs` — `origin: "roadmap"` on landing; `roadmap state` carries it; a binary lands without an index spawn.
- `test-engine-workunit-absorb.cjs` — origin rewritten from the feature's name to the topic's; a renamed import's link rewritten in the moved discussion and research and nowhere else; an unrenamed import's link untouched; `renamed_imports` in the result and the receipt; idempotent re-run; a binary entry accepted by the shape check.
- `test-engine-workunit-promote.cjs` — an import linked by the spec, one linked by a moved discussion, one attached by a moved discussion and linked by nothing, one belonging to an unmoved topic: the first three copied with entries, the fourth not; the epic keeps its files and entries; `.md` copies indexed at the new identity.
- `test-migration-059.cjs` — work-unit entries backfilled, roadmap entries backfilled, entries with an origin untouched, no-op, idempotency, malformed manifest skipped, content preserved.
- `test-knowledge-discovery.cjs`, `test-knowledge-cli.sh` — `imports/diagram.png` not discovered by the bulk walk; `index` on it refused with the policy message, not the structure message; the roadmap twin.
- `test-pipeline-simulation.cjs` — a feature mainline lands a binary and a markdown import from its research session, absorbs into an epic over a colliding name, and the state audit holds; a promote carries the linked import.
- Prose cases: `research-lands-a-shared-image` (a feature research session is handed an image path, lands it through the verb before any write, links it, and the write-up's commit leaves nothing untracked; `calls_in_order` puts the import before the first research write) and `investigation-lands-a-shared-screenshot` (the symptom-gathering question bank's screenshot answer lands and is linked from the investigation file). Both snapshotted.

## Build plan

Design doc standalone (PR0). Three implementation slices, each one agent, each reviewed against the tree before the next opens, stacked in landing order.

- **PR1 — engine.** Everything in the engine surface table but the knowledge base and the receipt line; migration 059 with its test; `commands.md`; the simulation scenarios. Green on `npm test`, `npm run test:cli`, `npm run typecheck`.
- **PR2 — knowledge base.** `src/knowledge/index.js`, the rebuilt bundle, `workflow-knowledge/SKILL.md`, the discovery and CLI tests.
- **PR3 — prose, docs, cases.** The shared reference and its four loads; the spec-construction line; the two templates; `CLAUDE.md`; the two prose cases with snapshots; `node tests/prose/run.cjs select --diff main` run and the intersecting cases named.

## Log

- 2026-09-17 — Opened from a Fumi research session's report: eleven onboarding screenshots with no supported home, hand-committed under an invented `research/assets/{topic}/`. Agreed in conversation: imports is the home, not a hack (the digest-versus-reference split does not partition the files; every mechanical need is shared); `origin` is required and backfilled, never absent-means-discovery; a clipboard paste with no path is asked for as a file; absorb handles a collision by rewriting the links its rename broke. R1–R8.

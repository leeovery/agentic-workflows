# PR4 — KB Indexing of Discovery Logs

Index epic discovery session **logs** (records) into the knowledge base under a new `discovery` phase, so prior discovery is a full-fidelity, searchable fallback for later phases (and for sibling-epic cross-pollination). Requires a `src/knowledge/` change, the mandatory chunk config, a finalize call site, **rewriting an anti-pattern that currently forbids this**, and a committed bundle rebuild.

> Read `00-overview.md` → Design → KB, and Research provenance.

## At a glance

- **Branch:** `feat/deep-discovery-pr4-kb-indexing`
- **Base / target:** `feat/deep-discovery-pr3-reentry`
- **Builds on:** PR1's `sessions/` path (the index path pattern targets `discovery/sessions/session-NNN.md`). Lights up PR3's "older via KB" fallback.
- **Design slice:** KB indexing. **Epic-only** — non-epic single-phase logs are thin shape-and-route and not indexed.
- **Identity:** topic = **work_unit** (a discovery log spans many topics; the log is the work-unit-level record, briefs are the per-topic views).

## Tasks

### 1. `src/knowledge/index.js`

- Add `'discovery'` to `INDEXED_PHASES` (~line 22).
- Add `discovery` to the `deriveIdentity()` phase regex enum (~line 296).
- Add a path branch (~line 331 block) for `discovery/sessions/session-NNN.md` → `{ workUnit, phase: 'discovery', topic: workUnit }`.

### 2. NEW chunk config `skills/workflow-knowledge/chunking/discovery.json`

**Mandatory** — `index.js:497` loads `chunking/{phase}.json` and `:498` `fs.existsSync`-guards it; absent ⇒ the indexer **throws**. Mirror `chunking/research.json`; `"phase":"discovery"`, `"confidence":"low"` (exploratory shape-setting, not validated decisions), split on the H2 headings (Exploration / Edits / Topics-Identified).

### 3. Finalize call site

Add `knowledge index .workflows/{wu}/discovery/sessions/session-{NNN}.md` at session finalisation. Home: `references/confirm-and-persist.md` §C (after the Conclusion is finalised). **Re-index on each harvest** (idempotent — `index.js` removes the prior identity before re-adding). Epic path only.

### 4. REWRITE the anti-pattern

`references/conclude-discovery.md` (~lines 9–12) currently **forbids** `knowledge index` ("Do not call knowledge index … session logs are journey records, not retrievable artifacts"). This directly contradicts the new design. **Remove** that instruction and replace it with the new reality (logs ARE indexed now; or move the indexing into `confirm-and-persist.md` and have conclude state that logs are indexed). Do not just append — leaving the contradiction will mislead a future agent.

### 5. Bundle rebuild

`npm run build` → regenerate `skills/workflow-knowledge/scripts/knowledge.cjs`. **Commit the bundle in this PR** (AGNTC installs the committed bundle; there is no build step at install). A src-only PR ships a stale bundle.

### 6. Tests `tests/scripts/test-knowledge-*`

- Extend `test-knowledge-cli.sh` / `test-knowledge-integration.cjs` for discovery-phase identity derivation (a `discovery/sessions/session-001.md` path → `phase=discovery, topic=workUnit`).
- Assert `chunking/discovery.json` presence (mirror `test-knowledge-build.sh` if it checks chunk configs).
- Add a test that `knowledge remove --work-unit {wu}` (no `--phase`) cascades to discovery chunks — confirms work-unit cancel cleans up discovery (it already calls this in `manage-work-unit.md:236`; just verify coverage of the new phase).

## Conventions to honour

- `conclude-discovery.md` rewrite obeys prose economy — state the new behaviour plainly, no "(changed from…)".
- Any new finalize step in `confirm-and-persist.md` is a model-instruction (`knowledge index …`) — not preceded by a render instruction; but if it carries a user-facing step marker, use `── … ──` + a `→` routing line per conventions.
- KB SKILL.md is the API reference — re-read it before adding the call site.

## Risks / hazards

- **Bundle drift** — forgetting `npm run build` + commit ships a stale CLI. Verify `git status` shows `knowledge.cjs` changed in the PR.
- **Missing `chunking/discovery.json`** throws at index time — ship it in the same commit as the `INDEXED_PHASES`/regex change.
- **The `conclude-discovery` contradiction** — rewrite, don't append.
- **Scope creep to non-epic** — only the epic harvest/finalize path indexes. Single-phase discovery logs are not indexed; state the decision in `conclude-discovery.md`/`confirm-and-persist.md`.

## Verification

- `npm run build`; then `bash tests/scripts/test-knowledge-cli.sh`, `node tests/scripts/test-knowledge-integration.cjs`, `bash tests/scripts/test-knowledge-build.sh` — green.
- Against a temp store + fixture: `node skills/workflow-knowledge/scripts/knowledge.cjs index .workflows/{wu}/discovery/sessions/session-001.md` → non-zero chunks, `phase=discovery topic={wu}`; `knowledge query "<term from the log>" --phase discovery` returns it.
- `git status` shows the rebuilt `knowledge.cjs` staged.
- Full suite green.

## Definition of done

Discovery logs index under a `discovery` phase (epic-only, topic=work_unit); `chunking/discovery.json` shipped; finalize call site wired; `conclude-discovery` anti-pattern rewritten; bundle rebuilt + committed; tests (incl. work-unit-cancel cascade) green.

## When this PR is approved

- **Confirm the approval**, then **do NOT merge.**
- **Plan PR5 now, in this same session:** enter plan mode and write the executable plan for **PR5** from `deep-discovery/pr-5-briefs.md`. Branch `feat/deep-discovery-pr5-briefs`, base/target `feat/deep-discovery-pr4-kb-indexing`. Include its own when-approved hand-off (→ PR6).
- **Do not clear context yourself, and do not ask the user to** — accepting the PR5 plan triggers the harness's *clear-and-proceed* into a fresh session that executes PR5.

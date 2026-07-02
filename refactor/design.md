# Refactor / Rebuild Work — Design Log

**Status:** in design · **Branch:** `worktree-refactor` · **Started:** 2026-06-29

## Source of truth / continuity

This doc is the durable design record for the "refactor/rebuild" work. It survives context
compactions — future Claude sessions should read it first, then fall back to the full transcript
for anything not captured here.

- **Session transcript (source of truth):**
  `/Users/leeovery/.claude/projects/-Users-leeovery-Code-agentic-workflows--claude-worktrees-refactor/1084f9db-eced-47d7-9ec9-e951f65cc9a4.jsonl`
- Local convenience symlink: `refactor/session-transcript.jsonl` (untracked; machine-local)

**How this doc is used:** we design here, decision by decision, preserving *both* the conclusions
and the paths we took to reach them. When the design is complete we turn it into a set of
per-PR plans (`refactor/plans/`), plan each in plan mode, and build the stack back-to-back across
sessions. No external time pressure — build it the right way.

> This project **authors** the workflow system; it does not use it. We edit skill files, references,
> and scripts directly. These `refactor/` docs are dev-only scaffolding and get stripped before the
> feature ships (same convention the shipped `deep-discovery/` docs followed).

---

## The problem

The existing work types (epic, feature, bugfix, quick-fix, cross-cutting) don't fit the work of
**rebuilding an old project**. That work is code-first ("research what's there, figure out how to
rebuild"), not idea-first. The question was whether "refactor" should be a sixth work type.

## Settled design (current answer)

1. **No new work type; no pipeline fork.** A rebuild *is an epic* — you already know *what* the
   system does; you're redesigning *how* (architecture, primitives, data model, DB, infra). Migration
   ("carry the old data/process, or change it for a better system?") is a **topic inside the epic**,
   captured as an ABSORB / PRESERVE / REPLACE **disposition table** — not a phase.
2. **"Rebuild" is at most a labelled epic preset** (a surfacing convenience that flips the capabilities
   below on). Nothing to register in the pipeline. — *decision open, see Decision 3.*
3. **The distinctive parts are capabilities layered onto the epic**, not new phases.
4. **The holistic "topics-as-output" discovery shape** a rebuild needs already shipped as **Deep
   Discovery** (v0.5.12). Rebuild inherits it. Coupling sets its tempo: greenfield = low coupling =
   harvest topics early = short discovery; rebuild = high coupling = harvest late = long discovery
   ("convergence = decoupled-enough-to-silo", now in the shipped guidelines).

## Capabilities to build (layered on epic)

1. **Ingestion** (general capability, not rebuild-only) — Claude reads external *references* of any kind
   (code, dirs, sites, files, images, spreadsheets…) and produces **our documented interpretation + a
   backlink to the source** (never verbatim). **No adapters, no per-type instructions** — the model
   already reads anything; generality is what ships it *complete*, not a breadth of handlers. Point it at
   the old system(s) for a rebuild, a reference impl for a feature. Rebuild is just the heaviest
   consumer. Distinct from imports (which copy files *in*).
2. **Trust / provenance grading** — `canonical / reference / prototype` tags + a "no-guesses, cite the
   source" rule. Legacy facts are ground truth, not soft decisions; spikes are throwaway. Underpins
   both the system map and spikes. (Modelled on FlowX's `docs/` trust system.)
3. **Interactive spiking *in* discovery** — the dig → spike → draft → refactor-to-test-fit → document
   loop is part of discovery. We **modify discovery** to permit user+Claude drafting throwaway code
   during exploration, kept in `.workflows/{work_unit}/discovery/code/` (a new sibling to `sessions/`
   and `briefs/` — discovery was deliberately split into directories precisely so we could add
   elements like this), tagged `prototype`, with learnings feeding the briefs. — *Decision 1, in progress.*

## Reasoning journey (paths taken — including the ones we rejected)

- **First framing (rejected as the primary case):** "refactor" = behaviour-preserving, safety-first,
  incremental — a bugfix-like early "Assessment" phase (characterization tests, seams, Mikado,
  strangler). Real, but the *rare* case for this user.
- **The reframe:** most of the user's work is a **rebuild** — new codebase, new data model, DB, event
  sourcing; behaviour preserved only at the *business* level. Incrementalism is often *wrong* here:
  when the paradigm shifts (e.g. event sourcing), the anti-corruption layer at the old/new seam grows
  large, leaky and permanent, contorting the new design → "subpar." So a rebuild shouldn't offer
  incrementalism as the happy path. Two distinct shapes: **evolve-in-place** vs **rebuild**.
- **Collapse to epic:** a rebuild's middle is just "build a system" — research → discussion → spec →
  plan → implement → review. Its `design/` (reasoning journal) ≈ Discussion; its `spec/` (current
  answer only) ≈ Specification. So it's an epic, not a new pipeline.
- **FlowX as the worked example:** the user's hand-built `~/Code/fabric/flowx/docs` (246 files,
  ~50–60% legacy-mapping, trust-tagged, three-zone model) is effectively the spec for what these
  capabilities produce — including the `flowx-implications.md` disposition table and `docs/code/`
  spikes at `trust: prototype` whose learnings were mined into `spec/`.
- **The coupling unifier:** discovery's size isn't fixed — it's set by how coupled the decisions are.
  This is what makes ONE discovery primitive hold both greenfield and rebuild. It shipped in Deep
  Discovery, so rebuild's holistic early phase needs no new work.
- **Course-correction:** don't let the shipped discovery guardrail ("conversation, not a spike run")
  override our earlier decision that spiking belongs in discovery. We author this system — we change
  discovery. (See `feedback_author_can_change_any_layer` in memory.)

## Open decisions

- **Decision 1 — Interactive spiking in discovery** *(design settled ✅)*: definition, keep-code,
  location (one evolving draft in `discovery/code/`), prototype-framing, surfacing (wiki index + brief
  pointers, reference-in-place), guardrails, and code ↔ session linking all agreed (see Decision log).
  Detailed skill edits deferred to its PR plan.
- **Decision 2 — Trust-grading scope** *(closed ✅ — nothing to build)*: **location encodes trust**
  (`ingested/` verifiable ref · `code/` prototype · exploration/briefs soft · spec firm). Backlink is
  the provenance. FlowX needed tags only for its flat `docs/` tree; our phase/dir structure conveys it
  for free.
- **Decision 3 — Surfacing the work type**: a visible `rebuild` preset that auto-invokes ingestion,
  or just "start an epic, then invoke ingestion"? *Leaning: **don't type-gate.** Ingestion & spiking
  are general, offered discovery moves — the opener just asks "any existing systems / reference impls
  to map?" for any epic. "Rebuild" may not need to be a designation at all. Revisit once the
  capabilities are designed.*
- **Decision 4 — Build order / PR split**: which capability is the first PR in the stack.
- **Decision 5 — Firming-up spike code in discussion** *(new, downstream of Decision 1)*: promoting a
  prototype spike into a blessed reference example during discussion. Leaning **option (ii)** — embed
  the firmed-up code *verbatim in the discussion document* so it rides the existing
  discussion → spec → plan pipe (indexed, extracted to spec, into plan) rather than adding
  file-management machinery to the discussion phase. Touches the discussion skill, not discovery.

## Decision log

_(Outcomes recorded here as each decision closes — newest last.)_

### Decision 1 — Interactive spiking in discovery (core agreed 2026-07-01)

- **What it is:** user + Claude collaboratively write/refactor *throwaway* code **during** discovery to
  test whether a design idea holds before it's recorded. The value is the *learning*; the code is a
  prototype, never copied verbatim, but a genuine worked example of how the thing could be built.
- **User-pulled, never Claude-pushed.** The user drives it and drives the volume — a rebuild may spike
  a lot (FlowX did). Claude still challenges ideas and stays detailed, but must let the user flow:
  branch off to investigate a tactic/architecture/model, then come back to the code, back and forth,
  across weeks and many sessions.
- **Not a reversal of the shipped guardrail.** `discovery-guidelines.md` bans *autonomous* spiking
  (Claude wandering off alone). Interactive, user-initiated spiking is a **carve-out** that keeps that
  protection — it already fits the shipped "only if the user asks" clause.
- **Kept & durable.** Spike code lives in `.workflows/{work_unit}/discovery/code/` — a new sibling to
  `sessions/` and `briefs/`. (The dir-per-element structure of discovery exists precisely so we can
  add elements like this; `code/` is one example.) Work-unit-level and holistic (not per-topic),
  optionally organised into per-spike subdirs (cf. FlowX `docs/code/` xmas-spike / flowx-drafts).
- **Always framed `prototype` / soft.** Consistent with discovery's soft-by-nature model: softness
  isn't over-emphasised in-session, but everything discovery emits is soft on consumption. Code is the
  same — real and usable as an example, but tagged prototype wherever it's referenced.
- **Surfacing (agreed):** wiki-style, not RAG. `discovery/code/README.md` is a browsable index (per
  spike: title, what-it-demonstrates, related topics, `status: prototype`); Claude scans it and
  greps/reads the files directly. Downstream reference rides the **briefs** — a topic's brief carries a
  *pointer* (path + prototype framing), which spec/plan follow and read directly. KB-indexing of
  discovery logs (PR4) must **exclude** `discovery/code/` so prototype code never pollutes the prose
  embeddings.
- **Reference in place, never move.** Spike code is epic-level (it predates the harvested map) and
  feeds the whole epic. Any number of topic discussions reference the *same* code from where it lives —
  referencing, not copying. (Firming-up in Decision 5 embeds only a blessed excerpt into a discussion
  doc; the underlying prototype stays put and stays referenceable.)
- **Guardrails:**
  1. *User-controlled execution; Claude never spikes autonomously* — but spiking is a **visible,
     offered** move, not a hidden feature. Claude may softly surface it alongside the other ways to
     proceed ("we can keep discussing, I can run some research, or we can spike this — got an
     example?") — offer, never "just do it." (Principle: **surface the available moves, let the user
     pick** — the offer naturally re-exposes discovery's existing moves too: discuss / research / spike.)
  2. *During a spike Claude contributes but doesn't drive* — challenges, proposes, flags problems, but
     follows the user's lead; no gold-plating or tangents.
  3. *Capture the learning automatically at natural pauses* into the session-log Exploration narrative
     (a concluding spike is a natural pause). Inline doc-blocks in the code are complementary, not a
     replacement.
  4. *Spiking is divergent — it defers the harvest signal*, never trips convergence; the nudge doesn't
     fire mid-code.
  5. *Prototype discipline* — stays in `discovery/code/`, tagged prototype; if it starts becoming the
     real build, that's the tell you've left discovery (Claude may name it; the user decides).
- **Code shape:** one **single evolving draft** — NOT per-session, NOT per-spike. A coherent whole, "a
  draft version of the real code," built out as far as needed and **heavily inline-documented**
  (doc-blocks carry the thinking alongside the code — more than normal style, on purpose). A
  `discovery/code/README.md` orients Claude to it (structure, what it demonstrates, `status: prototype`).
- **Linked to sessions:** session logs (`discovery/sessions/session-NNN.md`) link to the code — it's
  part of the same sessions — and the code links back. It's one block *because* code works as a
  consistent whole; sessions fragment, the draft doesn't.
- **Implementation surface (detailed edits deferred to the PR plan):** carve-out + offer-mechanism in
  `discovery-guidelines.md`; new `discovery/code/` dir + README convention; session-log ↔ code linking;
  exclude `discovery/code/` from discovery KB-indexing; brief pointer convention into the draft.
- **Status: design settled.** Downstream firming-up is Decision 5.

### Capability #1 — Ingestion (piece 1: definition + targeting + storage, agreed 2026-07-01)

- **Import vs ingestion (core distinction):** an *import* copies a file **verbatim** into the project;
  an *ingestion* is **our documented interpretation of an external reference + a backlink to the
  source** — never verbatim, not quite a "summary" (implies lossy), but an interpretation rich enough
  that Claude can follow the backlink to the original and read it when needed. The reference is
  understood and documented, never replaced. The **backlink IS the provenance** (trust-grading, piece 4,
  largely falls out of this).
- **General capability, not rebuild-only.** Ingest existing systems (rebuild's heavy case), a reference
  implementation from another project (even a feature epic), other artefact types later. Rebuild is the
  heaviest *consumer*, not the owner — reinforces that the capabilities are general discovery moves and
  "rebuild" is just an epic that leans on them (feeds Decision 3).
- **No adapters; ships complete via generality.** The model reads anything (code, sites, files, images,
  CSVs) without per-type instructions — ingestion is source-type-agnostic *by nature*, not by building
  handlers. "Complete" = works for any source on day one, NOT a v1 subset. *(Corrects the earlier adapter
  framing — that was over-engineering.)*
- **Structure is emergent, not prescribed.** We do NOT hardwire a two-phase digest+synthesis pipeline.
  Claude organizes the interpretation sensibly for the material (as it did unprompted for FlowV1);
  cross-cutting synthesis (interaction map, event catalogue, disposition table) is something it *can* do
  when useful/asked — not a built phase. We author for unknown projects; we can't prescribe FlowX's shape.
- **Fan-out is a scale technique, kept.** For large/multi-target ingestion Claude fans out to parallel
  agents (context/scale management) then collates — real value, minimal machinery. Distinct from the
  synthesis *structure* (emergent).
- **Storage & registry:** interpretation is **Markdown** under `discovery/ingested/` — markdown *even
  when the target is code* (documented interpretation with embedded code examples, not raw source), so
  it RAGs well. A *known, searchable, collaborative space*: everything in it is relevant reference
  material for the epic, shaped by user + Claude. The **directory is the registry**; **no manifest
  tracking** — when a skill needs to know "systems are mapped" the discovery scripts *scan the dir and
  inject* (existing skill convention; a filesystem scan can't drift). The **backlink is the provenance.**
- **KB-indexed.** Extends the shipped discovery-log indexing: index `ingested/` prose; `discovery/code/`
  (raw prototype we wrote) stays excluded.
- **Incremental & demand-driven.** Not all-up-front — enriched as the conversation needs it (Claude- or
  user-triggered: "what does X do?" → uncaptured → read X → add to `ingested/` → KB). "As complete as
  the moment requires," growing over sessions.
- **Trust needs no system — location encodes it.** FlowX tagged trust only because everything sat in one
  flat `docs/` tree. Our phase/dir separation conveys it for free: `ingested/` = verifiable reference,
  `code/` = prototype, exploration/briefs = soft, spec = firm. **Decision 2 closes: nothing to build.**
- **Targeting:** interactive, persisted, incremental; gently **offered** by Claude (offered-not-hidden).
  Multi-target, user-curated (add targets as the map reveals dependencies), **mandatory user steering
  context** per target (role, what matters for the rebuild, name-traps, entry points, what to ignore) +
  scope hints. Registers pointer + git ref (citation anchor + staleness); **reads in place, stores only
  the map** (the source system is never copied in).
- **Rebuild-specific synthesis (add-on):** the ABSORB/PRESERVE/REPLACE **disposition table** is a
  cross-cutting synthesis produced *over* the ingested systems when the epic is a rebuild — layered on
  general ingestion, not part of every ingestion.
- **Resolved:** downstream surfacing (KB-index the prose *and* dir-searchable); trust/provenance
  (location encodes trust — Decision 2 closed, nothing to build); manifest (none — dir is registry,
  scripts scan). **Open:** when-it-runs (opener offer) + refresh/staleness — both small.

## Build approach

One build, multiple **stacked PRs**, back-to-back across sessions. Order chosen for what's right to
build, not external pressure. Design fully here → turn into `refactor/plans/pr-N-*.md` → plan each in
plan mode → build the stack.

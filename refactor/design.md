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

1. **System ingestion** — point epic discovery at the old system(s): multi-target (a system rarely
   stands alone — FlowV1 needs 4–6 surrounding subsystems), user-fed (you say where to point),
   fan-out agents to document → a **"system map"** import-class artefact + the disposition table.
   Extends the existing `imports/` idea from "import a file" to **"import a system."**
2. **Trust / provenance grading** — `canonical / reference / prototype` tags + a "no-guesses, cite the
   source" rule. Legacy facts are ground truth, not soft decisions; spikes are throwaway. Underpins
   both the system map and spikes. (Modelled on FlowX's `docs/` trust system.)
3. **Interactive spiking *in* discovery** — the dig → spike → draft → refactor-to-test-fit → document
   loop is part of discovery. We **modify discovery** to permit user+Claude drafting throwaway code
   during exploration, tagged `prototype`, with learnings feeding the briefs. — *Decision 1, in progress.*

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

- **Decision 1 — Interactive spiking in discovery** *(in progress)*: confirm it belongs in discovery,
  and settle scope (which work types / when), invocation, what it produces & where, guardrails, and
  the concrete edits to the shipped discovery skill.
- **Decision 2 — Trust-grading scope**: import-class artefacts only (system map + spikes), or the
  fuller FlowX model that grades design/spec too?
- **Decision 3 — Surfacing**: a visible `rebuild` preset that auto-invokes ingestion, or just
  "start an epic, then invoke ingestion"?
- **Decision 4 — Build order / PR split**: which capability is the first PR in the stack.

## Decision log

_(Outcomes recorded here as each decision closes — newest last.)_

## Build approach

One build, multiple **stacked PRs**, back-to-back across sessions. Order chosen for what's right to
build, not external pressure. Design fully here → turn into `refactor/plans/pr-N-*.md` → plan each in
plan mode → build the stack.

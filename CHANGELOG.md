# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.15] - 2026-06-03

- Inbox pickup is now a working set — select multiple items of a single type to promote together into discovery as combined seed material (multi-select promotion gated to one type)
- Add inbox archive lifecycle — archive any selection out of the inbox, then restore or permanently delete archived items from a dedicated archived view
- Discovery seeds from multiple linked inbox items: `inbox_seed` → `inbox_seeds` (comma-joined list) threaded through opener, confirm-trigger, and name-resolution; multi-seed work shapes its name from conversation rather than a single filename slug
- `workflow-start` discovery script scans `.inbox/.archived/`, exposing `has_archived`/`archived_count` state and an `=== ARCHIVED ===` section
- Add `inbox-working-set.md` and `inbox-archived.md` references; broaden `workflow-start` allowed-tools for inbox file moves, archival, and deletion

## [0.4.14] - 2026-06-02

- Namespace the five `continue-*` navigation skills under `workflow-continue-*` (epic, feature, bugfix, quickfix, cross-cutting), renaming their directories, scripts, references, and test files
- Update all cross-references to the renamed skills across the bridge, discovery, start, legacy-research-split, and shared topic-discovery references

## [0.4.13] - 2026-06-02

- Make discovery the universal first phase for all work types — collapse `workflow-discovery-entry` + `workflow-discovery-process` into a single `workflow-discovery` skill with new/existing-epic modes that detects work type, shapes the work, persists at a confirm-trigger, and routes into the pipeline
- Remove the five `/start-*` skills; `/workflow-start` is now the sole user-invocable entry, with a new `s`/start option for unknown-shape work, and routes every pick (and inbox items) into discovery
- Make all five `continue-*` skills model-only (`user-invocable: false`) and trim their Step 0 to casing-only — migrations and knowledge-check now run once at `/workflow-start`
- Defer all persistence to the confirm-trigger — the manifest, session log, imports, and inbox seed all land at the work-type commit; abandoning before confirm leaves no partial state
- Add first-class **seeds**: a promoted inbox item is moved into `seeds/`, tracked via `manifest.seeds[]` with a `source: inbox:*` tag, and KB-indexed under a new `seeds` phase — distinct from reference imports
- Index seed artifacts in the knowledge base (`src/knowledge/index.js` — new `seeds` phase, identity derivation, and bulk-discovery traversal)
- Route single-phase work (feature/bugfix/quick-fix/cross-cutting) to its first phase via a durable carrier (discovery session log + manifest `description`); first-phase entry skills read the carrier instead of re-gathering
- Extend `workflow-bridge` to handle the discovery handoff with a supplied `next_phase`
- Promote inbox ideas through discovery so they can resolve to any work type, replacing the old feature/epic/cross-cutting sub-menu
- Carry seeds through feature absorption and surface them in epic/feature continue displays alongside imports
- Drop the `can_start_discussion` research gate for epics and remove unused `latest_session` discovery output
- Add a Prose Economy section to CONVENTIONS.md
- Add tests for inbox-promotion seed carry-through, knowledge-base seed indexing, and cross-work-type `phases.discovery` writes; update migration 038 and discovery test suites

## [0.4.12] - 2026-05-29

- Add `openai-compatible` embedding provider for local/self-hosted OpenAI-compatible `/v1/embeddings` endpoints (LM Studio, Ollama, vLLM, LiteLLM) — selectable in `knowledge setup` or via `base_url` in system config; API key optional, dimensions validated against the model's native output
- Extract shared `OpenAIEmbeddingsEngine` (wire logic, batching, error mapping) with thin `OpenAIProvider`/`OpenAICompatibleProvider` drivers over it; `openai` sends the `dimensions` param and requires a key, `openai-compatible` omits it and treats the key as optional; surface undici `err.cause` errno (ECONNREFUSED, etc.) in network errors
- Refactor setup into per-provider `SETUP_DESCRIPTOR`s driven by an injected toolkit; numbered provider menu, generic `buildSystemConfig`, reusable `askDimensions`, and a shared `describeValidationError` with driver-supplied remedies
- `resolveProvider` builds `openai-compatible` without a key but throws on missing `base_url` (no silent keyword-only degrade); `base_url` ignored under `openai`
- Add `CHANGELOG.md` (Keep a Changelog format); release script now auto-prepends each release entry, commits it before tagging, and shares one AI-generated notes body across the changelog and tag message
- Release notes generation excludes the minified `knowledge.cjs` bundle from the diff and raises the max-diff cap to 60000 lines; reframe the prompt to emit a user-facing markdown bullet list
- Add tests for the `openai-compatible` provider/config/setup paths and the release changelog helpers; mark ideas #15, #16, #23, #24, #27 done and log idea #28 (hybrid ranking weighting evaluation)

## [0.4.11] - 2026-05-29

- Split overloaded `analysis_cycle` counter into `analysis_cycle_total` (monotonic, drives findings-file naming) and `analysis_cycle_session` (per-session, drives the escape-hatch threshold), fixing prior cycles' findings being overwritten on resume/re-open
- Reset only `analysis_cycle_session` at Step 0 re-entry; seed both counters at fresh init; drop redundant resets at conclude and review loopback
- Add migration 041 inferring `analysis_cycle_total` from `max(stored, highest c{N} on disk)` to handle completed implementations where the old counter was zeroed, with full test coverage

## [0.4.10] - 2026-05-29

- Extract end-of-phase final-review menu into shared `final-review-menu.md` reference
- Wire research and discussion final-review flows to delegate menu rendering and one-at-a-time finding surfacing to the shared reference

## [0.4.9] - 2026-05-28

- Redesign Discussion Map render with discovery-map-style branches, state glyphs, and header counts
- Swap elevation marker from `→` to `↑` to free `→` as the converging state glyph
- Update discussion template and discovery-gap-analysis to match new marker

## [0.4.8] - 2026-05-28

- Rename inception phase to discovery across skills, scripts, manifests, and references
- Add migration 040 to rename phases.inception → phases.discovery, rewrite source provenance, and move inception/ dirs + state cache files
- Rename workflow-inception-entry/process skills and references to workflow-discovery-*; update bridge continuation and all cross-references
- Update manifest CLI valid phases and statuses to use discovery instead of inception
- Add "don't invent stops" guidance to all entry-point and processing skill rules
- Rename ensure-inception-item shared reference and inception-gap-analysis to discovery equivalents
- Update test fixtures and rename test files to match new discovery naming

## [0.4.7] - 2026-05-28

- Forbid priming analysis sub-agents with prior cycle context to prevent biased convergence

## [0.4.6] - 2026-05-27

- Tighten discovery map header: tier breakdown collapses to topic count when only one bucket is populated; imports callout suppressed when every topic is an import
- Rework topic row rendering with bracketed lifecycle labels and continuous `│` gutter through sub-lines, plus 65-char summary wrapping

## [0.4.5] - 2026-05-27

- Unify inception into single conversational session loop, replacing separate initial/refinement modes
- Add lazy session log creation — file written on first state change, not session start
- Add resume detection via `phases.inception.active_session` manifest marker
- Split topic synthesis into dedicated endpoint ceremony (`topic-synthesis.md`)
- Extract topic-discovery cache dispatch to shared `topic-discovery-dispatch.md`
- Rework inception guidelines around open exploration with one-question-at-a-time cadence
- Restructure session log template with separate Exploration (narrative) and Edits (structured) sections
- Rename `f`/`refine` menu option to `i`/`inception`; remove inline Add operation from map-operations
- Add CONVENTIONS rule for command-options-first menu ordering and user-directive prompt descriptions

## [0.4.4] - 2026-05-27

- Expose `summary_present`/`description_present` booleans in continue-epic discovery output so backfill filter operates on visible data
- Render summary text under each discovery map item; update Step 5 backfill check and summary-backfill reference to use presence flags
- Drop redundant post-backfill discovery re-run from summary-backfill reference

## [0.4.3] - 2026-05-26

- legacy-split: reframe theme extraction around source replacement — every meaningful piece must land in a theme cache file or it's lost
- topic-granularity: drop the "2–6 topics typical" anchor; let source structure dictate count

## [0.4.2] - 2026-05-26

- Make legacy-research-split route every theme to research; drop routing from cache plan, validator, and dialog edit ops
- Make backfill pass terminal in continue-epic — commit recovery work, then stop and advise `/clear` + `/workflow-start`

## [0.4.1] - 2026-05-26

- Add workflow-legacy-research-split skill for decomposing pre-inception kitchen-sink research files into topic-scoped artefacts via user-guided per-source flow
- Rewire continue-epic ordering: Legacy Bridge → Summary Backfill → Topic Discovery → Display
- Rename self-healing to topic-discovery; gate research-analysis and gap-analysis on completed material with per-candidate routing (no more hardcoded `routing: discussion`)
- Rename discussion-gap-analysis to inception-gap-analysis; move cache from `phases.discussion.gap_analysis_cache` to `phases.inception.gap_analysis_cache` (migration 039)
- Extract shared references for topic-granularity and routing-decision; loosen research-process drift trigger from "distinct threads" to "sustained off-topic content"
- Add `superseded` status to research phase; discovery-utils filters superseded items from phase aggregation
- Change manifest CLI `get` to return empty stdout + exit 0 for missing paths (was exit 2); callers simplified to check output instead of probe-then-read
- Restructure investigation findings-review: synthesis-agent now presents findings then offers validation; findings-review confirms first, only re-renders on feedback
- Add three idea docs: inception self-healing on legacy research, analysis-cycle counter reset collision, review not re-offered after loopback

## [0.4.0] - 2026-05-23

- Add inception phase and discovery map for epics — curatorial first phase that names topics, classifies routing (research/discussion), and drives auto-routing across the pipeline
- Add `workflow-inception-entry` and `workflow-inception-process` skills with initial-session and refinement-session flows
- Replace open-mode research with per-topic scoped research; drop `e`/`explore` and `route-first-phase`
- Add self-healing analyses (research-analysis, discussion-gap-analysis) that auto-add topics to the map with `source` provenance and dismissed-list filtering
- Add imports machinery: `.workflows/{wu}/imports/` directory, manifest `imports[]` field, KB indexing on import, surfaced via contextual query
- Add two-tier provenance (`summary` + `description`) on inception items; entry skills load description as opening context
- Add topic-splitting and elevation that write inception items alongside per-phase artefacts with collision validation
- Add direct-entry auto-add: `d`/`discuss` and `r`/`research` for unmapped topics auto-create inception items with `source: direct-start`
- Add migration 038 to seed inception items for legacy in-progress epics
- Index research-analysis and gap-analysis caches into knowledge base as `analysis` phase (low confidence)
- Add `continue-epic` discovery map render with tier ordering (→ ◐ ✓ ○ ⊘), summary backfill, and convergence signal
- Add `workflow-bridge` inception-continuation handoff back to `/continue-epic`
- Handle imports in feature absorption flow with KB chunk rewriting under target identity
- Surface `imports_count` in `continue-feature` display
- Add `base_url` config support for OpenAI-compatible embedding providers (LM Studio, Ollama)

## [0.3.3] - 2026-05-09

- Harden STOP gates against session-level override signals (system-reminders, hook text, /loop hints) — explicit failure-mode callouts and end-of-turn rule added across all workflow skills
- Extract skill authoring conventions from CLAUDE.md into standalone CONVENTIONS.md to shrink per-session context
- Collapse pending-discussion-topics display in continue-epic into a single menu (removes duplicate numbered list)
- Log new STOP gate override protection idea; mark task-backtracking, epic dependency visualization, selection-menu pattern, research background agents, and conditional routing convention ideas as done

## [0.3.2] - 2026-04-30

- Forbid harness auto mode from skipping STOP gates and menu selections across all entry-point and processing skills
- Clarify that the only skip mechanism is the manifest `auto` field, scoped per-gate per-topic
- Add missing Instructions sections to processing skills and workflow-migrate for consistent critical-guidance placement

## [0.3.1] - 2026-04-28

- Replace freeform perspective angles with polarity-pair lens table in discussion process
- Add Problem Restate Gate to perspective agents (mandatory restatement before arguing)
- Add framing alignment check to synthesis (T1 tension when lenses diverge on the question)
- Lead synthesis body with Unresolved Questions ahead of common ground and tensions
- Drop phase 5 infra ideas (project memory, dynamic discovery engine, loop-based surfacing) and renumber index

## [0.3.0] - 2026-04-27

- Add knowledge base subsystem: per-project RAG store of completed research, discussion, investigation, and specification artifacts; CLI commands index, query, check, status, remove, compact, rebuild, setup; hybrid (BM25 + OpenAI embeddings) and keyword-only modes; pending queue with retry, TTL-based decay, and credentials at `~/.config/workflows/credentials.json` (mode 0600)
- Wire knowledge base into the workflow pipeline: mandatory Step 0.3 readiness gate in all 11 entry-point skills, phase-completion indexing across processing skills, lifecycle removal on cancellation/supersession/promotion, three-layer retrieval (SKILL.md API, per-phase usage guide, inline callouts), and a semantic cross-cutting query at planning entry replacing the manual scan
- Add Step 0 sub-step convention (0.1 casing, 0.2 migrations, 0.3 knowledge check) and document it in CLAUDE.md
- Backfill `completed_at` on completed work units via migrations 036 and 037; manifest CLI now exits 2 for expected misses vs 1 for real errors and refuses to overwrite a corrupt project manifest
- Move release pipeline local: drop `.github/workflows/release.yml`, run `npm ci && npm run build` in the `release` script before tagging so every tag ships a fresh `knowledge.cjs` bundle
- Bundle build switched to ESM resolution for better tree-shaking; bundle size budget raised to 175 KB

## [0.2.18] - 2026-04-14

- Add epic topic cancellation and reactivation via continue-epic menu
- Exclude cancelled items from phase aggregation, gating, and discovery
- Add `cancelled` as valid status across all phases in manifest CLI
- Filter cancelled topics from next-phase-ready logic and spec/discussion entry discovery

## [0.2.17] - 2026-04-13

- Add feature absorption into epic via manage menu
- Guard absorb behind discussion-exists, no-spec, and in-progress-epic checks
- Document absorption lifecycle in CLAUDE.md and README

## [0.2.16] - 2026-04-13

- Add research import option (`i`/`import`) to epic and feature entry points
- Wire import flow through research entry, handoff, and initialization
- Populate Starting Point from imported content; leave empty on restart
- Document import option in CLAUDE.md and README

## [0.2.15] - 2026-04-12

- Update the discussion discovery format test for the gap-cache section

## [0.2.14] - 2026-04-12

- Add a discussion gap-analysis step for epics (stored under `phases.discussion`), surfacing cross-topic themes, with `computePendingFromGaps` unit tests
- Knowledge base (phase 3): implement the `index` (single file), `query` (with re-ranking and formatting), and `check` commands; config resolution and provider instantiation; CLI entry point and full CLI test suite
- Harden knowledge-base identity derivation, fix a race condition, and handle missing metadata
- Add a manifest `resolve` command for artifact path discovery

## [0.2.13] - 2026-04-12

- Add a shared background-agent surfacing protocol for the research and discussion phases, with explicit file+section links surfaced in the session loop
- Block review-agent dispatch while a prior review is still draining, and drop the "user wants out" bulk-skip escape
- Add a shared `natural-breaks.md` reference and document shared references in the Skill Architecture
- Sweep remaining third-person Claude references to second person across skill content

## [0.2.12] - 2026-04-11

- Knowledge base Phase 1: esbuild pipeline, Orama store (fulltext/vector/hybrid search), MsgPack persistence, file locking, StubProvider, metadata tracking
- Knowledge base Phase 2: markdown chunking engine with per-phase configs and special_sections support (own-chunk, skip, merge-up)
- Add document review gate to discussion and research processes (reconciles session conversation against artifact file before conclusion)
- Comprehensive test fixtures for all 4 indexed phases plus edge cases
- Dev REPL for interactive knowledge base exploration

## [0.2.11] - 2026-04-07

- Add knowledge base design specification (RAG-based retrieval for workflow artifacts)

## [0.2.10] - 2026-04-06

- Redesign pending topics menu to use numbered selection for starting discussions directly
- Add separate skip sub-prompt instead of combined topic+action selection flow
- Clarify "pending discussion topics" wording throughout manage pending section

## [0.2.9] - 2026-04-06

- Add mandatory final gap review before concluding research and discussion phases
- Add shared convergence analysis diagnostic for all review/fix cycle escalation points
- Add epic dependency map view with summary matrix, detail tree, and critical path insights
- Restructure epic menu: letter shortcuts for fixed actions, recommended item first
- Make review agent dispatch mandatory after every commit (checklist + checkpoint pattern)
- Add fix tracking persistence across attempts for implementation task loop
- Normalize object-format spec sources to array in epic discovery script
- Add parameter passing syntax for shared reference loading (`with` assignments)

## [0.2.8] - 2026-04-05

- Add diff view for review findings (spec + planning) with bordered diff blocks
- Add `Current` field to finding templates for enhancement-type findings
- Add `v`/`view full` option to finding approval menus
- Add diff presentation for resurfaced content during spec construction
- Mark ideas #6 (User Guidance & Help) and #7 (Spec Diff on Resurface) as done

## [0.2.7] - 2026-04-04

- Switch status terms from parenthetical `(term)` to square bracket `[term]` notation
- Add `⚑` callout flag convention for advisory/gating messages in code blocks
- Epic display: proper tree grammar (`├─`/`└─`), phase count summaries, middle-dot format separator
- Discussion entry: explicit `f`/`fresh` and `b`/`back` command options replace implicit prompt option

## [0.2.6] - 2026-04-03

- Skip redundant migrations when already invoked in current conversation
- Add CRITICAL continue instruction to all entry-point skills preventing premature stop after migrate returns
- Start skills show phase title and signpost immediately when migrations already ran
- Move casing conventions load before migration conditional in all skills
- Add explicit "do not stop" instruction to workflow-migrate no-op path

## [0.2.5] - 2026-04-03

- Unify numbered menu items to `- **`N`** —` format across all selection menus
- Simplify discussion entry topic display — condensed summaries, single numbered menu with status-based verbs
- Add quick-fix, scoping, and missing agents (research, discussion) to workflow explorer
- Add status and view-plan utilities to explorer sidebar

## [0.2.4] - 2026-04-03

- Add background sub-agents to research skill — periodic review agent for coverage gaps, deep-dive agents for independent thread investigation
- Surface pending discussion topics from research in epic display with gating-aware recommendations
- Add quick-fix pipeline and investigation synthesis agent to workflow explorer

## [0.2.3] - 2026-04-02

- Categorize review recommendations as quickfix/idea/bug — verifier tags, synthesizer preserves, report groups by category
- Surface non-blocking review recommendations to inbox from verdict screen
- Trim CLAUDE.md — condense prose, remove inline test harness template and ASCII banner
- Update workflow-explorer flowcharts: discussion agent-assisted loop, planning review cycle/re-loop
- Clean up epic display menu — remove stop option, fix key indentation, add research indicator
- Add research background agents idea

## [0.2.2] - 2026-04-02

- Track pending discussion topics from research analysis via `surfaced_topics` in manifest
- Add `pull` command to manifest CLI (remove value from array)
- Epic menu: manage pending topics (discuss or skip), soft gate before specification
- Restructure research analysis with coarser topic grouping guidance and lettered sections
- Add `computePendingFromResearch` to shared discovery utils

## [0.2.1] - 2026-03-31

- Add visual hierarchy system: phase titles (bullet-bordered), step markers (em-dash framed), sub-step markers, and signpost blockquotes
- Add step markers and signpost blockquotes to all entry-point, continue, start, and processing skills
- Replace plain-text title patterns with bullet-bordered phase titles across all display references
- Remove old "Output Formatting" sections with `── ── ── ── ──` pattern from processing skills
- Add signpost blockquotes to research-gating menus, conclude references, and context-gathering flows
- Update empty-state and active-work menus with pipeline descriptions and contextual signposts
- Document visual hierarchy, phase titles, step markers, sub-step markers, signpost blockquotes, and workflow banner in CLAUDE.md
- Add external_id registration to scoping write-tasks manifest setup

## [0.2.0] - 2026-03-29

- Add quick-fix work type: scoping → implementation → review pipeline for mechanical changes
- Add scoping phase — single-pass context, spec, and plan (max 2 tasks, no agents)
- Add verification workflow as TDD alternative for mechanical changes (baseline → change → verify)
- Add complexity check with promotion gate to feature/bugfix when scope exceeds quick-fix
- Add start-quickfix, continue-quickfix entry-point skills and workflow-log-quickfix capture skill
- Add quickfix-continuation bridge routing with early-completion and backwards navigation
- Extend manifest CLI, discovery scripts, and implementation executor to support quick-fix pipeline
- Add Codex Review Dispatch idea (model routing for review agents)

## [0.1.5] - 2026-03-28

- Rework discussion phase: replace question checklist with organic Discussion Map (pending → exploring → converging → decided)
- Add subtopic lifecycle, navigation, convergence detection, and status display to discussion session
- Add topic elevation for epics — sibling concerns seed as separate discussion topics
- Update discussion template, guidelines, meeting assistant, and agent instructions for map-driven flow
- Reorder output format mentions to tick, linear, local-markdown

## [0.1.4] - 2026-03-28

- Add investigation synthesis agent for independent root cause validation
- Integrate synthesis step into investigation pipeline (new Step 5, renumber subsequent steps)
- Surface synthesis gaps in findings review presentation
- Update README for 21 agents and investigation/discussion validation descriptions

## [0.1.3] - 2026-03-28

- Add discussion background agents: perspective, review, and synthesis
- Integrate agent dispatch and results surfacing into discussion session loop
- Add perspective agent lifecycle with parallel dispatch and synthesis reconciliation
- Add periodic review agent lifecycle with gap detection during sessions

## [0.1.2] - 2026-03-25

- Add compliance self-check step to all 7 processing skills before conclusion
- Create shared compliance-check.md reference with re-read, audit, and correction flow
- Wire research phase compliance check into topic-completion reference

## [0.1.1] - 2026-03-25

- Add ideas backlog with 13 improvement proposals
- Add explicit Step 0 → Step 1 routing to all entry-point skills post-migration
- Collapse review initialize-review.md into SKILL.md backbone, simplify resume flow with unreviewed_tasks tracking
- Remove skip-step parenthetical convention from routing instructions
- Add critical guards ensuring analysis loop runs on every task loop pass
- Fix workflow-migrate to use `→ Return to caller.` convention

## [0.1.0] - 2026-03-22

- Initial release of Agentic Engineering Workflows for Claude Code, installable via `npx agntc add leeovery/agentic-workflows`
- Five work-type pipelines — epic, feature, bugfix, quick-fix, and cross-cutting — each composed from phase skills (discovery, research, discussion, investigation, scoping, specification, planning, implementation, review)
- Two-tier skill architecture (entry-point, phase-entry, and processing skills) with shared references and idempotent migrations
- Manifest CLI as the single source of truth for workflow state, with project-level defaults cascading to topics
- Pluggable planning output formats and a workflow explorer overview


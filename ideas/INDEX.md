# Ideas Index

Improvement ideas for agentic-workflows, ordered by suggested implementation sequence. Grouped into phases based on dependencies and logical progression.

---

## Phase 1 — Quality Gates

Foundation work. Adds review agents to phases that currently lack quality gates. The compliance self-check applies immediately to all existing skills.

| # | Idea | Scope |
|---|------|-------|
| 1 | ~~[Skill Compliance Self-Check](skill-compliance-self-check.md)~~ | All processing skills | ✅ Done |
| 2 | ~~[Discussion Review Agent](discussion-review-agent.md)~~ | Discussion phase | ✅ Done |
| 3 | ~~[Investigation Synthesis Agent](investigation-synthesis-agent.md)~~ | Investigation phase (bugfix) | ✅ Done |

## Phase 2 — Discussion Evolution

Builds on Phase 1. The discussion review agent is the safety net that makes looser conversation viable.

| # | Idea | Scope |
|---|------|-------|
| 4 | ~~[Natural Conversation in Discussion](natural-conversation-in-discussion.md)~~ | Discussion processing skill | ✅ Done |
| 5 | ~~[Parallel Agent Discussion](parallel-agent-discussion.md)~~ | Discussion processing skill | ✅ Done |

## Phase 3 — UX & Visibility

Standalone improvements. Can be done in any order within this phase.

| # | Idea | Scope |
|---|------|-------|
| 6 | ~~[User Guidance & Help](user-guidance-and-help.md)~~ | All entry-point skills | ✅ Done |
| 7 | ~~[Spec Diff on Resurface](spec-diff-on-resurface.md)~~ | Specification processing skill | ✅ Done |
| 8 | ~~[Intelligent Escalation](intelligent-escalation.md)~~ | All review/fix cycles | ✅ Done |
| 9 | ~~[Epic Dependency Visualization](epic-dependency-visualization.md)~~ | Continue-epic / workflow-start | ✅ Done (superseded by `m`/`map` in continue-epic) |

## Phase 4 — Implementation Improvements

| # | Idea | Scope |
|---|------|-------|
| 10 | [Integration Validation Agent](integration-validation-agent.md) | Implementation phase |

## Phase 5 — Model Routing

Leverage multiple AI models by dispatching work to the best model for each task type.

| # | Idea | Scope |
|---|------|-------|
| 11 | [Codex Review Dispatch](codex-review-dispatch.md) | All review agents |

## Unphased — New Ideas

| # | Idea | Scope |
|---|------|-------|
| 12 | ~~[Selection Menu Display Pattern](selection-menu-pattern.md)~~ | All selection menus across skills | ✅ Done |
| 13 | ~~[Background Sub-Agents in Research](research-background-agents.md)~~ | Research processing skill | ✅ Done (superseded by deep-dive-agent) |
| 14 | ~~[Top-Level Conditional Routing: Bold vs H4](top-level-conditional-routing.md)~~ | Convention drift across ~53 skill files | ✅ Done |
| 15 | ~~[STOP Gate Override Protection](stop-gate-override-protection.md)~~ | All workflow skills with STOP gates | ✅ Done |
| 16 | ~~[Investigation: Show Interim Findings](investigation-show-interim-findings.md)~~ | Investigation processing skill (bugfix) | ✅ Done |
| 17 | [Bugfix: Prior Spec Knowledge Check](bugfix-prior-spec-knowledge-check.md) | Investigation or specification phase (bugfix) |
| 18 | ~~[Inbox Pickup Actions](inbox-pickup-actions.md)~~ | `workflow-start` inbox working set + `.archived` lifecycle | ✅ Done (with #29) |
| 19 | ~~[Review Classifier Quality](review-classifier-quality.md)~~ | `workflow-review-task-verifier` tagging rules | ✅ Done (with #20 — review-end triage redesign + do-now lane) |
| 20 | ~~[Review Finding Grouping](review-finding-grouping.md)~~ | `workflow-review-process` produce-review clustering | ✅ Done (with #19) |
| 21 | [Cross-Plan Implementation Ordering](cross-plan-implementation-ordering.md) | Planning content-appraisal + format-level enforcement + epic menu collapse to "next available task" |
| 22 | [Editing Historical Phase Artefacts](editing-historical-phase-artefacts.md) | Planning / implementation / knowledge base — corrigendum + reindex convention |
| 23 | ~~[Embedding Provider `base_url` Override](embedding-provider-base-url.md)~~ | Knowledge base CLI — `openai-compatible` driver + shared engine + config + setup | ✅ Done |
| 24 | ~~[Inception Self-Healing on Legacy / Kitchen-Sink Research](inception-self-healing-on-legacy-research.md)~~ | Migration 038 + `research-analysis` input guards + manifest `get` exit-2 + `routing` hardcode | ✅ Done |
| 25 | ~~[Analysis Cycle Counter Resets on Resume Collide with File Naming](analysis-cycle-counter-reset-collision.md)~~ | `workflow-implementation-process` Step 0 + `analysis-loop.md` + `invoke-analysis.md` | ✅ Done |
| 26 | [Review Not Re-Offered After Loopback from Review Remediation](review-not-re-offered-after-loopback.md) | `workflow-implementation-entry/validate-phase.md` + `workflow-bridge/discovery.cjs` |
| 27 | ~~[Continue-Epic Step 5 Asks the Agent to Filter Data the Discovery Script Doesn't Expose](continue-epic-items-to-recover-unobservable.md)~~ | `continue-epic/SKILL.md` Step 5 + `continue-epic/scripts/discovery.cjs` text formatter | ✅ Done |
| 28 | [Hybrid Search Ranking — Evaluate Text/Vector Weighting & Re-rank on a Real Corpus](hybrid-ranking-weighting-evaluation.md) | Knowledge base — `store.searchHybrid` weights + `index.js` `rerank()` + query pipeline |
| 29 | ~~[Seed Discovery from Multiple Linked Inbox Items](seed-discovery-multiple-inbox-items.md)~~ | Discovery multi-seed: working-set multi-select + opener/confirm-trigger/name-resolution | ✅ Done (with #18) |
| 30 | [Knowledge Base Query — Include/Exclude Result Filters](knowledge-query-include-exclude-filters.md) | Knowledge base — `query` flag parser + filter construction feeding `store.searchHybrid` in `src/knowledge/index.js` |
| 31 | [Discovery Map: Legacy `exploration` Catch-All + Analysis Approval Gating + Past-Discovery Suppression](discovery-legacy-exploration-and-analysis-gating.md) | `discovery-utils.cjs` lifecycle terminal-`handled` tier + `topic-discovery(-dispatch).md` approval gate & phase-suppression + `discovery-gap-analysis`/`research-analysis` staging + heal-forward migration. Continuation of #24's deferred option D. |
| 32 | [Deterministic Renderer for Trees, Menus & Signposts](deterministic-tree-and-menu-renderer.md) | Shared `tree.cjs`/menu renderer + schema so skills emit fixed-shape ASCII verbatim instead of hand-drawing it. Motivated by the `epic-display-and-menu.md` 65-char-vs-7-char-gutter wrap bug that broke the discovery-map tree. Immediate sub-fix: subtract the gutter from the wrap budget. ~15 skills hand-draw `├─` trees. |
| 33 | [Knowledge Base Temporal Model: Honest Timestamps + Progress-Driven Decay](knowledge-chunk-timestamp-uses-index-time.md) | Knowledge base — two folded parts. **(1)** `indexSingleFile` stamps every chunk with `Date.now()` not the source doc's date, so bulk/fresh indexing (install, reindex, migration) makes all legacy docs read as "today" in headers + ranking — fix: derive `timestamp` from source mtime → (opt.) frontmatter date. **(2)** `compact` decay is wall-clock (`completed_at + N months <= now`), so dormant projects decay valid context — replace with a workflow-native *progress clock* (watermark, derived from `completed_at` — no schema change) feeding a single retrievability `R = 0.9^(progressElapsed/S)` used two ways: FSRS-shaped multiplicative soft down-rank in `rerank()` (never delete for relevance) and `compact` pruning only when `R` falls below a floor (storage backstop). Progress is significance-weighted by work type (quick-fix < feature < epic). Pure-progress — no wall-clock in decay; reinforcement out of scope (wrong layer — it's query-conditioned, spun out as #35). 5 stacked PRs. Coordinates with #28 (`rerank()`), #22 (reindex backfill). |
| 34 | [Research-Review Agent Flags Unmade Decisions as Coverage Gaps](research-review-flags-unmade-decisions-as-gaps.md) | `agents/workflow-research-review.md` — agent has no rule against flagging *unmade decisions* as gaps (only against recommending/evaluating options), so it surfaces discussion-phase decisions as research deficiencies, pushing research past its "surface options, don't decide" charter. Fix: add a boundary rule distinguishing "option landscape under-explored" (valid gap) from "decision not yet made" (not a gap). Instruction-only. |
| 35 | [Query-Conditioned Relevance Feedback](query-conditioned-relevance-feedback.md) | Knowledge base — the *query-relevance* axis, spun out of #33's decay discussion. FSRS-style reinforcement doesn't belong in #33's *global* decay term: relevance is per-`(query, chunk)`, so one query's "not useful" verdict can't globally penalise a chunk. This is standard relevance-feedback / learning-to-rank — graded signal (Claude classifies results good/bad) keyed on `(query-class, chunk)`, adjusting ranking for similar future queries. Hard parts: query-similarity so feedback generalises; aggregation before any global signal; feedback loops; new persisted state. Closer to #28 (`rerank()`/ranking quality) than #33. Sketch only — not scoped. |
| 36 | [Discussion-Entry Drops Research When Discovery Left a Usable Carrier](discussion-entry-research-bypassed-on-carrier-path.md) | **Bug.** `workflow-discussion-entry` — research-detection (`gather-context.md` §B, the only place that sets `source=topic-provided-with-research`, the only `invoke-skill.md` branch emitting a `Research files:` block) lives solely on the *fallback* context path. Step 3's rich-carrier branches (non-epic Exploration-present; epic map-shaped) jump straight to Step 4, bypassing it — so a feature that ran the full `discovery → research → discussion` pipeline hands off with no research block and `initialize-discussion.md` seeds the map from the one-line manifest description, silently dropping the research. Happy path is the broken one (legacy/no-carrier units detect research fine). Fix: detect research at the `invoke-skill.md` chokepoint (always runs, already reads the manifest) and emit the block conditionally, independent of `source`. Instruction-only. Audit sibling `*-entry` skills for the same carrier-vs-fallback split. |
| 37 | [Sub-agent Reuse Policy: Fresh Reviewers + Fresh Per-Task Executors](subagent-reuse-policy-fresh-per-task-and-review.md) | **Bug/policy.** `workflow-implementation-process` — `invoke-executor.md`/`invoke-reviewer.md`/task loop state no agent-lifecycle rule, so an efficiency-minded orchestrator reuses one reviewer across many tasks (killing review independence — the reused reviewer missed a real defect this project) and reuses executors across different tasks. Fix: fresh reviewer per review, fresh executor per new task, reuse (SendMessage) only for a same-task fix round. Instruction-only; note the rationale inline so it isn't "optimised" back out. |
| 38 | [Parallel Phase Task-List Design in Planning](parallel-phase-task-list-design.md) | **Optimisation + convention.** `workflow-planning-process` (`plan-construction.md`/`define-tasks.md`/`workflow-planning-task-designer`) — allow the per-phase task-LIST *design* step to fan out across phases in parallel as an opt-in, keeping *authoring* (`workflow-planning-task-author`) strictly sequential. Assessed live on a 6-phase/45-task feature (2 independent audit agents): net-positive, one absorbed miss (a Ghostty permission-mapping deferral recorded only in a task's edge-cases, invisible to the blind parallel designer, folded in by the sequential author). Gate on (1) full phase acceptance criteria, (2) sequential authoring, (3) cross-phase deferrals lifted from task edge-cases into phase-level acceptance criteria. Precondition (3) is worth adopting as a lint regardless. |

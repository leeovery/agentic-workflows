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
| 18 | [Inbox Pickup Actions](inbox-pickup-actions.md) | `workflow-start` inbox menu + `start-quickfix` archive path |
| 19 | [Review Classifier Quality](review-classifier-quality.md) | `workflow-review-task-verifier` tagging rules |
| 20 | [Review Finding Grouping](review-finding-grouping.md) | `workflow-review-process` produce-review clustering |
| 21 | [Cross-Plan Implementation Ordering](cross-plan-implementation-ordering.md) | Planning content-appraisal + format-level enforcement + epic menu collapse to "next available task" |
| 22 | [Editing Historical Phase Artefacts](editing-historical-phase-artefacts.md) | Planning / implementation / knowledge base — corrigendum + reindex convention |
| 23 | ~~[Embedding Provider `base_url` Override](embedding-provider-base-url.md)~~ | Knowledge base CLI — `openai-compatible` driver + shared engine + config + setup | ✅ Done |
| 24 | ~~[Inception Self-Healing on Legacy / Kitchen-Sink Research](inception-self-healing-on-legacy-research.md)~~ | Migration 038 + `research-analysis` input guards + manifest `get` exit-2 + `routing` hardcode | ✅ Done |
| 25 | ~~[Analysis Cycle Counter Resets on Resume Collide with File Naming](analysis-cycle-counter-reset-collision.md)~~ | `workflow-implementation-process` Step 0 + `analysis-loop.md` + `invoke-analysis.md` | ✅ Done |
| 26 | [Review Not Re-Offered After Loopback from Review Remediation](review-not-re-offered-after-loopback.md) | `workflow-implementation-entry/validate-phase.md` + `workflow-bridge/discovery.cjs` |
| 27 | ~~[Continue-Epic Step 5 Asks the Agent to Filter Data the Discovery Script Doesn't Expose](continue-epic-items-to-recover-unobservable.md)~~ | `continue-epic/SKILL.md` Step 5 + `continue-epic/scripts/discovery.cjs` text formatter | ✅ Done |
| 28 | [Hybrid Search Ranking — Evaluate Text/Vector Weighting & Re-rank on a Real Corpus](hybrid-ranking-weighting-evaluation.md) | Knowledge base — `store.searchHybrid` weights + `index.js` `rerank()` + query pipeline |

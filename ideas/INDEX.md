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
| 15 | [STOP Gate Override Protection](stop-gate-override-protection.md) | All workflow skills with STOP gates |

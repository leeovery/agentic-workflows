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
| 6 | [User Guidance & Help](user-guidance-and-help.md) | All entry-point skills |
| 7 | [Spec Diff on Resurface](spec-diff-on-resurface.md) | Specification processing skill |
| 8 | [Intelligent Escalation](intelligent-escalation.md) | All review/fix cycles |
| 9 | [Epic Dependency Visualization](epic-dependency-visualization.md) | Continue-epic / workflow-start |

## Phase 4 — Implementation Improvements

| # | Idea | Scope |
|---|------|-------|
| 10 | [Integration Validation Agent](integration-validation-agent.md) | Implementation phase |
| 11 | [Task Backtracking](task-backtracking.md) | Implementation phase (investigation needed) |

## Phase 5 — Infrastructure & Intelligence

Larger systemic changes. Project memory benefits from all other improvements being in place so it has richer material to learn from. Discovery engine is a maintenance play — best done when discovery scripts next need changes.

| # | Idea | Scope |
|---|------|-------|
| 12 | [Project Memory](project-memory.md) | Cross-cutting, all phases |
| 13 | [Dynamic Discovery Engine](dynamic-discovery-engine.md) | All discovery scripts |

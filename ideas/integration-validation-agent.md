# Integration Validation Agent

## The Idea

After all tasks in a plan are implemented, run an agent that validates the implementation end-to-end as a cohesive whole — not just individual tasks in isolation.

## Why This Matters

Current agents operate per-task: executor implements one task, reviewer checks one task, analysis agents examine cross-task patterns. But nobody checks whether the assembled system actually works as an integrated whole.

Individual tasks can each pass their tests while the system fails at the seams. The task-reviewer can't catch this because it only sees one task's scope. The analysis agents (architecture, duplication, standards) look for patterns but don't run integration scenarios.

## What the Agent Would Do

A `workflow-implementation-integration-validator` would:

1. Read the full specification (the "golden document")
2. Read all implemented tasks and their tests
3. Trace end-to-end user journeys described in the spec
4. Check that data flows correctly across module boundaries
5. Verify that error handling chains work across layers
6. Flag integration gaps: "Task A produces X, Task B expects Y, but the format differs"
7. Check for missing glue code between independently-implemented components

This runs after the task loop completes but before the analysis loop, giving the analysis agents a chance to catch any integration issues as remediation tasks.

## Design Tension

This could be expensive (reads everything, thinks holistically). Might only be worth running for complex plans with many inter-dependent tasks. Could be optional, triggered by plan complexity or user preference.

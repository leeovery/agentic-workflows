# Agentic Engineering Workflows: Documentation

Structured engineering workflows for Claude Code. Documents drive phases, a deterministic engine owns state, Claude orchestrates and never freewheels. This is the full documentation; the repo's top-level README is the quick pitch and install.

## Reading order

Start here:

1. [Introduction](introduction.md): what the system is and the three commitments behind it
2. [How it fits together](how-it-fits-together.md): skills, engine, bridge, and a real session walked end to end
3. [Work types](work-types.md): the five pipeline shapes and how the right one gets picked

Then the pipeline, phase by phase:

4. [Discovery](discovery.md): the universal first phase. Shape the work, settle its type, persist it
5. [Research and discussion](research-and-discussion.md): explore, then decide, with background agents critiquing live
6. [Specification](specification.md): decisions become the golden document
7. [Planning](planning.md): the spec becomes phases, tasks, and a dependency graph
8. [Implementation](implementation.md): executor/reviewer agents per task, the TDD loop, fix threshold, analysis cycles
9. [Review](review.md): independent verification and the remediation loop

The machinery underneath:

10. [The engine](engine.md): transactions, refusals, byte-stable renders, commits, migrations
11. [Knowledge base](knowledge-base.md): what gets indexed, how recall works, decay, modes, setup
12. [Agents](agents.md): the 23 sub-agents, organised by when they act

Day to day:

13. [Inbox and capture](inbox-and-capture.md): logging thoughts, the working set, seeds vs imports
14. [Lifecycle tools](lifecycle-tools.md): pivot, absorb, promote, reopen, finalise, cancel, reactivate
15. [Output formats](output-formats.md): task backends and the five-file adapter contract
16. [Configuration](configuration.md): install, project defaults, gate modes, environment setup

Background:

17. [History](history.md): from two prose skills to the engine
18. [Timeline](timeline.md): the dated arc, with PR numbers and the review campaigns


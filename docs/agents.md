# Agents

Twenty-three sub-agents ship in `agents/`, and the reason they exist is context: a sub-agent reads the artifact cold, with no memory of the conversation that produced it, which is exactly what makes its critique worth having. The orchestrating session was *in* the conversation, so it can catch what was said but not written; the sub-agent catches what was written but not right. Every agent is stateless (each invocation starts fresh with full inputs), writes findings to files rather than chat, and returns a brief structured status. None touches git; commits belong to the orchestrator.

They divide by *when* they act.

## While you converse (background critics)

These run behind live [research and discussion](research-and-discussion.md) sessions, and their findings surface through the never-dump protocol: one finding per turn, reframed as a question, only after the user opts in.

| Agent | Role |
|---|---|
| `workflow-research-review` | Reads the research files with a clean slate; flags coverage gaps, shallow areas, unvalidated assumptions. Dispatched after meaningful commits. |
| `workflow-research-deep-dive` | Independent investigation of one thread (competitor, API, feasibility, market) with web access, running while the conversation continues. |
| `workflow-discussion-review` | The discussion counterpart of the research reviewer: gaps, shallow coverage, missing edge cases. |
| `workflow-discussion-perspective` | Argues a decision from one assigned analytical lens. Two run in parallel as a deliberate polarity pair (Formal Systems ↔ Incentive Realist, Common Path ↔ Tail-Risk, …), each restating the decision through its lens before arguing. |
| `workflow-discussion-synthesis` | Reconciles a completed perspective pair into a tradeoff landscape of tensions; a framing mismatch between the restatements becomes the first tension surfaced. |

## When a document must be validated (review cycles)

Dispatched synchronously inside the [specification](specification.md#review-two-agents-strictly-sequential) and [planning](planning.md#review) review loops, always in a strict order so the second agent reviews the corrected document.

| Agent | Role |
|---|---|
| `workflow-investigation-synthesis` | Independently validates a bugfix's root-cause hypothesis by tracing the code and checking it explains every symptom. |
| `workflow-specification-review-input` | Compares the spec against all source material: what got missed or distorted on the way in. |
| `workflow-specification-review-gap-analysis` | Reads the spec standalone, as its consumers will: completeness, clarity, ambiguity, planning readiness. |
| `workflow-planning-review-traceability` | Checks plan against spec in both directions: every task traceable, every requirement landed. |
| `workflow-planning-review-integrity` | Checks the plan's own structural quality, implementation readiness, and standards adherence. |

## While the plan is built

The [planning](planning.md#construction) construction pipeline, one concern per agent:

| Agent | Role |
|---|---|
| `workflow-planning-phase-designer` | Designs the phase structure from the specification. |
| `workflow-planning-task-designer` | Breaks one phase into a task list with edge cases. |
| `workflow-planning-task-author` | Writes full detail for all of a phase's tasks into the task detail file: one agent per phase, never concurrent. |
| `workflow-planning-dependency-grapher` | Establishes inter-task dependencies and priorities across the whole plan, detects cycles, writes graph data through the format adapter. |

## While the code is written

The [implementation](implementation.md) loop's pair, per task:

| Agent | Role |
|---|---|
| `workflow-implementation-task-executor` | Implements one task via the TDD workflow (or the quick-fix verification workflow). Stops and reports on any spec deviation rather than choosing a workaround. |
| `workflow-implementation-task-reviewer` | Independently reviews that one task: spec conformance, acceptance criteria, architectural quality. Its `needs-changes` verdict drives the fix loop. |

## After the code exists (analysis and remediation)

The post-loop [analysis cycle](implementation.md#the-analysis-loop) and [review remediation](review.md#the-remediation-loop) pipelines, three examiners, then synthesis, then write-back:

| Agent | Role |
|---|---|
| `workflow-implementation-analysis-architecture` | API surface quality, module structure, integration gaps, seam quality. |
| `workflow-implementation-analysis-duplication` | Cross-file duplication, near-duplicate logic, extraction candidates. |
| `workflow-implementation-analysis-standards` | Specification conformance and project convention compliance. |
| `workflow-implementation-analysis-synthesizer` | Deduplicates and normalizes the three analysts' findings into staged tasks for user approval. |
| `workflow-implementation-analysis-task-writer` | Writes approved analysis tasks into the plan via the format's authoring adapter. |
| `workflow-review-task-verifier` | Verifies one completed plan task against acceptance criteria, spec context, and test adequacy; dispatched in parallel batches of five during [review](review.md#verification). |
| `workflow-review-findings-synthesizer` | Turns review findings into normalized remediation tasks for triage and write-back. |

## The common shape

Read a few of these files and a pattern emerges. Inputs are explicit file paths plus content, never "the conversation so far". Outputs are structured: findings files with stable IDs and frontmatter state for the background critics, tracking files for the review cycles, staging files for the synthesizers, plus a terse `STATUS:` report to the orchestrator. Tool grants are minimal for the job (the phase designers get read-only `Read, Glob, Grep`; only the deep-dive researcher gets web access; only the task-writing agents get the Linear MCP tools). And every judgment gate stays with the orchestrator and the user: agents propose, findings get triaged, nothing an agent writes becomes plan or spec content without passing through an approval gate.

---

*Next: where work comes from before it has a pipeline, [inbox and capture](inbox-and-capture.md).*

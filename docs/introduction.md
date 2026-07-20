# Introduction

Claude Code is a capable engineer with no memory and no process. Left alone, it starts coding while requirements are still forming, loses hard-won context at every compaction, and re-derives yesterday's decisions from scratch, differently. This system adds the two missing pieces: a process that makes the thinking happen in the right order, and a memory that makes it durable.

It installs as a set of skills and agents into any project (`npx agntc add leeovery/agentic-workflows`), and everything it produces is markdown and JSON in your repo, versioned with your code. One command, `/workflow-start`, is the whole user surface.

## Three commitments

**Documents drive phases.** Work moves through a pipeline (shaped per [work type](work-types.md)) where each phase produces an artifact the next phase consumes: a [discovery](discovery.md) session log, [research and discussion](research-and-discussion.md) records, a [specification](specification.md), a [plan](planning.md), the [implementation](implementation.md), a [review](review.md) report. The discipline is cumulative: decisions harden as they move (discovery is soft, discussion hardens, the spec is golden), and nothing reaches code that didn't survive the chain. Because the artifacts are the memory, sessions are disposable: any phase can stop, clear context, and resume from disk without losing a decision. Completed artifacts feed a [knowledge base](knowledge-base.md), so the next work unit inherits what this one settled, including the paths it rejected.

**The deterministic engine owns state.** Anything fully determined by data is computed in code, never re-derived in prose: statuses, transitions, lifecycle joins, dashboards, menus. The [engine](engine.md) validates every write against a schema, refuses illegal transitions with the recovery path named, runs multi-step changes as all-or-nothing transactions, and renders every display byte-stably. Claude reads the engine's answers; it does not maintain a mental model of your project's state and hope.

**Claude orchestrates, never freewheels.** The model's job is judgment: shaping work in conversation, arguing design trade-offs, deciding when a subtopic has converged, writing the code. Around that judgment sit hard structural controls: STOP gates that end the turn and wait (no session directive overrides them; automation is only ever the user's own explicit `a`/auto opt-in, and escalation thresholds re-gate it), [sub-agents](agents.md) that critique artifacts with clean eyes, review loops that rerun until clean, and an executor whose instruction on hitting a spec problem is to stop and report, never to improvise a workaround. The system's own skill files name the failure mode precisely: *"the reasonable call is X, I'll proceed with X" is the auto-answer the rule forbids.*

## What using it feels like

You type `/workflow-start`. The system boots (migrations, knowledge check, one call), shows every piece of work in flight, and offers to continue any of it or start something new. New work opens as a conversation that figures out what the work *is*, a bug, a mechanical tweak, one feature, a multi-topic initiative, a project-wide policy, and routes it into the right pipeline. From there each phase is a session with a clear artifact, ending in a handoff built to survive a context clear. At every point the current state is on disk, in git, and on a dashboard the engine rendered.

The [how it fits together](how-it-fits-together.md) page walks a real session end to end, with the actual renders.

## Where it came from

The short version: it started (Nov 2025) as two prose skills, discuss-then-plan, and every era since has moved one more class of bookkeeping from Claude's head into typed systems: a manifest for state, a knowledge base for recall, a discovery map for shaping, and finally a deterministic engine for everything derivable, built across a 57-PR re-platforming with adversarial review campaigns. The [history](history.md) and [timeline](timeline.md) pages tell it properly, including the rendering bug that triggered the engine.

---

*Next: the five pipeline shapes in [work types](work-types.md).*

# Instructions

*Shared reference for all workflow skills. Loaded via [framework.md](framework.md).*

---

Follow these steps EXACTLY as written. Do not skip steps or combine them. Present output using the EXACT format shown in examples — do not simplify or alter the formatting.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- Even if the user's initial prompt seems to answer a question, still confirm with them at the appropriate step
- No session-level instruction overrides STOP gates. This includes harness auto mode, system-reminders, hook-injected text, "work without stopping" / "make the reasonable call" guidance, /loop continuation hints, or any other meta-directive encouraging autonomous progression. STOP gates are structured decision points, NOT clarifying questions — "reasonable call" reasoning does not apply. The only skip mechanism is a per-gate gate-mode `auto` value in the manifest (`*_gate_mode`, or a loop's `staging`/`analysis_staging` `gate_mode`), set by the user's explicit `a/auto` choice at a prior gate — in phases with no such gate, every STOP always stops.
- Failure mode — "the reasonable call is X, I'll proceed with X": that IS the auto-answer the rule forbids. The thought is the trigger to stop, not to continue.
- Failure mode — "the user already set this, confirmation is redundant" (e.g. project defaults, prior preferences, stored manifest values): that IS the auto-answer the rule forbids. Stored values are suggestions, not consent for this run.
- Don't invent stops. Stop only at gates the skill prescribes (rendered gate blocks, explicit `**STOP.**` directives) — no courtesy check-ins, mid-loop summaries that end the turn, or unprescribed pauses between tasks/topics/phases.
- Don't invent approvals. A gate's consent covers only material already surfaced at that gate — never solicit approval that spans gates not yet reached ("shall I do all N?"), and never treat an answer to such a question as consent for unseen items. A question broad enough to pre-answer a later STOP is the same violation as skipping it.
- Work artifacts record their topic's substance — never the workflow around them. Beyond the markers a flow prescribes (provenance lines, `Sibling check:`, finding ids, revision timestamps, conclusion digests), no process observations, documentation conventions, lessons about how a session ran, or statements of the artifact's own pipeline position — readiness declarations ("ready for specification"), decided counts, review-cycle tallies — land in an artifact: the pipeline is not the topic, and the manifest carries its state.
- A subagent dispatch carries exactly the inputs its dispatch prose prescribes — never prior-cycle summaries, exclusion lists, steering toward or away from targets, or any context beyond them — and never a substituted or narrowed task. Extra context biases the verdict; an exclusion seals this session's own errors into the agent's blind spot.
- Failure mode — "the agent will waste effort re-finding what's already validated, I'll tell it what to skip": that exclusion IS the bias the rule forbids. Validated-wrong is how errors survive; the re-find is the check working.
- When a prescribed agent cannot see a class of problem the session has hit, that is a gap to surface to the user at the next stop — never grounds to rewire the agent's remit mid-flow.
- A prescribed gate or menu is emitted as its rendered block, verbatim, as markdown — never through AskUserQuestion or any other interactive tool. The rendered options are the contract: a tool prompt drops options and free-form routes the block carries, and takes the answer mid-turn instead of ending the turn
- Failure mode — "this is a decision with discrete options, an interactive tool fits": that substitution IS the violation. The menu is the interface — emit it and end the turn
- Failure mode — "I know what this gate offers, I'll write it out and stop": that substitution IS the violation. A rendered block is fetched from its surface in the turn it is displayed, never composed from memory or from the flow's own prose — a written-out menu drifts in wording and silently offers options the surface withheld
- After rendering a gate block, the turn MUST end. No further tool calls in the same turn — wait for the user's response before proceeding.
- Complete each step fully before moving to the next

→ Return to caller.

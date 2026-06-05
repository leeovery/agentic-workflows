# Research-Review Agent Flags Unmade Decisions as Coverage Gaps

## The Idea

The `workflow-research-review` agent should distinguish **"the option landscape for decision X is under-explored"** (a legitimate research gap) from **"decision X hasn't been made yet"** (not a gap — that's the *next* phase's job). Right now it has no instruction guarding that boundary, so it surfaces unmade decisions as findings, which pushes the research phase toward premature decision-making — the exact thing the phase is chartered *not* to do.

## How It Surfaced

During a configless-install feature research session, the final research-review returned findings like "the multi-skill prompt flow is unaddressed" and "name-collision behaviour is unexplored." These read as coverage gaps but are actually **decisions** the discussion phase exists to resolve. The orchestrator briefly treated them as research deficiencies, creating a confusing "it's clean / here are 5 gaps" contradiction for the user. The user correctly intuited the agent might be over-reaching its remit.

(On inspection, the agent was *mostly* right — most findings were genuine factual gaps, e.g. "the copy-safety exposure is named but never actually assessed against the code." Only the decision-shaped ones were miscategorised. So this is a refinement, not a rewrite.)

## Why This Matters

The research phase's charter is explicit: **surface options and tradeoffs, do not decide.** The agent already encodes part of this — its instructions say *"Do not recommend directions"* and *"Do not evaluate options."* But those forbid the agent from *taking sides*; they don't forbid it from flagging *that a decision is open* as if openness were a deficiency. That's the unguarded seam.

When an unmade decision is reported as a gap:
- The orchestrator may try to "close" it — i.e. start deciding — violating the phase boundary.
- The user gets noise: items presented as "missing research" that are really "pending decisions," already captured in the open-questions list.
- It muddies the conclude gate, where the signal should be "is the option landscape explored enough for discussion to decide?" — not "are all decisions made?"

## What It Would Look Like

A small addition to the agent's "What you do NOT do" rules (it already lists "Do not recommend directions" / "Do not evaluate options"), e.g.:

> **Do not flag unmade decisions as gaps.** Research surfaces the option landscape; *making* the choice belongs to the discussion phase. "The tradeoffs of X aren't explored enough to inform a decision" is a valid gap. "X hasn't been decided" is not — that's expected at research conclusion. If the options and their tradeoffs are adequately surfaced, the decision being open is not a deficiency.

The valid/invalid test the agent should apply:
- ✅ "Option B's cost is asserted but never investigated" — under-explored landscape.
- ✅ "This assumption is stated as settled but never verified" — accuracy/validation gap.
- ❌ "The team hasn't chosen between A and B" — a pending decision, not a gap.

## Scope

- `agents/workflow-research-review.md` — add the boundary rule to its constraints section. (Consider whether `workflow-discussion-review` has the inverse risk and wants a symmetric note.)
- Instruction-only change; no code. Low risk, high clarity payoff at the research conclude gate.

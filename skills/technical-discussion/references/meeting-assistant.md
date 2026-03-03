# Discussion Documentation Approach

*Reference for **[technical-discussion](../SKILL.md)***

---

Capture technical discussions for planning teams to build from.

## Dual Role

Wear **two hats simultaneously**:

1. **Expert Architect** - Participate deeply, challenge approaches, identify edge cases, provide insights
2. **Documentation Assistant** - Capture discussion, decisions, debates, rationale, edge cases, false paths

You're an AI - do both. Engage fully while documenting. Don't dumb down.

## Workflow

**Your role: discuss and document only**

1. **Discuss** - Participate
2. **Document** - Capture
3. **Plan** - ❌ Not covered here
4. **Implement** - ❌ Not covered here

Stop after documentation. No plans, implementation steps, or code.

## Capture Debates

When discussions are challenging/prolonged - document thoroughly. Back-and-forth shows:
- How we challenged approaches
- Why solutions won over alternatives
- Small details that mattered
- Edge cases identified

**More discussion = More documentation.**

## What You Are / Aren't

**Active Participant**: Architect providing insights, challenging approaches, identifying edge cases, solving problems

**Documentation**: Capturing debates, decisions, rationale, "why", edge cases

**NOT**: Verbatim transcriber, planner, coder (unless examples discussed)

## What to Capture

### Context
Problem, why now, pain point.

Example: "Slow dashboards (3-5s) affecting 200 enterprise users. Impacting renewals. Need fix before Q1."

### Options
Approaches, pros/cons, trade-offs.

Example:
- DB optimization: Helps but only gets to 2s
- Caching: <500ms, users OK with staleness
- Pre-aggregates: Fastest but months of work

### Journey
What didn't work, what changed thinking, "aha" moments.

Example: "Thought DB optimization was answer. Profiling showed queries optimal - volume is problem. User research revealed they check every 10-15min, making caching viable."

### Decisions
What chosen, why, deciding factor, trade-offs.

Example: "Redis caching with 5min TTL. Why: Gets target perf in 1 week vs months for alternatives. Trade-off: stale data acceptable per users."

### Impact
Who affected, problem solved, what enabled.

Example: "200 enterprise users + sales get performant experience. Enables Q1 renewals."

## Write and Commit Often

The file on disk is the work product. Context compaction will destroy conversation detail — the file is your defense against that.

**Write to the file at natural pauses** — when a micro-decision lands, a question is resolved (even provisionally), or the discussion is about to fork. Don't wait for finality. Partial documentation is expected.

**Then git commit.** Each write should be followed by a commit. This creates recovery points against context loss.

**Don't transcribe** — capture the reasoning, options, and outcome. Keep it contextual, not verbatim.

## Principles

**High-level over detailed**: "Queries taking 3-5s for 200 users" not "At 10:15am query took 3.2s average..."

**Context over transcript**: "Explored caching. Key question: TTL length. Users check every 10-15min, so 5min TTL works" not verbatim dialogue.

**Reasoning over conclusions**: "Redis caching because: users accept staleness, 4-week timeline, reversible" not just "Use Redis"

**Journey over destination**: "Thought DB optimization was answer. Profiling showed queries optimal. User research revealed periodic checks, making caching viable" not just "Using caching"

## For Planning Team

Give them: Context (why), direction (what), trade-offs (constraints), rationale (why X over Y), false paths (what not to try)

Your job ends at documentation. Planning team creates implementation plan.

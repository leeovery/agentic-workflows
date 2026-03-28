# Codex Review Dispatch

## The Idea

When OpenAI's Codex is available on the system, dispatch review agents to Codex instead of Claude Code sub-agents. Codex is reportedly more analytical and may produce higher-quality code reviews, while Claude remains the primary agent for authoring and orchestration.

## Why This Matters

The workflow currently dispatches all sub-agents to Claude Code. This works well for implementation — Claude on Opus 4.6 is one of the best coding agents available. But review is a different skill profile: it rewards analytical rigour, thoroughness, and a critical eye over creative authoring ability.

If a more analytical model is available for review, using it would improve review quality without disrupting the authoring workflow. The key insight is that review agents are already isolated — they receive context, produce findings, and return structured output. They don't need to be the same model that wrote the code.

## What It Would Look Like

1. **Detection**: At workflow startup (or review phase entry), check whether Codex CLI is available on the system
2. **Dispatch routing**: When Codex is available, review agents (task reviewer, analysis agents, specification reviewers, planning reviewers) get dispatched to Codex instead of Claude Code sub-agents
3. **Fallback**: When Codex is unavailable, behaviour is unchanged — reviews go to Claude sub-agents as they do today
4. **Output contract**: Review agents already return structured output (findings, verdicts, recommendations). The contract stays the same regardless of which model executes the review — the orchestrating skill doesn't need to know or care which model produced the findings

## Design Tensions

- **Prompt compatibility**: Review agent prompts are written for Claude's instruction-following style. Codex may interpret them differently — prompts might need a Codex-specific variant or an adapter layer
- **Context passing**: Claude sub-agents inherit conversation context naturally. Codex dispatch would need to bundle all required context explicitly (spec, plan, task, code under review)
- **Latency and cost**: Codex API calls may have different latency/cost profiles. Worth measuring whether the quality uplift justifies any performance trade-off
- **Model drift**: Tying review quality to a specific external model creates a dependency. If Codex changes or degrades, review quality shifts outside our control
- **Configuration**: Should this be a project-level default (`project.defaults.review_model`) or a per-invocation choice? Project default with override seems right

## Broader Application

This opens the door to a more general "best model for the job" routing pattern. Different phases could dispatch to different models based on their strengths — analytical models for review, creative models for discussion, fast models for validation checks. But review is the clearest win and the right place to start.

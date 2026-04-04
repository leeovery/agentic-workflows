# Workflow Testing & Tuning via Automated Experimentation

Research into how to test, evaluate, and iteratively improve the agentic-workflows skill files and pipelines. Prompted by exploring whether Karpathy's autoresearch pattern (autonomous modify-run-measure-keep/revert loops) could be applied to workflow quality optimization.

## The Core Question

Can we build an automated feedback loop that improves our skill files — the way autoresearch improves ML training configs? And more fundamentally, how do we test these workflows at all?

## Landscape Summary (April 2026)

### What Exists and Is Mature

**Eval frameworks** are production-ready. Promptfoo (YAML-driven, CI/CD native, open source Node.js) and Evalite (TypeScript-native, Vitest-like DX) are the strongest fits for our ecosystem. Both support layered evaluation: deterministic checks (regex, schema, contains) then LLM-as-judge for content quality.

**LLM-as-judge** is well-understood. Rubric-based scoring with chain-of-thought reasoning works. Pairwise comparison avoids absolute scoring problems. Key: calibrate with examples, randomize order, use temperature 0, run multiple times and aggregate.

**Prompt regression testing** has established CI/CD patterns. Golden dataset approach: curate input/expected-output pairs, run on every PR, compare scores to baseline, fail if metrics drop. Promptfoo and Evalite both support this.

**Cost optimization** is solved. Layer cheapest checks first (deterministic regex = free, then heuristic = cheap, then LLM judge = expensive). Use Haiku for judge duties. Statistical sampling with confidence intervals rather than exhaustive evaluation.

### What's Emerging

**Agentic workflow testing** is medium maturity. Trace-based evaluation (capture full execution traces, evaluate the path not just the output) is becoming standard. LangSmith added multi-turn trajectory analysis in late 2025. But all existing frameworks assume tool-calling agents with programmatic boundaries — not prompt-as-program architectures like ours.

**Behavioral/contract testing** for LLMs is promising. Prompt-Contracts (PCSL) defines structural, semantic, and behavioral validation specs — conceptually right for our convention rules, but early-stage tooling. Property-based testing applied to LLM outputs (FSE 2025) is validated research.

**Automated prompt optimization:**
- **DSPy** is production-ready for programmatic pipelines. GEPA optimizer (evolutionary, Pareto-aware) can optimize multi-agent systems. But requires restructuring as typed Signatures — wrong abstraction for natural-language skill files.
- **TextGrad** (Stanford, Nature 2025) backpropagates natural-language feedback as "gradients" to improve prompts. Conceptually applicable to skill files.
- **Trace/OPTO** (Microsoft, NeurIPS 2024) models workflows as graphs and optimizes parameters (including prompts) using execution traces.
- **Trace2Skill** (March 2026) is the closest to our problem — dispatches sub-agents to analyze execution trajectories, extracts lessons, consolidates into skill directories. Explicitly tested on Claude Code skill files. Paper only, no production tooling.

**The autoresearch pattern** has been applied beyond ML: Shopify used it for code performance optimization (53% faster Liquid rendering from 93 automated commits overnight). The pattern works whenever you have: a single editable asset, a scalar metric, and time-boxed cycles.

### The Gap

No existing tool handles our specific architecture:
- **Multi-file interdependency**: All optimizers treat prompts as independent strings. Our skill files cross-reference, conditionally load, and share conventions. Optimizing one file can break behavior governed by another.
- **Prompt-as-program**: Our workflow logic lives in natural language instruction files, not code. No framework captures step boundaries defined by H2 headings in markdown.
- **Cascading quality**: Did the discussion lead to a good spec? Did the spec lead to a good plan? No eval framework handles this multi-phase quality chain.
- **Structural optimization**: Existing tools optimize content within a fixed structure. Nobody optimizes the decomposition itself (which instructions go in which file).

## What We Can Concretely Test Today

### Tier 1: Deterministic Format Validation (Free, Fast)

Our CLAUDE.md defines dozens of hard rules that are pure pattern matching:

- Phase title borders: exactly `●` + 47 em-dashes + `●` = 49 chars
- Step markers: `── {Name} ─────...` padded to exactly 49 chars
- Sub-step markers: `·· {Name} ·····...` padded to exactly 49 chars
- Signpost blockquotes: every line starts with `> `, max ~70 chars per line
- Rendering instructions: must precede every user-facing fenced block
- Menu frames: `· · · · · · · · · · · ·` dot separators
- Stop gates: only `**STOP.**` pattern, never variations
- Heading hierarchy: H1 title only, H2 steps, H3 subsections, H4 conditionals only
- Navigation verbs: only `→ Proceed to` and `→ Return to`, never alternatives
- Status terms: always parenthetical `(term)`, never brackets
- Bullet characters: `•` only, never `-` or `*`

These could run as a lint pass on skill files themselves (static analysis) AND on captured workflow outputs (runtime validation).

### Tier 2: Structural Contract Validation (Cheap)

- Skill files have required structure: frontmatter, purpose, Step 0 (migrations), sequential numbering
- Load directives follow exact format: `Load **[name.md](path)** and follow its instructions`
- Reference files have headers: `# Title` + attribution + horizontal rule
- Every conditional branch has its own routing instruction
- Manifest state transitions follow valid paths per work type
- Output artifacts exist at expected paths with required sections

### Tier 3: LLM-as-Judge Content Quality (Moderate Cost)

Per-phase rubrics for evaluating output substance:
- Discussion: topic coverage, decision clarity, convergence signals
- Specification: completeness, precision, testability, edge case coverage
- Plan: task granularity, dependency correctness, acceptance criteria quality
- Implementation: test coverage, code quality, plan adherence
- Review: thoroughness, actionability of findings

### Tier 4: End-to-End Pipeline Validation (Expensive)

Scripted scenario runs through full workflow paths with synthetic user inputs, validating that artifacts are structurally valid, manifest states are correct, and cross-phase references are coherent.

## Potential Approaches

### Approach A: Convention Linter (Start Here)

A static analysis tool that validates skill files against CLAUDE.md conventions. No LLM needed. Catches format regressions on every PR. This is the highest-value, lowest-cost starting point.

What it validates:
- Skill file structure (frontmatter, steps, load directives, routing)
- Display convention compliance (borders, markers, menus, blockquotes)
- Navigation verb correctness
- Conditional routing completeness
- Reference file header format

### Approach B: Phase Output Evaluator

Capture output from workflow runs (real or synthetic), evaluate against per-phase rubrics. Uses layered approach: deterministic checks first, then LLM-as-judge for content.

Requires:
- Golden examples of good phase outputs
- Synthetic user input scripts for reproducible runs
- Per-phase scoring rubrics
- Regression baseline tracking

### Approach C: Autoresearch-Style Optimization Loop

Apply the modify-run-measure-keep/revert pattern to individual skill files:
1. Agent proposes a targeted edit to a skill file
2. Run the workflow phase with a test scenario
3. Evaluate output (deterministic + LLM judge)
4. Keep improvement, revert regression
5. Repeat

Constraints:
- Must operate on one file at a time (or understand cross-file dependencies)
- Needs a composite metric (format score + content score)
- Cycles are expensive (each run = full workflow phase with API calls)
- Best applied to individual phases, not the full pipeline

### Approach D: Trace2Skill-Inspired Learning

Analyze execution trajectories from real workflow usage:
1. Capture traces from actual workflow sessions
2. Sub-agents analyze where the workflow succeeded/struggled
3. Extract lessons and consolidate into skill improvements
4. Validate improvements don't cause regressions

This is the most ambitious approach but potentially the most valuable — it learns from real usage rather than synthetic scenarios.

## Recommended Path

1. **Now**: Build the convention linter (Approach A). High value, low cost, catches regressions immediately.
2. **Next**: Build phase output evaluators (Approach B) for 1-2 phases. Start with specification (most structured output) and discussion (most conversational).
3. **Then**: Explore autoresearch-style loops (Approach C) on the phases that have good evaluators, targeting specific quality dimensions.
4. **Later**: Instrument real usage for trace-based learning (Approach D) once we have enough evaluation infrastructure to validate improvements.

## Key Tools to Investigate

- **Promptfoo**: YAML-driven eval with deterministic + LLM assertions, CI/CD native
- **Evalite**: TypeScript-native eval, Vitest-like DX, approaching v1
- **Prompt-Contracts (PCSL)**: Formal spec language for LLM behavior contracts
- **Trace2Skill**: Trajectory-based skill optimization (paper, no tooling yet)

## Sources

Eval frameworks: Promptfoo, DeepEval, Braintrust, Inspect AI, Evalite, Arize Phoenix, LangSmith, Langfuse, RAGAS. LLM-as-judge: Confident AI guide, Cameron Wolfe deep dive, Evidently AI, Eugene Yan. Agentic testing: CodeAnt, Amazon AWS, StackAI, LangChain readiness checklist. Prompt optimization: DSPy, TextGrad (Nature 2025), Trace/OPTO (NeurIPS 2024), EvoPrompt (ICLR 2024), PromptBreeder (DeepMind), GEPA/SuperOptiX. Self-improving agents: Trace2Skill (March 2026), OpenAI Self-Evolving Agents Cookbook, ICML 2025 metacognitive learning. Autoresearch applications: MindStudio business guide, The New Stack analysis, Non-ML applications guide. Markdown evaluation: MDEval (ACM 2025), StructEval (2025).

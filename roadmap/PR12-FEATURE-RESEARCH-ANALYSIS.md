# PR 12: Research-to-Discussion Handoff

## Problem

Two issues with how research feeds into discussion:

### 1. Epic: Double summarization loses information

The epic research analysis extracts 1-2 sentence summaries per topic. When a topic is selected, the entry skill further condenses this into a 2-5 line summary. The handoff to `technical-discussion` passes only this twice-distilled snippet plus a file/line reference. The discussion skill never reads the original research files — the actual depth, nuance, and reasoning is lost.

The analysis should be a **topic discovery tool** — it helps the user pick which topic to discuss. Once picked, the discussion skill should work from the **source research files** directly.

### 2. Feature: No research analysis at all

When a feature completes research and enters discussion, the research content is shown as raw context but not analyzed. The `source="new"` path in `gather-context.md` reads research files and shows key findings, but this is ad-hoc — there's no structured analysis step.

## Design Decisions

### Analysis = topic discovery only

The research analysis exists to help users pick a discussion topic (epic) or confirm what's being discussed (feature). It is **not** a content proxy. The discussion skill reads source research files directly.

Analysis cache shape per topic:
- **Theme name** — represents the topic
- **Summary** — as long as needed to convey what the topic covers (not artificially short)
- **Sources** — which research file(s) contain relevant material

No key questions (the discussion skill derives these from the full research). No line numbers (themes are often scattered across files — pinning line ranges is fragile and usually wrong).

### Discussion reads source research

When a topic is selected and has associated research, the handoff tells `technical-discussion` which files to read. The discussion skill reads them directly during Step 1 (Initialize Discussion), pulling relevant material into Context and deriving Questions from the actual research.

### No caching for feature

Epic needs caching because: multiple research files need cross-cutting analysis, multiple sessions enter discussion for different topics, and the topic breakdown menu needs stable output.

Feature has none of these: one research file (or a small set all feeding one topic), one discussion session, no topic selection menu. The analysis happens inline — read research, produce a structured summary, present it, move on.

### Research remains optional

Research is optional for both epic and feature. The distinction between work types is about scope and shape (multi-topic vs single-topic), not certainty. You can have an epic where you already know the architecture, or a feature where you need to explore first.

When research doesn't exist, the existing seeding questions (core problem, constraints, codebase files) gather the context that research would have provided. These are unchanged.

## Changes

### Epic: Fix the handoff

**`workflow-discussion-entry/references/gather-context-research.md`** — instead of summarizing the analysis summary, pass file references:

```
Discussion session for: {topic}
Work unit: {work_unit}
Output: {output_path}

Research files:
- .workflows/{work_unit}/research/{filename1}.md
- .workflows/{work_unit}/research/{filename2}.md
Topic context: {summary from analysis — what this topic is about}
```

**`workflow-discussion-entry/references/invoke-skill.md`** — update the `source="research"` handoff template to pass file paths instead of a line-reference + summary.

**`technical-discussion` Step 1** — when research files are provided in the handoff, read them and use the content to populate Context and derive Questions.

### Epic: Slim the analysis cache

**`workflow-discussion-entry/references/research-analysis.md`** — update cache format:

```markdown
# Research Analysis Cache

## Topics

### {Theme name}
- **Summary**: {as long as needed}
- **Sources**: {filename1}.md, {filename2}.md
```

Drop key questions and line numbers.

### Feature: Add inline research analysis

**`workflow-discussion-entry/references/gather-context.md`** — the `source="new"` path when research is completed: read research files, produce a structured summary (theme, what it covers, source files), present with "anything to add?", then pass research file references in handoff.

No caching, no manifest cache fields, no `.state/` file. Inline analysis only.

**`workflow-discussion-entry/references/invoke-skill.md`** — the `source="new-with-research"` handoff passes research file paths so the discussion skill reads them directly.

### Discussion skill: Read research files

**`technical-discussion/SKILL.md` Step 1** — when the handoff includes research file paths, read them as part of initialization. Use the content (not summaries of summaries) to populate Context and seed Questions.

## Scope

- `workflow-discussion-entry/references/gather-context.md` — feature research analysis (inline)
- `workflow-discussion-entry/references/gather-context-research.md` — epic: pass file refs not summaries
- `workflow-discussion-entry/references/research-analysis.md` — slim cache format
- `workflow-discussion-entry/references/invoke-skill.md` — both handoff templates pass file paths
- `technical-discussion/SKILL.md` (Step 1) — read research files when provided
- `technical-discussion/references/template.md` — may need References section guidance

## Not In Scope

- Bugfix (no research phase)
- Changes to the research processing skill itself
- Seeding questions for fresh discussions (already correct)
- Research optionality (already works — both epic and feature offer research as optional)

# Research Refactor — Design Brief

## Problem

Research for epic work types needs to handle multiple topics, but the current system treats research as a single monolithic file (`exploration.md`). For a v1 project, research spans business, marketing, architecture, design, language choice, data modelling, and more — it can't all live in one file.

## Current Behaviour

- Research always creates `exploration.md` as the starting file
- No way to create named research files for specific topics
- No way to return to a specific research file from workflow-start or start-research
- Research status is a single flat value in the manifest (`in-progress` / `concluded`)
- Convergence awareness concludes the entire research phase, not individual files
- workflow-start discovery doesn't list individual research files for epic
- Discussion analysis already handles multiple research files correctly (reads all `*.md` in the research directory)

## Desired Behaviour

### Entry — Two Paths

When starting research, ask: **Do you have a specific topic, or do you want to explore openly?**

1. **Specific topic**: Create `.workflows/{work_unit}/research/{topic}.md` directly (like discussion creates `{topic}.md`)
2. **Open exploration**: Create `.workflows/{work_unit}/research/exploration.md` — broad thinking, see where it goes

### Topic Extraction from Exploration

As themes emerge during open exploration, the research skill should:
- Recognise when a distinct topic is forming
- Offer to extract it into its own named file (e.g., `architecture.md`, `data-modelling.md`)
- The exploration file continues for remaining open threads
- Strengthen the existing convergence/topic-surfacing logic

### Per-File Convergence

Individual research files should be concludable independently:
- "This topic is ready for discussion" → conclude just that file
- Other files remain in-progress
- The overall research phase concludes when all files are concluded (or the user decides)

### Continue / Resume

Users should be able to:
- Pick which research file to continue with
- Start a new named topic
- Return to exploration
- See all research files and their state

### Display in workflow-start

For epic work units, research should show individual files:
```
Research:
  └─ exploration.md (in-progress)
  └─ architecture.md (concluded)
  └─ data-modelling.md (in-progress)
```

## Design Considerations

- **Per-file status tracking**: Needs some form of tracking — either manifest items (like discussion), file-level markers, or filesystem-based (file exists = in-progress, presence of conclusion marker = concluded)
- **Discussion analysis unchanged**: The discussion phase already reads all research files collectively. Whether there's 1 file or 10, the analysis groups them into discussion topics. This shouldn't need to change.
- **Feature/bugfix research**: For non-epic work types, research is simpler (usually one topic). The multi-file support should work but the entry-point can be simpler — no need for the "specific topic or explore?" question for a single-topic pipeline.
- **File naming**: Topic files use kebab-case like discussion (`{topic}.md`). `exploration.md` is the special name for open exploration.

## Files Likely Affected

- `skills/technical-research/SKILL.md` — session loop, file management, resume detection
- `skills/technical-research/references/convergence-awareness.md` — per-file convergence
- `skills/technical-research/references/research-session.md` — topic extraction during session
- `skills/start-research/SKILL.md` — mode detection, file argument, topic selection
- `skills/start-research/references/gather-context.md` — specific topic vs exploration question
- `skills/start-research/references/invoke-skill.md` — pass file path in handoff
- `skills/workflow-start/scripts/discovery.js` — list research files for epic
- `skills/workflow-start/references/epic-routing.md` — research file menu items
- `skills/workflow-bridge/references/epic-continuation.md` — research file display
- `skills/start-epic/references/invoke-skill.md` — research handoff
- Manifest: possibly add research items for epic (or use filesystem-based tracking)

## Relationship to Current Audit

Found during Round 8 audit of `feat/work-type-architecture-v2`. The immediate gaps (missing `research` row in routing tables, research files not surfaced in epic discovery) are being patched minimally in the audit. This document captures the full design intent for a proper follow-up.

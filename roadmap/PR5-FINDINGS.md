# PR 5: Phase Skills Internal — Detailed Findings

*Analysis findings from pre-implementation discussion. Referenced by the [implementation plan](../.claude/plans/golden-growing-spring.md). Original design in [PR5-PHASE-SKILLS-INTERNAL.md](PR5-PHASE-SKILLS-INTERNAL.md).*

---

## 1. Historical Context

### 1.1 What Standalone Mode Was

The standalone mode (no-args path) in phase skills was the **original design** before PR1 introduced manifests and work units. In the original architecture, all artifacts lived together under `.workflows/` in phase directories (discussion/, research/, specification/, etc.) without work-unit scoping. Phase skills scanned everything because there was nothing to scope to.

PR1 (Big Bang) introduced manifests and work-unit-first directory structure (`.workflows/{work_unit}/`). PR4 (Start/Continue Split) introduced dedicated start and continue skills as the user-facing entry points. These two PRs made standalone mode obsolete — the start/continue skills handle work-unit selection and context gathering, then invoke phase skills with the work unit already determined.

### 1.2 What PR4 Changed

PR4 added bridge mode to phase skills and created start/continue skills. However, bridge mode was designed to skip context gathering entirely, on the assumption that callers would provide all necessary context. In practice, the start skills only gather enough for naming (a brief description), not the detailed seed questions that bootstrap processing skills. This created a gap where new phase entries via bridge mode receive no phase-specific bootstrapping.

### 1.3 What This PR Achieves

- **Remove standalone mode** — legacy from pre-work-unit era, fully superseded
- **Keep scoped epic paths** (work_type + work_unit, no topic) — actively used by callers
- **Rename** `start-*` → `workflow-enter-*`, set `user-invocable: false`
- **Fix bootstrap question gap** from PR4 — new phase entries always ask seed questions
- **Replace bridge mode concept** with simpler routing model

---

## 2. Caller Path Analysis

Every phase skill invocation traces back to one of these callers. This section documents the complete paths.

### 2.1 Feature/Bugfix Paths (topic always = work_unit)

**New work — start skills create the work unit, invoke first phase:**

```
/start-feature → asks "What feature are you adding?" → names work unit → inits manifest
  → asks research or discussion → invokes /start-{phase} feature {work_unit}

/start-bugfix → asks "What's broken?" → names work unit → inits manifest
  → invokes /start-investigation bugfix {work_unit}
```

**Continue — determines next phase, invokes:**

```
/continue-feature → discovery finds features → user selects → backwards nav option
  → invokes /start-{next_phase} feature {work_unit}

/continue-bugfix → discovery finds bugfixes → user selects → backwards nav option
  → invokes /start-{next_phase} bugfix {work_unit}
```

**Bridge — processing skill concludes, transitions to next phase:**

```
/workflow-bridge → computes next_phase → plan mode → context clear
  → invokes /start-{next_phase} {work_type} {work_unit}
```

All feature/bugfix invocations provide work_type + work_unit. Topic = work_unit (inferred). Always bridge-equivalent.

### 2.2 Epic Paths (topic may or may not be provided)

**New work:**

```
/start-epic → asks "What's the initiative?" → names work unit → inits manifest
  → asks research or discussion → invokes /start-{phase} epic {work_unit}  [NO TOPIC]
```

**Continue — shows full state, user picks from menu:**

```
/continue-epic → discovery builds per-phase breakdown → state display → menu

Menu options WITH topic (bridge):
  Continue {topic} — {phase}              → /start-{phase} epic {work_unit} {topic}
  Start planning for {topic}               → /start-planning epic {work_unit} {topic}
  Start implementation of {topic}          → /start-implementation epic {work_unit} {topic}
  Start review for {topic}                 → /start-review epic {work_unit} {topic}
  Resume a concluded topic → {topic}       → /start-{phase} epic {work_unit} {topic}

Menu options WITHOUT topic (scoped):
  Start specification                      → /start-specification epic {work_unit}
  Start new discussion topic               → /start-discussion epic {work_unit}
  Start new research                       → /start-research epic {work_unit}
```

**Bridge — epic enters interactive mode (same as continue-epic):**

```
/workflow-bridge (epic) → interactive mode → state display + menu → same routing as continue-epic
```

### 2.3 Summary: When Topic Is and Isn't Provided

| Caller | Work Type | Topic Provided? | Phase Skills Affected |
|--------|-----------|----------------|----------------------|
| start-feature | feature | Yes (= work_unit) | research, discussion |
| start-bugfix | bugfix | Yes (= work_unit) | investigation |
| start-epic | epic | **No** | research, discussion |
| continue-feature | feature | Yes (= work_unit) | all 6 phases |
| continue-bugfix | bugfix | Yes (= work_unit) | all 5 phases |
| continue-epic (in-progress/next-phase) | epic | Yes | all 6 phases |
| continue-epic (new/spec) | epic | **No** | research, discussion, specification |
| workflow-bridge (feature/bugfix) | feature/bugfix | Yes (= work_unit) | next phase in pipeline |
| workflow-bridge (epic) | epic | Mixed | same as continue-epic |

**Phases that need scoped epic paths (no topic):** research, discussion, specification
**Phases that are always bridge (topic always provided):** planning, implementation, review, investigation

---

## 3. Display & Output Gap Analysis

### 3.1 What Callers Show vs What Phase Skills Showed

**Investigation** — fully covered by continue-bugfix. Phase skill showed in-progress/concluded investigations; continue-bugfix shows the bugfix's phase_label ("investigation (in-progress)", "ready for specification"). Backwards nav allows revisiting concluded investigation. Old standalone showed concluded items which would grow indefinitely — the new flow intentionally filters to active work.

**Research** — no display gap. Research has no discovery script and no display files. The phase skill's gather-context.md (seed questions) is kept.

**Discussion** — fully covered for feature/bugfix (continue-feature shows phase_label). For epic, the scoped path with its display-options.md (research topics + existing discussions) is kept.

**Specification** — fully covered for feature/bugfix (continue-feature shows phase_label). For epic, the entire analysis flow with all display files (display-single*.md, display-groupings.md, display-analyze.md, display-specs-menu.md) is kept.

**Planning** — fully covered. continue-epic shows "Start planning for {topic} — spec concluded" with gating. continue-feature shows "ready for planning". The old display-state.md showed cross-cutting spec separation — this awareness is preserved in cross-cutting-context.md which runs in the bridge path before planning begins.

**Implementation** — fully covered. continue-epic shows "Start implementation of {topic} — plan concluded" with gating. Dependency blocking info from the old display-plans.md is still surfaced by check-dependencies.md in the bridge path (after selection rather than in the overview).

**Review** — mostly covered. continue-epic shows "Start review for {topic} — implementation completed" with gating. Two things lost:
1. **Multi-plan review scope** (single/multi/all) — not needed; review still works per-topic, multi was just a convenience wrapper
2. **Standalone analysis entry point** — not needed; analysis/synthesis runs automatically after every review via review-actions-loop.md in the processing skill

### 3.2 Concluded Items Not Shown — By Design

The old standalone investigation display showed both in-progress and concluded investigations. The continue-bugfix display intentionally filters to active work only (shows phase_label for each active bugfix). Concluded items would accumulate indefinitely and make the menu busy. This is a deliberate design choice, not a gap.

For epic, the "Resume a concluded topic" menu option in continue-epic provides access to concluded items when needed, without cluttering the main display.

### 3.3 Epic Research → Discussion Transition

For epic, when moving from research to discussion, the discussion entryway skill does NOT ask "core problem, constraints, codebase files." Instead, it:
1. Analyses research files to extract potential discussion topics
2. Displays research topics alongside existing discussions
3. Lets the user pick a research topic to seed the discussion, or start fresh

The research content IS the bootstrap — it replaces the "cold start" interview questions. This only applies to epic where research topics seed discussions. For feature/bugfix, there's a single linear pipeline and the bootstrap questions are asked for new entries.

### 3.4 Epic Specification Never Receives a Topic

For epic, specification is never invoked with a topic because it's not linear. The analysis flow (reading concluded discussions, identifying couplings, grouping into specifications) IS how the topic gets determined. continue-epic invokes `/start-specification epic {work_unit}` without topic, and the specification entryway skill runs the full analysis flow to let the user choose or create a grouping. This is fundamental to how epic specifications work and must be preserved.

### 3.5 Epic Research — No Special Handling

For epic research, there's no equivalent of the discussion "seed from research" flow. Research IS the first phase — there's nothing before it to seed from. The same 4 interview questions work for both epic and feature/bugfix. No epic-specific changes needed for research.

### 3.6 Information Not Lost

All phase-specific validation, context gathering, and processing remains in the entryway skills. The callers handle work-unit selection and phase routing. The entryway skills handle phase-specific prerequisites, bootstrap questions, and processing skill invocation. The processing skills handle the actual work.

---

## 4. Key Design Decisions

### 4.0 Naming Convention: `workflow-{phase}-entry`

Phase-specific skills follow a `namespace-phase-action` pattern: `workflow-{phase}-entry`. This establishes a convention that can later extend to processing skills (`workflow-{phase}-process`), replacing the current `technical-{phase}` naming. For this PR, only entry skills are renamed.

Non-phase utility skills (`workflow-start`, `workflow-bridge`, `workflow-manifest`, `workflow-shared`) follow `workflow-{purpose}` and don't need this pattern — they're not phase-specific.

### 4.1 Bridge Mode Goes Away as a Named Concept

The three-mode system (standalone / scoped / bridge) collapses. The new routing model for every entryway skill is:

1. **Do I have a topic?**
   - Yes (feature/bugfix always; epic when caller provides it) → check manifest
   - No → must be epic → run scoped path

2. **Does this phase exist in the manifest for this topic?**
   - Doesn't exist → new entry → ask bootstrap questions → invoke processing skill
   - In-progress → resuming → skip bootstrap → invoke with resume context
   - Concluded → reopening → reset status → invoke with reopen context

No "mode detection" step. No argument-count checking. Work type is always provided by the caller.

### 4.2 Bootstrap Questions Must Not Be Skipped

PR4 introduced start/continue skills that gather a brief description for naming purposes only. The detailed seed questions (research: seed idea, current knowledge, starting point, constraints; discussion: core problem, constraints, codebase files; investigation: expected vs actual, error messages) must remain in the entryway skills and run for NEW phase entries.

**Verified via git history:** Before PR4 (`git show 4685e6f:skills/start-research/SKILL.md`), start-research had no bridge mode — Step 2 was always "Gather Context" (gather-context.md), and the 4 seed questions were always asked. PR4 added bridge mode which routes around gather-context, creating the gap.

This PR fixes that by ensuring new phase entries (phase doesn't exist in manifest) always trigger the bootstrap questions regardless of how the user arrived.

**Phases that need bootstrap questions for new entries:**
- Research: seed idea, current knowledge, starting point, constraints (gather-context.md)
- Discussion: core problem, constraints, codebase files (gather-context-fresh.md, minus naming section)
- Investigation: expected vs actual, error messages, how it manifests (gather-context.md bridge branch)

**Phases that DON'T need bootstrap questions:**
- Specification: source documents (concluded discussions/investigation) ARE the context
- Planning: concluded spec IS the context; validate-phase.md already asks for "additional context" for fresh plans
- Implementation: concluded plan IS the context
- Review: plan + completed implementation ARE the context

### 4.3 Start Skills vs Entryway Skills — Different Purposes

- **Start skills** (`start-feature`, `start-epic`, `start-bugfix`): Work-unit creators. Ask "what are you building?", name the work unit, init the manifest, hand off. The question they ask is purely for naming and description — NOT for bootstrapping the processing skill.
- **Entryway skills** (`workflow-enter-*`): Phase-specific bootstrapping. Validate prerequisites, ask phase-appropriate seed questions, invoke processing skill. The questions they ask are designed to bootstrap the processing skill with the right initial context.

These are separate layers for separate purposes and must not be conflated. The start skill's brief description does not replace the entryway skill's detailed seed questions. Both are needed for their respective purposes.

### 4.4 Discovery Scripts — Delete 4, Scope 2, Move to Manual Invocation

| Script | Action | Reason |
|--------|--------|--------|
| investigation | Delete | Bridge-only, validate-phase uses manifest CLI already |
| planning | Delete | Bridge-only, replace 2-3 discovery refs with manifest CLI calls |
| implementation | Delete | Bridge-only, replace discovery refs with manifest CLI + filesystem |
| review | Delete | Bridge-only, replace discovery refs with filesystem scan |
| discussion | Scope to work_unit | Epic scoped path needs research/discussion/cache data |
| specification | Scope to work_unit | Epic scoped path needs discussion/spec/cache data |

For discussion and specification, move from dynamic injection (`!` syntax) to manual Bash invocation (`node script.js {work_unit}`). This allows passing the work_unit argument, eliminates cross-work-unit noise, and reduces token waste. Costs one tool call — negligible compared to the token savings and clarity improvement.

### 4.5 Cross-Cutting Context is Work-Unit-Scoped

Cross-cutting specifications only exist within an epic work unit (the only work type with multiple specs). They don't leak across work units. For planning's `cross-cutting-context.md`, a single manifest CLI call scoped to the work unit is sufficient. Feature and bugfix work types have a single specification each, so the concept of cross-cutting doesn't apply to them.

### 4.6 Dynamic Injection vs Manual Invocation for Discovery

For discussion and specification discovery scripts that are being scoped (not deleted), we move from dynamic injection (`!` syntax in SKILL.md) to manual Bash invocation. Rationale:

- Dynamic injection runs before Claude sees the skill and cannot accept arguments — so it scans ALL manifests
- Manual invocation costs one tool call but allows passing `{work_unit}` to scope the scan
- Scoped output is smaller, clearer, and contains only relevant data — reduces token waste and context pollution
- The tool call cost is negligible compared to the token savings

Decision: Move to manual invocation when we need to pass arguments. Keep dynamic injection where no arguments are needed.

### 4.7 Review Multi-Plan and Analysis

The standalone review entryway offered multi-plan review scope (single/multi/all) and an analysis-only entry point for synthesising completed review findings into tasks.

**Multi-plan:** Not needed. Even when "all" was selected, the processing skill reviewed each plan individually in a loop. Not functionally different from reviewing one at a time via continue-epic.

**Analysis-only:** Not needed as a standalone entry point. The review-actions-loop.md in the processing skill (technical-review) runs synthesis automatically after every review. It checks the verdict, dispatches the review-findings-synthesizer agent, gets approval, writes tasks to the plan, and reopens implementation. This happens as part of every review's conclusion — no separate entry point required.

---

## 5. Per-Phase Analysis

### 5.1 Research (`start-research` → `workflow-research-entry`)

**Current state:** 4 files (SKILL.md + 3 references, no discovery.js)

**Paths:**
- Bridge (topic provided): validate-phase.md → invoke-skill.md
- Scoped epic (no topic): gather-context.md (4 seed questions) → invoke-skill.md

**Changes:**
- Rename, set `user-invocable: false`
- Remove Step 0 (migrations), simplify mode detection
- **Keep gather-context.md** — needed for both epic scoped path AND feature/bugfix new entries
- Ensure bridge path runs gather-context.md for new phase entries (phase doesn't exist in manifest)
- Update validate-phase.md to handle new/resume/reopen routing
- Update invoke-skill.md back-references

**Files kept:** validate-phase.md, gather-context.md, invoke-skill.md
**Files removed:** None

### 5.2 Investigation (`start-investigation` → `workflow-investigation-entry`)

**Current state:** 7 files (SKILL.md + discovery.js + 5 references)

**Paths:**
- Bridge (topic provided): validate-phase.md → gather-context.md (bridge branch asks "What's broken?") → invoke-skill.md
- Standalone: route-scenario.md → gather-context-fresh.md (topic naming + bug context) → invoke-skill.md

**Changes:**
- Rename, set `user-invocable: false`
- Delete discovery.js, route-scenario.md (standalone routing)
- Delete gather-context-fresh.md (topic naming moved to start-bugfix in PR4)
- **Keep gather-context.md** — bridge branch asks bug context questions. Ensure it runs for new entries.
- Update invoke-skill.md to remove "fresh" handoff branch

**Files kept:** validate-phase.md, gather-context.md, invoke-skill.md
**Files removed:** scripts/discovery.js, references/route-scenario.md, references/gather-context-fresh.md

### 5.3 Discussion (`start-discussion` → `workflow-discussion-entry`)

**Current state:** 12 files (SKILL.md + discovery.js + 10 references)

**Paths:**
- Bridge (topic provided): validate-phase.md → gather-context.md (dispatches to bridge/continue/fresh/research sub-refs) → invoke-skill.md
- Scoped epic (no topic): route-scenario.md → research-analysis.md → display-options.md → handle-selection.md → gather-context.md → invoke-skill.md
- Standalone (no args): same as scoped but discovery scans all manifests

**Changes:**
- Rename, set `user-invocable: false`
- Scope discovery.js to accept work_unit argument, manual invocation
- Remove standalone mode detection from SKILL.md
- **Keep almost all reference files** — the scoped epic path uses them (research analysis, display, selection, context gathering from research)
- Ensure bridge path runs gather-context-fresh.md bootstrap questions for new phase entries (feature/bugfix entering discussion for the first time). The naming section of gather-context-fresh.md should be skipped when topic is already known.
- Update back-references throughout

**Files kept:** All 10 reference files (validate-phase.md, route-scenario.md, research-analysis.md, display-options.md, handle-selection.md, gather-context.md, gather-context-fresh.md, gather-context-continue.md, gather-context-research.md, invoke-skill.md)
**Files removed:** None (discovery.js is scoped, not removed)
**Files modified:** discovery.js (accept work_unit arg), SKILL.md (remove standalone detection), gather-context-fresh.md (skip naming when topic known), all back-references

### 5.4 Specification (`start-specification` → `workflow-specification-entry`)

**Current state:** 27 files (SKILL.md + discovery.js + 25 references including handoffs/)

**Paths:**
- Bridge (topic provided): validate-source.md → validate-phase.md → invoke-skill-bridge.md
- Scoped epic (no topic): check-prerequisites.md → route-scenario.md → [display-single*.md | display-analyze.md | display-groupings.md | display-specs-menu.md] → analysis-flow.md → confirm-*.md → handoffs/*.md
- Standalone (no args): same as scoped but discovery scans all manifests

**Changes:**
- Rename, set `user-invocable: false`
- Scope discovery.js to accept work_unit argument, manual invocation
- Remove standalone mode detection from SKILL.md
- **Keep ALL reference files** — every display file is used by the scoped epic path (different states of the analysis process: single discussion, cached groupings, no cache, existing specs)
- Update validate-source.md terminal messages (replace `/start-discussion` → `/workflow-discussion-entry` etc.)
- Update back-references throughout
- No bootstrap questions needed — source documents ARE the context

**Files kept:** All 25 reference files + handoffs/
**Files removed:** None (discovery.js is scoped, not removed)
**Files modified:** discovery.js (accept work_unit arg), SKILL.md (remove standalone detection), validate-source.md (terminal messages), all back-references

### 5.5 Planning (`start-planning` → `workflow-planning-entry`)

**Current state:** 8 files (SKILL.md + discovery.js + 6 references)

**Paths:**
- Bridge (topic provided): validate-spec.md → validate-phase.md → cross-cutting-context.md → invoke-skill.md
- Standalone: route-scenario.md → display-state.md → validate-phase.md → cross-cutting-context.md → invoke-skill.md

**Changes:**
- Rename, set `user-invocable: false`
- **Delete discovery.js** — always has topic, only 2-3 manifest CLI calls needed
- Delete route-scenario.md (standalone routing)
- Delete display-state.md (standalone display)
- Update validate-spec.md: replace `specifications.crosscutting` from discovery with manifest CLI query scoped to work unit
- Update cross-cutting-context.md: same — query manifest for cross-cutting specs via CLI. Only applicable to epic work type.
- Update invoke-skill.md: remove `common_format` from discovery, query format from manifest or let processing skill determine it
- Update terminal messages in validate-spec.md
- No bootstrap questions needed — spec IS the context. validate-phase.md already asks for "additional context" for fresh plans.

**Files kept:** validate-spec.md, validate-phase.md, cross-cutting-context.md, invoke-skill.md
**Files removed:** scripts/discovery.js, references/route-scenario.md, references/display-state.md

### 5.6 Implementation (`start-implementation` → `workflow-implementation-entry`)

**Current state:** 8 files (SKILL.md + discovery.js + 6 references)

**Paths:**
- Bridge (topic provided): validate-phase.md → check-dependencies.md → environment-check.md → invoke-skill.md
- Standalone: route-scenario.md → display-plans.md → check-dependencies.md → environment-check.md → invoke-skill.md

**Changes:**
- Rename, set `user-invocable: false`
- **Delete discovery.js** — always has topic
- Delete route-scenario.md (standalone routing)
- Delete display-plans.md (standalone display)
- Update check-dependencies.md: replace `deps_satisfied`/`deps_blocking` from discovery with manifest CLI queries for `external_dependencies` on the planning phase entry for this topic
- Update environment-check.md: replace `environment` from discovery with direct file check of `.workflows/.state/environment-setup.md`
- Update invoke-skill.md: query format/ext_id from manifest CLI
- No bootstrap questions needed — plan IS the context

**Files kept:** validate-phase.md, check-dependencies.md, environment-check.md, invoke-skill.md
**Files removed:** scripts/discovery.js, references/route-scenario.md, references/display-plans.md

### 5.7 Review (`start-review` → `workflow-review-entry`)

**Current state:** 8 files (SKILL.md + discovery.js + 6 references)

**Paths:**
- Bridge (topic provided): validate-phase.md → determine-review-version.md → invoke-skill.md
- Standalone: route-scenario.md → display-plans.md → select-plans.md → invoke-skill.md

**Changes:**
- Rename, set `user-invocable: false`
- **Delete discovery.js** — always has topic
- Delete route-scenario.md (standalone routing)
- Delete display-plans.md (standalone display)
- Delete select-plans.md (standalone multi-select scope)
- Update determine-review-version.md: replace discovery refs with filesystem scan of `.workflows/{work_unit}/review/{topic}/r*/`
- Update invoke-skill.md: simplify to single-plan handoff (no multi-plan), query format from manifest CLI
- No bootstrap questions needed — plan + implementation are the context
- Multi-plan review and standalone analysis entry point are lost but not needed: analysis/synthesis runs automatically as part of every review's conclusion via review-actions-loop.md in the processing skill

**Files kept:** validate-phase.md, determine-review-version.md, invoke-skill.md
**Files removed:** scripts/discovery.js, references/route-scenario.md, references/display-plans.md, references/select-plans.md

---

## 6. Caller Updates Required

All callers reference phase skills by their old names. Every `/start-{phase}` reference must become `/workflow-enter-{phase}`.

### 6.1 Continue Skills

| File | Changes |
|------|---------|
| `skills/continue-feature/SKILL.md` | Routing table (Step 6): 6 entries |
| `skills/continue-bugfix/SKILL.md` | Routing table (Step 6): 5 entries |
| `skills/continue-epic/SKILL.md` | Routing table (Step 6): 11 entries |
| `skills/continue-epic/references/resume-concluded.md` | Phase-to-skill mapping: 6 entries |

### 6.2 Start Skills

| File | Changes |
|------|---------|
| `skills/start-feature/SKILL.md` | Step 4 routing table: 2 entries |
| `skills/start-epic/SKILL.md` | Step 4 routing table: 2 entries |
| `skills/start-bugfix/SKILL.md` | Step 3 invocation: 1 entry |

### 6.3 Workflow Bridge

| File | Changes |
|------|---------|
| `skills/workflow-bridge/references/feature-continuation.md` | Phase routing table + plan mode template |
| `skills/workflow-bridge/references/bugfix-continuation.md` | Phase routing table + plan mode template |
| `skills/workflow-bridge/references/epic-continuation.md` | All routing tables + plan mode templates |

### 6.4 Other Skills

| File | Changes |
|------|---------|
| `skills/status/SKILL.md` | Replace `/start-*` suggestions with user-facing commands |
| `skills/technical-discussion/references/conclude-discussion.md` | "run /start-discussion" → generic guidance |
| `skills/technical-specification/references/spec-completion.md` | "Run /start-planning" → generic guidance |
| `skills/technical-review/references/review-actions-loop.md` | `/start-implementation` references |
| Other processing skills with terminal messages | Replace phase skill references with generic guidance or user-facing commands |

### 6.5 Documentation

| File | Changes |
|------|---------|
| `CLAUDE.md` | Structure table, two-mode pattern section (rewrite/remove), terminal message examples, all `start-{phase}` references |
| `README.md` | Directory structure, phase-to-skill table, user-facing recommendations |

### 6.6 Tests

| File | Action |
|------|--------|
| `tests/scripts/test-discovery-for-discussion.js` | Update path reference (discovery.js moves with rename) |
| `tests/scripts/test-discovery-for-specification.js` | Update path reference |
| `tests/scripts/test-discovery-for-planning.js` | Delete (discovery.js deleted) |
| `tests/scripts/test-discovery-for-implementation.js` | Delete (discovery.js deleted) |
| `tests/scripts/test-discovery-for-review.js` | Delete (discovery.js deleted) |
| `tests/scripts/test-discovery-for-investigation.js` | Delete (discovery.js deleted) |

---

## 7. Summary: File Changes Per Skill

### Totals

| Skill | Before | After | Removed | Modified |
|-------|--------|-------|---------|----------|
| research | 4 | 4 | 0 | 3 (SKILL.md + 2 refs) |
| investigation | 7 | 4 | 3 | 3 (SKILL.md + 2 refs) |
| discussion | 12 | 12 | 0 | 12 (all files modified) |
| specification | 27 | 27 | 0 | 27 (all files modified) |
| planning | 8 | 5 | 3 | 4 (SKILL.md + 3 refs) |
| implementation | 8 | 5 | 3 | 4 (SKILL.md + 3 refs) |
| review | 8 | 4 | 4 | 3 (SKILL.md + 2 refs) |
| **Total** | **74** | **61** | **13** | — |

Plus ~20 caller/doc/test files to update.

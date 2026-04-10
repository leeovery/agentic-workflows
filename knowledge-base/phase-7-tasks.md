# Phase 7: Setup Wizard

**Goal**: An interactive first-time setup experience that handles system config, project init, and initial indexing in one flow.

**Acceptance Criteria**:
- [ ] `knowledge setup` wizard creates system config at `~/.config/workflows/config.json`
- [ ] Wizard creates project knowledge base at `.workflows/.knowledge/`
- [ ] Provider validation: test embed call to verify API key works
- [ ] Initial indexing of all existing completed artifacts
- [ ] Stub mode path when user skips API key
- [ ] Skips already-completed steps (idempotent)

## Tasks

2 tasks.

1. Setup wizard: system config + project init + stub mode — the interactive prompt-driven flow. System config creation (provider, model, API key env var, test embed validation). Project init (directory, config.json, empty store). Stub mode when user skips API key. Skip logic for already-completed steps. Human-only — interactive prompts via readline, Claude cannot run it.
   └─ Edge cases: system config exists but project doesn't (skip to project init), both exist (skip to indexing), API key env var set but invalid (validation catches it), no TTY (abort gracefully)

2. Setup wizard: initial indexing + idempotency + CLI integration — wire up `knowledge index` (no args) from Task 4-4 as the final setup step. Ensure re-running setup skips completed steps and only processes what's missing. Register setup in the CLI dispatch from Task 3-1.
   └─ Edge cases: setup interrupted mid-indexing (pending queue handles catch-up), re-run after partial setup, existing store with different provider (warn about rebuild)

# Phase 6: Retrieval Integration

**Goal**: Make the knowledge base user-facing through the three-layer integration pattern so Claude queries it autonomously during workflow phases.

**Acceptance Criteria**:
- [ ] Knowledge SKILL.md exists (Layer 1 — API documentation, commands, output format)
- [ ] Per-phase usage reference files exist (Layer 2 — trigger heuristics contextualised per phase)
- [ ] Inline callouts added at pertinent points in processing skills (Layer 3 — nudges)
- [ ] Contextual query at phase start for research, discussion, and investigation
- [ ] Planning entry cross-cutting query replaces existing manual approach
- [ ] Two-step retrieval pattern documented (chunks with provenance -> source file deep dive)

## Tasks

3 tasks.

1. Knowledge SKILL.md + two-step retrieval documentation — Layer 1. Create the API documentation skill file at skills/workflow-knowledge/SKILL.md. All commands, flags, output format, how indexing and querying work. Document the two-step retrieval pattern (chunks with provenance → source file deep dive). This is the foundation that Layer 2 references load.
   └─ Edge cases: must describe both hybrid and keyword-only modes, must not duplicate CLI help text verbatim (higher-level guidance)

2. Per-phase usage references + contextual query at phase start — Layer 2. Create reference files with trigger heuristics contextualised per phase. Load early in processing skills (alongside case conventions). Include the contextual query at phase start for research, discussion, investigation (natural language query from available context, not the topic slug). Specification explicitly excluded from automatic retrieval. Add `allowed-tools` to the 3 remaining processing skills (planning, implementation, review).
   └─ Edge cases: specification exclusion must be explicit, contextual query must use descriptive text not topic slugs, shared vs per-phase references (design doc allows either)

3. Inline callouts + planning entry cross-cutting query — Layer 3. Add nudges at pertinent points in processing skills where querying is most valuable. Replace the existing cross-cutting context approach in `workflow-planning-entry/references/cross-cutting-context.md` with a targeted semantic query filtered to `work_type: cross-cutting`.
   └─ Edge cases: callouts must be nudges not full reference loads, planning cross-cutting query replaces existing functionality (not additive)

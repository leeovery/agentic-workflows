# Phase 5: Skill Integration

**Goal**: Wire the knowledge base into all workflow skills so that it checks readiness, compacts on entry, indexes on phase completion, and removes on cancellation/supersession.

**Acceptance Criteria**:
- [ ] Step 0 of all entry-point skills runs `knowledge check` (after migrations)
- [ ] Hard stop reference file displayed when knowledge base is not set up
- [ ] Step 0 runs `knowledge compact` after check passes
- [ ] Phase-completion steps in processing skills for indexed phases run `knowledge index <file>`
- [ ] Manage menu cancellation runs `knowledge remove --work-unit`
- [ ] Specification supersession/promotion runs `knowledge remove` for affected topic
- [ ] `allowed-tools` frontmatter updated across all affected skills (~30 files)

## Tasks

3 tasks.

1. Hard stop reference + Step 0 integration — create the hard stop reference file displayed when knowledge base is not set up. Update Step 0 in all entry-point skills (~10-11 skills) to run `knowledge check` after migrations, display hard stop if not-ready, run `knowledge compact` if ready. Add `allowed-tools` to all entry-point skills.
   └─ Edge cases: existing Step 0 migration ordering must be preserved (migrations → check → compact), skills with varying Step 0 structures

2. Phase completion indexing — add `knowledge index <file>` at phase completion in processing skills for indexed phases: research, discussion, investigation, specification. Also scoping (produces a spec — the spec is the indexed artifact). Add `allowed-tools` to these processing skills.
   └─ Edge cases: scoping completes a spec (index under specification phase), indexing failure must not block the phase itself, skills that set `completed_at` going forward

3. Lifecycle removal (cancellation + supersession/promotion) — add `knowledge remove` on cancellation (manage menu skill) and on supersession/promotion (specification process skill). Set `completed_at` on the manage menu's done action (needed for compaction TTL). Add `allowed-tools` to the manage skill only. Spec process already has it from Task 5-2. The 3 non-indexed processing skills (planning, implementation, review) get `allowed-tools` in Phase 6 when querying is added — no Phase 5 reason. Phase entry skills do not call knowledge.cjs and do not need it.
   └─ Edge cases: cancellation of a work unit that was never indexed (0 removed, no error), removal failure does not block cancellation, supersession removes only the affected topic's spec chunks, done action must set completed_at for compaction

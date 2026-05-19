# Editing Historical Phase Artefacts

## The Idea

When a workflow plan includes a task that edits a historical phase artefact (a specification, discussion, investigation, or research file from a *prior* completed work unit), the workflow currently has no convention for:

1. **How** to make the edit (revise in place? append-only? mark as superseded?).
2. **Where** in the artefact to record that it was corrected after-the-fact, and by whom.
3. **What companion step is required** to keep the knowledge base in sync with the edit, given that historical artefacts are indexed and queried with high confidence.

This needs a decision and a documented convention, probably surfaced during planning so plans that touch historical artefacts automatically include the right tasks.

## The Situation That Triggered This

While running the `drop-invalid-A-flag-from-attach-session-argv` quick-fix in the `portal` codebase, we discovered that the upstream specification for a *previously completed* feature (`enter-attaches-from-preview`) contained the same incorrect claim that had caused the bug — namely, that the outside-tmux attach argv should be `tmux attach-session -A -t '=<session>'` (the `-A` flag is invalid on `attach-session`; it belongs to `new-session`).

The scoping/planning phase of the quick-fix had correctly identified this and authored a task to:

- Add a dated corrigendum block at the top of the upstream spec naming the correcting work unit.
- Edit §88 and §166 in place so they describe the correct argv and behaviour.

What the plan did **not** include — and what we only spotted because the user paused to ask about it during implementation — was the knowledge-base implication. The upstream spec was already indexed (9 chunks under `enter-attaches-from-preview/specification`). Editing the markdown in place doesn't update those embeddings; the KB would continue to serve the old (wrong) chunks at "specification, high confidence" until explicitly reindexed.

The discussion during implementation surfaced four options:

1. **Edit body in place + corrigendum + reindex** (the option we took).
2. Preserve the body, add an inline correction marker pointing to a top-of-file corrigendum. **Rejected** because the chunk's embedding still vectorises the wrong claim — the marker only helps a human eyeballing the retrieved chunk, not the retrieval ranking itself, and the marker may not even fall in the same chunk as the wrong line.
3. Preserve the body, `knowledge remove` the artefact entirely so it never surfaces in queries. Cost: lose all the (otherwise correct) context that artefact provided.
4. Do nothing to the upstream spec; rely on humans noticing the contradiction with the new spec.

The "reindex" half of option 1 was discovered ad hoc — we had to verify by inspection that `knowledge index` does **not** re-embed already-indexed files (it tracks "already indexed" and skips them), so the only safe pattern is `knowledge remove --work-unit X --phase Y` followed by `knowledge index`. That gave a clean swap (9 chunks deleted, 10 chunks added — the extra is the corrigendum block). No duplicates.

If the user hadn't paused, the plan would have committed correct file edits but left the KB serving the wrong content with high confidence.

## What's Worth Figuring Out

These are framing questions for the future conversation, not answers.

1. **Where does the responsibility live?** Candidates:
   - `workflow-planning-process` — detect that a planned task edits a historical artefact and automatically scaffold the companion tasks (corrigendum, in-place edit, KB reindex).
   - `workflow-implementation-process` — detect that an implementation task is touching an indexed path under `.workflows/{other-work-unit}/...` and either prompt for the reindex or run it post-task.
   - A shared reference loaded by both — a single "editing historical phase artefacts" protocol that planning consults when authoring tasks and that implementation re-asserts when executing them.
   - Out of band — a post-commit hook or post-implementation review check that flags edits to indexed paths.

2. **What's the canonical edit pattern?** The convention we settled on for this run was:
   - **Live file is current truth; git is the historical record.** Original wording is recoverable via `git log -p` on the file.
   - **In-place edits to the affected sections.** Wrong claims are removed; corrected claims replace them.
   - **Top-of-file corrigendum block.** Dated (ISO date), names the correcting work unit, quotes the original incorrect claim, states the correction. This is the only "new" content; it's clearly framed as annotation rather than revision.
   - **Companion KB reindex.** `knowledge remove --work-unit X --phase Y` then `knowledge index` — never just `index` alone, because already-indexed files are skipped.

   Is that the right default, or should we also support an append-only pattern for cases where historical fidelity is more important than KB correctness? (For the latter, option 3 — `knowledge remove` and leave the file untouched — might be the right shape.)

3. **What scope of artefacts does this cover?** Specifications are the obvious case (high-confidence, planning-relevant). Discussions and investigations are also indexed. Research is indexed but lower-confidence. Planning and implementation are not indexed at all. The convention probably needs to behave the same across all indexed phases but acknowledge that the *reasons* for editing them differ (specs are corrected for accuracy; discussions might not be corrected at all because they're a record of conversation).

4. **What's the discovery story?** How does planning know it's authoring a task that edits a historical artefact in the first place? Path-based detection (any task whose file edits land outside the current work unit's `.workflows/{work_unit}/` tree)? Explicit task tagging? Some other signal?

## Why It Matters

The failure mode this prevents is subtle but high-confidence-misleading: a future agent runs a research/discussion query, the KB returns chunks marked `specification | high | <date>` containing claims that were later corrected, the agent treats them as authoritative, and the same bug or design mistake gets re-derived from a "validated" source. The corrigendum-at-top convention only works if the KB is actually serving the corrigendum — which only happens if the reindex is part of the plan.

The KB confidence tiering specifically marks specifications as `high`. That trust is load-bearing across the whole knowledge-retrieval design. A spec containing surviving wrong content is worse than no spec, because it crowds out skepticism.

## Pointers to the Source Discussion

This idea emerged during a real implementation session. The conversation log is at:

- Portal repo: `/Users/leeovery/Code/portal`
- Work unit: `drop-invalid-A-flag-from-attach-session-argv` (a quick-fix completed 2026-05-19)
- The conversation happens around the approval of plan task `1-2` ("Correct enter-attaches-from-preview Spec §88 and §166"). The user's initial reservation was *"I'm not sure how I feel about editing historical records."* The exchange that followed worked through the options listed above.
- The post-implementation verification step in the same session confirmed: chunk counts matched (`enter-attaches-from-preview` went from 20 → 21 chunks, total store 384 → 385); queries for the false claim now return only the corrigendum chunk; the spec grep over the codebase returns zero `attach-session -A` matches.

The mechanical details of the `knowledge` CLI behaviour discovered along the way:

- `knowledge index` (no args) processes "pending" files only — files not yet tracked as indexed. It does **not** re-embed an already-indexed file even if its content has changed on disk.
- `knowledge remove --work-unit X --phase Y` is the supported way to delete chunks for a single artefact (or phase-of-an-artefact). Accepts `--dry-run`.
- `knowledge rebuild` would also work but blows away everything and re-embeds, which is overkill for a single-file correction.
- The store (`.workflows/.knowledge/store.msp` + `metadata.json`) is git-tracked, so the remove + index cycle produces a reviewable diff.

## Relevant Files

- `skills/workflow-planning-process/` — likely host for the planning-time detection.
- `skills/workflow-implementation-process/` — likely host for the implementation-time enforcement.
- `skills/workflow-shared/references/` — likely host for the shared "editing historical artefacts" protocol if we extract one.
- `skills/workflow-knowledge/SKILL.md` and `references/knowledge-usage.md` — the existing knowledge-base contract. Currently documents `query`, `index`, `remove`; does not (yet) document the "edit-then-reindex" pattern.
- `skills/workflow-scoping-process/` — scoping for quick-fixes is where this particular case originated; might need to surface the same pattern earlier.

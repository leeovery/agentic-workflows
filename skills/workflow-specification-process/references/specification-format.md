# Specification Format

*Reference for **[workflow-specification-process](../SKILL.md)***

---

This file defines the canonical structure for specification files (`.workflows/{work_unit}/specification/{topic}/specification.md`).

The specification is a single file per topic. Structure is **flexible** — organize around phases and subject matter, not rigid sections. This is a working document.

Structure is flexible; facts are not. Every value, rule, threshold, and enumeration has exactly one section that states it — its **home**. Every other mention references the home and never restates it. Reference only to avoid restating — never to justify, compare, or note consistency: if deleting the sentence containing a reference loses no information, delete the sentence. A reference cites the home by its section number (`§3.2`) — never restates or describes it. Never state a derived fact (a count or summary of a list sitting beside it) — it drifts when the list changes.

An empirical claim about the codebase or toolchain — a count, an enumeration, an "all X are Y" — is recorded at its home with the command that measured it, the command alone in its span so it re-runs by copy (`` … (`rg -l 'pattern' | wc -l` → 14) ``). A claim with no command is a claim review cannot re-check; a load-bearing claim that cannot be measured is written as observation, not fact. A specification carries no open-decision markers — "Decision required", "TBD", and kin park a decision the record never made; the point routes per **[resolve-source-incoherence.md](resolve-source-incoherence.md)** instead of landing in the document.

> **CHECKPOINT**: You should NOT be creating or writing to this file unless you have explicit user approval for specific content. If you're about to create this file with content you haven't presented and had approved, **STOP**. That violates the workflow.

---

## Metadata

Specification metadata is stored in the work-unit manifest, not in file frontmatter. Access via `engine manifest`:

```bash
# Read fields
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} status
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} review_cycle
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} finding_gate_mode
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} sources.{source-name}.status

# Write fields
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} sources.{source-name}.status incorporated
```

Lifecycle `status` transitions go through the engine, not `set` — `engine topic start` on creation, `engine topic complete` (which also indexes the artifact) at conclusion.

| Field | Set when |
|-------|----------|
| `status` | Spec creation → `in-progress`; completion → `completed` |
| `date` | Spec creation — today's date; update on each commit |
| `review_cycle` | Starts at 0; incremented each review cycle. Missing field treated as 0. |
| `review_baseline_words` | Set when review opens (cycle 0 → 1) — the document's word count at the end of construction. The convergence diagnostic measures review growth against it. |
| `finding_gate_mode` | Spec creation → `gated`; user opts in → `auto` |
| `construction_gate_mode` | Spec creation → `gated`; user opts in → `auto` |
| `sources` | Spec creation — all sources as `pending`; updated as extraction completes. The engine sets a row to `stale` when its source discussion reopens after extraction; reconciliation sets it back to `incorporated` |
| `consult_references` | Session setup — declared refs registered as `pending`; set `addressed` once the sibling discussion's hand-off slice is read narrowly and reconciled. Optional — absent when the spec owes no corrections |

---

## Body

```markdown
# Specification: [Topic Name]

## Specification

[Validated content accumulates here, organized by topic/phase]

---

## Working Notes

[Optional - capture in-progress discussion if needed]
```

Bracketed lines are placeholders, not content — create the file with the headings and leave the sections empty; never copy placeholder text into the file. Topic content nests beneath `## Specification` as numbered `###` sections (`### 3. Sweep Scope`), subdivided where a section has distinct parts as decimal `####` subsections (`#### 3.2 The in-scope set`) — never as sibling `##` headings.

Sections are stable — the number is the address, not the position. Wrong content in `3.2` is edited in place; new knowledge belonging to section 3 appends as its next subsection (`3.4`); a new top-level section appends at the end (`### 7.`) — order doesn't matter. Only when placement genuinely matters does a section slot in mid-sequence, and then the renumbering is careful: every displaced number and every `§` reference to it updates in the same approved edit. The document's furniture — `## Working Notes`, an epic's `## Dependencies`, a `## Corrigenda` — sits outside the numbering.

A specification corrected after its own phase concluded may additionally carry a `## Corrigenda` section as its final section — the durable record of post-conclusion amendments, written only through `workflow-shared/references/correcting-historical-artifacts.md`, never during specification work. A specification session that finds one leaves it exactly where it stands — it is the audit trail of corrections made from downstream, and it survives every later edit as the file's last section.

---

## Sources and Incorporation Status

**All specifications must track their sources**, even when built from a single source. This enables proper tracking when additional material is later added.

Track each source with its incorporation status via `engine manifest`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} sources.auth-flow.status
# → incorporated

node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} sources.api-design.status
# → pending
```

**Status values:**
- `pending` — Source has been selected but content extraction is not complete
- `incorporated` — Source content has been fully extracted and woven into the specification
- `stale` — Source was extracted, but its discussion was re-decided since — the extraction predates the revision. Set by the engine when the source discussion reopens; never set by hand

**When to update source status:**

1. **When creating the specification**: All sources start as `pending` — `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} sources.{source-name}.status pending`
2. **After completing exhaustive extraction from a source**: Mark that source as `incorporated` — `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.specification.{topic} sources.{source-name}.status incorporated`
3. **When adding a new source to an existing spec**: Add it with `status: pending` via the same command
4. **After reconciling a `stale` source** (see **[reconcile-stale-sources.md](reconcile-stale-sources.md)**): mark it `incorporated` — the same command as extraction

**How to determine if a source is incorporated:**

A source is `incorporated` when you have:
- Performed exhaustive extraction (reviewed ALL content in the source for relevant material)
- Presented and logged all relevant content from that source
- No more content from that source needs to be extracted

**IMPORTANT**: The specification should only be marked `completed` (via `node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} specification {topic}`) when:
- All sources are marked as `incorporated` — neither `pending` nor `stale`
- All three review phases are complete
- User has signed off

If a new source is added to a completed specification (via grouping analysis), or a source discussion is re-decided beneath it, the specification effectively needs updating — even if the manifest still shows `status: completed`, the presence of `pending` or `stale` sources indicates work remains.

---

## Cross-Cutting Concerns

Cross-cutting concerns (caching strategies, rate-limiting policies, work conventions) are a separate work type with their own pipeline: Research (optional) → Discussion → Specification (terminal). They are created via `/workflow-start` or promoted from epic specifications at completion time.

During planning for any work type, the planning entry skill surfaces completed cross-cutting specifications as context, ensuring features and bugfixes incorporate validated architectural decisions.

→ Return to caller.

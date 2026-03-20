# Specification Format

*Reference for **[workflow-specification-process](../SKILL.md)***

---

This file defines the canonical structure for specification files (`.workflows/{work_unit}/specification/{topic}/specification.md`).

The specification is a single file per topic. Structure is **flexible** — organize around phases and subject matter, not rigid sections. This is a working document.

> **CHECKPOINT**: You should NOT be creating or writing to this file unless you have explicit user approval for specific content. If you're about to create this file with content you haven't presented and had approved, **STOP**. That violates the workflow.

---

## Metadata (Manifest CLI)

Specification metadata is stored in the work-unit manifest, not in file frontmatter. Access via the manifest CLI:

```bash
# Read fields
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.specification.{topic} status
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.specification.{topic} review_cycle
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.specification.{topic} finding_gate_mode
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.specification.{topic} sources.{source-name}.status

# Write fields
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.specification.{topic} status completed
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.specification.{topic} sources.{source-name}.status incorporated
```

| Field | Set when |
|-------|----------|
| `status` | Spec creation → `in-progress`; completion → `completed` |
| `date` | Spec creation — today's date; update on each commit |
| `review_cycle` | Starts at 0; incremented each review cycle. Missing field treated as 0. |
| `finding_gate_mode` | Spec creation → `gated`; user opts in → `auto` |
| `sources` | Spec creation — all sources as `pending`; updated as extraction completes |

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

---

## Sources and Incorporation Status

**All specifications must track their sources**, even when built from a single source. This enables proper tracking when additional material is later added.

Track each source with its incorporation status via the manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.specification.{topic} sources.auth-flow.status
# → incorporated

node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.specification.{topic} sources.api-design.status
# → pending
```

**Status values:**
- `pending` — Source has been selected but content extraction is not complete
- `incorporated` — Source content has been fully extracted and woven into the specification

**When to update source status:**

1. **When creating the specification**: All sources start as `pending` — `node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.specification.{topic} sources.{source-name}.status pending`
2. **After completing exhaustive extraction from a source**: Mark that source as `incorporated` — `node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.specification.{topic} sources.{source-name}.status incorporated`
3. **When adding a new source to an existing spec**: Add it with `status: pending` via the same command

**How to determine if a source is incorporated:**

A source is `incorporated` when you have:
- Performed exhaustive extraction (reviewed ALL content in the source for relevant material)
- Presented and logged all relevant content from that source
- No more content from that source needs to be extracted

**Important**: The specification's overall status should only be set to `completed` (via `node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.specification.{topic} status completed`) when:
- All sources are marked as `incorporated`
- Both review phases are complete
- User has signed off

If a new source is added to a completed specification (via grouping analysis), the specification effectively needs updating — even if the manifest still shows `status: completed`, the presence of `pending` sources indicates work remains.

---

## Cross-Cutting Concerns

Cross-cutting concerns (caching strategies, rate-limiting policies, work conventions) are a separate work type with their own pipeline: Research (optional) → Discussion → Specification (terminal). They are created via `/start-cross-cutting` or promoted from epic specifications at completion time.

During planning for any work type, the planning entry skill surfaces completed cross-cutting specifications as context, ensuring features and bugfixes incorporate validated architectural decisions.

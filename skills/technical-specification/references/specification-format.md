# Specification Format

*Reference for **[technical-specification](../SKILL.md)***

---

This file defines the canonical structure for specification files (`.workflows/{work_unit}/specification/{topic}/specification.md`).

The specification is a single file per topic. Structure is **flexible** — organize around phases and subject matter, not rigid sections. This is a working document.

> **CHECKPOINT**: You should NOT be creating or writing to this file unless you have explicit user approval for specific content. If you're about to create this file with content you haven't presented and had approved, **STOP**. That violates the workflow.

---

## Metadata (Manifest CLI)

Specification metadata is stored in the work-unit manifest, not in file frontmatter. Access via the manifest CLI:

```bash
# Read fields
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase specification --topic {topic} status
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase specification --topic {topic} type
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase specification --topic {topic} review_cycle
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase specification --topic {topic} finding_gate_mode
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase specification --topic {topic} sources.{source-name}.status

# Write fields
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase specification --topic {topic} status completed
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase specification --topic {topic} sources.{source-name}.status incorporated
```

| Field | Set when |
|-------|----------|
| `status` | Spec creation → `in-progress`; completion → `completed` |
| `type` | Spec creation → `feature` (default); completion → `feature` or `cross-cutting` |
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
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase specification --topic {topic} sources.auth-flow.status
# → incorporated

node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase specification --topic {topic} sources.api-design.status
# → pending
```

**Status values:**
- `pending` — Source has been selected but content extraction is not complete
- `incorporated` — Source content has been fully extracted and woven into the specification

**When to update source status:**

1. **When creating the specification**: All sources start as `pending` — `node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase specification --topic {topic} sources.{source-name}.status pending`
2. **After completing exhaustive extraction from a source**: Mark that source as `incorporated` — `node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase specification --topic {topic} sources.{source-name}.status incorporated`
3. **When adding a new source to an existing spec**: Add it with `status: pending` via the same command

**How to determine if a source is incorporated:**

A source is `incorporated` when you have:
- Performed exhaustive extraction (reviewed ALL content in the source for relevant material)
- Presented and logged all relevant content from that source
- No more content from that source needs to be extracted

**Important**: The specification's overall status should only be set to `completed` (via `node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase specification --topic {topic} status completed`) when:
- All sources are marked as `incorporated`
- Both review phases are complete
- User has signed off

If a new source is added to a completed specification (via grouping analysis), the specification effectively needs updating — even if the manifest still shows `status: completed`, the presence of `pending` sources indicates work remains.

---

## Specification Types

The `type` field distinguishes between specifications that result in standalone implementation work versus those that inform how other work is done.

### Feature Specifications (`type: feature`)

Feature specifications describe something to **build** — a concrete piece of functionality with its own implementation plan.

**Examples:**
- User authentication system
- Order processing pipeline
- Notification service
- Dashboard analytics

**Characteristics:**
- Results in a dedicated implementation plan
- Has concrete deliverables (code, APIs, UI)
- Can be planned with phases, tasks, and acceptance criteria
- Progress is measurable ("the feature is done")

**This is the default type.** If not specified, assume `feature`.

### Cross-Cutting Specifications (`type: cross-cutting`)

Cross-cutting specifications describe **patterns, policies, or architectural decisions** that inform how features are built. They don't result in standalone implementation — instead, they're referenced by feature specifications and plans.

**Examples:**
- Caching strategy
- Rate limiting policy
- Error handling conventions
- Logging and observability standards
- API versioning approach
- Security patterns

**Characteristics:**
- Does NOT result in a dedicated implementation plan
- Defines "how to do things" rather than "what to build"
- Referenced by multiple feature specifications
- Implementation happens within features that apply these patterns
- No standalone "done" state — the patterns are applied across features

### Why This Matters

Cross-cutting specifications go through the same validation phases. The decisions are just as important to validate and document. The difference is what happens after:

- **Feature specs** → Planning → Implementation → Review
- **Cross-cutting specs** → Referenced by feature plans → Applied during feature implementation

When planning a feature, the planning process surfaces relevant cross-cutting specifications as context. This ensures that a "user authentication" plan incorporates the validated caching strategy and error handling conventions.

### Determining the Type

Ask: **"Is there a standalone thing to build, or does this inform how we build other things?"**

| Question | Feature | Cross-Cutting |
|----------|---------|---------------|
| Can you demo it when done? | Yes — "here's the login page" | No — it's invisible infrastructure |
| Does it have its own UI/API/data? | Yes | No — lives within other features |
| Can you plan phases and tasks for it? | Yes | Tasks would be "apply X to feature Y" |
| Is it used by one feature or many? | Usually one | By definition, multiple |

**Edge cases:**
- A "caching service" that provides shared caching infrastructure → **Feature** (you're building something)
- "How we use caching across the app" → **Cross-cutting** (policy/pattern)
- Authentication system → **Feature**
- Authentication patterns and security requirements → **Cross-cutting**

# Phase 1 — Manifest CLI Foundations

**Status:** Not started · **Depends on:** none

## Purpose

Foundation for everything that follows. Adds `inception` as a recognised phase and supports a top-level `imports` array on work-unit manifests. No user-visible behaviour change — every later phase needs this first.

## Reference

- [Design](design.md) — Discovery Map — Data Model section; Imports — Manifest tracking section.
- `skills/workflow-manifest/SKILL.md` — existing CLI conventions (dot-paths, validation, push/pull).
- `skills/workflow-manifest/scripts/manifest.cjs` — implementation.
- `tests/scripts/test-manifest-*.cjs` — existing test patterns to model on.

## What ships

- `inception` added to the phase-name validation table in the manifest CLI.
- Top-level `imports` array supported on work-unit manifests:
  - Read via `get {wu} imports` (returns the array).
  - Write via `set {wu} imports '[{...}]'` (full replace).
  - Append via `push {wu} imports '{path: "...", imported_at: "..."}'`.
  - Remove via `pull {wu} imports {match}`.
- Item-level validation rules: each entry has at least `path` (string) and `imported_at` (ISO timestamp).
- Inception-phase item validation matches existing per-phase item conventions (status field accepts `in-progress` only — there is no `cancelled` for inception items per the hard-delete decision).

## Files

**Modified:**
- `skills/workflow-manifest/scripts/manifest.cjs` — add `inception` to `PHASE_NAMES`. Support `imports` field at work-unit level for `get`/`set`/`push`/`pull`. Add validation for inception item structure.
- `skills/workflow-manifest/SKILL.md` — document `inception` phase, document `imports` field with example commands.

**New:**
- `tests/scripts/test-manifest-inception.cjs` — covers:
  - Happy path: `init-phase {wu}.inception.{topic}` succeeds.
  - Item validation: `set {wu}.inception.{topic} status in-progress` accepts; `cancelled` is rejected (no soft-delete).
  - Imports field: push entries; read; pull. Verify shape preservation.
  - Existing manifest behaviour unaffected.

## Out of scope

- Inception-related skills (Phases 2-4).
- Display of inception items in `continue-epic` (Phase 5).
- Anything user-visible.

## Verification

1. Run `tests/scripts/test-manifest-inception.cjs`. All assertions pass.
2. Existing manifest tests (`tests/scripts/test-manifest-*.cjs`) still pass — no regression.
3. Manual smoke: in a temp work unit, run `manifest init-phase test.inception.foo`; confirm `phases.inception.items.foo` written.
4. Manual smoke: `manifest push test imports '{"path":"imports/seed.md","imported_at":"2026-05-09T10:00:00Z"}'`; confirm written; `manifest get test imports` returns the array.

## Notes for the implementer

- The dot-path scheme already supports 1-segment work-unit access (`get {wu} field`). The `imports` field is simply a top-level array on the work-unit manifest — no new path semantics.
- Inception items are minimal — `name`, `summary`, `routing` (`research` | `discussion`), `source` (string with provenance), `created`, `updated`. No `status: cancelled` (hard-delete model).
- Keep the test harness consistent with existing test files — same assertion helpers, setup/teardown, etc.

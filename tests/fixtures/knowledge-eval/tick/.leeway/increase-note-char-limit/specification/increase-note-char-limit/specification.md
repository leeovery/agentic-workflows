# Specification: Increase Note Char Limit

## Change Description

The note text character limit (`maxNoteTextLen` in `internal/task/notes.go`)
is raised from 500 to 2000 characters. The 500-char cap originates in the
`cli-enhancements` work unit and has proven too low in real use. This is a
single-constant threshold change — validation logic and behaviour are
otherwise unchanged.

## Scope

- `internal/task/notes.go:12` — `const maxNoteTextLen = 500` → `2000` (the
  primary change; `ValidateNoteText` reads this constant).
- `internal/task/notes.go:51` — doc comment on `ValidateNoteText` ("at most
  500 characters") updated to 2000 to avoid drift.
- Test baselines that assert the old boundary:
  - `internal/task/notes_test.go:32` — "it accepts note text exactly 500
    chars" (accept-boundary → 2000).
  - `internal/task/notes_test.go:40` — "it rejects note text of 501 chars"
    (reject-boundary → 2001; this test fails as-is once the limit rises,
    since 501 chars is now valid).
  - `internal/cli/note_test.go:115` — "it errors when text exceeds 500 chars"
    uses `strings.Repeat("a", 501)` (→ 2001; fails as-is once the limit
    rises).

## Exclusions

- **Task title limit** (`maxTitleLen`, `internal/task/task.go:33`) stays at
  500. `internal/cli/update_test.go:443` and `internal/task/task_test.go`
  title-boundary tests are unaffected.
- **Task description** — intentionally unbounded (only empty/whitespace
  rejected via `ValidateDescriptionUpdate`). No change.
- No storage-schema change: notes persist in JSONL and a `task_notes` TEXT
  column, neither of which enforces a length cap.

## Verification

- `go test ./...` passes after the change (note-boundary tests updated to
  the new 2000/2001 boundary).
- No remaining assertion that a >500-and-≤2000-char note is rejected.
- A note of exactly 2000 chars is accepted; 2001 is rejected, with the error
  message reporting the maximum as 2000.
- `go vet ./...` clean; `gofmt` clean.

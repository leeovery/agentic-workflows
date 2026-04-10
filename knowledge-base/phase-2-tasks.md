# Phase 2: Chunking Engine

**Goal**: A pure-function markdown chunker driven by per-phase JSON configs that splits workflow artifacts at natural semantic boundaries, testable with real artifact fixtures and zero external dependencies.

**Acceptance Criteria**:
- [ ] Generic engine reads a chunking config and splits markdown into chunks accordingly
- [ ] All 4 phase configs exist (research, discussion, investigation, specification) with validated settings from the design doc
- [ ] Primary split on H2, fallback to H3 for oversized sections
- [ ] Special sections handled: `own-chunk`, `skip`, `merge-up`
- [ ] YAML frontmatter stripped before chunking
- [ ] Empty sections skipped
- [ ] Files below `keep_whole_below` threshold stay whole
- [ ] Code blocks containing markdown headings do not trigger false splits
- [ ] Test fixtures cover all 4 indexed phases with edge cases
- [ ] All chunker unit tests pass

## Tasks

2 tasks.

1. Generic markdown chunking engine + phase configs — the splitting algorithm (strip frontmatter, parse by heading, apply primary split, handle special sections, fallback for oversized, skip empty, keep-whole-below) plus all 4 phase JSON configs. Unit tests with synthetic markdown.
   └─ Edge cases: no H2 headings (fallback), code blocks containing headings, empty sections, YAML frontmatter, oversized sections

2. Chunker validation with real fixtures — representative fixtures for all 4 indexed phases, edge case coverage, validation that production configs produce correct chunks from real-world artifact structures
   └─ Edge cases: discussion with no subtopics, research with single massive section, spec with nested H3/H4 structure, investigation with minimal content

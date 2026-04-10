# Phase 8: Release Process

**Goal**: Formalize the esbuild build step into the release pipeline so the bundled knowledge.cjs is always up-to-date when tags are created.

**Acceptance Criteria**:
- [ ] Build step produces `knowledge.cjs` from source before tagging
- [ ] Release script or CI workflow includes the build
- [ ] Bundled output is committed and present in tagged releases
- [ ] `node_modules/` remains gitignored (dev dependency only)

## Tasks

2 tasks.

1. Release script build integration — modify the local release script to run `npm run build` before tagging. Ensure the bundled knowledge.cjs is committed as part of the release flow. Decide: build locally in the release script (simpler) or in GitHub Actions (automated).
   └─ Edge cases: build failure must abort the release (don't tag with stale bundle), source changes without rebuild (detect and warn)

2. CI test pipeline update — add knowledge tests (both Node .cjs and shell .sh) to the GitHub Actions release workflow alongside existing migration and discovery tests. Ensure the test suite runs against the committed bundle.
   └─ Edge cases: tests must run after npm install (dev deps needed for node:test), knowledge integration test skipped without OPENAI_API_KEY

# Plan: Complete Research Status Support

## Context

The architecture discussion (WORK-TYPE-ARCHITECTURE-DISCUSSION.md lines 496-502) decided that research gets `in-progress` / `concluded` status like every other phase. The manifest CLI supports it, and the technical-research processing skill sets both statuses correctly. But several downstream consumers still use the old marker-based approach or outdated "never concludes" language. Migration 016 also hardcodes research to `in-progress` regardless of actual state.

## Changes

### 1. Migration 016: detect concluded research

**File:** `skills/migrate/scripts/migrations/016-work-unit-restructure.sh` (lines 526-530)

Replace the hardcoded `in-progress` with Discussion-ready marker detection. Research files have no frontmatter — the `> **Discussion-ready**:` blockquote marker (written by convergence-awareness.md) is the only signal for concluded status.

This code is inside the `node -e` heredoc that builds manifest.json (line 408: "Build manifest.json via node"):

```javascript
var resDir = path.join(workDir, 'research');
if (fs.existsSync(resDir)) {
    var resFiles = fs.readdirSync(resDir).filter(function(f) { return f.endsWith('.md'); });
    if (resFiles.length > 0) {
        var hasConcluded = resFiles.some(function(f) {
            var content = fs.readFileSync(path.join(resDir, f), 'utf8');
            return /^> \*\*Discussion-ready\*\*:/m.test(content);
        });
        manifest.phases.research = { status: hasConcluded ? 'concluded' : 'in-progress' };
    }
}
```

### 2. Migration tests

**File:** `tests/scripts/test-migration-016.sh`

Add two tests after the existing test suite:
- Research file WITH `> **Discussion-ready**:` marker → manifest `phases.research.status` = `"concluded"`
- Research file WITHOUT marker → manifest `phases.research.status` = `"in-progress"`

Use `node -e` to extract specifically `m.phases.research.status` to avoid false positives from other phases.

### 3. gather-context bridge mode: manifest-first status check

**File:** `skills/start-discussion/references/gather-context.md` (line 13)

Change from marker scanning to manifest status authority:
- Check `get {work_unit} --phase research status`
- If `concluded` → read research files for the `> **Discussion-ready**:` summary content (the marker is still useful as content for the handoff, just not as the status signal)
- If `in-progress` or absent → fall through to the "Otherwise" branch (ask user for context)

### 4. Discovery script: add research status to YAML output

**File:** `skills/start-discussion/scripts/discovery.sh` (lines 44-52)

Add `work_unit` and `status` fields per research file entry by reading from manifest via CLI:

```yaml
research:
  exists: true
  files:
    - name: "exploration"
      topic: "exploration"
      work_unit: "my-feature"
      status: "concluded"
```

### 5. Documentation: fix "never concludes" language

**a.** `workflow-explorer.html` line 1922 — flowchart node desc: "Research never 'concludes'" → "Research concludes when parked as discussion-ready"

**b.** `workflow-explorer.html` line 2616 — research command desc: "Research never formally 'concludes'" → "Research concludes when the user parks a topic as discussion-ready"

**c.** `workflow-explorer.html` line 2665 — skill-research desc: "Research is open-ended — there is no formal 'conclusion' status" → "Research concludes when the user parks a topic as discussion-ready"

**d.** `WORK-TYPE-ARCHITECTURE-DISCUSSION.md` line 74 — outdated note: update to reference the later decision at lines 496-502

## Commit Strategy

1. Migration + tests (steps 1-2)
2. Behavioural changes (steps 3-4)
3. Documentation (step 5)

## Verification

1. `bash tests/scripts/test-migration-016.sh` — all pass including new research status tests
2. `bash tests/scripts/test-discovery-for-discussion.sh` — all pass with new research status fields
3. Full suite: `for t in tests/scripts/test-*.sh; do bash "$t"; done` — zero failures
4. Grep audit: `grep -rn "never.*conclud\|open-ended.*no.*conclusion\|no.*concluded.*status" skills/ workflow-explorer.html CLAUDE.md README.md` — zero matches

## Status: COMPLETED

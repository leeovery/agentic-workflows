'use strict';

//
// Tests for migration 047: discussion-map-to-manifest (.cjs)
//
// Ported from test-migration-047.sh with the same coverage: happy path,
// nested-child linkage, no-op paths, idempotency, content preservation, and
// the defensive parse-doubt guard.
//

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/047-discussion-map-to-manifest.cjs');

function setup() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'migration-047-'));
}
function teardown(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}
function runMigration(dir) {
  let updates = 0;
  let skips = 0;
  MIGRATION.run({
    projectDir: dir,
    reportUpdate: () => { updates += 1; },
    reportSkip: () => { skips += 1; },
  });
  return { updates, skips };
}

// A manifest with one discussion item of the given status.
function writeManifest(dir, wu, status) {
  const wuDir = path.join(dir, '.workflows', wu, 'discussion');
  fs.mkdirSync(wuDir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.workflows', wu, 'manifest.json'),
    JSON.stringify(
      {
        name: wu,
        work_type: 'epic',
        status: 'in-progress',
        description: 'Test epic',
        phases: { discussion: { items: { 'auth-flow': { status } } } },
      },
      null,
      2
    ) + '\n'
  );
}

function readManifest(dir, wu) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', wu, 'manifest.json'), 'utf8'));
}

// A discussion file with a Discussion Map section (mixed states, nested children).
const DISCUSSION_WITH_MAP = `# Discussion: Auth Flow

## Context

Why we are discussing.

## Discussion Map

A living index of subtopics.

### States

- **pending** (\`○\`) — identified but not yet explored

### Map

  Discussion Map — Auth Flow (4 subtopics — 1 decided · 1 converging · 1 exploring · 1 pending)

  ┌─ ✓ Subsystem Prefix Taxonomy [decided]
  ├─ → Token Refresh [converging]
  │  ├─ ◐ Refresh Rotation [exploring]
  │  └─ ○ Grace Window [pending]
  └─ ○ Session Storage [pending]

---

## Subsystem Prefix Taxonomy

### Decision
We decided.

## Summary

### Open Threads
- (none)

## Triage

(none)
`;

function writeDiscussionWithMap(dir, wu) {
  fs.writeFileSync(path.join(dir, '.workflows', wu, 'discussion', 'auth-flow.md'), DISCUSSION_WITH_MAP);
}

describe('migration 047: discussion map to manifest', () => {
  it('happy path — map rows land as manifest subtopics', () => {
    const dir = setup();
    writeManifest(dir, 'epic-a', 'in-progress');
    writeDiscussionWithMap(dir, 'epic-a');

    runMigration(dir);

    assert.deepStrictEqual(readManifest(dir, 'epic-a').phases.discussion.items['auth-flow'].subtopics, {
      'subsystem-prefix-taxonomy': { status: 'decided', parent: null },
      'token-refresh': { status: 'converging', parent: null },
      'refresh-rotation': { status: 'exploring', parent: 'token-refresh' },
      'grace-window': { status: 'pending', parent: 'token-refresh' },
      'session-storage': { status: 'pending', parent: null },
    });
    teardown(dir);
  });

  it('nested children — parent linkage from gutter indentation', () => {
    const dir = setup();
    writeManifest(dir, 'epic-a', 'in-progress');
    writeDiscussionWithMap(dir, 'epic-a');

    runMigration(dir);
    const subtopics = readManifest(dir, 'epic-a').phases.discussion.items['auth-flow'].subtopics;

    assert.strictEqual(subtopics['refresh-rotation'].parent, 'token-refresh');
    assert.strictEqual(subtopics['grace-window'].parent, 'token-refresh', 'child with no gutter bar still nests');
    assert.strictEqual(subtopics['session-storage'].parent, null, 'top-level row has null parent');
    teardown(dir);
  });

  it('no-op — discussion file without a map section', () => {
    const dir = setup();
    writeManifest(dir, 'epic-a', 'in-progress');
    fs.writeFileSync(
      path.join(dir, '.workflows', 'epic-a', 'discussion', 'auth-flow.md'),
      '# Discussion: Auth Flow\n\n## Context\n\nNo map here.\n\n## Summary\n'
    );

    const { skips } = runMigration(dir);

    assert.strictEqual(readManifest(dir, 'epic-a').phases.discussion.items['auth-flow'].subtopics, undefined);
    assert.strictEqual(skips, 1);
    teardown(dir);
  });

  it('no-op — completed discussion item is skipped entirely', () => {
    const dir = setup();
    writeManifest(dir, 'epic-a', 'completed');
    writeDiscussionWithMap(dir, 'epic-a');

    runMigration(dir);

    assert.strictEqual(readManifest(dir, 'epic-a').phases.discussion.items['auth-flow'].subtopics, undefined);
    teardown(dir);
  });

  it('idempotency — a second run never clobbers an advanced state', () => {
    const dir = setup();
    writeManifest(dir, 'epic-a', 'in-progress');
    writeDiscussionWithMap(dir, 'epic-a');

    runMigration(dir);
    const first = readManifest(dir, 'epic-a').phases.discussion.items['auth-flow'].subtopics;
    assert.ok(first && Object.keys(first).length > 0, 'first run parsed rows');

    // Hand-advance a state between runs — a second run must not clobber it.
    const m = readManifest(dir, 'epic-a');
    m.phases.discussion.items['auth-flow'].subtopics['session-storage'].status = 'decided';
    fs.writeFileSync(path.join(dir, '.workflows', 'epic-a', 'manifest.json'), JSON.stringify(m, null, 2) + '\n');

    runMigration(dir);

    assert.strictEqual(
      readManifest(dir, 'epic-a').phases.discussion.items['auth-flow'].subtopics['session-storage'].status,
      'decided',
      'second run preserved the advanced state'
    );
    teardown(dir);
  });

  it('content preservation — unrelated manifest fields and the file untouched', () => {
    const dir = setup();
    writeManifest(dir, 'epic-a', 'in-progress');
    const m = readManifest(dir, 'epic-a');
    m.seeds = [{ path: 'seeds/x.md', source: 'inbox:idea' }];
    m.phases.research = { items: { 'auth-flow': { status: 'completed' } } };
    fs.writeFileSync(path.join(dir, '.workflows', 'epic-a', 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
    writeDiscussionWithMap(dir, 'epic-a');
    const fileBefore = fs.readFileSync(path.join(dir, '.workflows', 'epic-a', 'discussion', 'auth-flow.md'), 'utf8');

    runMigration(dir);
    const after = readManifest(dir, 'epic-a');

    assert.strictEqual(after.work_type, 'epic');
    assert.deepStrictEqual(after.seeds, [{ path: 'seeds/x.md', source: 'inbox:idea' }]);
    assert.deepStrictEqual(after.phases.research, { items: { 'auth-flow': { status: 'completed' } } });
    assert.strictEqual(after.phases.discussion.items['auth-flow'].status, 'in-progress');
    assert.strictEqual(
      fs.readFileSync(path.join(dir, '.workflows', 'epic-a', 'discussion', 'auth-flow.md'), 'utf8'),
      fileBefore,
      'discussion file untouched'
    );
    teardown(dir);
  });

  it('unparseable rows are skipped, clean rows still land', () => {
    const dir = setup();
    writeManifest(dir, 'epic-a', 'in-progress');
    fs.writeFileSync(
      path.join(dir, '.workflows', 'epic-a', 'discussion', 'auth-flow.md'),
      [
        '# Discussion: Auth Flow',
        '',
        '## Discussion Map',
        '',
        '  Discussion Map — Auth Flow (3 subtopics)',
        '',
        '  ┌─ ✓ Good Row [decided]',
        '  ├─ broken row without a state tag',
        '  ├─ ◐ Strange State [finished]',
        '  └─ ○ Another Good Row [pending]',
        '',
        '## Summary',
        '',
      ].join('\n')
    );

    runMigration(dir);

    assert.deepStrictEqual(readManifest(dir, 'epic-a').phases.discussion.items['auth-flow'].subtopics, {
      'good-row': { status: 'decided', parent: null },
      'another-good-row': { status: 'pending', parent: null },
    });
    teardown(dir);
  });

  it('all rows unparseable — item left untouched (parse doubt)', () => {
    const dir = setup();
    writeManifest(dir, 'epic-a', 'in-progress');
    fs.writeFileSync(
      path.join(dir, '.workflows', 'epic-a', 'discussion', 'auth-flow.md'),
      '# Discussion: Auth Flow\n\n## Discussion Map\n\n  ┌─ no tag here\n  └─ also no tag\n\n## Summary\n'
    );
    const before = fs.readFileSync(path.join(dir, '.workflows', 'epic-a', 'manifest.json'), 'utf8');

    runMigration(dir);

    assert.strictEqual(
      fs.readFileSync(path.join(dir, '.workflows', 'epic-a', 'manifest.json'), 'utf8'),
      before,
      'manifest untouched on parse doubt'
    );
    teardown(dir);
  });
});

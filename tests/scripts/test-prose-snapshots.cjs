'use strict';

// Snapshot goldens (design/prose-tests.md P2/P3): every committed
// snapshot rebuilds byte-identical from its recipe under the frozen
// clock. A red run means the engine moved the world — regenerate with
// `node tests/prose/run.cjs snap <case-id>` and land the snapshot diff in
// the same commit as the change that moved it. Never hand-edit a
// snapshot to green this.
//
// Rebuilds fan out over a thread pool and are skipped for worlds whose
// recipes, shared mainlines, and engine sources are all unchanged since the
// world last rebuilt clean here — so a second run costs nothing, and any
// engine change invalidates every cached hash and rebuilds the lot.

require('./hermetic-env.cjs');

const { after, describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const cases = require('../prose/lib/cases.cjs');
const worlds = require('../prose/lib/worlds.cjs');
const { POOL_SIZE, createVerifyPool } = require('../prose/lib/verify-pool.cjs');

/**
 * The repository-relative paths among `rels` that this repository's own
 * ignore files — the ones between its root and the cases — match. Asked of a
 * throwaway repository holding copies of those files alone, so the answer is
 * the same in any checkout, under any developer's excludes, and with no
 * enclosing repository at all.
 */
function ignoredByRepository(rels) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'prose-ignore-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: scratch });
    const segments = path.relative(cases.ROOT, cases.CASES_DIR).split(path.sep);
    for (let depth = 0; depth <= segments.length; depth++) {
      const rel = path.join(...segments.slice(0, depth), '.gitignore');
      if (!fs.existsSync(path.join(cases.ROOT, rel))) continue;
      fs.mkdirSync(path.dirname(path.join(scratch, rel)), { recursive: true });
      fs.copyFileSync(path.join(cases.ROOT, rel), path.join(scratch, rel));
    }
    const res = spawnSync('git', ['-c', 'core.excludesFile=/dev/null', 'check-ignore', '--no-index', '--stdin'],
      { cwd: scratch, input: rels.join('\n'), encoding: 'utf8' });
    if (res.status !== 0 && res.status !== 1) throw new Error(`git check-ignore failed: ${res.stderr}`);
    return res.stdout.split('\n').filter(Boolean);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

// One test in flight per thread: each awaits its own world, so a test's
// duration is its world's rebuild and the pool never idles.
describe('prose-test snapshots', { concurrency: POOL_SIZE }, () => {
  const all = cases.loadAllCases();
  const pool = createVerifyPool();
  after(() => pool.close());

  it('has at least one built world', () => {
    assert.ok(all.some((c) => c.hasFixtureState), 'no case builds a world');
  });

  // A snapshot holds world state at whatever path the engine wrote it, so an
  // ignore rule matching inside one keeps the file out of the commit: the
  // checkout that snapped it still has it on disk and verifies clean, and
  // every other checkout rebuilds a world its snapshot lacks.
  it('no snapshot file is hidden from git by the repository\'s ignore rules', () => {
    const rels = [];
    for (const c of all) {
      for (const which of Object.keys(cases.SNAPSHOTS)) {
        const snap = worlds.readSnapshot(c.id, which);
        if (!snap) continue;
        const dir = path.relative(cases.ROOT, worlds.snapshotDir(c.id, which));
        for (const rel of snap.keys()) rels.push(path.join(dir, rel));
      }
    }
    const ignored = ignoredByRepository(rels);
    assert.deepStrictEqual(ignored, [],
      `ignored snapshot files — find the rule with \`git check-ignore -v <path>\` and anchor it:\n${ignored.map((f) => `  ${f}`).join('\n')}`);
  });

  for (const c of all) {
    const states = [
      c.hasFixtureState ? 'fixture' : null,
      c.hasAssertionState ? 'assertion' : null,
    ].filter(Boolean);

    for (const which of states) {
      it(`${c.id}/${which}: rebuilds byte-identical`, async () => {
        assert.ok(worlds.hasSnapshot(c.id, which),
          `${c.id}/${which} has no committed snapshot — run: node tests/prose/run.cjs snap ${c.id}`);
        const d = await pool.submit({ caseId: c.id, which });
        if (d.skipped) return;
        const report = [
          ...d.changed.map((f) => `changed: ${f}`),
          ...d.extra.map((f) => `extra (rebuilt, not in snapshot): ${f}`),
          ...d.missing.map((f) => `missing (in snapshot, not rebuilt): ${f}`),
        ];
        assert.deepStrictEqual(report, [],
          `world moved — regenerate: node tests/prose/run.cjs snap ${c.id}\n${report.map((l) => `  ${l}`).join('\n')}`);
      });
    }
  }
});

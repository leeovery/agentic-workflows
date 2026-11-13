'use strict';

//
// Tests for migration 075: split-detect (.cjs)
//
// The legacy split's detection (21.4.1, 21.4.3) driven in process against a
// git project on today's layout: in each epic in progress, an item of its
// map that 038 seeded — its source naming the seeding, among others or
// alone — routed to research, its research item in progress and its file
// there, named as a topic can be, qualifies; an item short of any one of
// these, a source a split left part-way, and every unit not an epic in
// progress, qualify for nothing. It writes the sources to the split's
// staging in the state, whole, and nothing else (21.S8's detection), and
// nothing at all where none qualifies (21.S7's); a project with no
// `.workflows/`, one whose `leeway-state` has a commit, and a folder in no
// repository have nothing to detect; a project nested in its repository is
// read in its own folder and staged in the repository's state; a manifest
// that does not read stops the run, naming it. Run again it writes the
// same, and a run killed writing, part of the file written or none, is run
// again to the whole of it.
//
// Layer: migration. World: codeintel on today's layout (migration-world.cjs,
// `splitProject`), made once per process and copied for each test.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { git, initRepo, createFile, cleanupFixture } = require('./engine-harness.cjs');
const { withFrozenClock } = require('./frozen-clock.cjs');
const { SPLIT_EPIC, SPLIT_SOURCES, SPLIT_OLD, splitProject, projectTree } = require('./migration-world.cjs');

const MIGRATION = require('../../skills/leeway-migrate/scripts/migrations/075-split-detect.cjs');

const SOURCES = '.leeway/.cache/migrate/split/sources.json';
// The frozen instant, as the detection names it.
const AT = '2026-01-01T00-00-00';

/** @type {string} */
let world;
/** @type {string} */
let main;
beforeEach(() => {
  world = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-075-')));
  main = path.join(splitProject(world), SPLIT_EPIC);
});
afterEach(() => cleanupFixture(world));

/** The detection run in process over `dir`, the clock frozen: what it reported. @param {string} dir */
function detect(dir) {
  const reported = { updates: 0, skips: 0 };
  withFrozenClock(() => MIGRATION.run({ projectDir: dir, reportUpdate: () => { reported.updates += 1; }, reportSkip: () => { reported.skips += 1; } }));
  return reported;
}

/** @param {string} rel @param {(manifest: Record<string, any>) => void} change */
function editManifest(rel, change) {
  const file = path.join(main, rel);
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  change(manifest);
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
}

describe('075 detects the legacy split\'s sources', () => {
  it('21.S8: finds exactly the six sources of an epic shaped as codeintel\'s was before its split, writing them whole to the split\'s staging and nothing else — not an item seeded by discovery, one routed to discussion, one whose research is done, one with no research item, one with no file, one no topic can be named, one a split left part-way, nor an epic not in progress or a feature', () => {
    const before = projectTree(main);

    assert.deepStrictEqual(detect(main), { updates: 1, skips: 0 });

    assert.deepStrictEqual(projectTree(main), { ...before, [SOURCES]: `${JSON.stringify({ at: AT, epics: { [SPLIT_EPIC]: SPLIT_SOURCES } }, null, 2)}\n` });
  });

  it('21.S7: where no epic holds a source in the working tree — what the chain changed there uncommitted — writes nothing, the directive left nothing to stage', () => {
    editManifest(`.workflows/${SPLIT_EPIC}/manifest.json`, (manifest) => {
      for (const source of SPLIT_SOURCES) manifest.phases.research.items[source].status = 'completed';
    });
    const before = projectTree(main);

    assert.deepStrictEqual(detect(main), { updates: 0, skips: 1 });

    assert.deepStrictEqual(projectTree(main), before);
  });

  it('has nothing to detect in a project with no .workflows/, one whose leeway-state has a commit, or a folder in no repository', () => {
    const born = main;
    git(born, ['branch', 'leeway-state']);
    const fresh = initRepo(path.join(world, 'fresh'));
    createFile(fresh, 'README.md', '# Fresh\n');
    const loose = path.join(world, 'loose');
    for (const [rel, text] of Object.entries(SPLIT_OLD)) createFile(loose, rel, text);
    const before = [born, fresh, loose].map(projectTree);

    assert.deepStrictEqual([born, fresh, loose].map(detect), [{ updates: 0, skips: 1 }, { updates: 0, skips: 1 }, { updates: 0, skips: 1 }]);

    assert.deepStrictEqual([born, fresh, loose].map(projectTree), before);
  });

  it('reads a project nested in its repository in its own folder, and stages its sources in the state at the repository\'s top', () => {
    const top = initRepo(path.join(world, 'monorepo'));
    for (const [rel, text] of Object.entries(SPLIT_OLD)) createFile(top, path.join('app', rel), text);

    assert.deepStrictEqual(detect(path.join(top, 'app')), { updates: 1, skips: 0 });

    assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(top, SOURCES), 'utf8')).epics, { [SPLIT_EPIC]: SPLIT_SOURCES });
    assert.ok(!fs.existsSync(path.join(top, 'app', '.leeway')), 'no state in the project\'s own folder');
  });

  it('stops the run at a manifest that does not read, naming it, and writes nothing', () => {
    fs.writeFileSync(path.join(main, '.workflows/atlas/manifest.json'), '{"name": "atlas",');
    const before = projectTree(main);

    assert.throws(() => detect(main), new RegExp(`^Error: the legacy split cannot read ${main}/\\.workflows/atlas/manifest\\.json — fix it, then run again: `));

    assert.deepStrictEqual(projectTree(main), before);
  });

  it('run again, writes the same; killed writing, part of the file written or none, run again writes it whole', () => {
    detect(main);
    const whole = projectTree(main);
    detect(main);
    assert.deepStrictEqual(projectTree(main), whole);

    const { writeFileSync: realWrite, renameSync: realRename } = fs;
    const kills = {
      torn: { writeFileSync: (/** @type {any} */ file, /** @type {any} */ content) => { realWrite(file, String(content).slice(0, 40)); throw new Error('killed mid-write'); } },
      unrenamed: { renameSync: () => { throw new Error('killed before the rename'); } },
    };
    for (const [kill, patch] of Object.entries(kills)) {
      fs.rmSync(path.join(main, '.leeway'), { recursive: true });
      Object.assign(fs, patch);
      try {
        assert.throws(() => detect(main), /^Error: killed/, kill);
      } finally {
        Object.assign(fs, { writeFileSync: realWrite, renameSync: realRename });
      }
      assert.ok(!fs.existsSync(path.join(main, SOURCES)), `${kill}: no sources part written`);
      detect(main);
      assert.deepStrictEqual(projectTree(main), whole, kill);
    }
  });
});

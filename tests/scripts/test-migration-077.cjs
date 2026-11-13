'use strict';

//
// Tests for migration 077: split-apply (.cjs)
//
// The legacy split applied (21.4.4) driven in process against a git project
// on today's layout whose sources the detection staged and whose plans the
// interview staged beside them: each plan applied to its epic in
// `.workflows/` as the split's apply left one — the source superseded, byte
// for byte, its research item renamed with it and its map item gone; each
// theme a research file headed with its title, its summary and its source,
// a research item in progress and a map item routed to research of its own,
// its name off the map's dismissed list; a theme taking its source's name
// in the source's place; a source kept whole left as it is — each plan
// marked applied, nothing committed (21.S8's apply). Run again it passes
// every source by; a run killed at any one of its writes, the file part
// written or none, is run again to what a whole run leaves; and where the
// detection found nothing, or there is no `.workflows/`, or `leeway-state`
// has a commit, there is nothing to apply.
//
// Layer: migration. World: codeintel on today's layout (migration-world.cjs,
// `splitProject`), made once per process and copied for each test, the
// detection's sources and the plans staged in each copy.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { git, createFile, cleanupFixture } = require('./engine-harness.cjs');
const { SPLIT_EPIC, SPLIT_SOURCES, SPLIT_OLD, SPLIT_PLANS, themeOf, stagedPlan, splitProject, projectTree } = require('./migration-world.cjs');

const MIGRATION = require('../../skills/leeway-migrate/scripts/migrations/077-split-apply.cjs');

const AT = '2026-01-01T00-00-00';
const EPIC = `.workflows/${SPLIT_EPIC}`;
const STAGING = `.leeway/.cache/migrate/split/${SPLIT_EPIC}`;
const OLD = JSON.parse(SPLIT_OLD[`${EPIC}/manifest.json`]);

// Each source the plans split, with the themes it splits into.
const SPLITS = Object.freeze({
  'competitive-landscape': ['competitive-landscape'],
  'cost-economics': ['cost-economics'],
  exploration: ['product-vision', 'tech-stack'],
  'knowledge-model': ['knowledge-model'],
  'multi-repo-architecture': ['multi-repo-architecture'],
});

/** @type {string} */
let world;
/** @type {string} */
let main;
beforeEach(() => {
  world = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-077-')));
  main = staged(path.join(splitProject(world), SPLIT_EPIC));
});
afterEach(() => cleanupFixture(world));

/**
 * The detection's sources and the plans staged in the state of `dir`, as
 * 075 and the interview leave them.
 * @param {string} dir @param {Record<string, string>} [plans] by path from the state
 */
function staged(dir, plans = SPLIT_PLANS) {
  createFile(dir, '.leeway/.cache/migrate/split/sources.json', `${JSON.stringify({ at: AT, epics: { [SPLIT_EPIC]: SPLIT_SOURCES } }, null, 2)}\n`);
  for (const [rel, text] of Object.entries(plans)) createFile(dir, path.join('.leeway', rel), text);
  return dir;
}

/** The apply run in process over `dir`: what it reported. @param {string} [dir] */
function apply(dir = main) {
  const reported = { updates: 0, skips: 0 };
  MIGRATION.run({ projectDir: dir, reportUpdate: () => { reported.updates += 1; }, reportSkip: () => { reported.skips += 1; } });
  return reported;
}

/** @param {Record<string, any>} items @param {string[]} names */
const kept = (items, names) => Object.fromEntries(names.map((name) => [name, items[name]]));

/** The research file a theme becomes. @param {string} name @param {string} source @param {string} research */
const researchOf = (name, source, research) => `# Research: ${name.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ')}\n\n${name} in a line.\n\n`
  + `## Starting Point\n\n- Material extracted from legacy research file ${source}.md via legacy-research-split.\n\n---\n\n${research}`;

describe('077 applies the legacy split', () => {
  it('21.S8: applies each plan to its epic in .workflows/ as the split\'s apply left one — the source superseded byte for byte, its research item renamed with it and its map item gone; each theme a research file headed as the split heads one, a research item in progress and a map item of its own, its name off the dismissed list, a theme of its source\'s name in its place — a source kept whole left as it is, each plan marked applied, and nothing committed', () => {
    const before = projectTree(main);
    const head = git(main, ['rev-parse', 'HEAD']);

    assert.deepStrictEqual(apply(), { updates: 5, skips: 1 });

    const after = projectTree(main);
    const superseded = Object.keys(SPLITS).map((source) => [`${EPIC}/research/${source}-superseded-${AT}.md`, before[`${EPIC}/research/${source}.md`]]);
    const themes = Object.entries(SPLITS).flatMap(([source, names]) => names.map((name) => [`${EPIC}/research/${name}.md`, researchOf(name, source, before[`${STAGING}/${source}/${name}.md`])]));
    const marks = Object.keys(SPLITS).map((source) => [`${STAGING}/${source}/applied.json`, `${JSON.stringify({ superseded: `${source}-superseded-${AT}` }, null, 2)}\n`]);
    const map = OLD.phases.discovery.items;
    const research = OLD.phases.research.items;
    const unsplit = ['session-capture', 'pricing', 'glossary', 'prior-art', 'roadmap', 'telemetry', 'api.v2', 'onboarding'];
    const manifest = {
      ...OLD,
      phases: {
        ...OLD.phases,
        discovery: {
          items: {
            ...kept(map, unsplit),
            ...Object.fromEntries(Object.entries(SPLITS).flatMap(([source, names]) => names.map((name) => {
              const { summary, description } = themeOf(name);
              return [name, { routing: 'research', summary, description, source: `legacy-split:${source}` }];
            }))),
          },
          dismissed: [],
        },
        research: {
          items: {
            ...kept(research, unsplit.filter((name) => Object.hasOwn(research, name))),
            ...Object.fromEntries(Object.entries(SPLITS).flatMap(([source, names]) => [
              [`${source}-superseded-${AT}`, { status: 'superseded' }],
              ...names.map((name) => [name, { status: 'in-progress' }]),
            ])),
          },
        },
      },
    };
    const { [`${EPIC}/research/exploration.md`]: gone, ...left } = before;
    assert.ok(gone !== undefined);
    assert.deepStrictEqual(after, {
      ...left,
      ...Object.fromEntries([...superseded, ...themes, ...marks]),
      [`${EPIC}/manifest.json`]: `${JSON.stringify(manifest, null, 2)}\n`,
    });
    assert.strictEqual(git(main, ['rev-parse', 'HEAD']), head, 'nothing committed');
    assert.strictEqual(git(main, ['diff', '--cached', '--name-only']), '', 'nothing staged');
  });

  it('keeps a source\'s file\'s bytes and mode in its superseded copy', () => {
    const source = path.join(main, EPIC, 'research/exploration.md');
    const bytes = Buffer.from([0x23, 0x20, 0xc3, 0xa9, 0x0d, 0x0a, 0xff]);
    fs.writeFileSync(source, bytes);
    fs.chmodSync(source, 0o640);

    apply();

    const copy = path.join(main, EPIC, `research/exploration-superseded-${AT}.md`);
    assert.deepStrictEqual([fs.readFileSync(copy).equals(bytes), fs.statSync(copy).mode & 0o777], [true, 0o640]);
  });

  it('run again, passes every source by, writing nothing', () => {
    apply();
    const whole = projectTree(main);

    assert.deepStrictEqual(apply(), { updates: 0, skips: 6 });

    assert.deepStrictEqual(projectTree(main), whole);
  });

  it('killed at any one of its writes, the file part written or none, is run again to what a whole run leaves — a source whose theme takes a new name, and one a theme of its name takes the place of, between two new ones', () => {
    const plans = {
      ...stagedPlan('cost-economics', { 'token-budget': '## Tokens\n\nTokens notes.\n' }),
      ...stagedPlan('exploration', { 'product-vision': '## Product Vision\n\nKept.\n', exploration: '## Open Questions\n\nKept.\n', 'tech-stack': '## Tech Stack\n\nKept.\n' }),
    };
    const fresh = (/** @type {string} */ name) => {
      const dir = staged(path.join(splitProject(path.join(world, name)), SPLIT_EPIC), plans);
      fs.writeFileSync(path.join(dir, '.leeway/.cache/migrate/split/sources.json'), JSON.stringify({ at: AT, epics: { [SPLIT_EPIC]: ['cost-economics', 'exploration'] } }));
      return dir;
    };
    const realFs = { writeFileSync: fs.writeFileSync, renameSync: fs.renameSync, rmSync: fs.rmSync };
    /**
     * The apply run over `dir`, each of its writes counted, and the one at
     * `killAt` killed: a file written, part of it, or a rename or a removal
     * never made. @param {string} dir @param {number} killAt @returns {number} the writes it made
     */
    const killing = (dir, killAt) => {
      let made = 0;
      const killed = () => { made += 1; return made === killAt; };
      Object.assign(fs, {
        writeFileSync: (/** @type {any} */ file, /** @type {any} */ content, /** @type {any[]} */ ...rest) => {
          if (!killed()) return realFs.writeFileSync(file, content, ...rest);
          const bytes = Buffer.from(content);
          realFs.writeFileSync(file, bytes.subarray(0, Math.floor(bytes.length / 2)));
          throw new Error('killed mid-write');
        },
        renameSync: (/** @type {any} */ from, /** @type {any} */ to) => {
          if (killed()) throw new Error('killed before the rename');
          return realFs.renameSync(from, to);
        },
        rmSync: (/** @type {any} */ file, /** @type {any} */ options) => {
          if (killed()) throw new Error('killed before the removal');
          return realFs.rmSync(file, options);
        },
      });
      try {
        apply(dir);
      } finally {
        Object.assign(fs, realFs);
      }
      return made;
    };
    const reference = fresh('whole');
    const writes = killing(reference, 0);
    const whole = projectTree(reference);

    for (let at = 1; at <= writes; at += 1) {
      const dir = fresh(`killed-${at}`);
      assert.throws(() => killing(dir, at), /^Error: killed/, `killed at write ${at}`);
      apply(dir);
      assert.deepStrictEqual(projectTree(dir), whole, `killed at write ${at} of ${writes}`);
    }
  });

  it('has nothing to apply where the detection found nothing, in a project with no .workflows/, or one whose leeway-state has a commit', () => {
    const none = path.join(splitProject(path.join(world, 'none')), SPLIT_EPIC);
    const old = staged(path.join(splitProject(path.join(world, 'old')), SPLIT_EPIC));
    fs.rmSync(path.join(old, '.workflows'), { recursive: true });
    const born = staged(path.join(splitProject(path.join(world, 'born')), SPLIT_EPIC));
    git(born, ['branch', 'leeway-state']);
    const before = [none, old, born].map(projectTree);

    assert.deepStrictEqual([none, old, born].map(apply), [{ updates: 0, skips: 1 }, { updates: 0, skips: 1 }, { updates: 0, skips: 1 }]);

    assert.deepStrictEqual([none, old, born].map(projectTree), before);
  });
});

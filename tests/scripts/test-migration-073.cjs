'use strict';

//
// Tests for migration 073: environment-linters (.cjs)
//
// The project default's linters and each implementation topic's carried onto
// the project manifest as environment.linters, each {name, command} — the
// default first, then a topic's not already there, by name, units and topics
// in name order, a name carried already with another command named in the
// verification addendum; a name alone, as a string or {name}, its own
// command; a {name, detail} as discovery recorded it, the detail its command;
// empty arrays carried as an empty list — and the old fields removed, the defaults
// object with them once empty; a project whose environment records its
// linters keeping them, the old fields still removed; an entry of no
// linter's shape left out and named in the verification addendum; the state
// found from a folder below the main checkout and from a linked worktree;
// one update per file changed; the skip with no old field, outside a
// repository and with no state; idempotency; every other field kept; and a
// unit manifest that cannot be read left alone.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { git, testIdentity } = require('./discovery-test-utils.cjs');

const MIGRATION = require('../../skills/leeway-migrate/scripts/migrations/073-environment-linters.cjs');

/** @type {string} */
let dir;
/** @type {number} */
let updates;
/** @type {number} */
let skips;

/** @param {string} [from] */
function run(from = dir) {
  return MIGRATION.run({ projectDir: from, reportUpdate: () => { updates++; }, reportSkip: () => { skips++; } });
}

/** @param {object} value */
const json = (value) => JSON.stringify(value, null, 2) + '\n';
/** @param {...string} segments */
const statePath = (...segments) => path.join(dir, '.leeway', ...segments);
/** @param {string} rel @param {object|string} value */
function writeState(rel, value) {
  fs.mkdirSync(path.dirname(statePath(rel)), { recursive: true });
  fs.writeFileSync(statePath(rel), typeof value === 'string' ? value : json(value));
}
/** @param {string} rel */
const readState = (rel) => JSON.parse(fs.readFileSync(statePath(rel), 'utf8'));

/** A unit whose implementation topics carry `linters` by topic. @param {string} name @param {Record<string, unknown>} linters */
function unit(name, linters) {
  writeState(`${name}/manifest.json`, {
    name, work_type: 'epic', status: 'in-progress',
    phases: {
      discussion: { items: { cards: { status: 'completed' } } },
      implementation: { items: Object.fromEntries(Object.entries(linters).map(([topic, held]) => [topic, { status: 'in-progress', linters: held, current_task: null }])) },
    },
  });
}

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-073-')));
  git(dir, ['init', '-q']);
  updates = 0;
  skips = 0;
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('migration 073: the linters move to the project\'s environment', () => {
  it('carries the default\'s linters and each topic\'s onto environment.linters, by name, a name carried already with another command named in the verification addendum, and removes the old fields, every other field kept', () => {
    writeState('manifest.json', { project_id: 'p1', work_units: { pay: {}, cards: {} }, defaults: { project_skills: ['go'], linters: [{ name: 'eslint', detail: 'npx eslint .', installed: true }] } });
    unit('pay', { checkout: ['tsc', { name: 'eslint', command: 'eslint src' }] });
    unit('cards', { form: [{ name: 'prettier', command: 'npx prettier --check .' }], store: [{ name: 'vet' }] });

    assert.deepStrictEqual(run(), {
      verify: 'These linters were not carried into environment.linters, a linter of the same name being carried already with another command: eslint (eslint src). Add any still wanted to environment.linters as {name, command}.',
    });

    assert.deepStrictEqual(readState('manifest.json'), {
      project_id: 'p1', work_units: { pay: {}, cards: {} }, defaults: { project_skills: ['go'] },
      environment: { linters: [
        { name: 'eslint', command: 'npx eslint .' },
        { name: 'prettier', command: 'npx prettier --check .' },
        { name: 'vet', command: 'vet' },
        { name: 'tsc', command: 'tsc' },
      ] },
    });
    assert.deepStrictEqual(readState('pay/manifest.json').phases.implementation.items, { checkout: { status: 'in-progress', current_task: null } });
    assert.deepStrictEqual(readState('cards/manifest.json').phases, {
      discussion: { items: { cards: { status: 'completed' } } },
      implementation: { items: { form: { status: 'in-progress', current_task: null }, store: { status: 'in-progress', current_task: null } } },
    });
    assert.deepStrictEqual([updates, skips], [3, 0]);
  });

  it('empty arrays, a confirmed none, carry as an empty list, the defaults object going once empty', () => {
    writeState('manifest.json', { project_id: 'p1', defaults: { linters: [] } });
    unit('pay', { checkout: [] });

    run();

    assert.deepStrictEqual(readState('manifest.json'), { project_id: 'p1', environment: { linters: [] } });
    assert.deepStrictEqual([updates, skips], [2, 0]);
  });

  it('a project whose environment records its linters keeps them, the old fields removed all the same', () => {
    writeState('manifest.json', { project_id: 'p1', defaults: { linters: ['eslint'] }, environment: { run: 'npm start', linters: [{ name: 'tsc', command: 'npx tsc' }] } });

    run();

    assert.deepStrictEqual(readState('manifest.json'), { project_id: 'p1', environment: { run: 'npm start', linters: [{ name: 'tsc', command: 'npx tsc' }] } });
    assert.deepStrictEqual([updates, skips], [1, 0]);
  });

  it('an entry of no linter\'s shape is left out and named in the verification addendum; a topic\'s linters that are no array carry nothing', () => {
    writeState('manifest.json', { project_id: 'p1', defaults: { linters: ['eslint', 7, { detail: 'npx tsc' }] } });
    unit('pay', { checkout: 'eslint' });

    const result = run();

    assert.deepStrictEqual(readState('manifest.json'), { project_id: 'p1', environment: { linters: [{ name: 'eslint', command: 'eslint' }] } });
    assert.deepStrictEqual(readState('pay/manifest.json').phases.implementation.items.checkout, { status: 'in-progress', current_task: null });
    assert.deepStrictEqual(result, {
      verify: 'These linter entries were not carried into environment.linters, being of no shape a linter was recorded in: 7, {"detail":"npx tsc"}. Add any still wanted to environment.linters as {name, command}.',
    });
  });

  it('finds the state in the main checkout from a folder below it and from a linked worktree', () => {
    testIdentity(dir);
    git(dir, ['commit', '-q', '--allow-empty', '-m', 'init']);
    git(dir, ['worktree', 'add', '-q', path.join(dir, 'wt')]);
    fs.mkdirSync(path.join(dir, 'app', 'src'), { recursive: true });

    for (const from of [path.join(dir, 'app', 'src'), path.join(dir, 'wt')]) {
      writeState('manifest.json', { defaults: { linters: ['eslint'] } });
      run(from);
      assert.deepStrictEqual(readState('manifest.json'), { environment: { linters: [{ name: 'eslint', command: 'eslint' }] } }, from);
    }
  });

  it('runs once: a second run finds nothing to carry', () => {
    writeState('manifest.json', { defaults: { linters: ['eslint'] } });
    unit('pay', { checkout: ['tsc'] });
    run();
    const before = [readState('manifest.json'), readState('pay/manifest.json')];

    run();

    assert.deepStrictEqual([readState('manifest.json'), readState('pay/manifest.json')], before);
    assert.deepStrictEqual([updates, skips], [2, 1]);
  });

  it('skips a project with no old field, a unit manifest that cannot be read left as it is', () => {
    writeState('manifest.json', { project_id: 'p1', defaults: { project_skills: [] } });
    writeState('pay/manifest.json', '{ not json');
    unit('cards', {});

    run();

    assert.deepStrictEqual([updates, skips], [0, 1]);
    assert.strictEqual(fs.readFileSync(statePath('pay/manifest.json'), 'utf8'), '{ not json');
    assert.deepStrictEqual(readState('manifest.json'), { project_id: 'p1', defaults: { project_skills: [] } });
  });

  it('skips a folder in no repository, a repository with no state, and a project manifest that cannot be read', () => {
    const outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-073-outside-')));
    try {
      run(outside);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
    run();
    writeState('manifest.json', '{ not json');
    run();

    assert.deepStrictEqual([updates, skips], [0, 3]);
    assert.strictEqual(fs.readFileSync(statePath('manifest.json'), 'utf8'), '{ not json');
  });
});

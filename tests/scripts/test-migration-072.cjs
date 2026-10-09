'use strict';

//
// Tests for migration 072: roadmap-kinds-and-notes (.cjs)
//
// The project manifest's roadmap items: every item without a kind gains
// "idea", a kind already set kept. Against real git, every source under
// .inbox/.archived/{folder}/ has its file moved to .roadmap/notes/{folder}/
// — a tracked file with git (the rename staged, nothing committed), an
// untracked one and one outside a repository on disk — and the source
// rewritten, a waiting, a pulled and a postponed item alike; two items
// sharing a note move it once and both point at its new home; a file already
// at its new home rewrites the source alone; a missing file, and one at both
// places, leaves the source as it is; every other source, field and item is
// kept. One update for the changed roadmap, skip/no-op, idempotency, and the
// guards: no project manifest, a malformed one, no roadmap node, no items,
// and shapes that are not objects.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { git, setupGitFixture, cleanupFixture } = require('./engine-harness.cjs');
const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/072-roadmap-kinds-and-notes.cjs');

let dir, updates, skips;

function run() {
  return MIGRATION.run({ projectDir: dir, reportUpdate: () => { updates++; }, reportSkip: () => { skips++; } });
}

const manifestPath = () => path.join(dir, '.workflows', 'manifest.json');

/** @param {object|string} manifest */
function writeProject(manifest) {
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  fs.writeFileSync(manifestPath(), typeof manifest === 'string' ? manifest : JSON.stringify(manifest, null, 2) + '\n');
}

/** @param {string} rel  project-relative @param {string} [content] */
function write(rel, content = `${path.basename(rel)}\n`) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

const exists = (rel) => fs.existsSync(path.join(dir, rel));
const readText = (rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const items = () => JSON.parse(fs.readFileSync(manifestPath(), 'utf8')).roadmap.items;
const commitAll = () => { git(dir, ['add', '-A']); git(dir, ['commit', '-q', '-m', 'init']); };
const head = () => git(dir, ['rev-parse', 'HEAD']).trim();
const staged = () => git(dir, ['diff', '--cached', '--name-status', '-M']).trim().split('\n').filter(Boolean).sort();

const ARCHIVED = '.workflows/.inbox/.archived/ideas/2026-03-01--dark-mode.md';
const NOTE = '.workflows/.roadmap/notes/ideas/2026-03-01--dark-mode.md';

/** @param {Record<string, object>} roadmapItems */
function roadmap(roadmapItems) {
  return { work_units: {}, roadmap: { horizons: ['v1', 'later'], items: roadmapItems } };
}

describe('migration 072: every roadmap item has a kind, and its note lives on the roadmap', () => {
  beforeEach(() => {
    dir = setupGitFixture('migration-072-');
    updates = 0;
    skips = 0;
  });
  afterEach(() => { cleanupFixture(dir); });

  describe('the kind', () => {
    it('gives every item without a kind the kind idea, keeping a kind already set and every other field', () => {
      writeProject(roadmap({
        loyalty: { horizon: 'v1', summary: 'rewards', origin: 'harvest', sources: ['.roadmap/sessions/session-001.md'] },
        sign_in: { horizon: 'v1', summary: 'accounts', origin: 'harvest', pulled_to: { work_unit: 'core', topic: 'sign-in' } },
        crash: { horizon: 'later', summary: 'login crash', kind: 'bug', origin: 'park:core' },
      }));

      run();

      assert.deepStrictEqual(items(), {
        loyalty: { horizon: 'v1', summary: 'rewards', origin: 'harvest', sources: ['.roadmap/sessions/session-001.md'], kind: 'idea' },
        sign_in: { horizon: 'v1', summary: 'accounts', origin: 'harvest', pulled_to: { work_unit: 'core', topic: 'sign-in' }, kind: 'idea' },
        crash: { horizon: 'later', summary: 'login crash', kind: 'bug', origin: 'park:core' },
      });
      assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 0 });
    });

    it('keeps the rest of the project manifest, in the engine\'s serialisation', () => {
      writeProject({
        defaults: { plan_format: 'x' },
        work_units: { core: { work_type: 'epic' } },
        roadmap: { horizons: ['v1'], items: { loyalty: { horizon: 'v1', summary: 'rewards', origin: 'harvest' } }, active_session: '002' },
      });

      run();

      const text = fs.readFileSync(manifestPath(), 'utf8');
      const after = JSON.parse(text);
      assert.deepStrictEqual(after.defaults, { plan_format: 'x' });
      assert.deepStrictEqual(after.work_units, { core: { work_type: 'epic' } });
      assert.deepStrictEqual(after.roadmap.horizons, ['v1']);
      assert.strictEqual(after.roadmap.active_session, '002');
      assert.strictEqual(text, JSON.stringify(after, null, 2) + '\n');
    });
  });

  describe('the notes', () => {
    it('moves a tracked archived note with git — the rename staged, the source rewritten, nothing committed', () => {
      writeProject(roadmap({
        'dark-mode': { horizon: 'later', summary: 'a dark theme', kind: 'idea', origin: 'inbox:2026-03-01--dark-mode', sources: ['.inbox/.archived/ideas/2026-03-01--dark-mode.md'] },
      }));
      write(ARCHIVED, 'dark mode\n');
      commitAll();
      const before = head();

      run();

      assert.strictEqual(exists(ARCHIVED), false);
      assert.strictEqual(readText(NOTE), 'dark mode\n');
      assert.deepStrictEqual(items()['dark-mode'].sources, ['.roadmap/notes/ideas/2026-03-01--dark-mode.md']);
      assert.ok(staged().includes(`R100\t${ARCHIVED}\t${NOTE}`));
      assert.strictEqual(head(), before, 'a migration never commits');
      assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 0 });
    });

    it('moves an untracked note on disk and stages nothing for it', () => {
      writeProject(roadmap({
        crash: { horizon: 'later', summary: 'login crash', kind: 'idea', origin: 'harvest', sources: ['.inbox/.archived/bugs/2026-03-02--crash.md'] },
      }));
      commitAll();
      write('.workflows/.inbox/.archived/bugs/2026-03-02--crash.md');

      run();

      assert.ok(exists('.workflows/.roadmap/notes/bugs/2026-03-02--crash.md'));
      assert.strictEqual(exists('.workflows/.inbox/.archived/bugs/2026-03-02--crash.md'), false);
      assert.deepStrictEqual(items().crash.sources, ['.roadmap/notes/bugs/2026-03-02--crash.md']);
      assert.deepStrictEqual(staged(), []);
    });

    it('moves on disk outside a repository', () => {
      cleanupFixture(dir);
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-072-plain-'));
      writeProject(roadmap({
        'dark-mode': { horizon: 'later', summary: 'a dark theme', origin: 'harvest', sources: ['.inbox/.archived/ideas/2026-03-01--dark-mode.md'] },
      }));
      write(ARCHIVED);

      run();

      assert.ok(exists(NOTE));
      assert.deepStrictEqual(items()['dark-mode'], {
        horizon: 'later', summary: 'a dark theme', origin: 'harvest', sources: ['.roadmap/notes/ideas/2026-03-01--dark-mode.md'], kind: 'idea',
      });
      assert.strictEqual(updates, 1);
    });

    it('moves a pulled item\'s note and a postponed item\'s alike — a source is a pointer', () => {
      writeProject(roadmap({
        pulled: { horizon: 'v1', summary: 'p', kind: 'idea', origin: 'harvest', sources: ['.inbox/.archived/quickfixes/2026-03-03--typo.md'], pulled_to: { work_unit: 'core' } },
        waits: { horizon: 'later', summary: 'w', kind: 'idea', origin: 'postpone:core', sources: ['.inbox/.archived/ideas/2026-03-04--themes.md', 'core/discussion/themes.md'], postponed_from: { work_unit: 'core', topic: 'themes' } },
      }));
      write('.workflows/.inbox/.archived/quickfixes/2026-03-03--typo.md');
      write('.workflows/.inbox/.archived/ideas/2026-03-04--themes.md');
      commitAll();

      run();

      assert.deepStrictEqual(items().pulled.sources, ['.roadmap/notes/quickfixes/2026-03-03--typo.md']);
      assert.deepStrictEqual(items().pulled.pulled_to, { work_unit: 'core' });
      assert.deepStrictEqual(items().waits.sources, ['.roadmap/notes/ideas/2026-03-04--themes.md', 'core/discussion/themes.md']);
      assert.ok(exists('.workflows/.roadmap/notes/quickfixes/2026-03-03--typo.md'));
      assert.ok(exists('.workflows/.roadmap/notes/ideas/2026-03-04--themes.md'));
    });

    it('moves a note two items share once, both sources pointing at its new home', () => {
      const source = '.inbox/.archived/ideas/2026-03-01--dark-mode.md';
      writeProject(roadmap({
        'dark-mode': { horizon: 'later', summary: 'a', kind: 'idea', origin: 'harvest', sources: [source] },
        'light-mode': { horizon: 'later', summary: 'b', kind: 'idea', origin: 'harvest', sources: [source] },
      }));
      write(ARCHIVED, 'both\n');
      commitAll();

      run();

      assert.strictEqual(readText(NOTE), 'both\n');
      assert.deepStrictEqual(items()['dark-mode'].sources, ['.roadmap/notes/ideas/2026-03-01--dark-mode.md']);
      assert.deepStrictEqual(items()['light-mode'].sources, ['.roadmap/notes/ideas/2026-03-01--dark-mode.md']);
      assert.strictEqual(updates, 1);
    });

    it('rewrites the source of a note already at its new home', () => {
      writeProject(roadmap({
        'dark-mode': { horizon: 'later', summary: 'a', kind: 'idea', origin: 'harvest', sources: ['.inbox/.archived/ideas/2026-03-01--dark-mode.md'] },
      }));
      write(NOTE, 'already moved\n');

      run();

      assert.strictEqual(readText(NOTE), 'already moved\n');
      assert.deepStrictEqual(items()['dark-mode'].sources, ['.roadmap/notes/ideas/2026-03-01--dark-mode.md']);
      assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 0 });
    });

    it('leaves a source whose archived file is missing, and one whose file sits at both places', () => {
      const missing = '.inbox/.archived/bugs/2026-03-05--gone.md';
      const both = '.inbox/.archived/ideas/2026-03-01--dark-mode.md';
      writeProject(roadmap({
        gone: { horizon: 'later', summary: 'a', kind: 'bug', origin: 'harvest', sources: [missing] },
        twice: { horizon: 'later', summary: 'b', kind: 'idea', origin: 'harvest', sources: [both] },
      }));
      write(ARCHIVED, 'archived\n');
      write(NOTE, 'note\n');

      run();

      assert.deepStrictEqual(items().gone.sources, [missing]);
      assert.deepStrictEqual(items().twice.sources, [both]);
      assert.strictEqual(readText(ARCHIVED), 'archived\n');
      assert.strictEqual(readText(NOTE), 'note\n');
      assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    });

    it('leaves every other source alone — a live inbox path, a session log, another archive folder, a nested path, a file that is not markdown, a non-string', () => {
      const sources = [
        '.inbox/ideas/2026-03-01--dark-mode.md',
        '.roadmap/sessions/session-001.md',
        '.inbox/.archived/other/2026-03-01--x.md',
        '.inbox/.archived/ideas/nested/2026-03-01--x.md',
        '.inbox/.archived/ideas/2026-03-01--sketch.png',
        42,
      ];
      writeProject(roadmap({ odd: { horizon: 'later', summary: 'a', kind: 'idea', origin: 'harvest', sources } }));
      write('.workflows/.inbox/.archived/ideas/2026-03-01--sketch.png');

      run();

      assert.deepStrictEqual(items().odd.sources, sources);
      assert.ok(exists('.workflows/.inbox/.archived/ideas/2026-03-01--sketch.png'), 'only a markdown note moves');
      assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    });
  });

  describe('skip, idempotency and the guards', () => {
    it('a second run changes nothing and skips', () => {
      writeProject(roadmap({
        'dark-mode': { horizon: 'later', summary: 'a', origin: 'harvest', sources: ['.inbox/.archived/ideas/2026-03-01--dark-mode.md'] },
      }));
      write(ARCHIVED);
      commitAll();

      run();
      const after = fs.readFileSync(manifestPath(), 'utf8');
      const stagedAfter = staged();
      run();

      assert.strictEqual(fs.readFileSync(manifestPath(), 'utf8'), after);
      assert.deepStrictEqual(staged(), stagedAfter);
      assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 1 });
    });

    it('skips a roadmap whose items all carry a kind and no archived source, leaving the file byte-identical', () => {
      const text = '{"roadmap":{"horizons":["v1"],"items":{"a":{"horizon":"v1","summary":"s","kind":"idea","origin":"harvest"}}}}';
      writeProject(text);

      run();

      assert.strictEqual(fs.readFileSync(manifestPath(), 'utf8'), text);
      assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    });

    it('skips without a project manifest, a malformed one, no roadmap node, a node without items, and non-object shapes', () => {
      const cases = [
        null,
        '{not json',
        '[]',
        { work_units: {} },
        { roadmap: 'scalar' },
        { roadmap: { horizons: [] } },
        { roadmap: { items: [] } },
      ];
      const text = () => (fs.existsSync(manifestPath()) ? fs.readFileSync(manifestPath(), 'utf8') : null);
      for (const manifest of cases) {
        fs.rmSync(manifestPath(), { force: true });
        if (manifest !== null) writeProject(manifest);
        const before = text();

        run();

        assert.strictEqual(text(), before);
      }
      assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: cases.length });
    });

    it('passes over an item that is not an object, and a sources field that is not a list', () => {
      writeProject(roadmap({ bad: 'scalar', list: ['x'], odd: { horizon: 'v1', summary: 's', kind: 'idea', origin: 'harvest', sources: 'nope' } }));

      run();

      assert.deepStrictEqual(items(), { bad: 'scalar', list: ['x'], odd: { horizon: 'v1', summary: 's', kind: 'idea', origin: 'harvest', sources: 'nope' } });
      assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    });
  });
});

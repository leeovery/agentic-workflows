'use strict';

// ---------------------------------------------------------------------------
// A work unit's creation (leeway-engine/scripts/domain/workunit-create.cjs):
// what a created unit holds, through the door that creates work — start this
// work's yes — its canonical manifest and registration, the marker only an
// epic's first session takes, and its inbox seeds, each moved with its
// folder's source tag, their removal in the creation's commit and nothing
// else of the inbox; a seed that is no live inbox item refused, nothing
// touched. Then what only `workunit create` takes until its imports move to
// the assets (29.15): its imports, landed under normalised names, a missing
// one failing fast; its model-authored log; a failed registration putting
// the unit back; the knowledge base indexing what landed, warn-don't-block;
// and its argument refusals. The gate itself is
// test-engine-start-this-work.cjs's.
//
// Layer: verb. World: discovery's gate suites' (discovery-gates-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  ENGINE, ok, refuses, refusedPristine, output, readManifest, readState, statePath, stateGit, lastMessage, touched, head, layout, writeState,
  indexedFiles, hasStore, unreadableKnowledge, commitOnState,
} = require('./engine-harness.cjs');
const { PRODUCT_LOG, IDEA, BUG, SESSION, useGatesWorld, gatesHelpers, failingWrites, manifestTemp } = require('./discovery-gates-world.cjs');

const dir = useGatesWorld();
const { scratch, payload } = gatesHelpers(dir);

const QUICKFIX = layout.inbox('quickfixes', '2026-06-03--typo-fix.md');

/** A start of `type` named `name`, staged and given its yes: the yes's answer. @param {string} type @param {string} name @param {Record<string, unknown>} [more] */
function started(type, name, more = {}) {
  const brief = ['feature', 'bugfix'].includes(type) ? { brief: scratch(`# ${name}\n`) } : {};
  output(dir(), ['render', 'start-this-work', '--file', payload({ type, name, description: 'Payments overhaul', reason: 'One piece of work.', shaped_by: [`${PRODUCT_LOG}#notes`], ...brief, ...more })], { env: SESSION });
  return ok(dir(), ['start-this-work', 'yes'], { env: SESSION });
}

/** The stage of a start with `seeds` refused, writing nothing: its error. @param {string[]} seeds */
function refusedSeeds(seeds) {
  const given = { type: 'epic', name: 'payments', description: 'Payments overhaul', reason: 'Parts.', shaped_by: [`${PRODUCT_LOG}#notes`], seeds };
  return refusedPristine(dir(), ['render', 'start-this-work', '--file', payload(given)], { env: SESSION }).error;
}

/** A file in the code tree, outside the state. @param {string} rel @param {string} content */
function codeFile(rel, content) {
  const file = path.join(dir(), rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

const LOG_STAGE = layout.cache('payments', 'session-001.md');
const SESSION_LOG = '# Discovery Session 001\n\n## Exploration\n\nShaping prose.\n';

/** `workunit create`'s argv, its log staged. @param {string} workUnit @param {string} workType @param {string[]} [extra] */
function createArgs(workUnit, workType, extra = []) {
  writeState(dir(), LOG_STAGE, SESSION_LOG);
  return ['workunit', 'create', workUnit, workType, '--description', 'Payments overhaul', '--session-log-file', statePath(dir(), LOG_STAGE), ...extra];
}

/** A landed file's absolute path. @param {string} rel unit-relative */
const landed = (rel) => statePath(dir(), layout.unit('payments', rel));

describe('a created unit, through start this work', () => {
  it('writes the canonical manifest and registration, byte for byte', () => {
    const { project_id: projectId, roadmap } = readManifest(dir(), '.');
    started('feature', 'payments');
    assert.strictEqual(readState(dir(), layout.manifest('payments')), `${JSON.stringify({
      name: 'payments', work_type: 'feature', status: 'in-progress', created: new Date().toISOString().slice(0, 10), description: 'Payments overhaul', phases: {},
    }, null, 2)}\n`);
    assert.strictEqual(readState(dir(), layout.projectManifest), `${JSON.stringify({
      project_id: projectId, work_units: { atlas: { work_type: 'feature' }, payments: { work_type: 'feature' } }, roadmap,
    }, null, 2)}\n`);
  });

  it('marks only an epic\'s first session open — the sole type whose discovery carries on', () => {
    for (const type of ['epic', 'feature', 'bugfix', 'quick-fix']) started(type, `unit-${type}`);
    assert.deepStrictEqual(['epic', 'feature', 'bugfix', 'quick-fix'].map((type) => readManifest(dir(), `unit-${type}`).phases),
      [{ discovery: { active_session: '001' } }, {}, {}, {}]);
  });

  it('moves each seed out of the inbox with its folder\'s source tag, the commit taking the removal and indexing what landed', () => {
    commitOnState(statePath(dir()), { [QUICKFIX]: '# Typo Fix\n' });
    const res = started('epic', 'payments', { seeds: [`.leeway/${IDEA}`, `.leeway/${BUG}`, `.leeway/${QUICKFIX}`] });
    assert.deepStrictEqual(res.seeds, [
      { path: landed('seeds/2026-06-01-smart-retry.md'), source: 'inbox:idea' },
      { path: landed('seeds/2026-06-02-login-loop.md'), source: 'inbox:bug' },
      { path: landed('seeds/2026-06-03-typo-fix.md'), source: 'inbox:quickfix' },
    ]);
    const { seeds } = readManifest(dir(), 'payments');
    assert.deepStrictEqual(seeds.map(({ path: at, source }) => ({ path: at, source })), [
      { path: 'seeds/2026-06-01-smart-retry.md', source: 'inbox:idea' },
      { path: 'seeds/2026-06-02-login-loop.md', source: 'inbox:bug' },
      { path: 'seeds/2026-06-03-typo-fix.md', source: 'inbox:quickfix' },
    ]);
    assert.ok(seeds.every(({ seeded_at: at }) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(at)));
    assert.deepStrictEqual(['ideas', 'bugs', 'quickfixes'].map((folder) => fs.readdirSync(statePath(dir(), '.inbox', folder))), [[], [], []]);
    assert.deepStrictEqual(touched(statePath(dir()), 'HEAD').filter((line) => line.includes('.inbox/')), [`D\t${BUG}`, `D\t${IDEA}`, `D\t${QUICKFIX}`],
      'each seed\'s removal rides with its new home');
    assert.deepStrictEqual(indexedFiles(dir()), ['payments/seeds/2026-06-01-smart-retry.md', 'payments/seeds/2026-06-02-login-loop.md', 'payments/seeds/2026-06-03-typo-fix.md']);
  });

  it('leaves an unrelated inbox change out of a commit with no seeds', () => {
    writeState(dir(), layout.inbox('ideas', '2026-06-09--unrelated.md'), '# Unrelated\n');
    started('feature', 'payments');
    assert.ok(!touched(statePath(dir()), 'HEAD').some((line) => line.includes('.inbox/')));
    assert.match(stateGit(dir(), ['status', '--porcelain']), /^\?\? \.inbox\/ideas\/2026-06-09--unrelated\.md$/m);
  });

  it('refuses a seed outside the inbox, one missing, and one named twice — nothing touched', () => {
    codeFile('notes/rogue.md', 'not an inbox item\n');
    assert.match(refusedSeeds(['notes/rogue.md']), /not a live inbox path/);
    assert.match(refusedSeeds(['.leeway/.inbox/ideas/2026-06-09--ghost.md']), /inbox file not found/);
    assert.match(refusedSeeds([`.leeway/${IDEA}`, `.leeway/${IDEA}`]), /duplicate inbox path/);
  });
});

describe('workunit create, its imports and its log (until 29.15)', () => {
  /** `workunit create` landing `sources` as imports: its answer. @param {string[]} sources */
  const landImports = (sources) => ok(dir(), createArgs('payments', 'feature', sources.flatMap((s) => ['--import', s])));

  it('installs the log verbatim, copies each import under its normalised name — markdown-ish ones as .md — and commits once', () => {
    codeFile('notes/My Design DOC.txt', 'a\n');
    codeFile('notes/UPPER.MD', 'b\n');
    codeFile('notes/plain', 'c\n');
    codeFile('notes/weird  name!!.md', 'd\n');
    const before = head(dir());
    const res = landImports(['notes/My Design DOC.txt', 'notes/UPPER.MD', 'notes/plain', 'notes/weird  name!!.md']);
    assert.deepStrictEqual(res.imports, ['my-design-doc.md', 'upper.md', 'plain.md', 'weird-name.md'].map((name) => ({ path: landed(`imports/${name}`) })));
    assert.deepStrictEqual([res.skipped_imports, res.session_log, readState(dir(), layout.session('payments', '001'))], [[], landed('discovery/session-001.md'), SESSION_LOG]);
    const [entry] = readManifest(dir(), 'payments').imports;
    assert.deepStrictEqual([Object.keys(entry), entry.origin], [['path', 'imported_at', 'origin'], 'discovery'], 'a new unit\'s files come in through discovery');
    assert.ok(fs.existsSync(path.join(dir(), 'notes/My Design DOC.txt')), 'an import is copied, its source untouched');
    assert.deepStrictEqual([lastMessage(dir()), stateGit(dir(), ['rev-list', '--count', `${before}..HEAD`]).trim()], ['discovery(payments): create work unit (feature)', '1']);
  });

  it('skips a dotfile, reporting it, and indexes only what landed', () => {
    codeFile('notes/.env', 'SECRET=1\n');
    codeFile('notes/good.md', 'fine\n');
    const res = landImports(['notes/.env', 'notes/good.md']);
    assert.deepStrictEqual([res.skipped_imports, res.imports], [['notes/.env'], [{ path: landed('imports/good.md') }]]);
    assert.deepStrictEqual(indexedFiles(dir()), ['payments/imports/good.md']);
  });

  it('suffixes a collision\'s stem, never its extension — the same source twice, and distinct sources normalising alike', () => {
    codeFile('notes/a b.md', 'one\n');
    codeFile('notes/a  b.md', 'two\n');
    codeFile('notes/shot.png', 'one\n');
    codeFile('notes/SHOT.png', 'two\n');
    const res = landImports(['notes/a b.md', 'notes/a b.md', 'notes/a  b.md', 'notes/shot.png', 'notes/SHOT.png']);
    assert.deepStrictEqual(res.imports, ['a-b.md', 'a-b-2.md', 'a-b-3.md', 'shot.png', 'shot-2.png'].map((name) => ({ path: landed(`imports/${name}`) })));
    assert.deepStrictEqual([fs.readFileSync(landed('imports/a-b-3.md'), 'utf8'), fs.readFileSync(landed('imports/shot-2.png'), 'utf8')], ['two\n', 'two\n']);
  });

  it('keeps a non-markdown extension, lowercased, never indexing it, and lands every source 0644', () => {
    codeFile('notes/Screenshot One.JPEG', 'jpeg bytes\n');
    codeFile('notes/design.txt', 'plain text\n');
    fs.chmodSync(codeFile('notes/locked.png', 'png bytes\n'), 0o600);
    const res = landImports(['notes/Screenshot One.JPEG', 'notes/design.txt', 'notes/locked.png']);
    assert.deepStrictEqual(res.imports, ['screenshot-one.jpeg', 'design.md', 'locked.png'].map((name) => ({ path: landed(`imports/${name}`) })));
    assert.deepStrictEqual(indexedFiles(dir()), ['payments/imports/design.md']);
    assert.strictEqual(fs.statSync(landed('imports/locked.png')).mode & 0o777, 0o644);
  });

  it('fails fast on every missing import, a folder among them — nothing touched, no store built', () => {
    codeFile('notes/good.md', 'fine\n');
    fs.mkdirSync(path.join(dir(), 'notes/album'));
    const err = refusedPristine(dir(), createArgs('payments', 'epic', ['--import', 'notes/good.md', '--import', 'notes/ghost.md', '--import', 'notes/album', '--seed', `.leeway/${IDEA}`]));
    assert.match(err.error, /import path\(s\) not found, not a file, or unreadable: notes\/ghost\.md, notes\/album/);
    assert.deepStrictEqual(err.missing_imports, ['notes/ghost.md', 'notes/album']);
    assert.strictEqual(hasStore(dir()), false);
  });

  it('puts the unit back where its registration fails — no folder, its seed back in the inbox', () => {
    codeFile('notes/design.md', 'notes\n');
    const args = createArgs('payments', 'epic', ['--import', 'notes/design.md', '--seed', `.leeway/${IDEA}`]);
    const refused = failingWrites(manifestTemp(statePath(dir())), () => refusedPristine(dir(), args));
    assert.strictEqual(refused.error, 'disk full');
  });

  it('warns where the knowledge base cannot index what landed, and still commits', () => {
    unreadableKnowledge(dir());
    codeFile('notes/design.md', 'notes\n');
    const res = ok(dir(), createArgs('payments', 'epic', ['--import', 'notes/design.md', '--seed', `.leeway/${IDEA}`]));
    assert.deepStrictEqual(res.warnings.map((/** @type {string} */ w) => w.replace(/ at .*/s, '')), [
      'knowledge index (imports/design.md) failed: loadStore: corrupted store file',
      'knowledge index (seeds/2026-06-01-smart-retry.md) failed: loadStore: corrupted store file',
    ]);
    assert.strictEqual(lastMessage(dir()), 'discovery(payments): create work unit (epic)');
  });
});

describe('workunit create, refused', () => {
  it('refuses an illegal type through the shared schema vocabulary, and a name a unit has', () => {
    assert.match(refusedPristine(dir(), createArgs('payments', 'saga')).error, /Invalid work_type "saga"\. Must be one of: epic, feature, bugfix, cross-cutting, quick-fix/);
    assert.match(refusedPristine(dir(), createArgs('atlas', 'epic')).error, /work unit "atlas" already exists — pick a different name/);
  });

  it('refuses an illegal name — anything but a kebab-case slug, a phase\'s name, a reserved name', () => {
    const refusal = (/** @type {string} */ name) => refuses(dir(), createArgs(name, 'epic')).error;
    for (const name of ['pay.ments', '../escape', 'Pay Flow', 'feat(auth)']) assert.match(refusal(name), /must be a kebab-case slug/);
    assert.match(refusal('discussion'), /conflicts with a phase name/);
    for (const name of ['project', 'roadmap', 'none', 'product']) assert.match(refusal(name), /is reserved/);
  });

  it('refuses a missing log file, and missing arguments with the usage', () => {
    assert.match(refusedPristine(dir(), ['workunit', 'create', 'payments', 'epic', '--description', 'd', '--session-log-file', '.leeway/.cache/ghost.md']).error, /session log file not found/);
    const usage = /Usage: engine workunit create .* --session-log-file <path>/;
    for (const args of [[], ['payments'], ['payments', 'epic'], ['payments', 'feature', '--description', 'd']]) assert.match(refuses(dir(), ['workunit', 'create', ...args]).error, usage);
    assert.match(refuses(dir(), ['workunit', 'destroy', 'payments']).error, /Usage: engine workunit <create\|import\|complete\|cancel\|reactivate\|pivot\|absorb\|promote>/);
  });

  it('validates work types through the shared schema module, never a local literal', () => {
    const src = fs.readFileSync(path.join(path.dirname(ENGINE), 'domain/workunit-create.cjs'), 'utf8');
    assert.ok(src.includes('require(\'../kernel/manifest-schema.cjs\')'), 'workunit-create must require the shared schema');
    assert.ok(!/VALID_WORK_TYPES\s*=\s*\[/.test(src), 'no local copy of the work-type vocabulary');
  });
});

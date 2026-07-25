'use strict';

// Case corpus: loading and validation.
//
// A case is a directory, tests/prose/cases/{case-id}/, holding one file
// per element of the test. Nothing is parsed: JSON is JSON, prose files
// are read whole and relayed into prompts, recipes are required as
// modules.
//
//   case.json            the values code branches on:
//                          { origin, files[], answers[], stubs{name: trigger} }
//   fixture.md           optional. Prose describing the starting world —
//                        what has already happened, where the session
//                        stands. Given to the walker.
//   fixture-state.cjs    exports build(h): the starting world, in engine
//                        calls. Composed from tests/prose/mainlines/.
//   act.md               the coarse instruction: where to enter, what to
//                        follow, where to stop. Given to the walker.
//   assert.md            the expected trace, step by step, plus any
//                        further claims. Given ONLY to the asserter.
//   assertion-state.cjs  optional. exports build(h): the world the walk
//                        should produce. Absent means "unchanged" — the
//                        walk should leave the fixture state untouched.
//   fixture/             generated snapshot of the starting world
//   assertion/           generated snapshot of the expected world
//
// act.md and assert.md are separate files because that is the P4
// boundary: the walker must never see the expected trace, and a file
// boundary enforces it structurally rather than by convention.
//
// The act stays coarse on purpose — the walker must DERIVE the path from
// the prose, and that derivation is the thing under test. Granularity
// lives in assert.md, where a step-by-step expected trace catches a
// walker that silently course-corrected around broken prose.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../..');
const PROSE_DIR = path.join(ROOT, 'tests/prose');
const CASES_DIR = path.join(PROSE_DIR, 'cases');
const STUBS_DIR = path.join(PROSE_DIR, 'stubs');

const FILES = {
  meta: 'case.json',
  situation: 'fixture.md',
  fixtureState: 'fixture-state.cjs',
  act: 'act.md',
  assert: 'assert.md',
  assertionState: 'assertion-state.cjs',
};
const SNAPSHOTS = { fixture: 'fixture', assertion: 'assertion' };

function listCaseIds() {
  if (!fs.existsSync(CASES_DIR)) return [];
  return fs.readdirSync(CASES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
    .map((e) => e.name)
    .sort();
}

function readIf(dir, name) {
  const file = path.join(dir, name);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : null;
}

function loadCase(id) {
  const dir = path.join(CASES_DIR, id);
  if (!fs.existsSync(dir)) throw new Error(`no case "${id}" in tests/prose/cases`);

  const metaPath = path.join(dir, FILES.meta);
  let meta = {};
  let metaError = null;
  if (!fs.existsSync(metaPath)) metaError = `missing ${FILES.meta}`;
  else {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (e) {
      metaError = `${FILES.meta} does not parse: ${e.message}`;
    }
  }

  return {
    id,
    dir,
    rel: path.relative(ROOT, dir),
    metaError,
    origin: meta.origin || null,
    files: (meta.files || []).map((spec) => {
      const hash = spec.indexOf('#');
      return hash === -1
        ? { path: spec, anchor: null }
        : { path: spec.slice(0, hash).trim(), anchor: spec.slice(hash + 1).trim() };
    }),
    answers: meta.answers || [],
    stubs: Object.entries(meta.stubs || {}).map(([name, trigger]) => ({ name, trigger })),
    situation: readIf(dir, FILES.situation),
    act: readIf(dir, FILES.act),
    assert: readIf(dir, FILES.assert),
    hasFixtureState: fs.existsSync(path.join(dir, FILES.fixtureState)),
    hasAssertionState: fs.existsSync(path.join(dir, FILES.assertionState)),
  };
}

function loadAllCases() {
  return listCaseIds().map(loadCase);
}

/** A world builder module: exports build(h). */
function requireState(caseId, which) {
  const file = path.join(CASES_DIR, caseId, FILES[which]);
  if (!fs.existsSync(file)) return null;
  delete require.cache[require.resolve(file)];
  const mod = require(file);
  if (typeof mod.build !== 'function') {
    throw new Error(`${caseId}/${FILES[which]} must export build(h)`);
  }
  return mod;
}

function listStubs() {
  if (!fs.existsSync(STUBS_DIR)) return [];
  return fs.readdirSync(STUBS_DIR)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .map((f) => path.basename(f, '.md'));
}

/** A stub file is description above a `---` fence, exact bytes below. */
function readStub(name) {
  const file = path.join(STUBS_DIR, `${name}.md`);
  if (!fs.existsSync(file)) throw new Error(`no stub "${name}" in tests/prose/stubs`);
  const raw = fs.readFileSync(file, 'utf8');
  const fence = raw.indexOf('\n---\n');
  if (fence === -1) throw new Error(`stub "${name}" has no --- fence separating description from content`);
  return {
    name,
    description: raw.slice(0, fence).replace(/^#.*\n/, '').trim(),
    content: raw.slice(fence + 5).replace(/^\n+/, ''),
  };
}

function headingExists(absPath, anchor) {
  return fs.readFileSync(absPath, 'utf8').split('\n').some((line) => {
    const h = line.match(/^#{1,6}\s+(.*?)\s*$/);
    return h && h[1].includes(anchor);
  });
}

function validateCorpus(cases) {
  const errors = [];
  const stubs = new Set(listStubs());

  for (const c of cases) {
    const at = c.rel;
    if (c.metaError) { errors.push(`${at}: ${c.metaError}`); continue; }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(c.id)) errors.push(`${at}: case directory is not kebab-case`);
    if (!c.origin) errors.push(`${at}: ${FILES.meta} has no origin`);

    if (c.files.length === 0) errors.push(`${at}: ${FILES.meta} scopes no files`);
    for (const f of c.files) {
      const abs = path.join(ROOT, f.path);
      if (!fs.existsSync(abs)) errors.push(`${at}: scoped file missing: ${f.path}`);
      else if (f.anchor && !headingExists(abs, f.anchor)) {
        errors.push(`${at}: anchor "#${f.anchor}" not a heading in ${f.path}`);
      }
    }

    if (!c.act) errors.push(`${at}: no ${FILES.act}`);
    if (!c.assert) errors.push(`${at}: no ${FILES.assert} — the expected trace is what catches a silent repair`);

    if (c.hasAssertionState && !c.hasFixtureState) {
      errors.push(`${at}: ${FILES.assertionState} without ${FILES.fixtureState} — nothing to act on`);
    }
    if (c.situation && !c.hasFixtureState) {
      errors.push(`${at}: ${FILES.situation} describes a world this case does not build`);
    }
    for (const which of ['fixtureState', 'assertionState']) {
      try {
        requireState(c.id, which);
      } catch (e) {
        errors.push(`${at}: ${e.message}`);
      }
    }

    for (const s of c.stubs) {
      if (!stubs.has(s.name)) errors.push(`${at}: no stub "${s.name}" in tests/prose/stubs`);
      if (!s.trigger || !s.trigger.trim()) {
        errors.push(`${at}: stub "${s.name}" declares no trigger — the case owns the moment`);
      }
      if (!c.hasFixtureState) errors.push(`${at}: stub "${s.name}" needs a world to fire in`);
    }
  }
  return errors;
}

module.exports = {
  ROOT, PROSE_DIR, CASES_DIR, STUBS_DIR, FILES, SNAPSHOTS,
  listCaseIds, loadCase, loadAllCases, requireState, listStubs, readStub, validateCorpus,
};

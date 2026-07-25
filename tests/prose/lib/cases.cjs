'use strict';

// Case corpus: parsing and validation.
//
// One case per file, flat: tests/prose/{case-id}.md, where the filename
// IS the id (validated, so a rename can never drift from the heading).
// Cases are Given-When-Then; nothing groups them but their `files:`
// scope, which is what selection actually runs on.
//
//   ## case: {kebab-id}
//   - origin: {why this case exists}
//   - files:
//     - {repo-relative path}[#heading fragment]
//
//   ### given
//   world_before: {fixture name}
//   stubs:
//     - {stub name}: {when it fires — the case owns the trigger}
//
//   ### when
//   {free text: where to enter, what to follow, where to stop}
//   answers:
//   1. {scripted user response, consumed in order}
//
//   ### then
//   world_after: {fixture name | unchanged}
//   trace:
//   1. {behavioural step the walk should have taken}
//   notes:
//   - {any further claim about the walk}
//
// The `when` stays coarse on purpose — one instruction, never a
// step-by-step script. The walker must DERIVE the path from the prose;
// that derivation is the thing under test. Granularity lives in `then`,
// where a step-by-step expected trace catches a walker that silently
// course-corrected around broken prose.
//
// Anchors are substring fragments matched against heading text
// (`#Boot` matches "Step 0.2: Boot") so a renumber can't break a case.
// Claims name BEHAVIOUR, never coordinates — step numbers and arm
// letters rot on cosmetic edits and fail for the wrong reason.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../..');
const PROSE_DIR = path.join(ROOT, 'tests/prose');
const FIXTURES_DIR = path.join(PROSE_DIR, 'fixtures');
const STUBS_DIR = path.join(PROSE_DIR, 'stubs');
const UNCHANGED = 'unchanged';

function listCaseFiles() {
  if (!fs.existsSync(PROSE_DIR)) return [];
  return fs.readdirSync(PROSE_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md')
    .map((e) => path.join(PROSE_DIR, e.name));
}

function parseCaseFile(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const c = {
    id: null, file: path.relative(ROOT, file), origin: null, files: [],
    worldBefore: null, stubs: [], when: [], answers: [],
    worldAfter: null, trace: [], notes: [],
  };
  let section = null;   // null | given | when | then
  let list = null;      // files | stubs | answers | trace | notes

  for (const line of lines) {
    const head = line.match(/^## case:\s*(\S+)\s*$/);
    if (head) {
      c.id = head[1];
      section = null;
      list = null;
      continue;
    }
    const sub = line.match(/^### (given|when|then)\s*$/);
    if (sub) {
      section = sub[1];
      list = null;
      continue;
    }

    if (section === null) {
      const origin = line.match(/^- origin:\s*(.*)$/);
      if (origin) { c.origin = origin[1].trim(); list = null; continue; }
      if (/^- files:\s*$/.test(line)) { list = 'files'; continue; }
      const item = line.match(/^\s+- (.+)$/);
      if (list === 'files' && item) {
        const spec = item[1].trim();
        const hash = spec.indexOf('#');
        c.files.push(hash === -1
          ? { path: spec, anchor: null }
          : { path: spec.slice(0, hash).trim(), anchor: spec.slice(hash + 1).trim() });
        continue;
      }
      if (line.trim() !== '') list = null;
      continue;
    }

    if (section === 'given') {
      const wb = line.match(/^world_before:\s*(\S+)\s*$/);
      if (wb) { c.worldBefore = wb[1]; list = null; continue; }
      if (/^stubs:\s*$/.test(line)) { list = 'stubs'; continue; }
      const stub = line.match(/^\s+- ([a-z0-9][a-z0-9-]*):\s*(.+)$/);
      if (list === 'stubs' && stub) {
        c.stubs.push({ name: stub[1], trigger: stub[2].trim() });
        continue;
      }
      continue;
    }

    if (section === 'when') {
      if (/^answers:\s*$/.test(line)) { list = 'answers'; continue; }
      const answer = line.match(/^\d+\.\s+(.*)$/);
      if (list === 'answers' && answer) { c.answers.push(answer[1].trim()); continue; }
      if (list !== 'answers') c.when.push(line);
      continue;
    }

    // then
    const wa = line.match(/^world_after:\s*(\S+)\s*$/);
    if (wa) { c.worldAfter = wa[1]; list = null; continue; }
    if (/^trace:\s*$/.test(line)) { list = 'trace'; continue; }
    if (/^notes:\s*$/.test(line)) { list = 'notes'; continue; }
    const step = line.match(/^\d+\.\s+(.*)$/);
    if (list === 'trace' && step) { c.trace.push(step[1].trim()); continue; }
    if (list === 'trace' && /^\s+\S/.test(line) && c.trace.length) {
      c.trace[c.trace.length - 1] += ` ${line.trim()}`;
      continue;
    }
    const note = line.match(/^- (.*)$/);
    if (list === 'notes' && note) { c.notes.push(note[1].trim()); continue; }
    if (list === 'notes' && /^\s+\S/.test(line) && c.notes.length) {
      c.notes[c.notes.length - 1] += ` ${line.trim()}`;
    }
  }

  c.when = c.when.join('\n').trim();
  return c;
}

function loadAllCases() {
  return listCaseFiles().map(parseCaseFile);
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
    description: raw.slice(0, fence).trim(),
    content: raw.slice(fence + 5).replace(/^\n+/, ''),
  };
}

function headingExists(absPath, anchor) {
  return fs.readFileSync(absPath, 'utf8').split('\n').some((line) => {
    const h = line.match(/^#{1,6}\s+(.*?)\s*$/);
    return h && h[1].includes(anchor);
  });
}

function fixtureExists(name) {
  return fs.existsSync(path.join(FIXTURES_DIR, name, 'recipe.cjs'));
}

function validateCorpus(cases) {
  const errors = [];
  const seen = new Set();
  const stubs = new Set(listStubs());

  for (const c of cases) {
    const at = c.file;
    if (!c.id) { errors.push(`${at}: no "## case:" heading`); continue; }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(c.id)) errors.push(`${at}: id is not kebab-case`);
    if (seen.has(c.id)) errors.push(`${at}: duplicate case id "${c.id}"`);
    seen.add(c.id);
    if (path.basename(c.file, '.md') !== c.id) {
      errors.push(`${at}: filename must equal the case id (expected ${c.id}.md)`);
    }

    if (!c.origin) errors.push(`${at}: no origin`);
    if (c.files.length === 0) errors.push(`${at}: no files: scope`);
    for (const f of c.files) {
      const abs = path.join(ROOT, f.path);
      if (!fs.existsSync(abs)) errors.push(`${at}: scoped file missing: ${f.path}`);
      else if (f.anchor && !headingExists(abs, f.anchor)) {
        errors.push(`${at}: anchor "#${f.anchor}" not a heading in ${f.path}`);
      }
    }

    if (c.worldBefore && !fixtureExists(c.worldBefore)) {
      errors.push(`${at}: world_before "${c.worldBefore}" has no fixture recipe`);
    }
    if (!c.worldAfter) {
      errors.push(`${at}: no world_after (use "unchanged" when the walk mutates nothing)`);
    } else if (c.worldAfter !== UNCHANGED) {
      if (!c.worldBefore) errors.push(`${at}: world_after names a fixture but there is no world_before`);
      if (!fixtureExists(c.worldAfter)) {
        errors.push(`${at}: world_after "${c.worldAfter}" has no fixture recipe`);
      }
    }

    for (const s of c.stubs) {
      if (!stubs.has(s.name)) errors.push(`${at}: no stub "${s.name}" in tests/prose/stubs`);
      if (!s.trigger) errors.push(`${at}: stub "${s.name}" declares no trigger — the case owns the moment`);
      if (!c.worldBefore) errors.push(`${at}: stub "${s.name}" needs a world to fire in`);
    }

    if (!c.when) errors.push(`${at}: empty when`);
    if (c.trace.length === 0) errors.push(`${at}: no trace — then must state the expected path step by step`);
  }
  return errors;
}

module.exports = {
  ROOT, PROSE_DIR, FIXTURES_DIR, STUBS_DIR, UNCHANGED,
  listCaseFiles, parseCaseFile, loadAllCases, listStubs, readStub, validateCorpus,
};

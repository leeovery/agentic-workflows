'use strict';

// Case corpus: parsing and validation.
//
// A case file is markdown under tests/prose/{flow}/ (any name, .md).
// Grammar, deterministic to parse:
//
//   ## case: {kebab-id}
//   - world: {fixture-name}            (optional; required by state expects)
//   - origin: {free text}
//   - files:
//     - {repo-relative path}[#heading fragment]
//
// Anchors are substring fragments, matched against heading text with
// `includes` — `#Boot` matches "Step 0.2: Boot" and survives a
// renumber. Authoring rule (see README): cases name BEHAVIOUR, never
// coordinates — step numbers, arm letters, and heading numbering in
// walk or expect text rot on cosmetic edits and fail for the wrong
// reason.
//   ### walk
//   {free text: entry point, what to do, stop condition}
//   ### user
//   1. {scripted answer, consumed in order}
//   ### expect
//   - routing: {claim graded by an agent against the walk transcript}
//   - state: {deterministic assertion — see parseStateAssertion}
//
// State assertion grammar (executed by the runner, zero model judgment):
//   file exists {rel}
//   file absent {rel}
//   manifest exists {dotpath} {field}
//   manifest absent {dotpath} {field}
//   manifest equals {dotpath} {field} {expected printed value}

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../..');
const PROSE_DIR = path.join(ROOT, 'tests/prose');
const FIXTURES_DIR = path.join(PROSE_DIR, 'fixtures');
const RESERVED_DIRS = new Set(['lib', 'fixtures']);

function listCaseFiles() {
  if (!fs.existsSync(PROSE_DIR)) return [];
  const files = [];
  for (const flow of fs.readdirSync(PROSE_DIR, { withFileTypes: true })) {
    if (!flow.isDirectory() || RESERVED_DIRS.has(flow.name)) continue;
    const flowDir = path.join(PROSE_DIR, flow.name);
    for (const entry of fs.readdirSync(flowDir)) {
      if (entry.endsWith('.md') && entry !== 'README.md') {
        files.push({ flow: flow.name, file: path.join(flowDir, entry) });
      }
    }
  }
  return files;
}

function parseStateAssertion(text) {
  const fileMatch = text.match(/^file (exists|absent) (\S+)$/);
  if (fileMatch) {
    return { kind: `file-${fileMatch[1]}`, path: fileMatch[2] };
  }
  const mExists = text.match(/^manifest (exists|absent) (\S+) (\S+)$/);
  if (mExists) {
    return { kind: `manifest-${mExists[1]}`, dotpath: mExists[2], field: mExists[3] };
  }
  const mEquals = text.match(/^manifest equals (\S+) (\S+) (.+)$/);
  if (mEquals) {
    return { kind: 'manifest-equals', dotpath: mEquals[1], field: mEquals[2], value: mEquals[3] };
  }
  return { error: `unparseable state assertion: "${text}"` };
}

function parseCaseFile(file, flow) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const cases = [];
  let current = null;
  let section = null; // null | 'walk' | 'user' | 'expect'
  let inFiles = false;

  const push = () => {
    if (current) {
      current.walk = current.walk.join('\n').trim();
      cases.push(current);
    }
  };

  for (const line of lines) {
    const caseStart = line.match(/^## case:\s*(\S+)\s*$/);
    if (caseStart) {
      push();
      current = {
        id: caseStart[1], flow, file: path.relative(ROOT, file),
        world: null, origin: null, files: [],
        walk: [], user: [], expect: [],
      };
      section = null;
      inFiles = false;
      continue;
    }
    if (!current) continue;

    const sub = line.match(/^### (walk|user|expect)\s*$/);
    if (sub) {
      section = sub[1];
      inFiles = false;
      continue;
    }
    if (/^#/.test(line)) { // any other heading ends the current case
      push();
      current = null;
      continue;
    }

    if (section === null) {
      const field = line.match(/^- (world|origin):\s*(.*)$/);
      if (field) {
        current[field[1]] = field[2].trim();
        inFiles = false;
        continue;
      }
      if (/^- files:\s*$/.test(line)) {
        inFiles = true;
        continue;
      }
      const fileEntry = line.match(/^\s+- (.+)$/);
      if (inFiles && fileEntry) {
        const [, spec] = fileEntry;
        const hash = spec.indexOf('#');
        current.files.push(hash === -1
          ? { path: spec.trim(), anchor: null }
          : { path: spec.slice(0, hash).trim(), anchor: spec.slice(hash + 1).trim() });
        continue;
      }
      if (line.trim() !== '') inFiles = false;
    } else if (section === 'walk') {
      current.walk.push(line);
    } else if (section === 'user') {
      const answer = line.match(/^\d+\.\s+(.*)$/);
      if (answer) current.user.push(answer[1].trim());
    } else if (section === 'expect') {
      const claim = line.match(/^- (routing|state):\s*(.*)$/);
      if (claim) current.expect.push({ kind: claim[1], text: claim[2].trim() });
    }
  }
  push();
  return cases;
}

function loadAllCases() {
  return listCaseFiles().flatMap(({ flow, file }) => parseCaseFile(file, flow));
}

function headingExists(absPath, anchor) {
  const content = fs.readFileSync(absPath, 'utf8');
  return content.split('\n').some((line) => {
    const h = line.match(/^#{1,6}\s+(.*?)\s*$/);
    return h && h[1].includes(anchor);
  });
}

function validateCorpus(cases) {
  const errors = [];
  const seen = new Set();
  for (const c of cases) {
    const at = `${c.file} :: ${c.id}`;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(c.id)) errors.push(`${at}: id is not kebab-case`);
    if (seen.has(c.id)) errors.push(`${at}: duplicate case id`);
    seen.add(c.id);

    if (c.files.length === 0) errors.push(`${at}: no files: scope`);
    for (const f of c.files) {
      const abs = path.join(ROOT, f.path);
      if (!fs.existsSync(abs)) {
        errors.push(`${at}: scoped file missing: ${f.path}`);
      } else if (f.anchor && !headingExists(abs, f.anchor)) {
        errors.push(`${at}: anchor "#${f.anchor}" not a heading in ${f.path}`);
      }
    }

    if (c.world !== null) {
      if (!fs.existsSync(path.join(FIXTURES_DIR, c.world, 'recipe.cjs'))) {
        errors.push(`${at}: world "${c.world}" has no fixture recipe`);
      }
    }

    if (!c.walk) errors.push(`${at}: empty walk`);
    if (c.expect.length === 0) errors.push(`${at}: no expects`);
    for (const e of c.expect) {
      if (!e.text) errors.push(`${at}: empty ${e.kind} expect`);
      if (e.kind === 'state') {
        if (c.world === null) {
          errors.push(`${at}: state expect requires a world`);
        }
        const parsed = parseStateAssertion(e.text);
        if (parsed.error) errors.push(`${at}: ${parsed.error}`);
      }
    }
  }
  return errors;
}

module.exports = {
  ROOT, PROSE_DIR, FIXTURES_DIR,
  listCaseFiles, parseCaseFile, loadAllCases, parseStateAssertion, validateCorpus,
};

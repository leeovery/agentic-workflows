#!/usr/bin/env node
'use strict';

// Prose-test runner — everything deterministic about a prose-test run.
// The /prose-test skill drives this CLI and supplies the model layer
// (walker and grader agents). See design/prose-tests.md.
//
//   list                          corpus table
//   select [--diff <ref>|--all|--cases a,b]   cases to run, as JSON
//   world <case-id>               materialise the case's world, print path
//   prompt <case-id> [--world <dir>]   walker prompt (NEVER contains expects)
//   grade <case-id> [--world <dir>]    run state assertions; emit routing
//                                      claims for the grader agent
//   snap <fixture>                (re)generate a fixture's golden snapshot
//   verify [fixture]              rebuild-compare fixture(s) against snapshot
//   destroy --world <dir>         remove a world

const fs = require('fs');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const cases = require('./lib/cases.cjs');
const fixtures = require('./lib/fixtures.cjs');
const world = require('./lib/world.cjs');

const ROOT = cases.ROOT;

function die(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}

function loadCase(id) {
  const all = cases.loadAllCases();
  const found = all.find((c) => c.id === id);
  if (!found) die(`no case "${id}" in the corpus`);
  return found;
}

function flag(argv, name) {
  const i = argv.indexOf(name);
  if (i === -1) return null;
  if (i + 1 >= argv.length) die(`${name} requires a value`);
  return argv[i + 1];
}

// --- select ---------------------------------------------------------------

function changedFiles(ref) {
  const run = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })
    .split('\n').map((l) => l.trim()).filter(Boolean);
  const diff = run(['diff', '--name-only', ref]);
  const status = run(['status', '--porcelain']).map((l) => l.slice(3).trim());
  return new Set([...diff, ...status]);
}

function cmdSelect(argv) {
  const all = cases.loadAllCases();
  let selected;
  let mode;
  if (argv.includes('--all')) {
    mode = 'all';
    selected = all;
  } else if (flag(argv, '--cases')) {
    mode = 'ids';
    const ids = flag(argv, '--cases').split(',').map((s) => s.trim());
    const byId = new Map(all.map((c) => [c.id, c]));
    for (const id of ids) if (!byId.has(id)) die(`no case "${id}" in the corpus`);
    selected = ids.map((id) => byId.get(id));
  } else {
    const ref = flag(argv, '--diff') || 'main';
    mode = `diff:${ref}`;
    const changed = changedFiles(ref);
    const touches = (c) => {
      if (changed.has(c.file)) return true;
      if (c.files.some((f) => changed.has(f.path))) return true;
      if (c.world !== null) {
        const prefix = path.posix.join('tests/prose/fixtures', c.world) + '/';
        for (const p of changed) if (p.startsWith(prefix)) return true;
      }
      return false;
    };
    selected = all.filter(touches);
  }
  process.stdout.write(JSON.stringify({
    mode,
    cases: selected.map((c) => ({ id: c.id, flow: c.flow, file: c.file, world: c.world })),
  }, null, 2) + '\n');
}

// --- world / destroy ------------------------------------------------------

function cmdWorld(argv) {
  const c = loadCase(argv[0] || die('usage: world <case-id>'));
  if (c.world === null) {
    process.stdout.write(JSON.stringify({ world: null, note: 'structure-only case — no world' }) + '\n');
    return;
  }
  const dir = world.buildWorld(c.world);
  process.stdout.write(JSON.stringify({ world: dir, fixture: c.world }) + '\n');
}

function cmdDestroy(argv) {
  const dir = flag(argv, '--world') || die('usage: destroy --world <dir>');
  world.destroyWorld(dir);
  process.stdout.write(`destroyed ${dir}\n`);
}

// --- prompt ---------------------------------------------------------------

function cmdPrompt(argv) {
  const c = loadCase(argv[0] || die('usage: prompt <case-id> [--world <dir>]'));
  const worldDir = flag(argv, '--world');
  if (c.world !== null && !worldDir) die(`case "${c.id}" needs --world (build one: run.cjs world ${c.id})`);

  const userScript = c.user.length
    ? c.user.map((a, i) => `  ${i + 1}. ${a}`).join('\n')
    : '  (none — the walk should reach its stop condition without user questions)';

  const setting = c.world !== null
    ? [
      'You are executing this project\'s workflow prose exactly as a live session would.',
      '',
      `Project directory — your cwd for EVERY command: ${worldDir}`,
      'The workflow skills are installed at .claude/skills/ inside that project.',
      'Mutations are expected and safe: the project is a disposable test world.',
    ]
    : [
      'You are walking workflow prose structurally: read the named files and trace the logic.',
      'Execute nothing — no commands, no writes. This is a read-only walk of the repository.',
      '',
      `Repository root: ${ROOT}`,
    ];

  const stubs = c.stub
    ? ['', 'STUBS — where the prose dispatches a background agent, do NOT dispatch one.',
      'Play the agent yourself exactly as described, then continue the prose:', '', c.stub]
    : [];

  const prompt = [
    ...setting,
    '',
    'TASK',
    c.walk,
    '',
    'SCOPE — the prose under walk:',
    ...c.files.map((f) => `  - ${f.path}${f.anchor ? ` (start at the heading containing "${f.anchor}")` : ''}`),
    ...stubs,
    '',
    'RULES',
    '- Follow the prose literally, step by step, arm by arm. Where it names an',
    '  engine or knowledge call, run it (node .claude/skills/workflow-engine/',
    '  scripts/engine.cjs …) from the project directory and use the real response.',
    '- You also play the user, from a fixed script. When the prose presents a',
    '  menu or question, consume the next scripted answer, in order:',
    userScript,
    '- If the prose asks a question and the script has no next answer: STOP and',
    '  record `UNSCRIPTED QUESTION:` with the exact question text.',
    '- If two arms both appear to match, record `AMBIGUOUS:` naming both, then',
    '  follow the one the prose\'s own ordering/guard rules select.',
    '- Never repair, reinterpret, or improve the prose. Execute what is written,',
    '  even where it looks wrong. You are a probe, not a reviewer.',
    '- Stop at the TASK\'s stop condition, the end of the flow, an UNSCRIPTED',
    '  QUESTION, or a hard error — whichever comes first.',
    '',
    'TRANSCRIPT — your entire final output, in order of events:',
    '1. Every prose section/arm entered: `file.md § Heading` plus the quoted',
    '   guard line that selected it.',
    '2. Every command run and the first line of its output.',
    '3. Every menu/question encountered (verbatim) and the scripted answer used.',
    '4. Every file written or edited (path only).',
    '5. Finally: `STOPPED: <reason>`.',
    'Return nothing but the transcript.',
  ].join('\n');

  process.stdout.write(prompt + '\n');
}

// --- grade ----------------------------------------------------------------

function engineInWorld(worldDir, args) {
  const engine = path.join(worldDir, '.claude/skills/workflow-engine/scripts/engine.cjs');
  return spawnSync('node', [engine, ...args], { cwd: worldDir, encoding: 'utf8' });
}

function runStateAssertion(worldDir, assertion) {
  const a = cases.parseStateAssertion(assertion);
  if (a.error) return { assertion, pass: false, actual: a.error };
  if (a.kind === 'file-exists' || a.kind === 'file-absent') {
    const present = fs.existsSync(path.join(worldDir, a.path));
    const want = a.kind === 'file-exists';
    return { assertion, pass: present === want, actual: present ? 'present' : 'absent' };
  }
  if (a.kind === 'json-equals') {
    const full = path.join(worldDir, a.path);
    if (!fs.existsSync(full)) return { assertion, pass: false, actual: 'file absent' };
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch (e) {
      return { assertion, pass: false, actual: `unparseable JSON: ${e.message}` };
    }
    const found = a.pointer.split('.').reduce((node, key) => (
      node === undefined || node === null ? undefined : node[key]
    ), doc);
    const actual = found === undefined ? '<undefined>' : String(found);
    return { assertion, pass: actual === a.value, actual };
  }
  if (a.kind === 'manifest-exists' || a.kind === 'manifest-absent') {
    const res = engineInWorld(worldDir, ['manifest', 'exists', a.dotpath, a.field]);
    if (res.status !== 0) return { assertion, pass: false, actual: `engine refused: ${res.stderr.trim()}` };
    const present = res.stdout.trim() === 'true';
    const want = a.kind === 'manifest-exists';
    return { assertion, pass: present === want, actual: present ? 'present' : 'absent' };
  }
  // manifest-equals
  const res = engineInWorld(worldDir, ['manifest', 'get', a.dotpath, a.field]);
  if (res.status !== 0) return { assertion, pass: false, actual: `engine refused: ${res.stderr.trim()}` };
  const actual = res.stdout.trim();
  return { assertion, pass: actual === a.value, actual };
}

function cmdGrade(argv) {
  const c = loadCase(argv[0] || die('usage: grade <case-id> [--world <dir>]'));
  const worldDir = flag(argv, '--world');
  const stateExpects = c.expect.filter((e) => e.kind === 'state');
  if (stateExpects.length > 0 && !worldDir) die(`case "${c.id}" has state expects — --world required`);

  const state = stateExpects.map((e) => runStateAssertion(worldDir, e.text));
  const routing = c.expect.filter((e) => e.kind === 'routing').map((e) => e.text);
  process.stdout.write(JSON.stringify({
    id: c.id,
    state,
    statePass: state.every((s) => s.pass),
    routing,
    note: routing.length
      ? 'routing claims are graded by an agent against the walk transcript — PASS requires quoted evidence'
      : 'no routing claims',
  }, null, 2) + '\n');
}

// --- snap / verify --------------------------------------------------------

function cmdSnap(argv) {
  const name = argv[0] || die('usage: snap <fixture>');
  const scratch = fixtures.runRecipe(name);
  try {
    const count = fixtures.writeSnapshot(name, scratch);
    process.stdout.write(`snapshot ${name}: ${count} files written — review the diff before committing\n`);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function cmdVerify(argv) {
  const names = argv[0] ? [argv[0]] : fixtures.listFixtures();
  let failed = false;
  for (const name of names) {
    const scratch = fixtures.runRecipe(name);
    try {
      const diff = fixtures.compareSnapshot(name, scratch);
      const clean = !diff.missing.length && !diff.extra.length && !diff.changed.length;
      if (clean) {
        process.stdout.write(`${name}: snapshot current\n`);
      } else {
        failed = true;
        process.stdout.write(`${name}: DRIFT — the recipe no longer rebuilds the snapshot\n`);
        for (const f of diff.changed) process.stdout.write(`  changed: ${f}\n`);
        for (const f of diff.extra) process.stdout.write(`  extra (rebuilt, not in snapshot): ${f}\n`);
        for (const f of diff.missing) process.stdout.write(`  missing (in snapshot, not rebuilt): ${f}\n`);
        process.stdout.write(`  regenerate: node tests/prose/run.cjs snap ${name}\n`);
      }
    } finally {
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  }
  process.exit(failed ? 1 : 0);
}

// --- list -----------------------------------------------------------------

function cmdList() {
  const all = cases.loadAllCases();
  const errors = cases.validateCorpus(all);
  for (const c of all) {
    const expects = `${c.expect.filter((e) => e.kind === 'routing').length}r/${c.expect.filter((e) => e.kind === 'state').length}s`;
    process.stdout.write(`${c.id}  [${c.flow}]  world=${c.world || '-'}  expects=${expects}\n`);
  }
  process.stdout.write(`\n${all.length} cases, ${fixtures.listFixtures().length} fixtures`);
  process.stdout.write(errors.length ? `, ${errors.length} VALIDATION ERRORS:\n` : ', corpus valid\n');
  for (const e of errors) process.stdout.write(`  - ${e}\n`);
  process.exit(errors.length ? 1 : 0);
}

// --- dispatch -------------------------------------------------------------

const [, , command, ...rest] = process.argv;
const commands = {
  list: cmdList, select: cmdSelect, world: cmdWorld, prompt: cmdPrompt,
  grade: cmdGrade, snap: cmdSnap, verify: cmdVerify, destroy: cmdDestroy,
};
if (!commands[command]) {
  die('usage: run.cjs <list|select|world|prompt|grade|snap|verify|destroy> …');
}
commands[command](rest);

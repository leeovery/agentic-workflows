#!/usr/bin/env node
'use strict';

// Prose-test runner — everything deterministic about a prose-test run.
// The /prose-test skill drives this CLI and supplies the two agents: one
// walks the prose, one asserts the result. See design/prose-tests.md.
//
//   list                          corpus table
//   select [--diff <ref>|--all|--cases a,b]   cases to run, as JSON
//   world <case-id>               materialise world_before, print path
//   prompt <case-id> --world <d>  walker prompt (NEVER contains `then`)
//   diff <case-id> --world <d>    acted world vs world_after, as facts
//   assert <case-id> --world <d>  the asserting agent's prompt (diff + then)
//   snap <fixture>                (re)generate a fixture's golden snapshot
//   verify [fixture]              rebuild-compare fixture(s)
//   destroy --world <dir>         remove a world

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const cases = require('./lib/cases.cjs');
const fixtures = require('./lib/fixtures.cjs');
const world = require('./lib/world.cjs');

const ROOT = cases.ROOT;

function die(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}

function loadCase(id) {
  const found = cases.loadAllCases().find((c) => c.id === id);
  if (!found) die(`no case "${id}" in the corpus`);
  return found;
}

function flag(argv, name) {
  const i = argv.indexOf(name);
  if (i === -1) return null;
  if (i + 1 >= argv.length) die(`${name} requires a value`);
  return argv[i + 1];
}

function requireWorld(argv, c) {
  const dir = flag(argv, '--world');
  if (!dir) die(`case "${c.id}" needs --world (build one: run.cjs world ${c.id})`);
  return dir;
}

// --- select ---------------------------------------------------------------

function changedFiles(ref) {
  const run = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })
    .split('\n').map((l) => l.trim()).filter(Boolean);
  return new Set([
    ...run(['diff', '--name-only', ref]),
    ...run(['status', '--porcelain']).map((l) => l.slice(3).trim()),
  ]);
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
    selected = all.filter((c) => changed.has(c.file)
      || c.files.some((f) => changed.has(f.path))
      || [c.worldBefore, c.worldAfter].filter(Boolean).some((w) =>
        [...changed].some((p) => p.startsWith(`tests/prose/fixtures/${w}/`)))
      || c.stubs.some((s) => changed.has(`tests/prose/stubs/${s.name}.md`)));
  }
  process.stdout.write(`${JSON.stringify({
    mode,
    cases: selected.map((c) => ({
      id: c.id, file: c.file, world_before: c.worldBefore, world_after: c.worldAfter,
    })),
  }, null, 2)}\n`);
}

// --- world / destroy ------------------------------------------------------

function cmdWorld(argv) {
  const c = loadCase(argv[0] || die('usage: world <case-id>'));
  if (!c.worldBefore) {
    process.stdout.write(`${JSON.stringify({ world: null, note: 'structure-only case — no world' })}\n`);
    return;
  }
  const dir = world.buildWorld(c.worldBefore);
  process.stdout.write(`${JSON.stringify({ world: dir, fixture: c.worldBefore })}\n`);
}

function cmdDestroy(argv) {
  const dir = flag(argv, '--world') || die('usage: destroy --world <dir>');
  world.destroyWorld(dir);
  process.stdout.write(`destroyed ${dir}\n`);
}

// --- prompt (the walker) --------------------------------------------------

function cmdPrompt(argv) {
  const c = loadCase(argv[0] || die('usage: prompt <case-id> [--world <dir>]'));
  const worldDir = c.worldBefore ? requireWorld(argv, c) : null;

  const setting = worldDir
    ? [
      "You are executing this project's workflow prose exactly as a live session would.",
      '',
      `Project directory — your cwd for EVERY command: ${worldDir}`,
      'The workflow skills are installed at .claude/skills/ inside that project.',
      'Mutations are expected and safe: the project is a disposable test world.',
    ]
    : [
      'You are walking workflow prose structurally: read the named files and trace the logic.',
      'Execute nothing — no commands, no writes. This is a read-only walk.',
      '',
      `Repository root: ${ROOT}`,
    ];

  const answers = c.answers.length
    ? c.answers.map((a, i) => `  ${i + 1}. ${a}`).join('\n')
    : '  (none — the walk should reach its stop condition without user questions)';

  const substitutions = c.stubs.length ? [
    '',
    'HARNESS SUBSTITUTIONS — these are NOT part of the process you are walking.',
    'They stand in for steps this framework deliberately does not simulate.',
    'Apply each only at the moment stated, then resume the prose exactly where',
    'you left it, and record `SUBSTITUTED: <name>` in the transcript.',
    '',
    ...c.stubs.flatMap((s) => {
      const stub = cases.readStub(s.name);
      return [
        `### ${s.name}`,
        `WHEN: ${s.trigger}`,
        `WHAT IT IS: ${stub.description.replace(/^#.*\n/, '').trim()}`,
        'CONTENT (write these exact bytes where the substitution calls for a file):',
        ...stub.content.split('\n').map((l) => `    ${l}`),
        '',
      ];
    }),
  ] : [];

  const situation = c.situation ? ['', 'SITUATION — where the project stands as you begin:', c.situation] : [];

  process.stdout.write(`${[
    ...setting,
    ...situation,
    '',
    'TASK',
    c.when,
    '',
    'SCOPE — the prose under walk:',
    ...c.files.map((f) => `  - ${f.path}${f.anchor ? ` (start at the heading containing "${f.anchor}")` : ''}`),
    ...substitutions,
    '',
    'RULES',
    '- Follow the prose literally, step by step, arm by arm. Where it names an',
    '  engine or knowledge call, run it from the project directory and use the',
    '  real response to decide which arm applies.',
    '- You also play the user, from a fixed script. When the prose presents a',
    '  menu or question, consume the next scripted answer, in order:',
    answers,
    '- If the prose asks a question and the script has no next answer: STOP and',
    '  record `UNSCRIPTED QUESTION:` with the exact question text.',
    '- If two arms both appear to match, record `AMBIGUOUS:` naming both, then',
    "  follow the one the prose's own ordering/guard rules select.",
    '- If the prose cannot be followed literally — a step that contradicts the',
    '  state, a missing file it assumes, an instruction that cannot be executed —',
    '  record `DEVIATION:` with what you could not do, then continue as best you',
    '  can. NEVER silently repair, reinterpret, or improve the prose. You are a',
    '  probe, not a reviewer: a broken instruction is the finding.',
    '- Stop at the TASK\'s stop condition, the end of the flow, an UNSCRIPTED',
    '  QUESTION, or a hard error — whichever comes first.',
    '',
    'TRANSCRIPT — your entire final output, in order of events:',
    '1. Every prose section/arm entered: `file.md § Heading` plus the quoted',
    '   guard line that selected it.',
    '2. Every command run and the first line of its output.',
    '3. Every menu/question encountered (verbatim) and the scripted answer used.',
    '4. Every file written or edited (path only), and every SUBSTITUTED marker.',
    '5. Finally: `STOPPED: <reason>`.',
    'Return nothing but the transcript.',
  ].join('\n')}\n`);
}

// --- diff (the facts) -----------------------------------------------------

function worldDelta(c, worldDir) {
  const target = c.worldAfter === cases.UNCHANGED ? c.worldBefore : c.worldAfter;
  return fixtures.diffWorldAgainstSnapshot(worldDir, target);
}

function cmdDiff(argv) {
  const c = loadCase(argv[0] || die('usage: diff <case-id> --world <dir>'));
  if (!c.worldBefore) {
    process.stdout.write(`${JSON.stringify({ note: 'structure-only case — no world to diff' }, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(worldDelta(c, requireWorld(argv, c)), null, 2)}\n`);
}

// --- assert (the judging agent) -------------------------------------------

function cmdAssert(argv) {
  const c = loadCase(argv[0] || die('usage: assert <case-id> [--world <dir>]'));
  const lines = [
    'You are asserting the result of a prose-test case. You did not perform',
    'the walk. Judge only what the evidence shows.',
    '',
    'EXPECTED TRACE — the path the prose should have taken:',
    ...c.trace.map((t, i) => `  ${i + 1}. ${t}`),
  ];
  if (c.notes.length) {
    lines.push('', 'FURTHER CLAIMS:', ...c.notes.map((n) => `  - ${n}`));
  }

  if (c.worldBefore) {
    const delta = worldDelta(c, requireWorld(argv, c));
    lines.push(
      '',
      c.worldAfter === cases.UNCHANGED
        ? 'EXPECTED WORLD: unchanged — the walk should have left the project exactly as it found it.'
        : `EXPECTED WORLD: the committed fixture "${c.worldAfter}".`,
      '',
      'WORLD DELTA — the factual difference between the world after the walk and',
      'the expected world, computed by code. Volatile values (timestamps, git',
      'SHAs, engine-allocated ids) are NOT normalised: a difference in one of',
      'those is expected and immaterial. A difference in shape, field presence,',
      'status vocabulary, or content is material.',
      '',
      JSON.stringify({ added: delta.added, removed: delta.removed, identical: delta.identical }, null, 2),
      ...delta.changed,
    );
  }

  lines.push(
    '',
    'THE TRANSCRIPT of the walk is supplied separately by the caller.',
    '',
    'VERDICT — return exactly this, nothing else:',
    '1. Trace: one line per expected step — PASS or FAIL, each PASS quoting the',
    '   transcript line that shows it. A PASS with no quote is invalid.',
    '2. World: PASS or FAIL. Enumerate EVERY difference in the delta and classify',
    '   each as volatile (immaterial) or material. Any material difference fails.',
    '   An empty delta passes.',
    '3. Markers: list every UNSCRIPTED QUESTION, AMBIGUOUS, and DEVIATION in the',
    '   transcript. Each is a finding in its own right, even if everything passed.',
    '4. VERDICT: PASS or FAIL, then one sentence on what it means for the prose.',
  );
  process.stdout.write(`${lines.join('\n')}\n`);
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
      const d = fixtures.compareSnapshot(name, scratch);
      if (!d.missing.length && !d.extra.length && !d.changed.length) {
        process.stdout.write(`${name}: snapshot current\n`);
      } else {
        failed = true;
        process.stdout.write(`${name}: DRIFT — the recipe no longer rebuilds the snapshot\n`);
        for (const f of d.changed) process.stdout.write(`  changed: ${f}\n`);
        for (const f of d.extra) process.stdout.write(`  extra (rebuilt, not in snapshot): ${f}\n`);
        for (const f of d.missing) process.stdout.write(`  missing (in snapshot, not rebuilt): ${f}\n`);
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
    const stubs = c.stubs.length ? ` stubs=${c.stubs.map((s) => s.name).join(',')}` : '';
    process.stdout.write(
      `${c.id}\n    ${c.worldBefore || '(no world)'} → ${c.worldAfter}  trace=${c.trace.length}${stubs}\n`);
  }
  process.stdout.write(`\n${all.length} cases, ${fixtures.listFixtures().length} fixtures, ${cases.listStubs().length} stubs`);
  process.stdout.write(errors.length ? `, ${errors.length} VALIDATION ERRORS:\n` : ', corpus valid\n');
  for (const e of errors) process.stdout.write(`  - ${e}\n`);
  process.exit(errors.length ? 1 : 0);
}

// --- dispatch -------------------------------------------------------------

const [, , command, ...rest] = process.argv;
const commands = {
  list: cmdList, select: cmdSelect, world: cmdWorld, prompt: cmdPrompt,
  diff: cmdDiff, assert: cmdAssert, snap: cmdSnap, verify: cmdVerify, destroy: cmdDestroy,
};
if (!commands[command]) {
  die('usage: run.cjs <list|select|world|prompt|diff|assert|snap|verify|destroy> …');
}
commands[command](rest);

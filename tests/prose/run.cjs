#!/usr/bin/env node
'use strict';

// Prose-test runner — everything deterministic about a prose-test run.
// The /prose-test skill drives this CLI and supplies the two agents: one
// walks the prose, one asserts the result. See design/prose-tests.md.
//
//   list                          corpus table
//   select [--diff <ref>|--all|--cases a,b]   cases to run, as JSON
//   world <case-id>               materialise the fixture state, print path
//   prompt <case-id> --world <d>  walker prompt (NEVER contains assert.md)
//   diff <case-id> --world <d>    acted world vs expected world, as facts
//   assert <case-id> --world <d> --transcript <f>   the asserter's prompt
//   snap <case-id>                (re)generate a case's snapshots
//   verify [case-id]              rebuild-compare snapshot(s)
//   destroy --world <dir>         remove a world

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const cases = require('./lib/cases.cjs');
const worlds = require('./lib/worlds.cjs');
const actionsLib = require('./lib/actions.cjs');
const prompts = require('./lib/prompts.cjs');

const ROOT = cases.ROOT;

function die(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}

function getCase(id) {
  if (!id) die('a case id is required');
  if (!cases.listCaseIds().includes(id)) die(`no case "${id}" in tests/prose/cases`);
  return cases.loadCase(id);
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
    for (const id of ids) getCase(id);
    selected = all.filter((c) => ids.includes(c.id));
  } else {
    const ref = flag(argv, '--diff') || 'main';
    mode = `diff:${ref}`;
    const changed = changedFiles(ref);
    selected = all.filter((c) => c.files.some((f) => changed.has(f.path))
      || [...changed].some((p) => p.startsWith(`${c.rel}/`))
      || c.stubs.some((s) => changed.has(`tests/prose/stubs/${s.name}.md`))
      || [...changed].some((p) => p.startsWith('tests/prose/mainlines/')));
  }
  process.stdout.write(`${JSON.stringify({
    mode,
    cases: selected.map((c) => ({
      id: c.id,
      dir: c.rel,
      expects: c.hasAssertionState ? 'assertion state' : 'fixture state unchanged',
    })),
  }, null, 2)}\n`);
}

// --- world / destroy ------------------------------------------------------

function cmdWorld(argv) {
  const c = getCase(argv[0]);
  if (!c.hasFixtureState) {
    process.stdout.write(`${JSON.stringify({ world: null, note: 'structure-only case — no world' })}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify({ world: worlds.buildWorld(c.id), case: c.id })}\n`);
}

function cmdDestroy(argv) {
  const dir = flag(argv, '--world') || die('usage: destroy --world <dir>');
  worlds.destroyWorld(dir);
  process.stdout.write(`destroyed ${dir}\n`);
}

// --- prompt (the walker) --------------------------------------------------

function cmdPrompt(argv) {
  const c = getCase(argv[0]);
  const worldDir = c.hasFixtureState ? requireWorld(argv, c) : null;

  process.stdout.write(prompts.walkerPrompt({
    worldDir,
    root: ROOT,
    situation: c.situation,
    task: c.act,
    scope: c.files
      .map((f) => `  - ${f.path}${f.anchor ? ` (start at the heading containing "${f.anchor}")` : ''}`)
      .join('\n'),
    stubs: c.stubs.map((s) => ({ ...s, ...cases.readStub(s.name) })),
    answers: c.answers.map((a, i) => `  ${i + 1}. ${a}`).join('\n'),
  }));
}

// --- diff (the facts) -----------------------------------------------------

function cmdDiff(argv) {
  const c = getCase(argv[0]);
  if (!c.hasFixtureState) {
    process.stdout.write(`${JSON.stringify({ note: 'structure-only case — no world to diff' }, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(worlds.diffWorld(c.id, requireWorld(argv, c)), null, 2)}\n`);
}

// --- assert (the judging agent) -------------------------------------------

function cmdAssert(argv) {
  const c = getCase(argv[0]);
  let world = null;
  let actions = null;
  if (c.hasFixtureState) {
    const dir = requireWorld(argv, c);
    const delta = worlds.diffWorld(c.id, dir);
    world = {
      expecting: delta.expecting,
      delta: [
        JSON.stringify({ added: delta.added, removed: delta.removed, identical: delta.identical }, null, 2),
        ...delta.changed,
      ].join('\n'),
    };
    const transcript = flag(argv, '--transcript');
    if (!transcript) {
      die('--transcript <file> is required: the walker\'s session transcript is the '
        + 'record of what the walk actually did, and a verdict without it rests on the '
        + "walker's own account — which is the thing this harness exists to distrust.");
    }
    actions = actionsLib.formatActions(actionsLib.extractActions(transcript, dir));
    // No tool calls at all is the harness failing, not the walk failing:
    // a walk in a world always runs commands. Refuse loudly rather than
    // let an agent reach a verdict with no record of what was done.
    if (!actions) {
      die(`no tool calls found in ${transcript} — either that is not the walker's `
        + 'transcript, or the walk made no calls at all. Do not judge this run.');
    }
  }
  process.stdout.write(prompts.asserterPrompt({ expected: c.assert, world, actions }));
}

// --- snap / verify --------------------------------------------------------

function statesOf(c) {
  return [
    c.hasFixtureState ? 'fixture' : null,
    c.hasAssertionState ? 'assertion' : null,
  ].filter(Boolean);
}

function cmdSnap(argv) {
  const ids = argv[0] ? [getCase(argv[0]).id] : cases.listCaseIds();
  for (const id of ids) {
    const c = cases.loadCase(id);
    for (const which of statesOf(c)) {
      const count = worlds.writeSnapshot(id, which);
      process.stdout.write(`${id}/${which}: ${count} files — review the diff before committing\n`);
    }
  }
}

function cmdVerify(argv) {
  const ids = argv[0] ? [getCase(argv[0]).id] : cases.listCaseIds();
  let failed = false;
  for (const id of ids) {
    const c = cases.loadCase(id);
    for (const which of statesOf(c)) {
      const d = worlds.verifySnapshot(id, which);
      if (d.skipped) {
        process.stdout.write(`${id}/${which}: unchanged since last build\n`);
      } else if (!d.missing.length && !d.extra.length && !d.changed.length) {
        process.stdout.write(`${id}/${which}: snapshot current\n`);
      } else {
        failed = true;
        process.stdout.write(`${id}/${which}: DRIFT — the recipe no longer rebuilds the snapshot\n`);
        for (const f of d.changed) process.stdout.write(`  changed: ${f}\n`);
        for (const f of d.extra) process.stdout.write(`  extra (rebuilt, not in snapshot): ${f}\n`);
        for (const f of d.missing) process.stdout.write(`  missing (in snapshot, not rebuilt): ${f}\n`);
        process.stdout.write(`  regenerate: node tests/prose/run.cjs snap ${id}\n`);
      }
    }
  }
  process.exit(failed ? 1 : 0);
}

// --- list -----------------------------------------------------------------

function cmdList() {
  const all = cases.loadAllCases();
  const errors = cases.validateCorpus(all);
  for (const c of all) {
    const stubs = c.stubs.length ? `  stubs=${c.stubs.map((s) => s.name).join(',')}` : '';
    const expects = c.hasAssertionState ? 'assertion state' : 'no change';
    process.stdout.write(`${c.id}\n    ${c.hasFixtureState ? 'fixture' : 'no world'} → ${expects}${stubs}\n`);
  }
  process.stdout.write(`\n${all.length} cases, ${cases.listStubs().length} stubs`);
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

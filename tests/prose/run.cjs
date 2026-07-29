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
//   assert <case-id> --world <d>  the asserting agent's prompt
//   snap <case-id>                (re)generate a case's snapshots
//   verify [case-id]              rebuild-compare snapshot(s)
//   archive <case-id> --world <d> lift a failed world's evidence out before destroy
//   destroy --world <dir>         remove a world

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const cases = require('./lib/cases.cjs');
const worlds = require('./lib/worlds.cjs');
const prompts = require('./lib/prompts.cjs');
const invariants = require('./lib/invariants.cjs');

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
  process.stdout.write(`${JSON.stringify({ world: worlds.buildWorld(c.id), case: c.id })}\n`);
}

function cmdDestroy(argv) {
  const dir = flag(argv, '--world') || die('usage: destroy --world <dir>');
  worlds.destroyWorld(dir);
  process.stdout.write(`destroyed ${dir}\n`);
}

// A failed run's world holds the only copy of its evidence. Archiving
// lifts the recorded logs and the workflow state to a directory that
// outlives the run, so a failure can be inspected without re-walking.
function cmdArchive(argv) {
  const c = getCase(argv[0]);
  const dir = requireWorld(argv, c);
  process.stdout.write(`${JSON.stringify({ archived: worlds.archiveWorld(dir, c.id) })}\n`);
}

// --- prompt (the walker) --------------------------------------------------

function cmdPrompt(argv) {
  const c = getCase(argv[0]);
  const worldDir = requireWorld(argv, c);

  process.stdout.write(prompts.walkerPrompt({
    worldDir,
    situation: c.situation,
    task: c.act,
    scope: c.files
      .map((f) => `  - ${f.path}${f.anchor ? ` (start at the heading containing "${f.anchor}")` : ''}`)
      .join('\n'),
    stubs: c.stubs.map((s) => ({ ...s, ...cases.readStub(s.name) })),
    answers: c.answers.map((a, i) => `  ${i + 1}. ${a}`).join('\n'),
    conduct: c.conduct,
  }));
}

// --- diff (the facts) -----------------------------------------------------

function cmdDiff(argv) {
  const c = getCase(argv[0]);
  process.stdout.write(`${JSON.stringify(worlds.diffWorld(c.id, requireWorld(argv, c)), null, 2)}\n`);
}

// --- assert (the judging agent) -------------------------------------------

function cmdAssert(argv) {
  const c = getCase(argv[0]);
  const dir = requireWorld(argv, c);
  const delta = worlds.diffWorld(c.id, dir, c.worldMode === 'claims');
  const world = {
    expecting: delta.expecting,
    delta: [
      JSON.stringify({ added: delta.added, removed: delta.removed, identical: delta.identical }, null, 2),
      ...delta.changed,
    ].join('\n'),
  };
  const actions = worlds.readActionLog(dir);
  // No log is the harness failing, not the walk: a walk in a world
  // always runs commands, and the walker's hook records every one.
  // Refuse loudly rather than let an agent judge on the narrative
  // alone — which is the thing the recording exists to replace.
  if (!actions) {
    die(`no action log at ${path.join(dir, worlds.ACTION_LOG)} — the prose-walker `
      + 'PostToolUse hook did not fire, so there is no record of what the walk did.\n'
      + 'Check the hooks block in .claude/agents/prose-walker.md, that the agent '
      + 'registry has reloaded since it changed, and that this project is trusted '
      + '(hasTrustDialogAccepted). Do not judge this run.');
  }
  const rows = worlds.readActionRows(dir);
  const checks = invariants.format(invariants.check(rows, c.invariants));
  const undeclared = invariants.undeclaredProse(rows, c.files.map((f) => f.path));
  const walk = worlds.readWalkLog(dir);
  // Same stance as the action log: the walk is harness-captured, so its
  // absence is a broken hook, not a quiet walk. Judging without it would
  // fall back to whatever the walker chose to say at the end — the very
  // summary this record exists to replace.
  if (!walk) {
    die(`no walk log at ${path.join(dir, worlds.WALK_LOG)} — the prose-walker `
      + 'SubagentStop hook did not fire, so there is no turn-by-turn record of '
      + 'the walk.\nCheck the hooks block in .claude/agents/prose-walker.md and '
      + 'that the agent registry has reloaded since it changed. Do not judge this run.');
  }

  const substitutions = c.stubs.length
    ? c.stubs.map((s) => {
      const stub = cases.readStub(s.name);
      return `- ${s.name} — fires ${s.trigger}\n  ${stub.description.replace(/\n/g, '\n  ')}`;
    }).join('\n')
    : null;
  process.stdout.write(
    prompts.asserterPrompt({
      expected: c.assert, world, actions, checks, walk, substitutions,
      scope: undeclared.length ? undeclared.map((f) => `- ${f}`).join('\n') : null,
    }),
  );
}

// --- snap / verify --------------------------------------------------------

function statesOf(c) {
  return [
    'fixture',
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
    process.stdout.write(`${c.id}\n    fixture → ${expects}${stubs}\n`);
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
  diff: cmdDiff, assert: cmdAssert, snap: cmdSnap, verify: cmdVerify,
  destroy: cmdDestroy, archive: cmdArchive,
};
if (!commands[command]) {
  die('usage: run.cjs <list|select|world|prompt|diff|assert|snap|verify|archive|destroy> …');
}
commands[command](rest);

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
//   assert <case-id> --world <d>  write the asserting agent's prompt into the world, print its path
//   stop <case-id> --world <d> --agent <id>|--transcript <f>
//                                 record a finished walker's stop its hook never wrote
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
const transcripts = require('./lib/transcripts.cjs');
const { verifyAll } = require('./lib/verify-pool.cjs');

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
    selected = cases.selectCases(all, changedFiles(ref));
  }
  process.stdout.write(`${JSON.stringify({
    mode,
    cases: selected.map((c) => ({
      id: c.id,
      dir: c.rel,
      expects: expectedWorld(c, 'fixture state unchanged'),
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

/**
 * The held dispatches as the asserter reads them: each numbered in the
 * order made, its agent, whether it ran in the background, and its prompt
 * whole — the world's path collapsed to `.`, as in the action log. A walk
 * that dispatched nothing carries no section at all.
 */
function formatDispatches(records, dir) {
  if (!records.length) return null;
  const world = path.resolve(dir);
  return records.map((r, i) => {
    const input = r.tool_input || {};
    const head = `${i + 1}. ${input.subagent_type || '-'} — ${input.description || ''}`
      + ` (background: ${input.run_in_background !== false})`;
    return `${head}\n${prompts.indent(String(input.prompt || '').split(world).join('.'))}`;
  }).join('\n\n');
}

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
  const walk = worlds.readWalkLog(dir);
  // Same stance as the action log: the walk is harness-captured, so its
  // absence is a broken hook, not a quiet walk. Judging without it would
  // fall back to whatever the walker chose to say at the end — the very
  // summary this record exists to replace.
  // The walk log and the recorded stop are written by the same hook as
  // the walker stops, so a record with no stop yet is a walk still in
  // progress — a message the walker handed back early is not its end.
  if (!walk && !rows.some((r) => r.event === 'SubagentStop')) {
    die(`the walker has not stopped — no SubagentStop in ${path.join(dir, worlds.ACTION_LOG)}, `
      + 'so the walk is still running (a message it handed back before stopping is not '
      + 'its end).\nWait for the walker to finish, then run assert again. Never judge or '
      + 'destroy the world while it runs.');
  }
  if (!walk) {
    die(`no walk log at ${path.join(dir, worlds.WALK_LOG)} — the prose-walker `
      + 'SubagentStop hook did not fire, so there is no turn-by-turn record of '
      + 'the walk.\nCheck the hooks block in .claude/agents/prose-walker.md and '
      + 'that the agent registry has reloaded since it changed. Do not judge this run.');
  }
  // Every dispatch a walker makes is held — recorded and refused before
  // any agent starts. One the stop found in the transcript with no held
  // record got past the hold, so a real agent may have run in this world
  // and nothing in it can be judged. Each row names the call and what came
  // back for it: a harness that refused the call before any hook ran says
  // why there.
  const unheld = rows.filter((r) => r.event === 'UNHELD');
  if (unheld.length) {
    die(`the walker made ${unheld.length} Agent call${unheld.length === 1 ? '' : 's'} the dispatch hold never `
      + `recorded (UNHELD in ${path.join(dir, worlds.ACTION_LOG)}):\n`
      + unheld.map((r) => `  - ${r.detail} [${r.outcome}] → ${r.output}`).join('\n')
      + '\nA dispatch that was not held may have run a real agent in this world. Check the '
      + '`Agent|Task` PreToolUse hook in .claude/agents/prose-walker.md (lib/hold-dispatch.cjs), '
      + 'that the agent registry has reloaded since it changed, and the held rows beside these. '
      + 'Do not judge this run.');
  }

  const dispatches = worlds.readDispatches(dir);
  const checks = invariants.format(invariants.check(rows, c.invariants, dispatches));
  const undeclared = invariants.undeclaredProse(rows, c.files.map((f) => f.path));
  const substitutions = c.stubs.length
    ? c.stubs.map((s) => {
      const stub = cases.readStub(s.name);
      return `- ${s.name} — fires ${s.trigger}\n  ${stub.description.replace(/\n/g, '\n  ')}`;
    }).join('\n')
    : null;
  const prompt = prompts.asserterPrompt({
    expected: c.assert, world, actions, checks, walk, substitutions,
    dispatches: formatDispatches(dispatches, dir),
    scope: undeclared.length ? undeclared.map((f) => `- ${f}`).join('\n') : null,
  });
  // The prompt carries the whole record and runs to 100 KB+ on a long walk
  // — far past what an orchestrating agent can relay verbatim into a
  // dispatch, and a cut record reaches the asserter as absence. So it lands
  // in the world as a file (excluded from the tree like the logs, lifted by
  // archive), and the orchestrator passes the path alone.
  const file = path.join(dir, worlds.ASSERT_PROMPT);
  fs.writeFileSync(file, prompt);
  process.stdout.write(`${JSON.stringify({ prompt_file: file, bytes: Buffer.byteLength(prompt), lines: prompt.split('\n').length })}\n`);
}

// --- stop (a finished walk whose stop hook never fired) -------------------

// Claude Code keeps every subagent's transcript beside its session's, so a
// walker's own record of how it ended outlives a stop hook that never ran.
function findTranscript(agentId) {
  const found = transcripts.findAgentTranscript(agentId);
  return found.file || die(found.error);
}

// The stop is replayed only from a turn the walker itself ended — the
// transcript's last assistant message closing on end_turn — and only into
// the world that transcript walked, so a walk still running is refused
// here exactly as assert refuses it.
function cmdStop(argv) {
  const c = getCase(argv[0]);
  const dir = requireWorld(argv, c);
  if (worlds.readActionRows(dir).some((r) => r.event === 'SubagentStop')) {
    die(`the walker's stop is already recorded in ${path.join(dir, worlds.ACTION_LOG)} — nothing to replay`);
  }
  const agent = flag(argv, '--agent');
  const transcript = flag(argv, '--transcript') || (agent ? findTranscript(agent)
    : die('stop needs the walker: --agent <id> or --transcript <file>'));
  const raw = fs.readFileSync(transcript, 'utf8');
  // The walker's prompt names its world before anything else it reads does.
  const walked = raw.match(/\/[^\s"'`\\]*\/prose-world-[A-Za-z0-9]+/);
  if (!walked || walked[0] !== path.resolve(dir)) die(`${transcript} is not a walk of ${dir}`);
  const last = raw.split('\n').filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter((e) => e && e.message && e.message.role === 'assistant').pop();
  if (!last || last.message.stop_reason !== 'end_turn') {
    die(`the walker has not stopped — the last turn in ${transcript} is not a finished one.\n`
      + 'Wait for the walker to finish, then run stop again.');
  }
  const { content } = last.message;
  const closing = Array.isArray(content)
    ? content.filter((b) => b.type === 'text').map((b) => b.text).join('\n')
    : String(content);
  execFileSync(process.execPath, [path.join(__dirname, 'lib', 'record-action.cjs')], {
    input: JSON.stringify({
      cwd: dir,
      hook_event_name: 'SubagentStop',
      agent_type: 'prose-walker',
      agent_transcript_path: transcript,
      last_assistant_message: closing,
    }),
  });
  if (!worlds.readActionRows(dir).some((r) => r.event === 'SubagentStop')) {
    die(`the recorder wrote no stop into ${path.join(dir, worlds.ACTION_LOG)}`);
  }
  process.stdout.write(`${JSON.stringify({ replayed: transcript })}\n`);
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

async function cmdVerify(argv) {
  const ids = argv[0] ? [getCase(argv[0]).id] : cases.listCaseIds();
  const jobs = ids.flatMap((id) => statesOf(cases.loadCase(id)).map((which) => ({ caseId: id, which })));
  let failed = false;
  for (const { caseId: id, which, result: d } of await verifyAll(jobs)) {
    if (d.skipped) {
      process.stdout.write(`${id}/${which}: unchanged since it last rebuilt clean here\n`);
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
  process.exit(failed ? 1 : 0);
}

/**
 * What a case's world is judged against, for the listings.
 * @param {{hasAssertionState: boolean, worldMode: string|null}} c
 * @param {string} unchanged
 */
function expectedWorld(c, unchanged) {
  if (c.hasAssertionState) return 'assertion state';
  return c.worldMode === 'claims' ? 'the stated claims' : unchanged;
}

// --- list -----------------------------------------------------------------

function cmdList() {
  const all = cases.loadAllCases();
  const errors = cases.validateCorpus(all);
  for (const c of all) {
    const stubs = c.stubs.length ? `  stubs=${c.stubs.map((s) => s.name).join(',')}` : '';
    const expects = expectedWorld(c, 'no change');
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
  diff: cmdDiff, assert: cmdAssert, stop: cmdStop, snap: cmdSnap, verify: cmdVerify,
  destroy: cmdDestroy, archive: cmdArchive,
};
if (!commands[command]) {
  die('usage: run.cjs <list|select|world|prompt|diff|assert|stop|snap|verify|archive|destroy> …');
}
// `verify` fans its rebuilds out over threads, so a command may answer a
// promise; a rejection is the same failure a synchronous throw was.
Promise.resolve(commands[command](rest)).catch((e) => die(e.stack || String(e)));

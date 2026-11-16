'use strict';

// The live run of GitHub's landing driver (7.3.7): the landing world driven
// through the `land` verbs against a real, empty scratch repository on
// GitHub, with the real gh, its stack extension and the person's own login.
// It runs only on the person's word, which is the repository named on the
// command line; without it, it refuses and touches nothing. No gate runs
// it: it is no suite, and no script names it.
//
//   node tests/drivers/github/live-run.cjs <owner>/<repo> [<owner>/<nested-repo>] [--unit <owner>/<unit-repo>]
//
// Each repository named must exist and hold no branch. The run pushes the
// world's code there, sets the repository's squash default as setup's yes
// does (`github-squash`), then lands three phases: a stack of three tasks
// merged whole, a fix phase of one task, and a fix phase built on it, landed
// at finish. Given a second repository, it then nests that one as the clone
// `ext`, which the project ignores, its code pushed there and its squash
// default set by setup's yes again, which sets it on every repository nested
// since, and lands two phases more across both (7.2.17): a stack of two
// tasks in both, the lower first, and a fix phase of two built on it, the
// first in the project alone and the second in both again, landed at finish.
// It then reads what each default branch gained and checks each commit
// against 7.2.18 — its subject the task's landing subject with GitHub's "
// (#N)", its body naming the task's id on a line of its own — each pull
// request merged. Given a repository for a unit's own branch (`--unit`), it
// lands a unit of a cut of five phases there too: its first phase start's
// close making `feat/pay` on GitHub (7.2.34), phase 1's stack linked onto
// that branch and merged into it, never retargeted onto GitHub's default,
// then finish landing phase 2 on it and the branch on main through the
// unit's pull request, by a merge commit (7.2.38) — and checks that branch
// gained each task as 7.2.18 names it, every task's pull request based off
// main, and main's first-parent line one commit, `Merge feat/pay (#N)`
// described by the phases, its history holding the branch's. Everything it
// made stays on GitHub to be looked at; the local copies go at exit. It runs
// as the person on GitHub: their gh login, which the harness's hermetic
// environment pins away, is taken before the harness loads and given back to
// every call the run makes — its own gh, git's credential helper, and the
// engine's.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const REPOSITORY = /^[\w.-]+\/[\w.-]+$/;
const argv = process.argv.slice(2);
const flag = argv.indexOf('--unit');
const unitRepo = flag === -1 ? undefined : argv[flag + 1];
const [named, nested, ...extra] = flag === -1 ? argv : [...argv.slice(0, flag), ...argv.slice(flag + 2)];
const repositories = [named, nested, unitRepo].filter((repository) => repository !== undefined);
if (named === undefined || extra.length > 0 || (flag !== -1 && unitRepo === undefined) || !repositories.every((repository) => REPOSITORY.test(repository)) || new Set(repositories).size < repositories.length) {
  process.stderr.write('live-run: name the scratch repository on GitHub you created for this run, as <owner>/<repo>, for a nested clone a second one, as <owner>/<nested-repo>, and for a unit\'s own branch another, as --unit <owner>/<unit-repo> — nothing has been done\n');
  process.exit(2);
}

const LOGIN = ['GH_CONFIG_DIR', 'GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN', 'GH_HOST'];
const login = new Map(LOGIN.map((name) => [name, process.env[name]]));
const harness = require('../../scripts/engine-harness.cjs');
const { BASE, TASKS, openArgs, track, cutTask, commitFiles, mergeBack, buildLanding, setLandingDriver, finishReady, buildBegun, phaseReviewed } = require('../../scripts/landing-world.cjs');

for (const [name, value] of login) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

const { card, total, rounding, currency } = TASKS;
const run = (/** @type {string} */ command, /** @type {string[]} */ args, /** @type {string} */ cwd) => execFileSync(command, args, { cwd, encoding: 'utf8' }).trim();
const { git } = harness;

/** A task's landing as 7.2.18 names it: its subject, and the task's id. @typedef {{subject: string, task: string}} Landing */

/**
 * What a branch gained past `from`, oldest first: each commit's subject and
 * body.
 * @param {string} dir @param {string} from @param {string} branch
 * @returns {{subject: string, body: string}[]}
 */
function gained(dir, from, branch) {
  return run('git', ['log', '--reverse', '--format=%x1e%s%x1f%b', `${from}..${branch}`], dir).split('\x1e').slice(1).map((entry) => {
    const [subject, body] = entry.split('\x1f');
    return { subject, body: body.trim() };
  });
}

/** A verb through the engine, its answer shown. @param {string} dir @param {string[]} args */
function land(dir, args) {
  process.stdout.write(`engine ${args.join(' ')}\n`);
  const answer = harness.ok(dir, args);
  process.stdout.write(`  ${JSON.stringify(answer)}\n`);
  return answer;
}

/** The squash default set as setup's yes sets it, on every repository the project at `dir` lands in, the run stopped where it is not. @param {string} dir */
function setSquash(dir) {
  if (land(dir, ['github-squash', 'yes']).github_squash === 'set') return;
  process.stderr.write('live-run: the squash default was not set — see the answer above\n');
  process.exit(1);
}

/** Stop the run where a repository named holds a branch already. @param {string} repository */
function refuseUnlessEmpty(repository) {
  const branches = JSON.parse(run('gh', ['api', `repos/${repository}/branches`], os.tmpdir()));
  if (branches.length === 0) return;
  process.stderr.write(`live-run: ${repository} holds branches already (${branches.map((/** @type {{name: string}} */ b) => b.name).join(', ')}) — create an empty one for the run\n`);
  process.exit(2);
}

/**
 * The repository at `dir` put on GitHub as `repository`: its origin there,
 * reached through the person's gh login, `pushed` pushed, and origin's HEAD
 * naming main.
 * @param {string} dir @param {string} repository @param {string[]} pushed
 */
function onGithub(dir, repository, pushed) {
  git(dir, ['config', 'credential.https://github.com.helper', '!gh auth git-credential']);
  git(dir, ['remote', 'add', 'origin', `https://github.com/${repository}.git`]);
  git(dir, ['push', '-q', '--tags', 'origin', ...pushed]);
  git(dir, ['fetch', '-q', 'origin']);
  git(dir, ['remote', 'set-head', 'origin', 'main']);
}

/**
 * What a repository's branch on GitHub, its default unless given, gained
 * past `from` against the landings `expected`, and its pull requests not
 * merged: each a fault.
 * @param {string} dir @param {string} repository @param {string} from @param {Landing[]} expected @param {string} [branch]
 * @returns {string[]}
 */
function faultsIn(dir, repository, from, expected, branch = 'main') {
  git(dir, ['fetch', '-q', 'origin']);
  const landed = gained(dir, from, `origin/${branch}`);
  const pulls = JSON.parse(run('gh', ['pr', 'list', '--repo', repository, '--state', 'all', '--json', 'number,state,headRefName,baseRefName'], dir));
  process.stdout.write(`\n${repository}'s ${branch} gained, oldest first:\n${landed.map((c) => `  ${c.subject}\n${c.body.replace(/^/gm, '    ')}`).join('\n')}\n`);
  process.stdout.write(`its pull requests:\n${pulls.map((/** @type {any} */ p) => `  #${p.number} ${p.state} ${p.headRefName} -> ${p.baseRefName}`).join('\n')}\n`);
  return [
    ...(landed.length === expected.length ? [] : [`${repository}'s ${branch} gained ${landed.length} commits, not ${expected.length}`]),
    ...expected.flatMap((want, i) => {
      const commit = landed[i];
      const subject = /^(.*) \(#\d+\)$/.exec(commit?.subject ?? '')?.[1] === want.subject;
      const task = commit?.body.split('\n').includes(`Task: ${want.task}`) === true;
      return subject && task ? [] : [`${repository}'s commit ${i + 1} is "${commit?.subject}", not "${want.subject} (#N)" with "Task: ${want.task}" in its body`];
    }),
    ...pulls.filter((/** @type {any} */ p) => p.state !== 'MERGED').map((/** @type {any} */ p) => `${repository}'s #${p.number} is ${p.state}`),
  ];
}

/**
 * The project's phases 4 and 5 landed across it and the clone `ext` it
 * nests and ignores, put on GitHub as `repository`: the faults the
 * landing shows.
 * @param {string} dir @param {string} repository
 * @returns {string[]}
 */
function landNested(dir, repository) {
  const ext = harness.initRepo(path.join(dir, 'ext'));
  fs.writeFileSync(path.join(ext, 'ext.txt'), 'ext\n');
  git(ext, ['add', 'ext.txt']);
  git(ext, ['commit', '-q', '-m', 'the ext']);
  git(ext, ['tag', BASE]);
  onGithub(ext, repository, ['refs/heads/main:refs/heads/main']);
  fs.appendFileSync(path.join(dir, '.git', 'info', 'exclude'), '/ext/\n');
  setSquash(dir);
  const added = git(dir, ['rev-parse', 'main']).trim();

  /** A task cut in both repositories, from `from`, a change in each. @param {string} shown @param {string} type @param {string} title @param {string} from */
  const across = (shown, type, title, from) => {
    const task = track(dir, shown, type, title);
    const slug = task.branch.split('-').slice(2).join('-');
    commitFiles(ext, task.branch, from, { [`ext-${slug}.txt`]: `${slug}\n` });
    commitFiles(dir, task.branch, from, { [`${slug}.txt`]: `${slug}\n` });
    return task;
  };
  const rates = across('4.1', 'feat', 'Add ext rates', 'main');
  const shown = across('4.2', 'feat', 'Show ext rates', rates.branch);
  const alone = cutTask(dir, '5.1', 'fix', 'Fix the rates page', shown.branch, { 'rates-page.txt': 'page\n' });
  const fix = track(dir, '5.2', 'fix', 'Fix ext rates');
  commitFiles(ext, fix.branch, shown.branch, { 'ext-fix-ext-rates.txt': 'fix\n' });
  commitFiles(dir, fix.branch, alone.branch, { 'fix-ext-rates.txt': 'fix\n' });
  for (const task of [rates, shown]) land(dir, openArgs(task));
  land(dir, ['land', 'chain', 'pay', '4.2']);
  for (const task of [alone, fix]) land(dir, openArgs(task));
  land(dir, ['land', 'chain', 'pay', '5.2']);
  land(dir, ['land', 'phase', 'pay', '4']);
  land(dir, ['land', 'finish', 'pay']);

  const [addRates, showRates, leftAlone, fixRates] = [
    { subject: 'feat(pay): Add ext rates', task: 'pay-4-1' }, { subject: 'feat(pay): Show ext rates', task: 'pay-4-2' },
    { subject: 'fix(pay): Fix the rates page', task: 'pay-5-1' }, { subject: 'fix(pay): Fix ext rates', task: 'pay-5-2' },
  ];
  return [...faultsIn(dir, named, added, [addRates, showRates, leftAlone, fixRates]), ...faultsIn(ext, repository, BASE, [addRates, showRates, fixRates])];
}

/**
 * A unit of a cut of five phases landed on its own branch in a world of its
 * own put on GitHub as `repository`: the faults the landing shows.
 * @param {string} repository
 * @returns {string[]}
 */
function landOwnBranch(repository) {
  const at = harness.setupGitFixture('leeway-live-run-unit-');
  process.on('exit', () => harness.cleanupFixture(at));
  buildLanding(at);
  setLandingDriver(at, 'github');
  onGithub(at, repository, ['refs/heads/main:refs/heads/main', 'refs/heads/leeway-state:refs/heads/leeway-state']);
  setSquash(at);
  buildBegun(at, 5);
  land(at, ['checklist', 'done', 'phase-start', 'pay', '1', 'design-settled']);
  const branch = land(at, ['checklist', 'close', 'phase-start', 'pay', '1']).branch;
  land(at, openArgs(card));
  land(at, ['land', 'chain', 'pay', '1.1']);
  phaseReviewed(at, 1, 'auto');
  land(at, ['land', 'phase', 'pay', '1']);
  git(at, ['fetch', '-q', 'origin']);
  commitFiles(at, rounding.branch, `origin/${branch}`, rounding.files);
  land(at, openArgs(rounding));
  finishReady(at);
  land(at, ['land', 'finish', 'pay']);

  const [addCard, roundTotals] = [{ subject: 'feat(pay): Add card', task: 'pay-1-1' }, { subject: 'fix(pay): Round totals', task: 'pay-2-1' }];
  const line = run('git', ['log', '--first-parent', '--format=%x1e%s%x1f%b', `${BASE}..origin/main`], at).split('\x1e').slice(1);
  const pulls = JSON.parse(run('gh', ['pr', 'list', '--repo', repository, '--state', 'all', '--json', 'number,headRefName,baseRefName'], at));
  const merged = /^Merge feat\/pay \(#\d+\)\x1fPhase 1: Phase 1\nPhase 2: Phase 2\s*$/;
  return [
    ...faultsIn(at, repository, BASE, [addCard, roundTotals], branch),
    ...(line.length === 1 && merged.test(line[0]) ? [] : [`${repository}'s main gained ${line.length} commits on its first-parent line, not one merge commit "Merge ${branch} (#N)" described by its phases: ${JSON.stringify(line)}`]),
    ...(spawnSync('git', ['merge-base', '--is-ancestor', `origin/${branch}`, 'origin/main'], { cwd: at }).status === 0 ? [] : [`${repository}'s main lacks ${branch}'s tip, so its history lacks a task's squash`]),
    ...pulls.filter((/** @type {any} */ p) => p.headRefName !== branch && p.baseRefName === 'main').map((/** @type {any} */ p) => `${repository}'s #${p.number} of ${p.headRefName} is based on main, not off it`),
  ];
}

refuseUnlessEmpty(named);
if (nested !== undefined) refuseUnlessEmpty(nested);
if (unitRepo !== undefined) refuseUnlessEmpty(unitRepo);

const dir = harness.setupGitFixture('leeway-live-run-');
process.on('exit', () => harness.cleanupFixture(dir));
buildLanding(dir);
setLandingDriver(dir, 'github');
onGithub(dir, named, ['refs/heads/main:refs/heads/main', 'refs/heads/leeway-state:refs/heads/leeway-state']);
setSquash(dir);

land(dir, openArgs(card));
land(dir, ['land', 'chain', 'pay', '1.1']);
mergeBack(dir, total.branch, card.branch);
land(dir, openArgs(total));
land(dir, ['land', 'chain', 'pay', '1.2']);
const tax = cutTask(dir, '1.4', 'feat', 'Add tax', total.branch, { 'tax.txt': 'tax\n' });
land(dir, openArgs(tax));
land(dir, ['land', 'chain', 'pay', '1.4']);
land(dir, openArgs(rounding));
land(dir, openArgs(currency));
land(dir, ['land', 'phase', 'pay', '1']);
finishReady(dir);
land(dir, ['land', 'finish', 'pay']);

const faults = faultsIn(dir, named, BASE, [
  { subject: 'feat(pay): Add card', task: 'pay-1-1' }, { subject: 'feat(pay): Show total', task: 'pay-1-2' }, { subject: 'feat(pay): Add tax', task: 'pay-1-4' },
  { subject: 'fix(pay): Round totals', task: 'pay-2-1' }, { subject: 'fix(pay): Name the currency', task: 'pay-3-1' },
]);
if (nested !== undefined) faults.push(...landNested(dir, nested));
if (unitRepo !== undefined) faults.push(...landOwnBranch(unitRepo));
process.stdout.write(faults.length === 0 ? '\nlive-run: every task landed as 7.2.18 names it\n' : `\nlive-run: ${faults.length} differences from 7.2.18:\n${faults.map((f) => `  ${f}`).join('\n')}\n`);
process.exitCode = faults.length === 0 ? 0 : 1;

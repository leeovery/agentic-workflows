'use strict';

// The live run of GitHub's landing driver (7.3.7): the landing world driven
// through the `land` verbs against a real, empty scratch repository on
// GitHub, with the real gh, its stack extension and the person's own login.
// It runs only on the person's word, which is the repository named on the
// command line; without it, it refuses and touches nothing. No gate runs
// it: it is no suite, and no script names it.
//
//   node tests/drivers/github/live-run.cjs <owner>/<repo> [<owner>/<sub-repo>]
//
// Each repository named must exist and hold no branch. The run pushes the
// world's code there, sets the repository's squash default as setup's yes
// does (`github-squash`), then lands three phases: a stack of three tasks
// merged whole, a fix phase of one task, and a fix phase built on it,
// landed at finish. Given a second repository, it then adds that one as
// the submodule `ext`, its code pushed there and its squash default set,
// and lands two phases more across both (7.2.17): a stack of two tasks,
// each moving the submodule's pointer, the lower first, and a fix phase of
// two built on it, the first leaving the pointer alone and the second
// moving it again, landed at finish — so GitHub squashes a stack brought
// up to date with its default branch, the stand-in's model of which the
// suites rest on. It then reads
// what each default branch gained and checks each commit against 7.2.18 —
// its subject the task's landing subject with GitHub's " (#N)", its body
// naming the task's id on a line of its own — each pull request merged,
// and, given the submodule, that the project's default branch points it at
// a commit on the submodule's. Everything it made stays on GitHub to be
// looked at; the local copy goes at exit. It runs as the person on GitHub:
// their gh login, which the harness's hermetic environment pins away, is
// taken before the harness loads and given back to every call the run
// makes — its own gh, git's credential helper, and the engine's.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const REPOSITORY = /^[\w.-]+\/[\w.-]+$/;
const [named, sub, ...extra] = process.argv.slice(2);
if (named === undefined || extra.length > 0 || ![named, sub ?? named].every((repository) => REPOSITORY.test(repository)) || sub === named) {
  process.stderr.write('live-run: name the scratch repository on GitHub you created for this run, as <owner>/<repo>, and, for a submodule, a second one, as <owner>/<sub-repo> — nothing has been done\n');
  process.exit(2);
}

const LOGIN = ['GH_CONFIG_DIR', 'GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN', 'GH_HOST'];
const login = new Map(LOGIN.map((name) => [name, process.env[name]]));
const harness = require('../../scripts/engine-harness.cjs');
const { BASE, TASKS, openArgs, track, cutTask, commitFiles, mergeBack, buildLanding, setLandingDriver } = require('../../scripts/landing-world.cjs');

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
 * What a repository's default branch on GitHub gained past `from` against
 * the landings `expected`, and its pull requests not merged: each a fault.
 * @param {string} dir @param {string} repository @param {string} from @param {Landing[]} expected
 * @returns {string[]}
 */
function faultsIn(dir, repository, from, expected) {
  git(dir, ['fetch', '-q', 'origin']);
  const landed = gained(dir, from, 'origin/main');
  const pulls = JSON.parse(run('gh', ['pr', 'list', '--repo', repository, '--state', 'all', '--json', 'number,state,headRefName,baseRefName'], dir));
  process.stdout.write(`\n${repository}'s main gained, oldest first:\n${landed.map((c) => `  ${c.subject}\n${c.body.replace(/^/gm, '    ')}`).join('\n')}\n`);
  process.stdout.write(`its pull requests:\n${pulls.map((/** @type {any} */ p) => `  #${p.number} ${p.state} ${p.headRefName} -> ${p.baseRefName}`).join('\n')}\n`);
  return [
    ...(landed.length === expected.length ? [] : [`${repository}'s main gained ${landed.length} commits, not ${expected.length}`]),
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
 * The project's phases 4 and 5 landed across it and the submodule `ext`,
 * put on GitHub as `repository` and added on the project's main, pushed:
 * the faults the landing shows.
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
  run('gh', ['api', '--method', 'PATCH', `repos/${repository}`, '-f', 'squash_merge_commit_title=PR_TITLE', '-f', 'squash_merge_commit_message=PR_BODY'], os.tmpdir());
  git(dir, ['submodule', 'add', '-q', `https://github.com/${repository}.git`, 'ext']);
  git(dir, ['commit', '-q', '-m', 'chore: add ext']);
  git(dir, ['push', '-q', 'origin', 'main']);
  const added = git(dir, ['rev-parse', 'main']).trim();

  /** A task cut in both repositories, from `from`, the project's moving the pointer to its change in ext. @param {string} shown @param {string} type @param {string} title @param {string} from */
  const across = (shown, type, title, from) => {
    const task = track(dir, shown, type, title);
    const slug = task.branch.split('-').slice(2).join('-');
    const moved = commitFiles(ext, task.branch, from, { [`ext-${slug}.txt`]: `${slug}\n` });
    commitFiles(dir, task.branch, from, { [`${slug}.txt`]: `${slug}\n` }, { gitlinks: { ext: moved } });
    return task;
  };
  const rates = across('4.1', 'feat', 'Add ext rates', 'main');
  const shown = across('4.2', 'feat', 'Show ext rates', rates.branch);
  const alone = cutTask(dir, '5.1', 'fix', 'Fix the rates page', shown.branch, { 'rates-page.txt': 'page\n' });
  const fix = track(dir, '5.2', 'fix', 'Fix ext rates');
  const moved = commitFiles(ext, fix.branch, shown.branch, { 'ext-fix-ext-rates.txt': 'fix\n' });
  commitFiles(dir, fix.branch, alone.branch, { 'fix-ext-rates.txt': 'fix\n' }, { gitlinks: { ext: moved } });
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
  const faults = [...faultsIn(dir, named, added, [addRates, showRates, leftAlone, fixRates]), ...faultsIn(ext, repository, BASE, [addRates, showRates, fixRates])];
  const pointer = git(dir, ['rev-parse', 'origin/main:ext']).trim();
  const onSub = spawnSync('git', ['merge-base', '--is-ancestor', pointer, 'origin/main'], { cwd: ext }).status === 0;
  return [...faults, ...(onSub ? [] : [`${named}'s main points ext at ${pointer.slice(0, 7)}, a commit ${repository}'s main lacks`])];
}

refuseUnlessEmpty(named);
if (sub !== undefined) refuseUnlessEmpty(sub);

const dir = harness.setupGitFixture('leeway-live-run-');
process.on('exit', () => harness.cleanupFixture(dir));
buildLanding(dir);
setLandingDriver(dir, 'github');
onGithub(dir, named, ['refs/heads/main:refs/heads/main', 'refs/heads/leeway-state:refs/heads/leeway-state']);
if (land(dir, ['github-squash', 'yes']).github_squash !== 'set') {
  process.stderr.write(`live-run: ${named}'s squash default was not set — see the answer above\n`);
  process.exit(1);
}

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
land(dir, ['land', 'finish', 'pay']);

const faults = faultsIn(dir, named, BASE, [
  { subject: 'feat(pay): Add card', task: 'pay-1-1' }, { subject: 'feat(pay): Show total', task: 'pay-1-2' }, { subject: 'feat(pay): Add tax', task: 'pay-1-4' },
  { subject: 'fix(pay): Round totals', task: 'pay-2-1' }, { subject: 'fix(pay): Name the currency', task: 'pay-3-1' },
]);
if (sub !== undefined) faults.push(...landNested(dir, sub));
process.stdout.write(faults.length === 0 ? '\nlive-run: every task landed as 7.2.18 names it\n' : `\nlive-run: ${faults.length} differences from 7.2.18:\n${faults.map((f) => `  ${f}`).join('\n')}\n`);
process.exitCode = faults.length === 0 ? 0 : 1;

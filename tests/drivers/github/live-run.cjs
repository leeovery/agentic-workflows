'use strict';

// The live run of GitHub's landing driver (7.3.7): the landing world driven
// through the `land` verbs against a real, empty scratch repository on
// GitHub, with the real gh, its stack extension and the person's own login.
// It runs only on the person's word, which is the repository named on the
// command line; without it, it refuses and touches nothing. No gate runs
// it: it is no suite, and no script names it.
//
//   node tests/drivers/github/live-run.cjs <owner>/<repo>
//
// The repository must exist and hold no branch. The run pushes the world's
// code there, sets the repository's squash default as setup's yes does
// (`github-squash`), then lands three phases: a stack of three tasks merged
// whole, a fix phase of one task, and a fix phase built on it, landed at
// finish. It then reads what GitHub's default branch gained and checks each
// commit against 7.2.18 — its subject the task's landing subject with
// GitHub's " (#N)", its body naming the task's id on a line of its own — and
// each pull request merged. Everything it made stays on GitHub to be looked
// at; the local copy goes at exit. It runs as the person on GitHub: their
// gh login, which the harness's hermetic environment pins away, is taken
// before the harness loads and given back to every call the run makes —
// its own gh, git's credential helper, and the engine's.

const os = require('os');
const { execFileSync } = require('child_process');

const REPOSITORY = /^[\w.-]+\/[\w.-]+$/;
const [named, ...extra] = process.argv.slice(2);
if (named === undefined || extra.length > 0 || !REPOSITORY.test(named)) {
  process.stderr.write('live-run: name the scratch repository on GitHub you created for this run, as <owner>/<repo> — nothing has been done\n');
  process.exit(2);
}

const LOGIN = ['GH_CONFIG_DIR', 'GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN', 'GH_HOST'];
const login = new Map(LOGIN.map((name) => [name, process.env[name]]));
const harness = require('../../scripts/engine-harness.cjs');
const { BASE, TASKS, openArgs, cutTask, mergeBack, buildLanding, setLandingDriver } = require('../../scripts/landing-world.cjs');

for (const [name, value] of login) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

const { card, total, rounding, currency } = TASKS;
const run = (/** @type {string} */ command, /** @type {string[]} */ args, /** @type {string} */ cwd) => execFileSync(command, args, { cwd, encoding: 'utf8' }).trim();

/**
 * What a branch gained past the base, oldest first: each commit's subject
 * and body.
 * @param {string} dir @param {string} branch
 * @returns {{subject: string, body: string}[]}
 */
function gained(dir, branch) {
  return run('git', ['log', '--reverse', '--format=%x1e%s%x1f%b', `${BASE}..${branch}`], dir).split('\x1e').slice(1).map((entry) => {
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

const branches = JSON.parse(run('gh', ['api', `repos/${named}/branches`], os.tmpdir()));
if (branches.length > 0) {
  process.stderr.write(`live-run: ${named} holds branches already (${branches.map((/** @type {{name: string}} */ b) => b.name).join(', ')}) — create an empty one for the run\n`);
  process.exit(2);
}

const dir = harness.setupGitFixture('leeway-live-run-');
process.on('exit', () => harness.cleanupFixture(dir));
buildLanding(dir);
setLandingDriver(dir, 'github');
harness.git(dir, ['config', 'credential.https://github.com.helper', '!gh auth git-credential']);
harness.git(dir, ['remote', 'add', 'origin', `https://github.com/${named}.git`]);
harness.git(dir, ['push', '-q', '--tags', 'origin', 'refs/heads/main:refs/heads/main', 'refs/heads/leeway-state:refs/heads/leeway-state']);
harness.git(dir, ['fetch', '-q', 'origin']);
harness.git(dir, ['remote', 'set-head', 'origin', 'main']);
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

harness.git(dir, ['fetch', '-q', 'origin']);
const landed = gained(dir, 'origin/main');
const expected = [
  { subject: 'feat(pay): Add card', task: 'pay-1-1' }, { subject: 'feat(pay): Show total', task: 'pay-1-2' }, { subject: 'feat(pay): Add tax', task: 'pay-1-4' },
  { subject: 'fix(pay): Round totals', task: 'pay-2-1' }, { subject: 'fix(pay): Name the currency', task: 'pay-3-1' },
];
const pulls = JSON.parse(run('gh', ['pr', 'list', '--repo', named, '--state', 'all', '--json', 'number,state,headRefName,baseRefName'], dir));
process.stdout.write(`\n${named}'s main gained, oldest first:\n${landed.map((c) => `  ${c.subject}\n${c.body.replace(/^/gm, '    ')}`).join('\n')}\n`);
process.stdout.write(`its pull requests:\n${pulls.map((/** @type {any} */ p) => `  #${p.number} ${p.state} ${p.headRefName} -> ${p.baseRefName}`).join('\n')}\n`);
const faults = [
  ...(landed.length === expected.length ? [] : [`main gained ${landed.length} commits, not ${expected.length}`]),
  ...expected.flatMap((want, i) => {
    const commit = landed[i];
    const subject = /^(.*) \(#\d+\)$/.exec(commit?.subject ?? '')?.[1] === want.subject;
    const task = commit?.body.split('\n').includes(`Task: ${want.task}`) === true;
    return subject && task ? [] : [`commit ${i + 1} is "${commit?.subject}", not "${want.subject} (#N)" with "Task: ${want.task}" in its body`];
  }),
  ...pulls.filter((/** @type {any} */ p) => p.state !== 'MERGED').map((/** @type {any} */ p) => `#${p.number} is ${p.state}`),
];
process.stdout.write(faults.length === 0 ? '\nlive-run: every task landed as 7.2.18 names it\n' : `\nlive-run: ${faults.length} differences from 7.2.18:\n${faults.map((f) => `  ${f}`).join('\n')}\n`);
process.exitCode = faults.length === 0 ? 0 : 1;

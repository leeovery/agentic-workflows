'use strict';

// ---------------------------------------------------------------------------
// What boot offers to set on GitHub (workflow-engine/scripts/domain/
// github-setup.cjs): the GitHub rule, on a GitHub remote whatever the
// landing setting, and the squash default where the project lands through
// GitHub; each drawn as its gate, never made again once answered, not even
// to a fresh clone; failing closed; and nothing offered beyond GitHub. What
// an answer sets through gh is tests/drivers/github/test-setup.cjs's.
//
// Layer: git. World: real repositories in a temp folder per test, a bare
// repository as the remote and clones of it; boot runs from a copy of the
// engine beside a stand-in migration runner, so the state checks are what
// each test exercises (boot-state-world.cjs).
// A remote on GitHub is a bare repository reached through a stand-in ssh,
// its URL rewritten to a port ssh refuses so nothing it misses reaches
// github.com.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const harness = require('./engine-harness.cjs');
const { announced, auditGate } = require('./gate-audit.cjs');
const { git, githubOffline, tip, remoteTip } = harness;

const SCRIPTS = path.dirname(harness.ENGINE);
const { STATE_BRANCH } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { hostDriver } = require(path.join(SCRIPTS, 'domain/drivers.cjs'));

const { createFile } = require('./discovery-test-utils.cjs');
const { useWorld, engine, codeProject, cloneOf, boot, setUp } = require('./boot-state-world.cjs');

const world = useWorld();

// --- what boot offers on GitHub ------------------------------------------------------

/**
 * A remote on GitHub, `git@github.com:acme/portal.git`, served by a bare
 * repository through a stand-in ssh. Nothing leaves the machine, and it fails
 * closed: the URL is rewritten to GitHub on a port ssh refuses
 * (`githubOffline`), so a git call the stand-in misses never reaches
 * github.com.
 * @returns {{url: string, bare: string, env: Record<string, string>}}
 */
function fakeGithub() {
  const served = path.join(world(), 'github');
  const bare = path.join(served, 'acme', 'portal.git');
  fs.mkdirSync(path.dirname(bare), { recursive: true });
  harness.bareRepo(bare);
  const ssh = path.join(world(), 'fake-ssh');
  createFile(world(), 'fake-ssh', [
    '#!/bin/sh',
    'for last; do :; done',
    'service=${last%% *}',
    "repo=${last#* }; repo=${repo#\\'}; repo=${repo%\\'}",
    `exec git "\${service#git-}" "${served}/\${repo#/}"`,
    '',
  ].join('\n'));
  fs.chmodSync(ssh, 0o755);
  return { url: 'git@github.com:acme/portal.git', bare, env: { ...githubOffline(world()), GIT_SSH_COMMAND: ssh, GIT_SSH_VARIANT: 'ssh' } };
}

describe('what boot offers on GitHub (4.4.6, 4.S10, 4.S30, 7.2.18)', () => {
  /** @type {ReturnType<typeof fakeGithub>} */
  let github;
  /** @type {Record<string, string|undefined>} */
  let was;
  beforeEach(() => {
    github = fakeGithub();
    was = Object.fromEntries(Object.keys(github.env).map((name) => [name, process.env[name]]));
    Object.assign(process.env, github.env);
  });
  afterEach(() => {
    for (const [name, value] of Object.entries(was)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it('setup on a GitHub remote offers the rule and, landing through GitHub, the squash default — the state gone to GitHub first', () => {
    const main = codeProject({ remote: github.url });

    const res = boot(main);

    assert.deepStrictEqual([res.state, res.github_rule_offer, res.github_squash_offer], ['ready', true, true]);
    assert.strictEqual(remoteTip(github.bare), tip(main, STATE_BRANCH), 'the state went to GitHub');
  });

  it('the rule is offered whatever the landing setting, and the squash default only where the project lands through GitHub', () => {
    const main = codeProject({ remote: github.url });
    boot(main);
    const project = path.join(main, '.leeway', 'manifest.json');
    fs.writeFileSync(project, JSON.stringify({ ...JSON.parse(fs.readFileSync(project, 'utf8')), drivers: { landing: 'local' } }, null, 2));
    harness.commitAll(main, 'land locally');

    const res = boot(main);

    assert.deepStrictEqual([res.github_rule_offer, res.github_squash_offer], [true, false]);
  });

  it('fails closed: the remote reads as GitHub on a port ssh refuses, so a git call the stand-in misses never reaches github.com', () => {
    const main = codeProject();
    git(main, ['remote', 'add', 'origin', github.url]);

    assert.strictEqual(git(main, ['remote', 'get-url', 'origin']).trim(), 'ssh://git@github.com:0/acme/portal.git');
    assert.notStrictEqual(hostDriver(git(main, ['remote', 'get-url', 'origin'])), null, 'the code host\'s driver serves it');

    const { GIT_SSH_COMMAND, GIT_SSH_VARIANT, ...unstubbed } = process.env;
    const missed = spawnSync('git', ['ls-remote', 'origin'], { cwd: main, encoding: 'utf8', env: unstubbed, timeout: 10000 });
    assert.notStrictEqual(missed.status, 0);
    assert.match(missed.stderr, /Bad port '0'/);
  });

  it('draws the offer: the rule and what it refuses, set on yes, left unset on no', () => {
    const main = codeProject({ remote: github.url });
    boot(main);

    const out = engine.output(main, ['render', 'github-rule-gate']);

    assert.strictEqual(out, [
      '=== MENU: github rule gate (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      'Portal\'s remote is on GitHub. A rule there can refuse deleting or force-pushing `leeway-state` for anything run outside Claude Code; inside it, Leeway already refuses both.',
      '',
      '**`◆ Set that rule on GitHub?`**',
      '',
      '**`y/yes`** → Set it on Portal\'s repository',
      '**`n/no`**  → Leave it unset — *setup carries on without it*',
      '',
    ].join('\n'));
    const gate = announced(() => auditGate(engine.output(main, ['render', 'github-rule-gate']), 'github rule gate'));
    assert.strictEqual(gate.question, 'Set that rule on GitHub?');
    assert.deepStrictEqual(gate.options.map((o) => o.key), ['y', 'n']);
  });

  it('draws the squash default\'s offer: what it makes each task land under, set on yes, left on no', () => {
    const main = codeProject({ remote: github.url });
    boot(main);

    const out = engine.output(main, ['render', 'github-squash-gate']);

    assert.strictEqual(out, [
      '=== MENU: github squash gate (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      'Portal lands each task on GitHub as a pull request squashed into one commit. Made from the pull request\'s title and description, that commit carries the task\'s subject and id; until the repository squashes so, Leeway won\'t merge a phase\'s stack.',
      '',
      '**`◆ Squash from the pull request\'s title and description?`**',
      '',
      '**`y/yes`** → Set it on Portal\'s repository',
      '**`n/no`**  → Leave it as it is — *set it later by hand*',
      '',
    ].join('\n'));
    const gate = announced(() => auditGate(engine.output(main, ['render', 'github-squash-gate']), 'github squash gate'));
    assert.strictEqual(gate.question, 'Squash from the pull request\'s title and description?');
    assert.deepStrictEqual(gate.options.map((o) => o.key), ['y', 'n']);
  });

  it('a fresh clone of a project whose offers were answered is never offered them', () => {
    const main = codeProject({ remote: github.url });
    boot(main);
    engine.ok(main, ['github-rule', 'no']);
    engine.ok(main, ['github-squash', 'no']);
    git(main, ['push', '-q', 'origin', 'main']);
    const fresh = cloneOf(github.url, 'fresh');

    const res = boot(fresh);

    assert.deepStrictEqual([res.state, res.github_rule_offer, res.github_squash_offer], ['ready', false, false]);
  });
});

describe('beyond GitHub', () => {
  it('a remote that is not on GitHub is offered nothing, and a yes there is refused', () => {
    const bare = harness.bareRepo(path.join(world(), 'portal.git'));
    const { main } = setUp({ remote: bare });

    const res = boot(main);

    assert.deepStrictEqual([res.github_rule_offer, res.github_squash_offer], [false, false]);
    assert.match(engine.refuses(main, ['github-rule', 'yes']).error, /the state's remote is not on GitHub — there is no repository to set the rule on/);
    assert.match(engine.refuses(main, ['github-squash', 'yes']).error, /the project does not land through GitHub — there is no repository to set the squash default on/);
  });
});

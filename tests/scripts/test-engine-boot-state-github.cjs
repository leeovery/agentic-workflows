'use strict';

// ---------------------------------------------------------------------------
// The GitHub rule (workflow-engine/scripts/domain/github-rule.cjs): offered
// at setup on a GitHub remote and set through gh on yes, recorded once;
// failing closed; nothing offered beyond GitHub; and a GitHub repository
// read off every form of a remote URL.
//
// Layer: git. World: real repositories in a temp folder per test, a bare
// repository as the remote and clones of it; boot runs from a copy of the
// engine beside a stand-in migration runner, so the state checks are what
// each test exercises (boot-state-world.cjs).
// A remote on GitHub is a bare repository reached through a stand-in ssh,
// its URL rewritten to a port ssh refuses so nothing it misses reaches
// github.com; `gh` is a stand-in on PATH.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const harness = require('./engine-harness.cjs');
const { announced, auditGate } = require('./gate-audit.cjs');
const { git, githubOffline, tip, remoteTip } = harness;

const SCRIPTS = path.dirname(harness.ENGINE);
const { STATE_BRANCH } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { RULESET } = require(path.join(SCRIPTS, 'domain/github-rule.cjs'));
const { githubRepository } = require(path.join(SCRIPTS, 'domain/remote.cjs'));

const { createFile } = require('./discovery-test-utils.cjs');
const { useWorld, engine, codeProject, cloneOf, boot, setUp } = require('./boot-state-world.cjs');

const world = useWorld();

// --- the GitHub rule ---------------------------------------------------------------

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

/**
 * A stand-in `gh` first on PATH: every call logged, its input kept. It is
 * signed in, and sets what it is asked to, unless told otherwise.
 * @param {{signedOut?: boolean, refuses?: boolean}} [opts]
 */
function ghStub({ signedOut = false, refuses = false } = {}) {
  const bin = fs.mkdtempSync(path.join(world(), 'gh-'));
  const log = path.join(bin, 'calls');
  const input = path.join(bin, 'input');
  createFile(bin, 'gh', [
    '#!/bin/sh',
    `printf '%s\\n' "$*" >> "${log}"`,
    'case "$1" in',
    `  auth) ${signedOut ? 'echo "You are not logged into any GitHub hosts." >&2; exit 1' : 'exit 0'} ;;`,
    `  api) cat > "${input}"; ${refuses ? 'echo "HTTP 403: Resource not accessible by integration" >&2; exit 1' : 'echo "{}"; exit 0'} ;;`,
    'esac',
    'exit 2',
    '',
  ].join('\n'));
  fs.chmodSync(path.join(bin, 'gh'), 0o755);
  return {
    PATH: `${bin}:${process.env.PATH}`,
    calls: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : []),
    input: () => JSON.parse(fs.readFileSync(input, 'utf8')),
  };
}

/** The project manifest as the state branch holds it. @param {string} main */
function committedManifest(main) {
  return JSON.parse(git(main, ['show', `${STATE_BRANCH}:manifest.json`]));
}

describe('the GitHub rule (4.4.6, 4.S10, 4.S30)', () => {
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

  it('setup on a GitHub remote offers the rule, and sets nothing until the yes — which sets it through gh, recorded so the offer is never made again', () => {
    const gh = ghStub();
    const main = codeProject({ remote: github.url });

    const res = boot(main, { PATH: gh.PATH });

    assert.deepStrictEqual([res.state, res.github_rule_offer], ['ready', true]);
    assert.strictEqual(remoteTip(github.bare), tip(main, STATE_BRANCH), 'the state went to GitHub');
    assert.deepStrictEqual(gh.calls(), [], 'boot set nothing');

    const out = engine.ok(main, ['github-rule', 'yes'], { env: { PATH: gh.PATH } });

    assert.deepStrictEqual(gh.calls(), ['auth status --hostname github.com', 'api --method POST repos/acme/portal/rulesets --input -']);
    assert.deepStrictEqual(gh.input(), {
      name: 'leeway-state', target: 'branch', enforcement: 'active',
      conditions: { ref_name: { include: ['refs/heads/leeway-state'], exclude: [] } },
      rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }],
    });
    assert.deepStrictEqual(gh.input(), RULESET);
    assert.deepStrictEqual([out.github_rule, out.reason, out.warnings], ['set', undefined, undefined]);
    assert.strictEqual(out.committed, git(main, ['rev-parse', '--short', STATE_BRANCH]).trim());
    assert.strictEqual(git(main, ['log', '-1', '--format=%s', STATE_BRANCH]).trim(), 'chore: the GitHub rule on leeway-state set');
    assert.deepStrictEqual(committedManifest(main).github_rule, { status: 'set' });
    assert.strictEqual(boot(main, { PATH: gh.PATH }).github_rule_offer, false);
  });

  it('fails closed: the remote reads as GitHub on a port ssh refuses, so a git call the stand-in misses never reaches github.com', () => {
    const main = codeProject();
    git(main, ['remote', 'add', 'origin', github.url]);

    assert.strictEqual(git(main, ['remote', 'get-url', 'origin']).trim(), 'ssh://git@github.com:0/acme/portal.git');
    assert.deepStrictEqual(githubRepository(git(main, ['remote', 'get-url', 'origin'])), { owner: 'acme', repo: 'portal' });

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

  it('a no sets nothing, is recorded, and setup carries on', () => {
    const gh = ghStub();
    const main = codeProject({ remote: github.url });
    boot(main, { PATH: gh.PATH });

    const out = engine.ok(main, ['github-rule', 'no'], { env: { PATH: gh.PATH } });

    assert.deepStrictEqual([out.github_rule, out.reason], ['declined', undefined]);
    assert.deepStrictEqual(gh.calls(), []);
    assert.deepStrictEqual(committedManifest(main).github_rule, { status: 'declined' });
    const next = boot(main, { PATH: gh.PATH });
    assert.deepStrictEqual([next.state, next.github_rule_offer], ['ready', false]);
  });

  for (const [why, setUpGh, reason] of /** @type {const} */ ([
    ['gh is missing', 'missing', 'gh is not installed'],
    ['gh is not signed in', { signedOut: true }, 'gh is not signed in to github.com'],
    ['gh is refused', { refuses: true }, 'gh refused it: HTTP 403: Resource not accessible by integration'],
  ])) {
    it(`a yes where ${why} says so and carries on, recorded as failed with why, never offered again`, () => {
      const main = codeProject({ remote: github.url });
      boot(main);
      let PATH;
      if (setUpGh === 'missing') {
        const bin = fs.mkdtempSync(path.join(world(), 'bin-'));
        fs.symlinkSync(execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim(), path.join(bin, 'git'));
        PATH = bin;
      } else {
        PATH = ghStub(setUpGh).PATH;
      }

      const out = engine.ok(main, ['github-rule', 'yes'], { env: { PATH } });

      assert.deepStrictEqual([out.github_rule, out.reason], ['failed', reason]);
      assert.deepStrictEqual(out.warnings, [`the rule against deleting or force-pushing leeway-state was not set on acme/portal: ${reason} — set it by hand under the repository's Settings → Rules`]);
      assert.deepStrictEqual(committedManifest(main).github_rule, { status: 'failed', reason });
      assert.strictEqual(boot(main).github_rule_offer, false);
    });
  }

  it('an answer is recorded once', () => {
    const gh = ghStub();
    const main = codeProject({ remote: github.url });
    boot(main);
    engine.ok(main, ['github-rule', 'no'], { env: { PATH: gh.PATH } });

    assert.match(engine.refuses(main, ['github-rule', 'yes'], { env: { PATH: gh.PATH } }).error, /the offer is answered — "declined" is recorded, and an answer is recorded once/);
    assert.match(engine.refuses(main, ['github-rule', 'maybe']).error, /the answer is yes or no — got "maybe"/);
    assert.deepStrictEqual(gh.calls(), []);
  });

  it('a fresh clone of a project whose offer was answered is never offered it', () => {
    const gh = ghStub();
    const main = codeProject({ remote: github.url });
    boot(main);
    engine.ok(main, ['github-rule', 'no'], { env: { PATH: gh.PATH } });
    git(main, ['push', '-q', 'origin', 'main']);
    const fresh = cloneOf(github.url, 'fresh');

    const res = boot(fresh);

    assert.deepStrictEqual([res.state, res.github_rule_offer], ['ready', false]);
  });
});

describe('the GitHub rule beyond GitHub', () => {
  it('a remote that is not on GitHub is offered nothing, and a yes there is refused', () => {
    const bare = harness.bareRepo(path.join(world(), 'portal.git'));
    const { main } = setUp({ remote: bare });

    assert.strictEqual(boot(main).github_rule_offer, false);
    assert.match(engine.refuses(main, ['github-rule', 'yes']).error, /the state's remote is not on GitHub — there is no repository to set the rule on/);
  });

  it('reads a GitHub repository off every form a remote URL takes, and nothing else', () => {
    for (const url of [
      'git@github.com:acme/portal.git', 'git@github.com:acme/portal', 'https://github.com/acme/portal.git',
      'https://github.com/acme/portal/', 'https://token@github.com/acme/portal', 'ssh://git@github.com/acme/portal.git',
      'ssh://git@github.com:22/acme/portal.git', 'git://github.com/acme/portal.git', 'https://GitHub.com/acme/portal',
    ]) {
      assert.deepStrictEqual(githubRepository(url), { owner: 'acme', repo: 'portal' }, url);
    }
    for (const url of ['https://gitlab.com/acme/portal.git', 'git@github.com.evil.io:acme/portal.git', 'https://github.com/acme', '/srv/git/portal.git']) {
      assert.strictEqual(githubRepository(url), null, url);
    }
  });
});

'use strict';

// ---------------------------------------------------------------------------
// Lost state (workflow-engine/scripts/domain/state-checks.cjs,
// domain/boot.cjs, domain/code-trace.cjs): the workflows' trace in the code
// read across the repository, the stop with nothing written — the trust
// log's waiting events landed all the same — its screen, and the fresh
// start on yes (`boot --start-again`).
//
// Layer: git. World: real repositories in a temp folder per test, a bare
// repository as the remote and clones of it; boot runs from a copy of the
// engine beside a stand-in migration runner, so the state checks are what
// each test exercises (boot-state-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const harness = require('./engine-harness.cjs');
const { announced, auditGate, auditMarkers } = require('./gate-audit.cjs');
const { datedAt, createFile } = require('./discovery-test-utils.cjs');
const { git, initRepo, tip, remoteTip } = harness;

const SCRIPTS = path.dirname(harness.ENGINE);
const { STATE_BRANCH } = require(path.join(SCRIPTS, 'domain/state-worktree.cjs'));
const { trustEvent } = require(path.join(SCRIPTS, 'domain/trust-events.cjs'));
const { newId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));

const { useWorld, LAYOUT_GROUP, WORKFLOW_HOOKS, engine, codeProject, cloneOf, boot, bootRefused, setUp, placed, IN_PLACE, untouched } = require('./boot-state-world.cjs');

const world = useWorld();

// --- lost state -------------------------------------------------------------------

/**
 * A project whose code tree holds the workflows' trace — the state's ignore
 * line and the hooks, committed as boot leaves them — with no state branch
 * here or on its remote, the code dated in the past.
 * @param {{remote?: string|null, trace?: Record<string, string>}} [opts]
 */
function lostProject({ remote = null, trace = { '.gitignore': '.leeway/\n', '.claude/settings.json': WORKFLOW_HOOKS } } = {}) {
  const main = initRepo(path.join(world(), 'portal'));
  datedAt('2025-03-01T12:00:00Z', () => {
    createFile(main, 'src/app.js', 'export default 1;\n');
    git(main, ['add', '-A']);
    git(main, ['commit', '-q', '-m', 'the app']);
    for (const [rel, content] of Object.entries(trace)) createFile(main, rel, content);
    git(main, ['add', '-A']);
    git(main, ['commit', '-q', '-m', 'set up']);
  });
  if (remote !== null) {
    git(main, ['remote', 'add', 'origin', remote]);
    git(main, ['push', '-q', 'origin', 'main']);
  }
  return main;
}

/** Lose the state everywhere: its worktree and branch here, its branch on the remote. @param {string} main @param {string|null} [bare] */
function loseState(main, bare = null) {
  git(main, ['worktree', 'remove', '--force', '--force', path.join(main, '.leeway')]);
  git(main, ['branch', '-D', STATE_BRANCH]);
  if (bare !== null) git(bare, ['branch', '-D', STATE_BRANCH]);
}

/** A menu row's wrapped line opens on non-breaking spaces. */
const WRAP = '\u00a0'.repeat(8);

describe('lost state (4.4.5, 4.S9, 4.S32)', () => {
  it('gone here and on the remote, in a project whose committed settings hold the workflows\' hooks, stops boot with nothing written — and the next boot stops again', () => {
    const bare = harness.bareRepo(path.join(world(), 'portal.git'));
    const main = lostProject({ remote: bare, trace: { '.claude/settings.json': WORKFLOW_HOOKS } });
    const before = untouched(main, bare);

    assert.deepStrictEqual(boot(main), { ok: true, state: 'lost', warnings: [] });
    assert.deepStrictEqual(untouched(main, bare), before);
    assert.ok(!fs.existsSync(path.join(main, '.leeway')));

    assert.deepStrictEqual(boot(main), { ok: true, state: 'lost', warnings: [] });
    assert.deepStrictEqual(untouched(main, bare), before);
  });

  it('the layout hook alone, among the person\'s own hooks, is the trace', () => {
    const settings = { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo theirs' }] }, LAYOUT_GROUP] } };
    const main = lostProject({ trace: { '.claude/settings.json': JSON.stringify(settings, null, 2) + '\n' } });

    assert.deepStrictEqual(boot(main), { ok: true, state: 'lost', warnings: [] });
    assert.ok(!fs.existsSync(path.join(main, '.leeway')));
  });

  it('a boot that stops at the lost state still lands the trust log\'s events a conversation kept waiting: every boot does (16.13.3, 16.S74)', () => {
    const main = lostProject();
    const config = path.join(world(), 'config');
    const session = '6f1c2b9a-0d4e-4a7b-9c3e-2f5a8b7d1e40';
    const header = { id: newId(), at: '2026-10-28T10:00:00Z', project: null, project_name: null, model: null, session };
    const waiting = `${JSON.stringify(trustEvent('call', header, { entry: newId(), kind: null, label: null, sort: null }))}\n`;
    createFile(path.join(config, 'conversations', session), 'trust-pending.jsonl', waiting);

    assert.deepStrictEqual(boot(main, { WORKFLOWS_CONFIG_DIR: config }), { ok: true, state: 'lost', warnings: [] });

    assert.strictEqual(fs.readFileSync(path.join(config, 'trust.jsonl'), 'utf8'), waiting);
    assert.ok(!fs.existsSync(path.join(config, 'conversations', session, 'trust-pending.jsonl')));
  });

  it('a line naming the state in the .gitignore is the trace too', () => {
    const main = lostProject({ trace: { '.gitignore': 'node_modules\n.leeway/\n' } });

    assert.strictEqual(boot(main).state, 'lost');
    assert.ok(!fs.existsSync(path.join(main, '.leeway')));
  });

  describe('the trace read across the repository, not one checkout (4.5.2)', () => {
    it('set up from a code worktree, its trace on that branch alone: a boot in the main checkout stops at the lost state, nothing written', () => {
      const bare = harness.bareRepo(path.join(world(), 'portal.git'));
      const main = codeProject({ remote: bare });
      const code = path.join(world(), 'portal-feature');
      git(main, ['worktree', 'add', '-q', '-b', 'feature', code]);
      assert.strictEqual(boot(code).state, 'ready');
      loseState(main, bare);
      assert.ok(!fs.existsSync(path.join(main, '.gitignore')), 'the main checkout\'s branch holds no trace');
      const before = untouched(main, bare);

      assert.deepStrictEqual(boot(main), { ok: true, state: 'lost', warnings: [] });

      assert.deepStrictEqual(untouched(main, bare), before);
    });

    it('the main checkout on a branch cut before setup, the trace on a branch checked out nowhere: stops at the lost state, nothing written', () => {
      const bare = harness.bareRepo(path.join(world(), 'portal.git'));
      const main = lostProject({ remote: bare });
      git(main, ['checkout', '-q', '-b', 'before-setup', 'main~1']);
      const before = untouched(main, bare);

      assert.deepStrictEqual(boot(main), { ok: true, state: 'lost', warnings: [] });

      assert.deepStrictEqual(untouched(main, bare), before);
    });

    it('the trace on a remote-tracking branch alone: a clone whose own branches never carried it stops at the lost state, nothing written', () => {
      const bare = harness.bareRepo(path.join(world(), 'portal.git'));
      lostProject({ remote: bare });
      const fresh = cloneOf(bare, 'fresh', ['--branch', 'main']);
      git(fresh, ['checkout', '-q', '-b', 'before-setup', 'origin/main~1']);
      git(fresh, ['branch', '-q', '-D', 'main']);
      const before = untouched(fresh, bare);

      assert.deepStrictEqual(boot(fresh), { ok: true, state: 'lost', warnings: [] });

      assert.deepStrictEqual(untouched(fresh, bare), before);
    });

    it('the trace written in another worktree but never committed there: a boot in the main checkout stops at the lost state', () => {
      const main = codeProject();
      const code = path.join(world(), 'portal-feature');
      git(main, ['worktree', 'add', '-q', '-b', 'feature', code]);
      createFile(main, '.git/hooks/pre-commit', '#!/bin/sh\nexit 1\n');
      fs.chmodSync(path.join(main, '.git/hooks/pre-commit'), 0o755);
      assert.strictEqual(boot(code).state, 'ready');
      assert.strictEqual(git(main, ['rev-list', '--count', 'main..feature']).trim(), '0', 'nothing of the trace committed');
      loseState(main);
      const before = untouched(main, null);

      assert.deepStrictEqual(boot(main), { ok: true, state: 'lost', warnings: [] });

      assert.deepStrictEqual(untouched(main, null), before);
    });

    it('a project nested in a larger repository, set up from a worktree on a branch since checked out nowhere: stops at the lost state', () => {
      const top = initRepo(path.join(world(), 'mono'));
      createFile(top, 'app/README.md', '# app\n');
      git(top, ['add', '-A']);
      git(top, ['commit', '-q', '-m', 'code']);
      const code = path.join(world(), 'mono-feature');
      git(top, ['worktree', 'add', '-q', '-b', 'feature', code]);
      assert.strictEqual(boot(path.join(code, 'app')).state, 'ready');
      git(code, ['checkout', '-q', '-b', 'elsewhere', 'main']);
      loseState(top);
      const before = untouched(top, null);

      assert.deepStrictEqual(boot(path.join(top, 'app')), { ok: true, state: 'lost', warnings: [] });

      assert.deepStrictEqual(untouched(top, null), before);
    });

    it('the trace pushed from another clone on a branch this one never fetched: the remote\'s branches are fetched first, and boot stops at the lost state', () => {
      const bare = harness.bareRepo(path.join(world(), 'portal.git'));
      const main = codeProject({ remote: bare });
      const old = cloneOf(bare, 'old', ['--branch', 'main']);
      const code = path.join(world(), 'portal-feature');
      git(main, ['worktree', 'add', '-q', '-b', 'feature', code]);
      assert.strictEqual(boot(code).state, 'ready');
      git(code, ['push', '-q', 'origin', 'feature']);
      loseState(main, bare);
      assert.strictEqual(git(old, ['for-each-ref', 'refs/remotes/origin/feature']), '', 'the old clone never fetched it');

      assert.deepStrictEqual(boot(old), { ok: true, state: 'lost', warnings: [] });

      assert.ok(!fs.existsSync(path.join(old, '.leeway')));
      assert.strictEqual(remoteTip(bare), '', 'no fresh state pushed for every other clone to restore');
    });

    it('a fetch of the remote\'s branches that fails is never read as a project being set up: boot stops, writing nothing', () => {
      const bare = harness.bareRepo(path.join(world(), 'portal.git'));
      const main = codeProject({ remote: bare });
      const real = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
      const wrapper = fs.mkdtempSync(path.join(world(), 'git-'));
      createFile(wrapper, 'git', `#!/bin/sh\ncase "$*" in *" fetch "*) echo "fatal: the remote hung up" >&2; exit 128 ;; esac\nexec "${real}" "$@"\n`);
      fs.chmodSync(path.join(wrapper, 'git'), 0o755);
      const before = untouched(main, bare);

      assert.match(bootRefused(main, { PATH: `${wrapper}:${process.env.PATH}` }), new RegExp(
        '^origin\'s branches could not be fetched, so boot cannot tell a project being set up from one whose state was lost, ' +
        'and wrote nothing — start again once origin can be reached: git fetch failed: fatal: the remote hung up$',
      ));

      assert.deepStrictEqual(untouched(main, bare), before);
      assert.ok(!fs.existsSync(path.join(main, '.leeway')));
    });

    it('a project with no trace on any branch, local or remote-tracking, nor in any tree checked out, is being set up', () => {
      const bare = harness.bareRepo(path.join(world(), 'portal.git'));
      const main = codeProject({ remote: bare });
      git(main, ['checkout', '-q', '-b', 'feature']);
      createFile(main, '.gitignore', 'node_modules\n');
      createFile(main, '.claude/settings.json', JSON.stringify({
        hooks: {
          SessionEnd: [{ hooks: [{ type: 'command', command: 'echo bye' }] }],
          PreToolUse: [{ matcher: 'Write|Edit|NotebookEdit', hooks: [{ type: 'command', command: 'node lint.cjs' }] }],
        },
      }));
      git(main, ['add', '-A']);
      git(main, ['commit', '-q', '-m', 'the person\'s own']);
      git(main, ['push', '-q', 'origin', 'feature']);
      git(main, ['checkout', '-q', 'main']);
      git(main, ['worktree', 'add', '-q', path.join(world(), 'portal-feature'), 'feature']);

      assert.strictEqual(boot(main).state, 'ready');
      assert.deepStrictEqual(placed(path.join(main, '.leeway')), IN_PLACE);
    });
  });

  it('a .worktreeinclude naming the state is no trace — no version of the workflows wrote such a line — so the project is being set up', () => {
    const main = lostProject({ trace: { '.worktreeinclude': 'node_modules\n.leeway/.knowledge/store.bin\n' } });

    assert.strictEqual(boot(main).state, 'ready');
    assert.deepStrictEqual(placed(path.join(main, '.leeway')), IN_PLACE);
  });

  it('gone with no remote at all, stops too', () => {
    const { main, root } = setUp();
    git(main, ['worktree', 'remove', '--force', '--force', root]);
    git(main, ['branch', '-D', STATE_BRANCH]);
    const before = untouched(main, null);

    assert.strictEqual(boot(main).state, 'lost');
    assert.deepStrictEqual(untouched(main, null), before);
  });

  it('draws the stop: what was lost, the other clone that can put it back, and the fresh start on yes', () => {
    const main = lostProject();

    const out = engine.output(main, ['render', 'state-lost-gate']);

    assert.strictEqual(out, [
      '=== DISPLAY: state lost stop (emit verbatim as a properties code block (```properties fence)) ===',
      '⚑ Boot stopped: Leeway\'s state branch is gone',
      '',
      '=== DISPLAY: state lost account (emit verbatim as markdown (not a code block)) ===',
      '> Portal keeps its Leeway state on a branch of its own, `leeway-state`. Boot found it neither in this clone nor on the remote.',
      '>',
      '> If another clone of Portal still has it, on this machine or another, run Leeway there: boot pushes it back to the remote, and this clone restores it when it next starts.',
      '>',
      '> Otherwise the state is lost: the decisions, the logs and the ledger. Portal\'s code and its history are untouched.',
      '',
      '=== MENU: state lost gate (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**`◆ Start again with a fresh state?`**',
      '',
      '**`y/yes`** → Start again — *a fresh state branch, then the product*',
      `${WRAP}*researcher reads Portal's code to rebuild what it can*`,
      '**`n/no`**  → Not now — *look for another clone first; nothing is*',
      `${WRAP}*written*`,
      '',
    ].join('\n'));
    auditMarkers(out, 'state lost gate');
    const gate = announced(() => auditGate(engine.output(main, ['render', 'state-lost-gate']), 'state lost gate'));
    assert.strictEqual(gate.question, 'Start again with a fresh state?');
    assert.deepStrictEqual(gate.options.map((o) => o.key), ['y', 'n']);
  });

  it('on yes, `boot --start-again` makes a fresh orphan branch and says the state was started again — the baseline signal reads all the code as before the workflows', () => {
    const bare = harness.bareRepo(path.join(world(), 'portal.git'));
    const main = lostProject({ remote: bare });
    const code = tip(main, 'main');

    const res = engine.ok(main, ['boot', '--start-again']);

    assert.strictEqual(res.state, 'restarted');
    assert.deepStrictEqual(git(main, ['rev-list', STATE_BRANCH]).trim().split('\n'), [tip(main, STATE_BRANCH)]);
    assert.deepStrictEqual(placed(path.join(main, '.leeway')), IN_PLACE);
    assert.strictEqual(remoteTip(bare), tip(main, STATE_BRANCH));
    assert.strictEqual(tip(main, 'main'), code, 'the code side gained nothing: its trace was already there');
    assert.strictEqual(res.baseline, 'none');
    assert.strictEqual(res.baseline_signal.commits_before, res.baseline_signal.commits_total);
    assert.deepStrictEqual(res.baseline_signal.history_before, ['2025-03-01  the app', '2025-03-01  set up']);
    assert.notStrictEqual(res.baseline_signal.workflows_date, null);
    assert.strictEqual(boot(main).state, 'ready', 'started again once: the next boot finds the state in place');
  });

  it('`boot --start-again` where the state is in place starts nothing again', () => {
    const { main } = setUp();
    const before = tip(main, STATE_BRANCH);

    assert.strictEqual(engine.ok(main, ['boot', '--start-again']).state, 'ready');
    assert.strictEqual(tip(main, STATE_BRANCH), before);
    assert.match(engine.refuses(main, ['boot', '--fresh']).error, /^Usage: engine boot \[--start-again\]$/);
  });

  it('a state folder with no branch here or on the remote is refused, saying what happened and the ways on, nothing written', () => {
    const bare = harness.bareRepo(path.join(world(), 'portal.git'));
    const { main, root } = setUp({ remote: bare });
    git(main, ['update-ref', '-d', `refs/heads/${STATE_BRANCH}`]);
    git(bare, ['branch', '-D', STATE_BRANCH]);

    assert.strictEqual(bootRefused(main), [
      `the state folder ${root} is still there, but leeway-state is gone — from this clone, and from origin — so boot wrote nothing: `,
      'it makes no state branch under a folder holding state it cannot account for. Where another clone still holds leeway-state, ',
      'run Leeway there to push it back, and this clone restores it at its next boot; ',
      `otherwise move ${root} aside, keeping what it holds, and boot again`,
    ].join(''));
    assert.strictEqual(git(main, ['for-each-ref', `refs/heads/${STATE_BRANCH}`]), '');
    assert.strictEqual(remoteTip(bare), '');

    fs.renameSync(root, path.join(world(), 'aside'));
    assert.strictEqual(boot(main).state, 'lost', 'the folder moved aside, boot stops at the lost state, whose yes starts it afresh');
  });
});

'use strict';

// ---------------------------------------------------------------------------
// The setup's trace (workflow-engine/scripts/domain/code-trace.cjs): the
// commit of the ignore line and the hooks, owed until it lands, and setup
// while git is in the middle of a bisect or a rebase.
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
const harness = require('./engine-harness.cjs');
const { git } = harness;

const { useWorld, write, read, tip, codeProject, boot } = require('./boot-state-world.cjs');

const world = useWorld();

describe('a project being set up (4.S12, 4.5.2)', () => {
  describe('the trace\'s commit, owed until it lands', () => {
    /** A hook in the main checkout refusing every code commit, and its removal. @param {string} main */
    function refusingCommits(main) {
      const hook = path.join(main, '.git/hooks/pre-commit');
      write(main, '.git/hooks/pre-commit', '#!/bin/sh\nexit 1\n');
      fs.chmodSync(hook, 0o755);
      return () => fs.rmSync(hook);
    }

    it('a commit git refused is made by the next boot — the line and the hooks both — and leaves the index as it found it, the person\'s own staged edit still staged', () => {
      const main = codeProject();
      const allow = refusingCommits(main);
      const head = tip(main, 'main');
      write(main, 'README.md', '# portal, staged\n');
      git(main, ['add', 'README.md']);

      const refused = boot(main);

      assert.strictEqual(refused.state, 'ready');
      assert.deepStrictEqual(refused.warnings.map((w) => w.split(':')[0]), [
        `the state's ignore line is in ${path.join(main, '.gitignore')} but was not committed, and the next boot tries again`,
        'project settings commit failed, and the next boot tries again',
      ]);
      assert.strictEqual(tip(main, 'main'), head);
      assert.strictEqual(git(main, ['diff', '--cached', '--name-only']), 'README.md\n', 'nothing of the workflows\' left staged');
      allow();
      git(main, ['commit', '-q', '-m', 'the person\'s own']);

      assert.deepStrictEqual(boot(main).warnings, []);

      assert.deepStrictEqual(git(main, ['log', '-2', '--format=%s']).trim().split('\n'),
        ['chore: install workflow session hooks', 'chore: ignore .leeway/, the workflows state']);
      assert.strictEqual(git(main, ['status', '--porcelain']), '');
    });

    it('a settings file holding the person\'s own uncommitted edit beside the hooks is left as it is, with a warning — their edit is never committed under the workflows\' name', () => {
      const main = codeProject();
      const allow = refusingCommits(main);
      boot(main);
      allow();
      const settings = JSON.parse(read(main, '.claude/settings.json'));
      write(main, '.claude/settings.json', JSON.stringify({ model: 'opus', ...settings }, null, 2));
      const theirs = read(main, '.claude/settings.json');

      const res = boot(main);

      assert.deepStrictEqual(res.warnings, [
        '.claude/settings.json holds changes of yours not yet committed, so the workflows\' own change to it was not committed either — ' +
        'commit yours, and the next boot commits theirs',
      ]);
      assert.strictEqual(read(main, '.claude/settings.json'), theirs);
      assert.strictEqual(git(main, ['ls-tree', '--name-only', 'HEAD', '--', '.claude']), '', 'nothing of the file committed');
      assert.strictEqual(git(main, ['log', '-1', '--format=%s']).trim(), 'chore: ignore .leeway/, the workflows state', 'the line, the workflows\' alone, committed');
    });

    it('a .gitignore of the person\'s never committed takes the line, and is left for them to commit, with a warning', () => {
      const main = codeProject();
      write(main, '.gitignore', 'node_modules\n');
      const head = tip(main, 'main');

      const res = boot(main);

      assert.strictEqual(read(main, '.gitignore'), 'node_modules\n.leeway/\n');
      assert.ok(res.warnings.includes(
        '.gitignore holds changes of yours not yet committed, so the workflows\' own change to it was not committed either — ' +
        'commit yours, and the next boot commits theirs',
      ));
      assert.strictEqual(git(main, ['log', '--format=%s', `${head}..main`]).trim(), 'chore: install workflow session hooks');
    });

    it('a settings file git ignores is owed nothing: the hooks stay on disk, uncommitted, with no warning — the line still commits', () => {
      const main = codeProject();
      write(main, '.gitignore', '.claude/\n');
      git(main, ['add', '.gitignore']);
      git(main, ['commit', '-q', '-m', 'keep .claude out']);
      const head = tip(main, 'main');

      for (const res of [boot(main), boot(main)]) assert.deepStrictEqual([res.state, res.warnings], ['ready', []]);

      assert.ok(fs.existsSync(path.join(main, '.claude/settings.json')), 'the hooks are on disk');
      assert.strictEqual(git(main, ['log', '--format=%s', `${head}..main`]).trim(), 'chore: ignore .leeway/, the workflows state');
      assert.strictEqual(git(main, ['status', '--porcelain']), '');
    });

    it('a .gitignore checked out with CRLF line endings under core.autocrlf is compared as git stages it: the line commits, with no warning', () => {
      const main = codeProject();
      git(main, ['config', 'core.autocrlf', 'true']);
      write(main, '.gitignore', 'node_modules\n');
      git(main, ['add', '.gitignore']);
      git(main, ['commit', '-q', '-m', 'ignore']);
      fs.rmSync(path.join(main, '.gitignore'));
      git(main, ['checkout', '--', '.gitignore']);
      assert.strictEqual(read(main, '.gitignore'), 'node_modules\r\n', 'checked out with CRLF');

      assert.deepStrictEqual(boot(main).warnings, []);

      assert.strictEqual(git(main, ['show', 'HEAD~1:.gitignore']), 'node_modules\n.leeway/\n');
      assert.deepStrictEqual(boot(main).warnings, []);
    });
  });

  describe('while git is in the middle of a bisect', () => {
    /** A project with three commits and a bisect started across them in the main checkout. */
    function midBisect() {
      const main = codeProject();
      for (const n of ['two', 'three']) {
        write(main, 'README.md', `# ${n}\n`);
        git(main, ['commit', '-q', '-am', n]);
      }
      git(main, ['bisect', 'start', 'HEAD', 'HEAD~2']);
      return main;
    }

    it('a boot in the main checkout commits nothing and HEAD stays on the commit under test — after the reset, the next boot commits both', () => {
      const main = midBisect();
      const testing = tip(main, 'HEAD');

      assert.strictEqual(boot(main).state, 'ready');

      assert.strictEqual(tip(main, 'HEAD'), testing);
      assert.strictEqual(git(main, ['status', '--porcelain']), '');
      git(main, ['bisect', 'reset']);
      assert.deepStrictEqual(boot(main).warnings, []);
      assert.deepStrictEqual(git(main, ['log', '-2', '--format=%s']).trim().split('\n'),
        ['chore: install workflow session hooks', 'chore: ignore .leeway/, the workflows state']);
    });

    it('a boot from a code worktree reads its own tree\'s bisect, not the main checkout\'s, and commits on its branch', () => {
      const main = midBisect();
      const code = path.join(world(), 'portal-feature');
      git(main, ['worktree', 'add', '-q', '-b', 'feature', code, 'main']);
      const testing = tip(main, 'HEAD');

      assert.strictEqual(boot(code).state, 'ready');

      assert.strictEqual(tip(main, 'HEAD'), testing);
      assert.deepStrictEqual(git(main, ['log', '-2', '--format=%s', 'feature']).trim().split('\n'),
        ['chore: install workflow session hooks', 'chore: ignore .leeway/, the workflows state']);
    });
  });

  describe('while git is in the middle of a rebase', () => {
    /** A project set up, its ignore line and hooks dropped on a later commit, then a rebase stopped part-way in the main checkout. */
    function midRebase() {
      const main = codeProject();
      boot(main);
      fs.writeFileSync(path.join(main, '.gitignore'), '');
      fs.rmSync(path.join(main, '.claude'), { recursive: true });
      git(main, ['add', '-A']);
      git(main, ['commit', '-q', '-m', 'drop the trace']);
      write(main, 'x.txt', 'x\n');
      git(main, ['add', 'x.txt']);
      git(main, ['commit', '-q', '-m', 'x']);
      assert.throws(() => git(main, ['rebase', '--exec', 'false', 'HEAD~1']));
      assert.ok(fs.existsSync(path.join(main, '.git/rebase-merge')), 'the rebase stopped part-way');
      return main;
    }

    it('a boot in the main checkout writes neither the line nor the hooks and commits nothing there, leaving nothing dirty — the next boot after it commits both', () => {
      const main = midRebase();
      const head = tip(main, 'HEAD');

      assert.strictEqual(boot(main).state, 'ready');

      assert.strictEqual(tip(main, 'HEAD'), head, 'nothing committed into the rebase');
      assert.strictEqual(read(main, '.gitignore'), '');
      assert.ok(!fs.existsSync(path.join(main, '.claude')), 'no hooks waiting to be swept into the rebase');
      assert.strictEqual(git(main, ['status', '--porcelain']), '');
      git(main, ['rebase', '--abort']);
      assert.deepStrictEqual(boot(main).warnings, []);
      assert.strictEqual(read(main, '.gitignore'), '.leeway/\n');
      assert.deepStrictEqual(git(main, ['log', '-2', '--format=%s']).trim().split('\n'),
        ['chore: install workflow session hooks', 'chore: ignore .leeway/, the workflows state']);
      assert.strictEqual(git(main, ['status', '--porcelain']), '');
    });

    it('a boot from a code worktree commits nothing in the main checkout', () => {
      const main = midRebase();
      const code = path.join(world(), 'portal-feature');
      git(main, ['worktree', 'add', '-q', '-b', 'feature', code, 'main']);
      const head = tip(main, 'HEAD');

      assert.strictEqual(boot(code).state, 'ready');

      assert.strictEqual(tip(main, 'HEAD'), head);
      assert.strictEqual(git(main, ['status', '--porcelain']), '');
      assert.ok(fs.existsSync(path.join(main, '.git/rebase-merge')), 'the rebase is the person\'s still');
    });
  });
});

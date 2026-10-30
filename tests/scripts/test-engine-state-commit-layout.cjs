'use strict';

// ---------------------------------------------------------------------------
// The state commit held to the layout (workflow-engine/scripts/domain/
// state-worktree.cjs, `commitHere`): a commit reads the state worktree's
// changes in one `status`. A file on disk the layout has no place for
// refuses it, naming the file and the way on, with nothing committed — a
// verb's own commit, `commit --workflows` and `--migrations`, and a
// transaction's tail, which answers the refusal as a commit pending (6.2.5,
// 6.S6); a file gone, from the working tree or with its deletion staged,
// refuses nothing. Every changed log of 4.11's rides along with the verb's
// paths and is pushed with them, and no other file does (6.3.2, 6.S7). The
// files the person's tools leave beside the state's — Finder's, Explorer's,
// AppleDouble's, Vim's, Emacs's, JetBrains' — are neither refused nor
// committed; a name in another case is its place where the filesystem
// ignores case; and a merge's landing is never held to the layout. The
// places themselves are test-engine-layout.cjs's.
//
// Git layer: the library's code projects, with or without a bare remote,
// and its two machines on one remote; the engine in process.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  ok, refusedPristine, git, createFile, layout, touched, traced, codeProject, twoMachines, commitOnState, tip, remoteTip,
} = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { STATE_BRANCH, withStateLock, commitState } = require('../../skills/workflow-engine/scripts/domain/state-worktree.cjs');
const { catchUpState } = require('../../skills/workflow-engine/scripts/domain/state-merge.cjs');
const { ignoresCase } = require('../../skills/workflow-engine/scripts/kernel/state-root.cjs');

const folder = useTempFolder('state-commit-layout-');

const UNIT = 'acme';
const BRIEF = layout.topic(UNIT, 'login', 'brief.md');
const LOG = layout.topic(UNIT, 'login', 'log.md');
const SPEC = layout.unit(UNIT, 'spec.md');
const STRAY = layout.unit(UNIT, 'tmp', 'x.md');
const IDEA = layout.inbox('ideas', '2026-10-30--dark-mode.md');
const ARCHIVED = layout.archived('ideas', '2026-10-30--dark-mode.md');

/** The refusal of a commit over files outside the layout, as the engine words it. @param {string} root @param {string} files */
function outsideLayout(root, files) {
  return `the state at ${root} holds ${files}, outside the workflows' layout — nothing committed; remove it, or move it into the layout`;
}

/** A state commit's short sha. @param {string} root @param {string} rev */
function short(root, rev) {
  return git(root, ['rev-parse', '--short', rev]).trim();
}

/** The state worktree's files that differ from its branch, as git lists them. @param {string} root */
function status(root) {
  return git(root, ['status', '--porcelain', '--untracked-files=all']);
}

describe('a file outside the layout (6.2.5)', () => {
  it('6.S6: a file a shell made in a unit refuses the next verb\'s commit, naming it and the way on, with nothing committed', () => {
    const { main, root } = codeProject(folder(), { state: true });
    createFile(root, BRIEF, '# login\n');
    createFile(root, STRAY, 'scratch\n');

    const refused = refusedPristine(main, ['commit', UNIT, '-m', 'discussion(acme): login']);

    assert.deepStrictEqual(refused, { ok: false, error: outsideLayout(root, STRAY) });
  });

  for (const form of ['--workflows', '--migrations']) {
    it(`commit ${form} refuses one too, committing nothing on either side`, () => {
      const { main, root } = codeProject(folder(), { state: true });
      createFile(root, BRIEF, '# login\n');
      createFile(root, STRAY, 'scratch\n');
      createFile(main, '.gitignore', 'node_modules/\n');
      const code = tip(main, 'HEAD');

      const refused = refusedPristine(main, ['commit', form, '-m', 'chore: the state']);

      assert.deepStrictEqual(refused, { ok: false, error: outsideLayout(root, STRAY) });
      assert.strictEqual(tip(main, 'HEAD'), code);
    });
  }

  it('turns a transaction\'s tail into a commit pending, the refusal among its warnings, its write kept', () => {
    const { main, root } = codeProject(folder(), { state: true });
    commitOnState(root, { [IDEA]: '# Dark mode\n' });
    const before = tip(root, 'HEAD');
    createFile(root, STRAY, 'scratch\n');

    const res = ok(main, ['inbox', 'archive', path.join(root, IDEA)]);

    assert.deepStrictEqual(res, {
      ok: true,
      archived: [path.join(root, ARCHIVED)],
      committed: null,
      warnings: [`commit failed: ${outsideLayout(root, STRAY)}`],
      note: 'commit pending — state saved; retry with engine commit',
    });
    assert.strictEqual(tip(root, 'HEAD'), before);
    assert.ok(fs.existsSync(path.join(root, ARCHIVED)), 'the archive was undone');
  });

  it('names every file outside the layout, wherever it is in the state', () => {
    const { root } = codeProject(folder(), { state: true });
    createFile(root, BRIEF, '# login\n');
    for (const rel of [STRAY, 'notes.txt', layout.topic(UNIT, 'login', 'scratch', 'draft.md')]) createFile(root, rel, 'scratch\n');

    assert.throws(() => withStateLock(root, () => commitState(root, [BRIEF], 'state: the brief')), {
      message: `the state at ${root} holds acme/tmp/x.md, acme/topics/login/scratch/draft.md, notes.txt, outside the workflows' layout — nothing committed; remove each, or move each into the layout`,
    });
  });

  const REMOVALS = {
    'from the working tree': (/** @type {string} */ root) => fs.rmSync(path.join(root, 'notes.txt')),
    'with git rm, the deletion staged': (/** @type {string} */ root) => git(root, ['rm', '-q', 'notes.txt']),
  };

  for (const [how, remove] of Object.entries(REMOVALS)) {
    it(`refuses nothing for one the branch holds once it is removed ${how}, and a commit of the whole state takes the removal`, () => {
      const { main, root } = codeProject(folder(), { state: true });
      createFile(root, 'notes.txt', 'a person\'s notes\n');
      git(root, ['add', 'notes.txt']);
      git(root, ['commit', '-q', '-m', 'a person\'s commit']);
      remove(root);
      createFile(root, BRIEF, '# login\n');

      const res = ok(main, ['commit', '--workflows', '-m', 'chore: the state']);

      assert.deepStrictEqual(res, { ok: true, committed: short(root, 'HEAD') });
      assert.deepStrictEqual(touched(root, 'HEAD'), [`A\t${BRIEF}`, 'D\tnotes.txt']);
    });
  }

  it('reads a name in another case as its place where the filesystem ignores case, and as outside the layout where it keeps it', () => {
    const { root } = codeProject(folder(), { state: true });
    const rel = 'Acme/Topics/Login/Brief.md';
    createFile(root, rel, '# login\n');
    const commit = () => withStateLock(root, () => commitState(root, ['Acme'], 'state: the brief'));

    if (ignoresCase(root)) assert.deepStrictEqual(touched(root, commit().commit || ''), [`A\t${rel}`]);
    else assert.throws(commit, { message: outsideLayout(root, rel) });
  });
});

describe('the files the person\'s tools leave beside the state\'s', () => {
  // Each family's every name, beside the brief a verb commits.
  const SIDECARS = {
    'Finder and Explorer': ['.DS_Store', layout.unit(UNIT, '.DS_Store'), layout.topic(UNIT, 'login', 'Thumbs.db'), layout.unit(UNIT, 'topics', 'desktop.ini')],
    'AppleDouble': [layout.topic(UNIT, 'login', '._brief.md')],
    'Vim': ['swp', 'swo', 'swx'].map((ext) => layout.topic(UNIT, 'login', `.brief.md.${ext}`)),
    'Emacs': ['brief.md~', '#brief.md#', '.#brief.md'].map((name) => layout.topic(UNIT, 'login', name)),
    'JetBrains': ['tmp', 'old'].map((kind) => layout.topic(UNIT, 'login', `brief.md___jb_${kind}___`)),
  };

  it(`are neither refused nor committed, wherever they are: ${Object.keys(SIDECARS).join(', ')}`, () => {
    const { main, root } = codeProject(folder(), { state: true });
    const left = Object.values(SIDECARS).flat();
    for (const rel of left) createFile(root, rel, 'a tool\'s\n');
    createFile(root, BRIEF, '# login\n');

    const res = ok(main, ['commit', '--workflows', '-m', 'chore: the state']);

    assert.deepStrictEqual(res, { ok: true, committed: short(root, 'HEAD') });
    assert.deepStrictEqual(touched(root, 'HEAD'), [`A\t${BRIEF}`]);
    assert.deepStrictEqual(status(root).split('\n').filter(Boolean).sort(), left.map((rel) => `?? ${rel}`).sort());
  });
});

describe('the logs a state commit takes along (6.3.2)', () => {
  it('6.S7: a topic\'s log edited since the last commit rides in the verb\'s one commit, and the remote\'s leeway-state moves to it', () => {
    const { main, root, bare } = codeProject(folder(), { remote: true, state: true });
    commitOnState(root, { [IDEA]: '# Dark mode\n', [LOG]: '# login\n' });
    createFile(root, LOG, '# login\n\n## 2026-10-30\n\nDecided the session length.\n');

    const res = ok(main, ['inbox', 'archive', path.join(root, IDEA)]);

    assert.deepStrictEqual(res, { ok: true, archived: [path.join(root, ARCHIVED)], committed: short(root, 'HEAD') });
    assert.deepStrictEqual(touched(root, 'HEAD'), [`A\t${ARCHIVED}`, `D\t${IDEA}`, `M\t${LOG}`]);
    assert.strictEqual(remoteTip(/** @type {string} */ (bare)), tip(root, STATE_BRANCH));
    assert.strictEqual(status(root), '');
  });

  it('takes 4.11\'s four logs alone: today\'s session logs and the layout\'s other files stay as they are', () => {
    const { root } = codeProject(folder(), { state: true });
    const logs = [LOG, layout.unit(UNIT, 'discovery', 'session-001.md'), '.product/sessions/session-001.md', layout.unit(UNIT, 'build', 'log.md')];
    const left = [layout.session(UNIT, '001'), '.roadmap/sessions/session-001.md', SPEC];
    for (const rel of [...logs, ...left]) createFile(root, rel, `${rel}\n`);
    createFile(root, layout.projectManifest, '{}\n');

    const out = withStateLock(root, () => commitState(root, [layout.projectManifest], 'state: the manifest'));

    assert.deepStrictEqual(touched(root, out.commit || ''), [...logs.map((rel) => `A\t${rel}`), `M\t${layout.projectManifest}`].sort());
    assert.deepStrictEqual(status(root).split('\n').filter(Boolean).sort(), left.map((rel) => `?? ${rel}`).sort());
  });

  it('reads the state worktree\'s changes in one status, however many there are', () => {
    const { root } = codeProject(folder(), { state: true });
    for (const rel of [BRIEF, SPEC, LOG, layout.unit(UNIT, 'build', 'log.md')]) createFile(root, rel, `${rel}\n`);

    const { result, commands } = traced(() => withStateLock(root, () => commitState(root, [BRIEF, SPEC], 'state: the unit')));

    assert.strictEqual(touched(root, result.commit || '').length, 4);
    assert.deepStrictEqual(commands.filter((command) => command.startsWith('status ')), ['status --porcelain -z --untracked-files=all --no-renames']);
  });
});

describe('a merge\'s landing', () => {
  it('is no verb\'s commit: the catch-up lands the remote\'s state whatever lies outside the layout here', () => {
    const { here, there } = twoMachines(folder());
    commitOnState(there.root, { [BRIEF]: '# login\n' });
    createFile(here.root, STRAY, 'scratch\n');

    const out = catchUpState(here.root);

    assert.strictEqual(out.action, 'fast-forwarded');
    assert.strictEqual(tip(here.root, STATE_BRANCH), tip(there.root, STATE_BRANCH));
    assert.strictEqual(status(here.root), `?? ${STRAY}\n`);
  });
});

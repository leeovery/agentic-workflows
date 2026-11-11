'use strict';

// ---------------------------------------------------------------------------
// The capture line (leeway-engine/scripts/domain/inbox-capture.cjs, engine
// `inbox capture <idea|bug|quick-fix> [--project <folder>]`, 18.6.1–18.6.3,
// 18.6.8): the item's text on stdin written into the inbox where the state
// lives, named for its title and the day, the next free `-{n}` where the
// inbox or its archive holds the name (across kinds and the product's notes,
// test-engine-roadmap-inbox.cjs); committed under the writer lock of
// the project it lands in, alone, and pushed, a refused push a warning; its
// one line drawn. It lands in the one state copy from a linked worktree
// (18.S23), and in another project's inbox from a session in a project of
// its own (18.S47), naming that project, a failed commit's retry run from
// that project's folder; it marks no conversation as running the
// workflows. Refused, nothing written: a --project folder holding no state,
// a kind it does not know, a text with no title, and a call of another
// shape.
//
// Layer: git. World: a project with its state on a bare remote, and a
// second project, each `codeProject`'s, in a temp folder per test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, okSections, refusedPristine, sectionOf, codeProject, git, tip, remoteTip, touched, treeSnapshot, lockAttempts, layout, withFrozenClock, FROZEN_AT, initRepo,
} = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');

const world = useTempFolder('inbox-capture-');
const TODAY = FROZEN_AT.slice(0, 10);
const BUG = '# The Login Loops\n\nSigning in sends you back to sign in.\n';

/** The capture run from `cwd` on the frozen day: its response and its sections. @param {string} cwd @param {string[]} args @param {string} text @param {Record<string, string>} [env] */
const captured = (cwd, args, text, env) => withFrozenClock(() => okSections(cwd, ['inbox', 'capture', ...args], { stdin: text, env }));

/** The one line the capture draws. @param {string} sections */
const line = (sections) => sectionOf(sections, 'DISPLAY: confirmation');

describe('inbox capture (18.6.1, 18.6.2)', () => {
  it('18.S22: writes the text into the inbox where the state lives, named for its title and the day, commits it alone and pushes it, and draws its one line', () => {
    const { main, root, bare } = codeProject(world(), { remote: true, state: true });
    const aside = layout.inbox('ideas', `${TODAY}--half-written.md`);
    fs.mkdirSync(path.dirname(path.join(root, aside)), { recursive: true });
    fs.writeFileSync(path.join(root, aside), '# Half Written\n');
    const { res, sections } = captured(main, ['bug'], BUG);
    const rel = layout.inbox('bugs', `${TODAY}--the-login-loops.md`);

    assert.deepStrictEqual(res, { ok: true, captured: path.join(root, rel), committed: git(root, ['rev-parse', '--short', 'HEAD']).trim() });
    assert.strictEqual(fs.readFileSync(path.join(root, rel), 'utf8'), BUG);
    assert.deepStrictEqual([git(root, ['log', '-1', '--format=%s']).trim(), touched(root, 'HEAD'), git(root, ['status', '--porcelain', '--untracked-files=all'])],
      ['workflow(inbox): capture the-login-loops', [`A\t${rel}`], `?? ${aside}\n`]);
    assert.strictEqual(remoteTip(bare), tip(root, 'HEAD'));
    assert.strictEqual(line(sections), 'Logged bug: "The Login Loops"\n');
  });

  it('takes the next free -{n} where the inbox or its archive holds the name today', () => {
    const { main, root } = codeProject(world(), { state: true });
    const first = captured(main, ['idea'], '# Pay By Phone\n').res.captured;
    withFrozenClock(() => okSections(main, ['inbox', 'archive', first]));
    const names = [captured(main, ['idea'], '# Pay By Phone\n'), captured(main, ['idea'], '# Pay by phone!\n')].map(({ res }) => path.relative(root, res.captured));

    assert.deepStrictEqual(names, [layout.inbox('ideas', `${TODAY}--pay-by-phone-2.md`), layout.inbox('ideas', `${TODAY}--pay-by-phone-3.md`)]);
  });

  it('keeps the commit and answers a warning where the remote refuses the push', () => {
    const { main, root, bare } = codeProject(world(), { remote: true, state: true });
    const before = remoteTip(bare);
    fs.writeFileSync(path.join(bare, 'hooks', 'pre-receive'), '#!/bin/sh\necho "no pushes today" >&2\nexit 1\n', { mode: 0o755 });
    const { res } = captured(main, ['quick-fix'], '# Rename The Pay Button\n');

    assert.strictEqual(res.committed, git(root, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(remoteTip(bare), before);
    assert.match(res.warnings.join('\n'), /^leeway-state is committed here but was not pushed to origin .*no pushes today/s);
  });

  it('marks no conversation as running the workflows, where a verb of the work does', () => {
    const { main } = codeProject(world(), { state: true });
    const config = path.join(world(), 'config');
    const env = (/** @type {string} */ id) => ({ LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: id });
    const marked = (/** @type {string} */ id) => fs.existsSync(path.join(config, 'conversations', id, 'workflow'));
    const { res } = captured(main, ['bug'], BUG, env('logging'));
    withFrozenClock(() => okSections(main, ['inbox', 'archive', res.captured], { env: env('triaging') }));

    assert.deepStrictEqual([marked('logging'), marked('triaging')], [false, true]);
  });
});

describe('inbox capture from elsewhere (18.6.3, 18.6.8)', () => {
  it('18.S23: from a linked worktree of the project, lands in the one state copy, its commit the engine\'s on the state branch', () => {
    const { main, root } = codeProject(world(), { state: true });
    const linked = path.join(world(), 'linked');
    git(main, ['worktree', 'add', '-q', '-b', 'side', linked]);
    const { res } = captured(linked, ['bug'], BUG);

    assert.strictEqual(res.captured, path.join(root, layout.inbox('bugs', `${TODAY}--the-login-loops.md`)));
    assert.strictEqual(git(root, ['log', '-1', '--format=%s', 'leeway-state']).trim(), 'workflow(inbox): capture the-login-loops');
    assert.deepStrictEqual([fs.existsSync(path.join(linked, '.leeway')), git(linked, ['status', '--porcelain'])], [false, '']);
  });

  it('18.S47: from another project, --project lands it in the named project\'s inbox under that project\'s writer lock alone, its own state as it was, the line naming the project', (t) => {
    const { main: here, root: ours } = codeProject(world(), { name: 'here', state: true });
    const { root: theirs } = codeProject(world(), { name: 'there', state: true });
    const before = treeSnapshot(here);
    const [own, landing] = [ours, theirs].map((root) => lockAttempts(t, path.join(root, layout.lock)));
    const { res, sections } = captured(here, ['bug', '--project', '../there'], BUG);

    assert.deepStrictEqual(
      [res.captured, landing.includes('made'), own, treeSnapshot(here), line(sections)],
      [path.join(theirs, layout.inbox('bugs', `${TODAY}--the-login-loops.md`)), true, [], before, 'Logged bug in There: "The Login Loops"\n'],
    );
  });

  it('a commit that fails in another project names the retry run from that project\'s folder, which commits its inbox — in its own, the retry alone', () => {
    const { main: here } = codeProject(world(), { name: 'here', state: true });
    const { main: there, root: theirs } = codeProject(world(), { name: 'there', state: true });
    const locks = [here, there].map((main) => path.join(main, '.git', 'refs', 'heads', 'leeway-state.lock'));
    for (const lock of locks) fs.writeFileSync(lock, '');
    const [own, another] = [[], ['--project', there]].map((project) => captured(here, ['bug', ...project], BUG).res.note);
    for (const lock of locks) fs.unlinkSync(lock);
    const [, retry, from] = /^commit pending — state saved; retry with: engine commit (--inbox) -m "<message>", run from (.+)$/.exec(another) ?? [];
    const retried = ok(from, ['commit', retry, '-m', 'workflow(inbox): capture the-login-loops']);

    assert.strictEqual(own, 'commit pending — state saved; retry with: engine commit --inbox -m "<message>"');
    assert.deepStrictEqual([from, retried.committed, touched(theirs, 'HEAD')], [there, git(theirs, ['rev-parse', '--short', 'HEAD']).trim(), [`A\t${layout.inbox('bugs', `${TODAY}--the-login-loops.md`)}`]]);
  });

  it('refuses, writing nothing, a --project folder holding no state, a kind it does not know, a text with no title, and a call of another shape', () => {
    const { main } = codeProject(world(), { state: true });
    const bare = initRepo(path.join(world(), 'plain'));
    const refused = (/** @type {string[]} */ args, /** @type {string} */ text = BUG) => refusedPristine(main, ['inbox', 'capture', ...args], { stdin: text }).error;
    const usage = 'Usage: engine inbox <archive|restore|delete> <path> [<path> …] | engine inbox close <work-unit|none> <path> [<path> …] | engine inbox file <work-unit> --file <item.json> | engine inbox capture <idea|bug|quick-fix> [--project <folder>]';

    assert.deepStrictEqual([
      refused(['bug', '--project', bare]), refused(['task']), refused(['bug'], 'No title here.\n'), refused(['bug'], ''), refused([]), refused(['bug', 'idea']), refused(['bug', '--file', 'x.md']),
    ], [
      `inbox capture: ${bare} holds no Leeway state — name the folder of a project that has it: --project <folder>`,
      'inbox capture: its kind is one of idea, bug, quick-fix, not "task"',
      'inbox capture: its text, on stdin, holds its title, `# Title`',
      'inbox capture: its text, on stdin, holds its title, `# Title`',
      usage, usage, usage,
    ]);
  });
});

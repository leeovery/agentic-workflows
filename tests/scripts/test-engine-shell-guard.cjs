'use strict';

// ---------------------------------------------------------------------------
// The hook before Bash (leeway-engine/scripts/domain/shell-guard.cjs, its
// reader kernel/shell-reader.cjs, and the guards' door guards.cjs): `engine
// shell guard`, Claude Code's hook before every shell command, fed its JSON
// on stdin as Claude Code sends it. Ordinary commands pass silently and
// write nothing — a git read, git's plumbing, a quoted word or a heredoc's
// body or a comment that says "git commit", a mention of the state branch,
// a file under the state removed by its name, a name built at run time, a
// read of a file only the engine writes, a write to a place the layout
// gives Claude or to a file of an engine-only name outside any state.
// It refuses, with exit 2 and the way on: the state worktree unlocked,
// moved or removed, `.leeway` removed, the state branch deleted here or on
// the remote or force-pushed, by every spelling Claude writes, in a project
// with a remote and one without (4.S7); a raw `git commit` during a build,
// the task in flight read from the conversation stdin names (6.S11, 6.S22),
// and in the state worktree at any time; a command naming a file at user
// level the layout hook refuses Claude's writes to; and a command writing,
// by any form a shell writes with, to a file in the state only the engine
// writes, for the layout hook's reason (2.S1). Input it cannot read passes.
// A pass never runs git, and the position is read for a commit alone. At
// the shell door each guard answers before the engine loads anything but
// its own module, the shell guard's modules pinned one by one, and the
// layout guard's for a write into the state (E5).
//
// Layer: verb, and process for the shell door. World: a project with a unit
// and a task started in one conversation, a code worktree beside it; a
// project with a bare remote and one without, for the state's refusals.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  ENGINE, call, ok, git, stateGit, commitAll, fixtureFrom, codeProject, cleanupFixture, statePath, layout, STATE_DIR_NAME,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.dirname(ENGINE);
const { GUARD_VERBS } = require(path.join(SCRIPTS, 'guards.cjs'));
const { positionPath } = require(path.join(SCRIPTS, 'domain', 'conversation.cjs'));
const { ignoresCase } = require(path.join(SCRIPTS, 'kernel', 'state-root.cjs'));

// Whether the filesystem every folder of these tests is on ignores case.
const IGNORES_CASE = ignoresCase(fs.realpathSync(os.tmpdir()));

const UNIT = 'pay';
const BUILDING = 'building-session';
const IDLE = 'idle-session';
const PLACED = 'placed-session';
const NAMELESS = 'nameless-session';
const CONFIG = /** @type {string} */ (process.env.LEEWAY_CONFIG_DIR);
const CLAUDE = /** @type {string} */ (process.env.CLAUDE_CONFIG_DIR);
const TASK = [
  '# Take a card', '', '## Type', 'feat', '', '## Problem', 'A card cannot be taken.', '', '## Solution', 'Add the card form.', '',
  '## Outcome', 'A card is taken.', '', '## Acceptance scenarios', '- Given a card, when it is taken, then it is charged.', '', '## Spec reference', '§1',
].join('\n');

/** Why each of the state's commands is refused. */
const REFUSED = Object.freeze({
  worktree: 'unlocking, moving or removing the state worktree (.leeway) is refused — it holds the workflows\' state, and boot keeps it locked where it is',
  removal: 'removing .leeway is refused — it is the state worktree, holding the workflows\' state; a stray file in it is removed by its own name',
  branch: 'deleting the state branch (leeway-state) is refused — it holds the workflows\' state, which only the engine changes',
  remote: 'deleting leeway-state on the remote is refused — it holds the workflows\' state, and boot restores a lost local branch from it',
  force: 'force-pushing leeway-state is refused — the engine pushes it after every commit, and a force would drop what another clone pushed; push your own branches by name',
  stateCommit: 'a raw git commit in the state worktree (.leeway) is refused — every state commit is the engine\'s, made by the verb that changes the state',
});
const BUILD_COMMIT = `a raw git commit is refused while task 1.1 of ${UNIT} is in flight — the build commits through the commit door: \`engine commit --paths <file>… --task ${UNIT} 1.1 -m "<message>"\``;
const NAMED = 'a shell command naming it is refused, and the Read and Grep tools read it';

/** The engine's modules a pass of the shell guard loads, by their paths in the scripts folder. */
const SHELL_GUARD_LOADS = [
  'domain/brief-names.cjs', 'domain/conversation.cjs', 'domain/shell-guard.cjs', 'domain/user-files.cjs', 'engine.cjs', 'guards.cjs',
  'kernel/call.cjs', 'kernel/file-stream.cjs', 'kernel/git.cjs', 'kernel/isolated-git.cjs', 'kernel/manifest-io.cjs', 'kernel/process.cjs',
  'kernel/shell-reader.cjs', 'kernel/state-root.cjs', 'kernel/system-config.cjs',
];

/** The engine's modules the layout guard loads for a write into the state, every shipped task driver's aside. */
const LAYOUT_GUARD_LOADS = [
  'domain/brief-names.cjs', 'domain/conversation.cjs', 'domain/drivers.cjs', 'domain/layout-hook.cjs', 'domain/layout.cjs', 'domain/task-id.cjs',
  'domain/user-files.cjs', 'engine.cjs', 'guards.cjs', 'kernel/call.cjs', 'kernel/file-stream.cjs', 'kernel/git.cjs', 'kernel/isolated-git.cjs',
  'kernel/manifest-io.cjs', 'kernel/manifest-schema.cjs', 'kernel/manifest.cjs', 'kernel/process.cjs', 'kernel/state-root.cjs', 'kernel/system-config.cjs',
];

/** Each file in the state only the engine writes, by its path from the state, with the layout hook's reason for refusing a write to it. */
const ENGINE_FILES = [
  [layout.manifest(UNIT), `a unit's manifest (${layout.manifest(UNIT)}) changes only through the engine's commands — engine manifest set|push|pull|delete|apply`],
  [layout.projectManifest, `the project manifest (${layout.projectManifest}) changes only through the engine's commands — engine manifest set|push|pull|delete`],
  [layout.ledger, `the ledger (${layout.ledger}) changes only through the engine's commands — engine ledger ask|find|decide|replace|hold|move|merge`],
];

/** A path in the state as a command from the project spells it. @param {string} rel */
const inState = (rel) => `${STATE_DIR_NAME}/${rel}`;

/** The unit, its first task written, the project's code committed. */
const unitWorld = fixtureFrom('shell-guard-', (dir) => {
  createManifest(dir, UNIT, {});
  commitAll(dir, 'init');
  ok(dir, ['task', 'phase', UNIT, '1', '--title', 'Cards']);
  const file = path.join(dir, '..', 'task.md');
  fs.writeFileSync(file, TASK);
  ok(dir, ['task', 'create', UNIT, '1', '--file', file]);
});

/** @type {string} */ let dir;
/** @type {string} */ let worktree;
/** @type {string[]} */ const scratch = [];

before(() => {
  dir = unitWorld();
  worktree = path.join(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'shell-guard-worktree-'))), 'card');
  scratch.push(dir, path.dirname(worktree));
  git(dir, ['worktree', 'add', '-q', '-b', 'card', worktree]);
  ok(dir, ['task', 'start', UNIT, '1.1'], { env: { CLAUDE_CODE_SESSION_ID: BUILDING } });
  ok(dir, ['session', 'label', UNIT], { env: { CLAUDE_CODE_SESSION_ID: PLACED } });
});

after(() => {
  for (const at of scratch) cleanupFixture(at);
  for (const session of [BUILDING, IDLE, PLACED, NAMELESS]) fs.rmSync(path.join(CONFIG, 'conversations', session), { recursive: true, force: true });
});

/**
 * The hook's stdin, as Claude Code writes it before a Bash call.
 * @param {string} cwd @param {string} command @param {Record<string, unknown>} [fields] the call's own, over these
 */
function hookInput(cwd, command, fields = {}) {
  return JSON.stringify({
    session_id: IDLE, transcript_path: '/t/idle-session.jsonl', cwd, permission_mode: 'default',
    hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command, description: 'A command' }, ...fields,
  });
}

/**
 * The hook run on `command` from `cwd`, in the conversation `session`.
 * @param {string} cwd @param {string} command @param {{session?: string, env?: Record<string, string|undefined>}} [opts]
 */
function guard(cwd, command, { session = IDLE, env = {} } = {}) {
  return call(cwd, ['shell', 'guard'], { env, stdin: hookInput(cwd, command, { session_id: session }) });
}

/** @param {{code: number, stdout: string, stderr: string}} res @param {string} what */
function assertPassed(res, what) {
  assert.deepStrictEqual({ code: res.code, stdout: res.stdout, stderr: res.stderr }, { code: 0, stdout: '', stderr: '' }, what);
}

/** @param {{code: number, stdout: string, stderr: string}} res @param {string} reason @param {string} what */
function assertRefused(res, reason, what) {
  assert.deepStrictEqual({ code: res.code, stdout: res.stdout, stderr: res.stderr }, { code: 2, stdout: '', stderr: `${reason}\n` }, what);
}

/** Every file under a folder, by its path there, with its bytes. @param {string} root @returns {[string, string][]} */
function filesUnder(root, at = root) {
  return fs.readdirSync(at, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(at, entry.name);
    return entry.isDirectory() ? filesUnder(root, file) : [[path.relative(root, file), fs.readFileSync(file, 'utf8')]];
  });
}

/** What the hook could write: the two config folders, the project's tree and its state's. */
function written() {
  return {
    config: filesUnder(CONFIG),
    claude: filesUnder(CLAUDE),
    code: git(dir, ['status', '--porcelain', '--untracked-files=all']),
    state: stateGit(dir, ['status', '--porcelain', '--untracked-files=all', '--ignored']),
  };
}

/** `fn` run, and nothing the hook could write written by it. @param {() => void} fn */
function writingNothing(fn) {
  const before = written();
  fn();
  assert.deepStrictEqual(written(), before, 'nothing written, no conversation marked');
}

describe('ordinary commands pass silently, writing nothing', () => {
  it('git\'s reads and plumbing, a quoted word, a heredoc\'s body or a comment saying "git commit", a mention of the state branch, a forced push of another branch, a file under the state removed by its name, the engine\'s own commit, a read of a file only the engine writes — redirected from, copied away — a write to a log or the spec, or to a file of an engine-only name outside the state — each passes during a build and out of one, and nothing is written', () => {
    const conversation = path.join(CONFIG, 'conversations', BUILDING);
    const [manifest, ledger, spec] = [inState(layout.manifest(UNIT)), inState(layout.ledger), inState(layout.unit(UNIT, 'spec.md'))];
    const commands = [
      'git log --oneline -5',
      'git status && git diff HEAD~1 -- src',
      'git commit-tree HEAD^{tree} -p HEAD -m "a tree"',
      'grep -rn "git commit" skills/',
      'git log --grep \'git commit\'',
      'echo "the state is on leeway-state" && git log leeway-state -3',
      'cat <<EOF > notes.md\ngit commit -am "from the body"\nrm -rf .leeway\ngit push -f origin leeway-state\nEOF',
      'cat <<-\'END\' | wc -l\n\tgit commit -m x\n\tEND',
      '# git commit -am "kept for later"\nls -la',
      'printf \'%s\\n\' "git push --force origin leeway-state"',
      'git push origin card && git push --force-with-lease origin card && git push -f origin HEAD @',
      'git branch -d card',
      'git worktree list && git worktree remove ../card',
      'rm -rf node_modules dist && rm -rf .leeway/pay/stray.md',
      'ls -la .leeway && cat .leeway/manifest.json',
      `jq .status ${manifest} && jq . < ${manifest} && wc -l < ${ledger} && grep -c found ${ledger} && head -3 ${ledger}`,
      `git -C ${STATE_DIR_NAME} diff && cat ${manifest} > held.json && cp ${manifest} ${ledger} ${os.tmpdir()} && mv held.json kept.json`,
      `sed -n 1p ${manifest} && sed -e 's/i/x/' ${manifest} && perl -MList::Util -ne 'print' ${manifest} && node build.js 2>&1 | tee build.log`,
      `cat <<EOF > notes.md\necho '{}' >> ${ledger}\nEOF`,
      `echo "- tried the form" >> ${inState(layout.topic(UNIT, UNIT, 'log.md'))} && sed -i '' s/draft/final/ ${spec} && cp draft.md ${spec}`,
      `echo '{}' > manifest.json && sed -i '' s/a/b/ ${layout.manifest(UNIT)} && echo '{}' >> ${layout.ledger} && rm -f ${path.join(os.tmpdir(), 'manifest.json')}`,
      'node .claude/skills/leeway-engine/scripts/engine.cjs commit --paths src/card.js -m "Take the card" --for pay implementation/pay',
      'npm test -- --grep "git commit"',
      `ls ${conversation} && cat ${path.join(conversation, 'position.json')}`,
      'cat "$LEEWAY_CONFIG_DIR/trust.jsonl" "$(dirname "$X")/briefs/b1.md"',
    ];
    writingNothing(() => {
      for (const command of commands) {
        for (const session of [BUILDING, IDLE]) assertPassed(guard(dir, command, { session, env: { CLAUDE_CODE_SESSION_ID: session } }), `${command} — ${session}`);
      }
    });
    assert.ok(!fs.existsSync(path.join(CONFIG, 'conversations', IDLE)));
  });
});

describe('4.S7: the state\'s refusals, in a project with a remote and one without (4.4.2, 4.4.8, 6.3.8)', () => {
  /** @type {{main: string}[]} */
  let projects;
  before(() => {
    const at = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'shell-guard-projects-')));
    scratch.push(at);
    projects = [codeProject(path.join(at, 'remote'), { remote: true, state: true }), codeProject(path.join(at, 'local'), { state: true })];
  });

  /** Each command refused with `reason`, from each project's main checkout, writing nothing. @param {string} reason @param {(main: string) => string[]} commands */
  function refusedEverywhere(reason, commands) {
    writingNothing(() => {
      for (const { main } of projects) {
        for (const command of commands(main)) assertRefused(guard(main, command), reason, `${command} — from ${main}`);
      }
    });
  }

  it('unlocking, moving or removing the state worktree — by its name, its path, from inside it, through `-C`', () => {
    refusedEverywhere(REFUSED.worktree, (main) => [
      'git worktree unlock .leeway',
      'git worktree remove --force .leeway',
      'git worktree move .leeway ../elsewhere',
      `git worktree remove -f -f ${path.join(main, STATE_DIR_NAME)}/`,
      'git -C .leeway worktree remove .',
      'cd .leeway && git worktree unlock .',
    ]);
  });

  it('removing .leeway — the folder, its contents, from inside it, from below it', () => {
    refusedEverywhere(REFUSED.removal, (main) => [
      'rm -rf .leeway',
      'rm -r .leeway/',
      'rm -fr .leeway/*',
      'rm -R ./.leeway/.',
      `rm --recursive --force ${path.join(main, STATE_DIR_NAME)}`,
      'cd .leeway && rm -rf *',
      'cd .leeway/pay && rm -rf ..',
    ]);
  });

  it('deleting leeway-state locally — `branch -d`, `-D`, `--delete`, the ref deleted', () => {
    refusedEverywhere(REFUSED.branch, () => [
      'git branch -d leeway-state',
      'git branch -D leeway-state',
      'git branch --delete --force leeway-state',
      'git -C .leeway branch -Dr leeway-state',
      'git update-ref -d refs/heads/leeway-state',
    ]);
  });

  it('deleting leeway-state on the remote — `--delete`, `-d`, an empty source', () => {
    refusedEverywhere(REFUSED.remote, () => [
      'git push origin --delete leeway-state',
      'git push -d origin leeway-state',
      'git push origin :leeway-state',
      'git push origin :refs/heads/leeway-state',
    ]);
  });

  it('force-pushing leeway-state — `-f`, `--force…`, a `+` refspec, a mirror, every branch forced, the state worktree\'s own branch forced, by no refspec or by `HEAD` or `@` there — through a chain, its setup words and git\'s global options', () => {
    refusedEverywhere(REFUSED.force, () => [
      'git push --force origin leeway-state',
      'git push -fu origin leeway-state',
      'git push --force-with-lease origin leeway-state',
      'git push origin +leeway-state',
      'git push origin +HEAD:refs/heads/leeway-state',
      'git push --mirror origin',
      'git push --all --force origin',
      'cd .leeway && git push -f',
      'cd .leeway && git push --force origin HEAD',
      'git -C .leeway push -f origin @',
      'cd .leeway && git push origin +@',
      'git status && GIT_TRACE=1 command git -c core.pager=cat --no-pager push -f origin leeway-state',
      'env -u GIT_DIR git --git-dir=.git push origin +leeway-state',
    ]);
  });
});

describe('raw commits (6.3.7, 6.3.12, 12.9.8)', () => {
  it('6.S11: during a build, a raw git commit in a code worktree is refused, naming the commit door\'s call for the task in flight — Claude Code\'s own message form among them', () => {
    const commands = [
      'git commit -m "Take the card"',
      'git add src/card.js && git commit -am "Take the card"',
      'cd src && git commit --amend --no-edit',
      `git -C ${worktree} commit -m x`,
      'git commit -m "$(cat <<\'EOF\'\nTake the card — don\'t "charge" twice (yet)\nEOF\n)"',
    ];
    for (const command of commands) assertRefused(guard(worktree, command, { session: BUILDING }), BUILD_COMMIT, command);
  });

  it('a raw commit is found wherever the text runs one — in a loop, in a conditional, in a substitution alone, by git\'s path', () => {
    for (const command of [
      'for f in a.js b.js; do git add "$f"; git commit -m "$f"; done',
      'if git diff --quiet; then echo clean; else git commit -am x; fi',
      'echo "$(git commit -m x)"',
      '/usr/bin/git commit -m x',
    ]) assertRefused(guard(worktree, command, { session: BUILDING }), BUILD_COMMIT, command);
  });

  it('the position is read for a commit alone, and once however many commits the command holds — never for another command, nor for a commit the state worktree refuses', (t) => {
    const reads = t.mock.method(fs, 'readFileSync');
    const positionReads = (/** @type {string} */ command, /** @type {string} */ session) => {
      reads.mock.resetCalls();
      guard(dir, command, { session });
      return reads.mock.calls.filter(({ arguments: [file] }) => file === positionPath(session)).length;
    };
    const cases = [
      { command: 'git status && git log -1 && git push origin card && rm -rf dist', session: BUILDING, reads: 0 },
      { command: 'git -C .leeway commit -m x', session: BUILDING, reads: 0 },
      { command: 'git commit -m x', session: BUILDING, reads: 1 },
      { command: 'git commit -m a; git commit --amend --no-edit', session: PLACED, reads: 1 },
    ];
    assert.deepStrictEqual(
      cases.map(({ command, session }) => ({ command, reads: positionReads(command, session) })),
      cases.map(({ command, reads }) => ({ command, reads })),
    );
  });

  it('the task in flight is the conversation\'s stdin names — a subagent\'s call carries it — never the environment\'s', () => {
    const command = 'git commit -m x';
    assertRefused(guard(worktree, command, { session: BUILDING, env: { CLAUDE_CODE_SESSION_ID: IDLE } }), BUILD_COMMIT, 'the stdin\'s conversation builds');
    assertPassed(guard(worktree, command, { session: IDLE, env: { CLAUDE_CODE_SESSION_ID: BUILDING } }), 'the environment\'s builds');
    assertPassed(call(worktree, ['shell', 'guard'], { env: { CLAUDE_CODE_SESSION_ID: BUILDING }, stdin: hookInput(worktree, command, { session_id: undefined }) }), 'no session on stdin');
  });

  it('out of a build a raw commit runs: no position, a position naming no task, or a task naming no unit', () => {
    fs.mkdirSync(path.dirname(positionPath(NAMELESS)), { recursive: true });
    fs.writeFileSync(positionPath(NAMELESS), JSON.stringify({ phase: 'implementation', topic: UNIT, task: '1.1' }));
    assertPassed(guard(worktree, 'git commit -m x', { session: IDLE }), 'no position');
    assertPassed(guard(worktree, 'git commit -m x', { session: PLACED }), 'at a place, no task');
    assertPassed(guard(worktree, 'git commit -m x', { session: NAMELESS }), 'a task, no unit');
  });

  it('in the state worktree a raw commit is refused at any time — from inside it, by `cd` or `pushd`, by `popd` back into it, by `-C` after `-C`, by `--work-tree` or `--git-dir` — and one beside it, or a subshell\'s `cd` left behind, or a `popd` out of it, is not', () => {
    const state = path.join(dir, STATE_DIR_NAME);
    assertRefused(guard(state, 'git commit -am x'), REFUSED.stateCommit, 'from inside it');
    assertRefused(guard(dir, 'git commit -am x', { session: BUILDING }), BUILD_COMMIT, 'during a build, the build\'s refusal beside it');
    for (const command of [
      'cd .leeway && git add -A && git commit -m x', 'pushd .leeway && git commit -m x', `cd .leeway && pushd ${os.tmpdir()} && popd && git commit -m x`,
      'git -C .leeway commit -m x', `git -C ${os.tmpdir()} -C ${state} commit`, 'git --work-tree=.leeway commit', 'git --git-dir .leeway/.git commit',
    ]) {
      assertRefused(guard(dir, command), REFUSED.stateCommit, command);
    }
    for (const command of ['git commit -m x', 'git -C .leeway log -1', 'cd .leeway && git status', '(cd .leeway && git status) && git commit -m x', 'pushd .leeway && popd && git commit -m x']) {
      assertPassed(guard(dir, command), command);
    }
  });

  it('6.S22: with the mod not running, a raw commit during a build is refused, and so is a dispatch of the builder with no brief, by the hook before Agent', () => {
    const env = { LEEWAY_GATE_SURFACE: undefined };
    assertRefused(guard(worktree, 'git commit -m x', { session: BUILDING, env }), BUILD_COMMIT, 'the raw commit');
    const dispatch = call(dir, ['brief', 'guard'], {
      env,
      stdin: JSON.stringify({ session_id: BUILDING, cwd: dir, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: 'leeway-builder', prompt: 'Build task 1.1.' } }),
    });
    fs.rmSync(path.join(CONFIG, 'brief-refusals.jsonl'), { force: true });
    assert.deepStrictEqual([dispatch.code, dispatch.stdout], [2, '']);
    assert.match(dispatch.stderr, /this one names no brief\n$/);
  });
});

describe('the files at user level the layout hook refuses, by their names (6.5.12, 16.13.2, 16.4.4)', () => {
  const briefs = path.join(CONFIG, 'conversations', BUILDING, 'briefs');

  it('a command naming a conversation\'s briefs, the folder or a file in it, the brief hook\'s refusals, the trust log or a transcript — read or written, by its path, from its folder, through `~`, as a glob — is refused with the layout hook\'s reason and the way on', () => {
    const brief = (/** @type {string} */ name) => `a brief a conversation issued (${name}) changes only through the engine's commands — ${NAMED}`;
    const trustLog = `the trust log (trust.jsonl) changes only through the engine's commands — ${NAMED}`;
    const cases = [
      [`cat ${path.join(briefs, 'b1.md')}`, brief('b1.md')],
      [`echo "Do it differently." > ${path.join(briefs, 'b1.md')}`, brief('b1.md')],
      [`ls ${path.join(CONFIG, 'conversations', '*', 'briefs', '*.json')}`, brief('*.json')],
      [`rm -rf ${briefs}`, `a conversation's briefs (briefs/) change only through the engine's commands — ${NAMED}`],
      [`echo '{}' >> ${path.join(CONFIG, 'brief-refusals.jsonl')}`, `the brief hook's refusals (brief-refusals.jsonl) changes only through the engine's commands — ${NAMED}`],
      [`tail -3 ${path.join(CONFIG, 'trust.jsonl')}`, trustLog],
      [`cd ${CONFIG} && sed -i '' 1d trust.jsonl`, trustLog],
      [`grep -l card ${path.join(CLAUDE, 'projects', '-Users-me-app', '*.jsonl')}`, `a conversation's transcript (*.jsonl) is Claude Code's own: the trust log reads the model from it — ${NAMED}`],
    ];
    const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'shell-guard-home-')));
    scratch.push(home);
    writingNothing(() => {
      for (const [command, reason] of cases) assertRefused(guard(dir, command), reason, command);
      const res = guard(dir, 'cat ~/.config/leeway/trust.jsonl', { env: { HOME: home, LEEWAY_CONFIG_DIR: undefined } });
      assertRefused(res, trustLog, 'through `~`');
    });
  });

  it('the rest of the system config directory passes, and so does a file of those names anywhere else', () => {
    for (const command of [
      `cat ${path.join(CONFIG, 'conversations', BUILDING, 'position.json')}`,
      `ls ${path.join(CONFIG, 'conversations', BUILDING)}`,
      `cat ${path.join(CONFIG, 'nested', 'trust.jsonl')} ${path.join(CONFIG, 'briefs', 'b1.md')}`,
      'cat trust.jsonl person.md briefs/b1.md',
      `ls ${path.join(CLAUDE, 'projects', '-Users-me-app', 'memory')}`,
    ]) assertPassed(guard(dir, command), command);
  });
});

describe('a write to a file in the state only the engine writes, by the names its words give (2.S1, 6.2.3)', () => {
  /** Each form a shell command writes to a file with, by the file's path as the command spells it. @type {((file: string) => string)[]} */
  const WRITES = [
    (file) => `jq '.status = "completed"' notes.json > ${file}`,
    (file) => `echo '{"event":"found"}' >> ${file}`,
    (file) => `echo '{}' >| ${file}`,
    (file) => `node build.js &> ${file}`,
    (file) => `node build.js &>> ${file}`,
    (file) => `node build.js 2> ${file}`,
    (file) => `node build.js 1>>${file}`,
    (file) => `node build.js >& ${file}`,
    (file) => `exec 3<> ${file}`,
    (file) => `jq . notes.json | tee -a ${file}`,
    (file) => `sed -i '' 's/in-progress/completed/' ${file}`,
    (file) => `sed -i.bak -e 's/a/b/' ${file}`,
    (file) => `sed --in-place 's/a/b/' ${file}`,
    (file) => `sed -Ei 's/a+/b/' ${file}`,
    (file) => `perl -pi -e 's/a/b/' ${file}`,
    (file) => `perl -i.bak -ne 'print' ${file}`,
    (file) => `mv ${file} held.json`,
    (file) => `mv forged.json ${file}`,
    (file) => `mv ${path.basename(file)} ${path.dirname(file)}/`,
    (file) => `cp forged.json ${file}`,
    (file) => `cp -f ${path.join('forged', path.basename(file))} ${path.dirname(file)}`,
    (file) => `install -m 644 forged.json ${file}`,
    (file) => `ln -sf forged.json ${file}`,
    (file) => `rm -f ${file}`,
    (file) => `unlink ${file}`,
    (file) => `truncate -s 0 ${file}`,
    (file) => `touch ${file}`,
    (file) => `dd if=forged.json of=${file}`,
  ];

  it('each form a shell writes with — a redirection out, appended, clobbering, of both streams or one descriptor, to read and write; tee; sed and perl in place; mv from it or onto it; cp, install or ln onto it or into its folder; rm, unlink, truncate, touch; dd — is refused for a unit\'s manifest, the project manifest and the ledger, with the layout hook\'s reason naming the verb', () => {
    writingNothing(() => {
      for (const [rel, reason] of ENGINE_FILES) {
        for (const write of WRITES) assertRefused(guard(dir, write(inState(rel))), reason, write(inState(rel)));
      }
    });
  });

  it('a file is read from the folder the command runs in — after a `cd` or `pushd` into the state, from inside it, through `..`, by its absolute path — and where the text cannot say the folder, a relative path names no file in the state', () => {
    const state = path.join(dir, STATE_DIR_NAME);
    const [unitManifest, projectManifest, ledger] = ENGINE_FILES.map(([, reason]) => reason);
    const review = layout.unit(UNIT, 'spec-review.json');
    const refused = [
      [dir, `cd ${STATE_DIR_NAME} && echo '{}' >> ${layout.ledger}`, ledger],
      [dir, `cd ${inState(UNIT)} && sed -i '' s/a/b/ manifest.json`, unitManifest],
      [dir, `pushd ${STATE_DIR_NAME} && rm ${layout.projectManifest}`, projectManifest],
      [dir, `cd ${inState(UNIT)} && echo '{}' >> ../${layout.ledger}`, ledger],
      [os.tmpdir(), `touch ${statePath(dir, review)}`, `a unit's record of the person's review of its spec (${review}) changes only through the engine's commands`],
      [state, `echo '{}' > ${layout.projectManifest}`, projectManifest],
    ];
    writingNothing(() => {
      for (const [cwd, command, reason] of refused) assertRefused(guard(cwd, command), reason, `${command} — from ${cwd}`);
    });
    for (const [cwd, command] of [
      [state, `cd "$ELSEWHERE" && echo '{}' > ${layout.projectManifest}`],
      [state, `cd - && rm ${layout.manifest(UNIT)}`],
      [dir, `(cd ${STATE_DIR_NAME}) && echo '{}' > ${layout.projectManifest}`],
    ]) assertPassed(guard(cwd, command), `${command} — from ${cwd}`);
  });

  it('a file named in another case is the file it names where the state\'s filesystem ignores case, refused with its name as written, and another file where it keeps case', () => {
    const [unitManifest, ledger] = [layout.unit(UNIT.toUpperCase(), 'Manifest.json'), layout.ledger.toUpperCase()];
    const cases = [
      [`echo '{}' > ${inState(unitManifest)}`, `a unit's manifest (${unitManifest}) changes only through the engine's commands — engine manifest set|push|pull|delete|apply`],
      [`sed -i '' s/a/b/ ${inState(ledger)}`, `the ledger (${ledger}) changes only through the engine's commands — engine ledger ask|find|decide|replace|hold|move|merge`],
    ];
    writingNothing(() => {
      for (const [command, reason] of cases) {
        if (IGNORES_CASE) assertRefused(guard(dir, command), reason, command);
        else assertPassed(guard(dir, command), `${command}: another file on a filesystem that keeps case`);
      }
    });
  });
});

describe('input it cannot read passes', () => {
  it('no JSON, no tool input, no command, a command that is no text', () => {
    for (const stdin of ['', '{not json', '[]', JSON.stringify({ tool_name: 'Bash' }), hookInput(dir, '', { tool_input: { description: 'x' } }), hookInput(dir, '', { tool_input: { command: ['git', 'commit'] } })]) {
      assertPassed(call(dir, ['shell', 'guard'], { stdin }), stdin);
    }
  });
});

describe('the shell door', () => {
  /** @type {string} */ let out;
  /** @type {string} */ let preload;
  before(() => {
    out = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'shell-guard-door-')));
    scratch.push(out);
    preload = path.join(out, 'loaded.cjs');
    fs.writeFileSync(preload, 'process.on(\'exit\', () => require(\'fs\').writeFileSync(process.env.LOADED_TO, JSON.stringify(Object.keys(require.cache))));\n');
  });

  /**
   * The engine's modules a node process loaded, run with `args` on `input`
   * from the project — each passing, silent.
   * @param {string[]} args @param {string} [input] @returns {string[]}
   */
  function loadedBy(args, input = '') {
    const to = path.join(out, 'loaded.json');
    const res = spawnSync('node', ['--require', preload, ...args], { cwd: dir, encoding: 'utf8', input, env: { ...process.env, LOADED_TO: to } });
    assert.deepStrictEqual([res.status, res.stdout, res.stderr], [0, '', ''], args.join(' '));
    return JSON.parse(fs.readFileSync(to, 'utf8')).filter((/** @type {string} */ file) => file.startsWith(SCRIPTS)).sort();
  }

  it('E5: each guard, spawned, loads its own module and what it requires, and nothing else of the engine\'s', () => {
    const guards = {
      'layout guard': ['domain/layout-hook.cjs', JSON.stringify({ cwd: dir, tool_name: 'Write', tool_input: { file_path: path.join(dir, 'src/app.js'), content: '' } })],
      'brief guard': ['domain/brief-guard.cjs', JSON.stringify({ session_id: IDLE, cwd: dir, tool_name: 'Agent', tool_input: { subagent_type: 'Explore', prompt: 'Find the form.' } })],
      'shell guard': ['domain/shell-guard.cjs', hookInput(dir, 'git status')],
    };
    assert.deepStrictEqual(Object.keys(guards), [...GUARD_VERBS]);
    for (const [verb, [module, input]] of Object.entries(guards)) {
      const alone = loadedBy(['-e', `require(${JSON.stringify(path.join(SCRIPTS, 'guards.cjs'))}); require(${JSON.stringify(path.join(SCRIPTS, module))})`]);
      assert.deepStrictEqual(loadedBy([ENGINE, ...verb.split(' ')], input), [ENGINE, ...alone].sort(), verb);
    }
  });

  it('E5: the shell guard loads these modules of the engine\'s and no other, a commit\'s read of the position and a write outside the state among them', () => {
    const loaded = loadedBy([ENGINE, 'shell', 'guard'], hookInput(dir, 'git status > status.txt && git commit -m x'));
    assert.deepStrictEqual(loaded.map((file) => path.relative(SCRIPTS, file)), SHELL_GUARD_LOADS);
  });

  it('E5: the layout guard loads these modules of the engine\'s for a write into the state, and the shipped task drivers, and no other', () => {
    const write = JSON.stringify({ cwd: dir, tool_name: 'Write', tool_input: { file_path: statePath(dir, layout.topic(UNIT, UNIT, 'log.md')), content: '' } });
    const drivers = fs.readdirSync(path.join(SCRIPTS, 'drivers', 'task')).map((name) => `drivers/task/${name}/driver.cjs`);
    const loaded = loadedBy([ENGINE, 'layout', 'guard'], write);
    assert.deepStrictEqual(loaded.map((file) => path.relative(SCRIPTS, file)), [...LAYOUT_GUARD_LOADS, ...drivers].sort());
  });

  it('a pass never runs git — from the project, a code worktree or the state worktree, a commit\'s read of the position and a write into the state\'s layout read among them', () => {
    const bin = path.join(out, 'bin');
    const ran = path.join(out, 'git-ran');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'git'), `#!/bin/sh\necho "$*" >> '${ran}'\n`, { mode: 0o755 });
    const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` };
    const passes = [
      [dir, 'git status && git commit -m x && git push origin card && rm -rf .leeway/pay/stray.md'],
      [worktree, 'git commit -am x'],
      [path.join(dir, STATE_DIR_NAME), 'git log -1 && git push origin HEAD && ls'],
    ];
    for (const [cwd, command] of passes) {
      const res = spawnSync('node', [ENGINE, 'shell', 'guard'], { cwd, encoding: 'utf8', input: hookInput(cwd, command), env });
      assert.deepStrictEqual([res.status, res.stdout, res.stderr], [0, '', ''], `${command} — from ${cwd}`);
    }
    assert.ok(!fs.existsSync(ran), 'git never ran');
    spawnSync('git', ['--version'], { env });
    assert.ok(fs.existsSync(ran), 'the stub stands in for git');
  });

  it('a stray argument is a usage error, which lets the call through', () => {
    const res = call(dir, ['shell', 'guard', 'extra'], { stdin: hookInput(dir, 'rm -rf .leeway') });
    assert.deepStrictEqual([res.code, res.stdout, res.stderr], [1, '', 'Usage: engine shell guard\n']);
  });
});

'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { stateGit, commitAll, setupGitFixture, cleanupFixture } = harness;
const { walkthroughState } = require('../../skills/workflow-engine/scripts/domain/walkthrough.cjs');

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}
const run = (dir, args) => harness.ok(dir, args);
function refuses(dir, args, pattern) {
  const parsed = harness.refuses(dir, args);
  assert.match(parsed.error, pattern);
  return parsed;
}
function projectManifest(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.leeway/manifest.json'), 'utf8'));
}
function setProjectManifest(dir, mutate) {
  const m = projectManifest(dir);
  mutate(m);
  writeFile(dir, '.leeway/manifest.json', JSON.stringify(m, null, 2) + '\n');
}

describe('walkthrough state', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture('engine-walkthrough-state-');
    writeFile(dir, '.leeway/manifest.json', JSON.stringify({ work_units: {} }, null, 2) + '\n');
  });
  afterEach(() => cleanupFixture(dir));

  it('reads the recorded answer; anything else is the nothing-recorded state the offer keys on', () => {
    assert.deepStrictEqual(walkthroughState(dir), { status: 'none' }, 'an absent node');
    for (const status of ['walked', 'skipped']) {
      setProjectManifest(dir, (m) => { m.walkthrough = { status }; });
      assert.deepStrictEqual(walkthroughState(dir), { status });
    }
    for (const walkthrough of [{}, { status: 'weird' }, { status: 7 }, 'walked', ['walked'], null]) {
      setProjectManifest(dir, (m) => { m.walkthrough = walkthrough; });
      assert.deepStrictEqual(walkthroughState(dir), { status: 'none' }, JSON.stringify(walkthrough));
    }
    fs.rmSync(path.join(dir, '.leeway/manifest.json'));
    assert.deepStrictEqual(walkthroughState(dir), { status: 'none' }, 'a missing project manifest');
    writeFile(dir, '.leeway/manifest.json', '{ not json');
    assert.deepStrictEqual(walkthroughState(dir), { status: 'none' }, 'a corrupt project manifest');
  });
});

describe('engine walkthrough record', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture('engine-walkthrough-');
    writeFile(dir, '.leeway/manifest.json', JSON.stringify({ work_units: { pay: { work_type: 'feature' } } }, null, 2) + '\n');
    writeFile(dir, '.leeway/pay/manifest.json', '{"name":"pay","work_type":"feature","status":"in-progress"}\n');
    writeFile(dir, '.leeway/pay/discussion/pay.md', '# Discussion\n');
    commitAll(dir, 'init');
  });
  afterEach(() => cleanupFixture(dir));

  it('walked: writes the answer and commits it confined to the project manifest — a peer session\'s dirt never rides', () => {
    // A peer mid-write: an untracked scratch note and a modified discussion.
    writeFile(dir, '.leeway/pay/NOTES.md', 'peer scratch\n');
    writeFile(dir, '.leeway/pay/discussion/pay.md', '# Discussion\n\npeer session dirt\n');

    const res = run(dir, ['walkthrough', 'record', 'walked']);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'walked');
    assert.match(res.committed, /^[0-9a-f]+$/);
    assert.deepStrictEqual(projectManifest(dir).walkthrough, { status: 'walked' });
    assert.deepStrictEqual(projectManifest(dir).work_units, { pay: { work_type: 'feature' } }, 'sibling keys survive');

    assert.strictEqual(stateGit(dir, ['log', '-1', '--pretty=%s']).trim(), 'chore(help): walkthrough walked');
    const landed = stateGit(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).split('\n').map((l) => l.trim()).filter(Boolean);
    assert.deepStrictEqual(landed, ['manifest.json']);
    const status = stateGit(dir, ['status', '--porcelain']).split('\n').filter(Boolean);
    assert.ok(status.some((l) => l.startsWith('?? ') && l.includes('NOTES.md')), `the peer's untracked note is still untracked:\n${status.join('\n')}`);
    assert.ok(status.some((l) => l.startsWith(' M ') && l.includes('discussion/pay.md')), `the peer's modified discussion is still dirty:\n${status.join('\n')}`);
  });

  it('skipped: the decline, with its own message', () => {
    const res = run(dir, ['walkthrough', 'record', 'skipped']);
    assert.strictEqual(res.status, 'skipped');
    assert.deepStrictEqual(projectManifest(dir).walkthrough, { status: 'skipped' });
    assert.strictEqual(stateGit(dir, ['log', '-1', '--pretty=%s']).trim(), 'chore(help): walkthrough skipped');
  });

  it('refuses any other value, and refuses once anything is recorded — the offer is answered once', () => {
    refuses(dir, ['walkthrough', 'record', 'bananas'], /one of walked, skipped — got "bananas"/);
    refuses(dir, ['walkthrough', 'record'], /Usage: engine walkthrough record/);
    refuses(dir, ['walkthrough', 'record', 'walked', 'skipped'], /Usage: engine walkthrough record/);
    refuses(dir, ['walkthrough', 'nope'], /Unknown walkthrough command/);
    assert.strictEqual(projectManifest(dir).walkthrough, undefined, 'a refused answer writes nothing');

    run(dir, ['walkthrough', 'record', 'walked']);
    refuses(dir, ['walkthrough', 'record', 'skipped'], /the walkthrough is "walked" — the answer is recorded once/);
    refuses(dir, ['walkthrough', 'record', 'walked'], /recorded once/);
    setProjectManifest(dir, (m) => { m.walkthrough = { status: 'skipped' }; });
    refuses(dir, ['walkthrough', 'record', 'walked'], /the walkthrough is "skipped"/);
  });

  it('a nothing-recorded object and a missing project manifest both take the answer', () => {
    setProjectManifest(dir, (m) => { m.walkthrough = {}; });
    stateGit(dir, ['commit', '-q', '-am', 'nothing recorded']);
    run(dir, ['walkthrough', 'record', 'walked']);
    assert.deepStrictEqual(projectManifest(dir).walkthrough, { status: 'walked' });

    fs.rmSync(path.join(dir, '.leeway/manifest.json'));
    stateGit(dir, ['commit', '-q', '-am', 'drop the project manifest']);
    const res = run(dir, ['walkthrough', 'record', 'skipped']);
    assert.deepStrictEqual(projectManifest(dir).walkthrough, { status: 'skipped' });
    assert.match(res.committed, /^[0-9a-f]+$/);
  });

  it('the baseline verdict and the walkthrough answer are separate records on one manifest', () => {
    run(dir, ['baseline', 'record', 'native']);
    run(dir, ['walkthrough', 'record', 'skipped']);
    const m = projectManifest(dir);
    assert.deepStrictEqual(m.baseline, { status: 'native' });
    assert.deepStrictEqual(m.walkthrough, { status: 'skipped' });
  });
});

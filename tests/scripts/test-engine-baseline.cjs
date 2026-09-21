'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const harness = require('./engine-harness.cjs');

const { git } = harness;

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
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows/manifest.json'), 'utf8'));
}

describe('engine baseline record', () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-baseline-'));
    git(dir, ['init', '-q', '-b', 'main']);
    git(dir, ['config', 'user.email', 'test@example.com']);
    git(dir, ['config', 'user.name', 'Test']);
    git(dir, ['config', 'commit.gpgsign', 'false']);
    writeFile(dir, '.workflows/manifest.json', JSON.stringify({ work_units: { pay: { work_type: 'feature' } } }, null, 2) + '\n');
    writeFile(dir, '.workflows/pay/manifest.json', '{"name":"pay","work_type":"feature","status":"in-progress"}\n');
    writeFile(dir, '.workflows/pay/discussion/pay.md', '# Discussion\n');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'init']);
  });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('native: writes the verdict and commits it confined to the project manifest — a peer session\'s dirt never rides', () => {
    // A peer mid-write: an untracked scratch note and a modified discussion.
    writeFile(dir, '.workflows/pay/NOTES.md', 'peer scratch\n');
    writeFile(dir, '.workflows/pay/discussion/pay.md', '# Discussion\n\npeer session dirt\n');

    const res = run(dir, ['baseline', 'record', 'native']);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'native');
    assert.match(res.committed, /^[0-9a-f]+$/);
    assert.deepStrictEqual(projectManifest(dir).baseline, { status: 'native' });
    assert.deepStrictEqual(projectManifest(dir).work_units, { pay: { work_type: 'feature' } }, 'sibling keys survive');

    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'baseline: the project grew up on the workflows');
    const landed = git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).split('\n').map((l) => l.trim()).filter(Boolean);
    assert.deepStrictEqual(landed, ['.workflows/manifest.json']);
    const status = git(dir, ['status', '--porcelain']).split('\n').filter(Boolean);
    assert.ok(status.some((l) => l.startsWith('?? ') && l.includes('NOTES.md')), `the peer's untracked note is still untracked:\n${status.join('\n')}`);
    assert.ok(status.some((l) => l.startsWith(' M ') && l.includes('discussion/pay.md')), `the peer's modified discussion is still dirty:\n${status.join('\n')}`);
  });

  it('skipped: the decline, with its own message', () => {
    const res = run(dir, ['baseline', 'record', 'skipped']);
    assert.strictEqual(res.status, 'skipped');
    assert.deepStrictEqual(projectManifest(dir).baseline, { status: 'skipped' });
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'baseline: decline the assessment offer');
  });

  it('refuses any other value, and refuses once anything is recorded — the judgment happens once', () => {
    refuses(dir, ['baseline', 'record', 'bananas'], /one of native, skipped — got "bananas"/);
    refuses(dir, ['baseline', 'record'], /Usage: engine baseline record/);
    refuses(dir, ['baseline', 'nope'], /Unknown baseline command/);
    assert.strictEqual(projectManifest(dir).baseline, undefined, 'a refused verdict writes nothing');

    run(dir, ['baseline', 'record', 'native']);
    refuses(dir, ['baseline', 'record', 'skipped'], /the baseline is "native" — the verdict is recorded once/);
    refuses(dir, ['baseline', 'record', 'native'], /recorded once/);
    for (const status of ['in-progress', 'completed', 'skipped']) {
      const m = projectManifest(dir);
      m.baseline = { status, areas: { overview: 'completed' } };
      writeFile(dir, '.workflows/manifest.json', JSON.stringify(m, null, 2) + '\n');
      refuses(dir, ['baseline', 'record', 'native'], new RegExp(`the baseline is "${status}"`));
    }
  });

  it('a nothing-recorded object and a missing project manifest both take the verdict', () => {
    const m = projectManifest(dir);
    m.baseline = {};
    writeFile(dir, '.workflows/manifest.json', JSON.stringify(m, null, 2) + '\n');
    git(dir, ['commit', '-q', '-am', 'nothing recorded']);
    run(dir, ['baseline', 'record', 'native']);
    assert.deepStrictEqual(projectManifest(dir).baseline, { status: 'native' });

    fs.rmSync(path.join(dir, '.workflows/manifest.json'));
    git(dir, ['commit', '-q', '-am', 'drop the project manifest']);
    const res = run(dir, ['baseline', 'record', 'skipped']);
    assert.deepStrictEqual(projectManifest(dir).baseline, { status: 'skipped' });
    assert.match(res.committed, /^[0-9a-f]+$/);
  });
});

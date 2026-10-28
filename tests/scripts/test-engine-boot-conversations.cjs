'use strict';

// ---------------------------------------------------------------------------
// The conversation folders at boot (workflow-engine/scripts/domain/boot.cjs
// with domain/conversation.cjs): a folder whose transcript is gone deleted,
// every conversation's tidied whichever project marked it, the trust log's
// events one kept waiting appended first (domain/trust-log.cjs), and the
// boot's own marked after the tidy.
//
// Layer: verb. World: the project fixture (boot-world.cjs), a git repository
// with its state worktree and the workflows' hooks, made once per process and
// copied; boot runs from a copy of the engine beside a stand-in migration
// runner whose behaviour the test picks through the environment.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { createFile } = require('./discovery-test-utils.cjs');
const { setupProject, stubbed, bootProject, runEngine } = require('./boot-world.cjs');
const { trustEvent } = require('../../skills/workflow-engine/scripts/domain/trust-events.cjs');
const { newId } = require('../../skills/workflow-engine/scripts/domain/ledger-ids.cjs');

describe('engine boot: the conversation folders', () => {
  let fix;
  let config;
  beforeEach(() => {
    fix = bootProject();
    config = path.join(fix.root, 'config');
  });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  const folder = (/** @type {string} */ id) => path.join(config, 'conversations', id);

  /** A conversation's folder holding `files`, by name. */
  function conversation(/** @type {string} */ id, /** @type {Record<string, string>} */ files) {
    for (const [name, content] of Object.entries(files)) createFile(folder(id), name, content);
  }

  /** Boot in `project`, the system config directory this test's own. */
  const boot = (/** @type {string} */ project, env = {}) => runEngine(stubbed, project, ['boot'], { WORKFLOWS_CONFIG_DIR: config, ...env });

  /** The path of `id`'s transcript in project folder `key` of this test's own directory of Claude Code projects. */
  const transcriptPath = (/** @type {string} */ key, /** @type {string} */ id) => path.join(fix.root, 'projects', key, `${id}.jsonl`);

  /** `id`'s transcript, made in project folder `key`. */
  function transcript(/** @type {string} */ key, /** @type {string} */ id) {
    const file = transcriptPath(key, id);
    createFile(path.dirname(file), path.basename(file), '');
    return file;
  }

  it('deletes each folder whose transcript is gone, whatever it holds — one whose transcript is there, or that names none, stays', () => {
    const live = transcript('app', 'live');
    conversation('gone', { workflow: '', transcript: transcriptPath('app', 'gone'), 'position.json': '{"name":"pay"}', 'gate.json': 'null' });
    conversation('live', { workflow: '', transcript: live });
    conversation('unnamed', { workflow: '' });

    boot(fix.project);

    assert.ok(!fs.existsSync(folder('gone')));
    assert.deepStrictEqual(fs.readdirSync(folder('live')).sort(), ['transcript', 'workflow']);
    assert.deepStrictEqual(fs.readdirSync(folder('unnamed')), ['workflow']);
  });

  it('a boot in any project tidies every conversation\'s folder, whichever project marked it — the transcript found by its name, whichever project folder the hook named', () => {
    // Resumed from another checkout, the conversation ends with a path under
    // that checkout's key, while its transcript stays where it began.
    const file = transcript('app', 'sess-1');
    const env = { WORKFLOWS_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'sess-1' };
    runEngine(stubbed, fix.project, ['session', 'repair'], env);
    stubbed.ok(fix.project, ['conversation', 'end'], { env, stdin: JSON.stringify({ session_id: 'sess-1', transcript_path: transcriptPath('app-wt', 'sess-1') }) });
    assert.deepStrictEqual(fs.readdirSync(folder('sess-1')).sort(), ['transcript', 'workflow']);

    const other = setupProject(path.join(fix.root, 'other'));
    boot(other);
    assert.ok(fs.existsSync(folder('sess-1')), 'kept while its transcript is there');

    fs.unlinkSync(file);
    boot(other);
    assert.ok(!fs.existsSync(folder('sess-1')));
  });

  it('while the append still fails, a boot warns and the trust log event waits, its folder kept though the transcript is gone; once it can succeed, the next boot lands it, then the tidy-up takes the folder (16.S74)', () => {
    const session = '6f1c2b9a-0d4e-4a7b-9c3e-2f5a8b7d1e40';
    const header = { id: newId(), at: '2026-10-28T10:00:00Z', project: null, project_name: null, model: null, session };
    const waiting = `${JSON.stringify(trustEvent('call', header, { entry: newId(), kind: null, label: null, sort: null }))}\n`;
    const trust = path.join(config, 'trust.jsonl');
    conversation(session, { workflow: '', transcript: transcriptPath('app', session), 'trust-pending.jsonl': waiting });
    fs.mkdirSync(trust, { recursive: true });

    const failed = boot(fix.project);

    assert.match(failed.warnings.join('\n'), /^the trust log was not written: .+ — the events waiting in the conversations wait for the next record or start$/m);
    assert.strictEqual(fs.readFileSync(path.join(folder(session), 'trust-pending.jsonl'), 'utf8'), waiting);

    fs.rmdirSync(trust);
    boot(fix.project);

    assert.strictEqual(fs.readFileSync(trust, 'utf8'), waiting);
    assert.ok(!fs.existsSync(folder(session)));
  });

  it('the boot\'s own conversation is marked after the tidy — a folder the tidy takes comes back holding the mark', () => {
    conversation('sess-1', { workflow: '', transcript: transcriptPath('app', 'sess-1') });

    boot(fix.project, { CLAUDE_CODE_SESSION_ID: 'sess-1' });

    assert.deepStrictEqual(fs.readdirSync(folder('sess-1')), ['workflow']);
  });
});

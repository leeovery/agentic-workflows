'use strict';

// ---------------------------------------------------------------------------
// Boot's system-config detection (workflow-engine/scripts/domain/boot.cjs):
// what a not-ready boot reports of the machine's knowledge config under ~,
// absent, valid or invalid, never key material.
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
const { stubbed, readyKnowledge, bootProject, runEngine } = require('./boot-world.cjs');

describe('engine boot system-config detection', () => {
  let fix;
  let home;
  beforeEach(() => {
    fix = bootProject();
    // Hermetic home: system-config detection resolves ~ via $HOME, so the
    // developer's real ~/.config/workflows never leaks into assertions.
    home = path.join(fix.root, 'home');
    fs.mkdirSync(home, { recursive: true });
  });
  afterEach(() => { fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  function writeSystemConfig(content) {
    createFile(home, '.config/workflows/config.json', content);
  }

  // The suite's hermetic config directory answers ahead of $HOME, so it comes
  // off every child environment here — this describe is about the ~ path.
  const underHome = (extra = {}) => ({ HOME: home, WORKFLOWS_CONFIG_DIR: undefined, ...extra });

  it('not-ready with no system config reports absent', () => {
    const res = runEngine(stubbed, fix.project, ['boot'], underHome());

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.deepStrictEqual(res.system_config, { status: 'absent', provider: null, model: null });
  });

  it('not-ready with a valid provider config reports provider and model — never key material', () => {
    writeSystemConfig(JSON.stringify({
      knowledge: { provider: 'openai', model: 'text-embedding-3-small', dimensions: 1536 },
    }));
    // Both key sources present on disk/env — neither may reach the response.
    createFile(home, '.config/workflows/credentials.json', JSON.stringify({
      credentials: { openai: { api_key: 'sk-STORED-SECRET' } },
    }));

    const res = runEngine(stubbed, fix.project, ['boot'], underHome({ OPENAI_API_KEY: 'sk-ENV-SECRET' }));

    assert.strictEqual(res.knowledge, 'not-ready');
    assert.deepStrictEqual(res.system_config, {
      status: 'valid',
      provider: 'openai',
      model: 'text-embedding-3-small',
    });
    assert.ok(!JSON.stringify(res).includes('SECRET'));
  });

  it('not-ready with a valid providerless config reports valid with nulls (keyword-only)', () => {
    writeSystemConfig(JSON.stringify({ knowledge: {} }));

    const res = runEngine(stubbed, fix.project, ['boot'], underHome());

    assert.deepStrictEqual(res.system_config, { status: 'valid', provider: null, model: null });
  });

  it('not-ready with an unparseable or wrongly-shaped config reports invalid', () => {
    writeSystemConfig('not json at all');
    const res1 = runEngine(stubbed, fix.project, ['boot'], underHome());
    assert.deepStrictEqual(res1.system_config, { status: 'invalid', provider: null, model: null });

    writeSystemConfig(JSON.stringify({ knowledge: 'not-an-object' }));
    const res2 = runEngine(stubbed, fix.project, ['boot'], underHome());
    assert.deepStrictEqual(res2.system_config, { status: 'invalid', provider: null, model: null });
  });

  it('not-ready with a knowledge-less shared config file reports absent', () => {
    writeSystemConfig(JSON.stringify({ editor: { theme: 'dark' } }));
    const res = runEngine(stubbed, fix.project, ['boot'], underHome());
    assert.deepStrictEqual(res.system_config, { status: 'absent', provider: null, model: null });
  });

  it('ready responses carry no system_config field', () => {
    writeSystemConfig(JSON.stringify({ knowledge: { provider: 'openai', model: 'm' } }));
    readyKnowledge(fix.project);

    const res = runEngine(stubbed, fix.project, ['boot'], underHome());

    assert.strictEqual(res.knowledge, 'ready');
    assert.ok(!('system_config' in res));
  });
});

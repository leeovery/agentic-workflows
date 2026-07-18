'use strict';

// Unit tests for the non-interactive setup forms (src/knowledge/setup-forms.js):
// form selection, refusal constants, the active-settings summary, and the
// --key-only flow against injected prompt deps. CLI-level behaviour of the
// full forms is covered end-to-end in test-knowledge-cli.sh.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const forms = require('../../src/knowledge/setup-forms.js');
const config = require('../../src/knowledge/config.js');

describe('parseSetupForm', () => {
  it('no form flags selects the wizard', () => {
    assert.deepStrictEqual(forms.parseSetupForm({}), { form: 'wizard' });
    // Unrelated flags (e.g. --dry-run) do not select a form.
    assert.deepStrictEqual(forms.parseSetupForm({ 'dry-run': true }), { form: 'wizard' });
  });

  it('each flag selects its form', () => {
    assert.deepStrictEqual(forms.parseSetupForm({ 'from-system': true }), { form: 'from-system' });
    assert.deepStrictEqual(forms.parseSetupForm({ 'keyword-only': true }), { form: 'keyword-only' });
    assert.deepStrictEqual(forms.parseSetupForm({ provider: 'openai' }), { form: 'provider' });
    assert.deepStrictEqual(forms.parseSetupForm({ 'key-only': true }), { form: 'key-only' });
  });

  it('--provider modifies --key-only rather than conflicting with it', () => {
    assert.deepStrictEqual(
      forms.parseSetupForm({ 'key-only': true, provider: 'openai-compatible' }),
      { form: 'key-only' }
    );
  });

  it('--key is refused in any position, before any form runs', () => {
    for (const flags of [
      { key: 'sk-abc' },
      { key: true },
      { 'from-system': true, key: 'sk-abc' },
      { 'key-only': true, key: 'sk-abc' },
    ]) {
      assert.deepStrictEqual(forms.parseSetupForm(flags), { error: forms.KEY_FLAG_REFUSAL });
    }
    assert.match(forms.KEY_FLAG_REFUSAL, /never pass through command arguments/);
    assert.match(forms.KEY_FLAG_REFUSAL, /--key-only/);
  });

  it('two forms at once are refused', () => {
    assert.deepStrictEqual(
      forms.parseSetupForm({ 'from-system': true, 'keyword-only': true }),
      { error: forms.FORM_CONFLICT_REFUSAL }
    );
    assert.deepStrictEqual(
      forms.parseSetupForm({ 'key-only': true, 'from-system': true }),
      { error: forms.FORM_CONFLICT_REFUSAL }
    );
  });
});

describe('summaryLines', () => {
  it('keyword-only names the mode and the upgrade path', () => {
    const lines = forms.summaryLines(null);
    assert.match(lines[0], /keyword-only \(BM25\)/);
    assert.match(lines.join('\n'), /Upgrade anytime/);
  });

  it('openai shows provider and model only', () => {
    const lines = forms.summaryLines({ provider: 'openai', model: 'text-embedding-3-small' });
    assert.deepStrictEqual(lines, [
      'Knowledge base ready.',
      '  provider: openai',
      '  model:    text-embedding-3-small',
    ]);
  });

  it('openai-compatible adds the base URL; no other fields appear', () => {
    const lines = forms.summaryLines({
      provider: 'openai-compatible',
      model: 'nomic-embed',
      base_url: 'http://localhost:1234/v1',
    });
    assert.deepStrictEqual(lines, [
      'Knowledge base ready.',
      '  provider: openai-compatible',
      '  model:    nomic-embed',
      '  base URL: http://localhost:1234/v1',
    ]);
  });
});

describe('runKeyOnly', () => {
  let home;
  let savedHome;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-keyonly-'));
    savedHome = process.env.HOME;
    process.env.HOME = home;
  });

  afterEach(() => {
    process.env.HOME = savedHome;
    fs.rmSync(home, { recursive: true, force: true });
  });

  const deps = (answers) => ({
    requireTTY: () => {},
    createPrompter: () => ({ close: () => {} }),
    askSecret: async () => answers.shift(),
  });

  it('stores the prompted key under openai by default, mode 0600', async () => {
    await forms.runKeyOnly({ 'key-only': true }, deps(['sk-test-123']));

    const credPath = config.credentialsPath();
    assert.ok(credPath.startsWith(home));
    const parsed = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    assert.deepStrictEqual(parsed, { credentials: { openai: { api_key: 'sk-test-123' } } });
    assert.strictEqual(fs.statSync(credPath).mode & 0o777, 0o600);
  });

  it('re-prompts on empty input until a key arrives', async () => {
    await forms.runKeyOnly({ 'key-only': true }, deps(['', '', 'sk-after-retries']));
    const parsed = JSON.parse(fs.readFileSync(config.credentialsPath(), 'utf8'));
    assert.strictEqual(parsed.credentials.openai.api_key, 'sk-after-retries');
  });

  it('--provider selects the credentials entry the key lands under', async () => {
    await forms.runKeyOnly({ 'key-only': true, provider: 'openai-compatible' }, deps(['local-key']));
    const parsed = JSON.parse(fs.readFileSync(config.credentialsPath(), 'utf8'));
    assert.deepStrictEqual(parsed, { credentials: { 'openai-compatible': { api_key: 'local-key' } } });
  });

  it('an unknown provider is a refusal, raised before any prompt', async () => {
    let prompted = false;
    await assert.rejects(
      () => forms.runKeyOnly({ 'key-only': true, provider: 'bogus' }, {
        requireTTY: () => {},
        createPrompter: () => ({ close: () => {} }),
        askSecret: async () => { prompted = true; return 'x'; },
      }),
      forms.SetupRefusal
    );
    assert.strictEqual(prompted, false);
    assert.ok(!fs.existsSync(config.credentialsPath()));
  });
});

describe('runFromSystem refusals', () => {
  let home;
  let project;
  let savedHome;
  let savedCwd;
  let savedEnvKey;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-fromsys-home-'));
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-fromsys-proj-'));
    fs.mkdirSync(path.join(project, '.workflows'), { recursive: true });
    savedHome = process.env.HOME;
    savedCwd = process.cwd();
    savedEnvKey = process.env.OPENAI_API_KEY;
    process.env.HOME = home;
    delete process.env.OPENAI_API_KEY;
    process.chdir(project);
  });

  afterEach(() => {
    process.chdir(savedCwd);
    process.env.HOME = savedHome;
    if (savedEnvKey !== undefined) process.env.OPENAI_API_KEY = savedEnvKey;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  });

  const noBulk = async () => { throw new Error('bulk index must not run on a refusal'); };

  it('refuses when no system config exists, naming the remedies', async () => {
    await assert.rejects(() => forms.runFromSystem(noBulk, {}), (err) => {
      assert.ok(err instanceof forms.SetupRefusal);
      assert.match(err.message, /no system config found/);
      assert.match(err.message, /--provider/);
      assert.match(err.message, /--keyword-only/);
      return true;
    });
    assert.ok(!fs.existsSync(path.join(project, '.workflows', '.knowledge')));
  });

  it('refuses an invalid system config with the parse reason', async () => {
    fs.mkdirSync(path.join(home, '.config', 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(home, '.config', 'workflows', 'config.json'), '{"nope":1}');
    await assert.rejects(() => forms.runFromSystem(noBulk, {}), (err) => {
      assert.ok(err instanceof forms.SetupRefusal);
      assert.match(err.message, /is not valid/);
      return true;
    });
  });

  it('refuses an unresolvable openai key, naming the env var and --key-only', async () => {
    fs.mkdirSync(path.join(home, '.config', 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(home, '.config', 'workflows', 'config.json'),
      JSON.stringify({ knowledge: { provider: 'openai', model: 'text-embedding-3-small', dimensions: 1536 } })
    );
    await assert.rejects(() => forms.runFromSystem(noBulk, {}), (err) => {
      assert.ok(err instanceof forms.SetupRefusal);
      assert.match(err.message, /\$OPENAI_API_KEY/);
      assert.match(err.message, /--key-only/);
      assert.match(err.message, /Never paste the key into a chat/);
      return true;
    });
    // Nothing was created before the refusal.
    assert.ok(!fs.existsSync(path.join(project, '.workflows', '.knowledge')));
  });
});

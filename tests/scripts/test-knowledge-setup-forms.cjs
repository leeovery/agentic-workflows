'use strict';

// Unit tests for the knowledge setup forms: form selection, refusal
// constants, the active-settings summary, the initial index every form ends
// with, and the --key-only flow and the interactive wizard against injected
// prompt deps. Behaviour of the full forms through `engine knowledge setup`
// is covered end-to-end in test-knowledge-cli.sh.

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const forms = require('../../skills/workflow-engine/scripts/domain/knowledge/setup-forms.cjs');
const setup = require('../../skills/workflow-engine/scripts/domain/knowledge/setup.cjs');
const { runWizard, runKeyOnly } = require('../../skills/workflow-engine/scripts/domain/knowledge/setup-wizard.cjs');
const { loadSettings } = require('../../skills/workflow-engine/scripts/domain/knowledge/embedder.cjs');
const config = require('../../skills/workflow-engine/scripts/kernel/knowledge/config.cjs');
const store = require('../../skills/workflow-engine/scripts/kernel/knowledge/store.cjs');
const { knowledgeFiles } = require('../../skills/workflow-engine/scripts/kernel/knowledge/files.cjs');
const { heldCall } = require('./knowledge-harness.cjs');

/**
 * A throwaway home the system config resolves through. These forms read
 * `~/.config/workflows`, so the suite's hermetic override — which answers
 * ahead of `$HOME` — comes off for the duration.
 */
function fakeConfigHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-home-'));
  const savedHome = process.env.HOME;
  const savedOverride = process.env.WORKFLOWS_CONFIG_DIR;
  process.env.HOME = home;
  delete process.env.WORKFLOWS_CONFIG_DIR;
  return {
    home,
    restore() {
      process.env.HOME = savedHome;
      process.env.WORKFLOWS_CONFIG_DIR = savedOverride;
      fs.rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    },
  };
}

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
  let configHome;

  beforeEach(() => {
    configHome = fakeConfigHome();
    home = configHome.home;
  });

  afterEach(() => {
    configHome.restore();
  });

  const deps = (answers) => ({
    requireTTY: () => {},
    createPrompter: () => ({ close: () => {} }),
    askSecret: async () => answers.shift(),
  });

  it('stores the prompted key under openai by default, mode 0600', async () => {
    await runKeyOnly(heldCall(home).call, { 'key-only': true }, deps(['sk-test-123']));

    const credPath = config.credentialsPath();
    assert.ok(credPath.startsWith(home));
    const parsed = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    assert.deepStrictEqual(parsed, { credentials: { openai: { api_key: 'sk-test-123' } } });
    assert.strictEqual(fs.statSync(credPath).mode & 0o777, 0o600);
  });

  it('re-prompts on empty input until a key arrives', async () => {
    await runKeyOnly(heldCall(home).call, { 'key-only': true }, deps(['', '', 'sk-after-retries']));
    const parsed = JSON.parse(fs.readFileSync(config.credentialsPath(), 'utf8'));
    assert.strictEqual(parsed.credentials.openai.api_key, 'sk-after-retries');
  });

  it('--provider selects the credentials entry the key lands under', async () => {
    await runKeyOnly(heldCall(home).call, { 'key-only': true, provider: 'openai-compatible' }, deps(['local-key']));
    const parsed = JSON.parse(fs.readFileSync(config.credentialsPath(), 'utf8'));
    assert.deepStrictEqual(parsed, { credentials: { 'openai-compatible': { api_key: 'local-key' } } });
  });

  it('an unknown provider is a refusal, raised before any prompt', async () => {
    let prompted = false;
    await assert.rejects(
      () => runKeyOnly(heldCall(home).call, { 'key-only': true, provider: 'bogus' }, {
        requireTTY: () => {},
        createPrompter: () => ({ close: () => {} }),
        askSecret: async () => { prompted = true; return 'x'; },
      }),
      setup.SetupRefusal
    );
    assert.strictEqual(prompted, false);
    assert.ok(!fs.existsSync(config.credentialsPath()));
  });
});

describe('runFromSystem and runKeywordOnly refusals', () => {
  let home;
  let project;
  let configHome;

  beforeEach(() => {
    configHome = fakeConfigHome();
    home = configHome.home;
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-fromsys-proj-'));
    fs.mkdirSync(path.join(project, '.workflows'), { recursive: true });
  });

  afterEach(() => {
    configHome.restore();
    fs.rmSync(project, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  const call = () => heldCall(project).call;

  it('refuses when no system config exists, naming the remedies', async () => {
    await assert.rejects(() => forms.runFromSystem(call(), project), (err) => {
      assert.ok(err instanceof setup.SetupRefusal);
      assert.match(err.message, /no system config found/);
      assert.match(err.message, /--provider/);
      assert.match(err.message, /--keyword-only/);
      return true;
    });
    assert.ok(!fs.existsSync(path.join(project, '.workflows', '.knowledge')));
  });

  it('refuses an invalid system config with the parse reason', async () => {
    fs.mkdirSync(path.join(home, '.config', 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(home, '.config', 'workflows', 'config.json'), '{"knowledge":42}');
    await assert.rejects(() => forms.runFromSystem(call(), project), (err) => {
      assert.ok(err instanceof setup.SetupRefusal);
      assert.match(err.message, /is not valid/);
      return true;
    });
  });

  it('keyword-only refuses an unreadable system config before it writes anything', async () => {
    const knowledgeDir = path.join(project, '.workflows', '.knowledge');
    fs.mkdirSync(path.join(home, '.config', 'workflows'), { recursive: true });
    for (const [content, reason] of [['{ not json', /not valid JSON/], ['{"knowledge":42}', /invalid "knowledge" key/]]) {
      fs.writeFileSync(path.join(home, '.config', 'workflows', 'config.json'), content);
      await assert.rejects(() => forms.runKeywordOnly(call(), project), (err) => {
        assert.ok(err instanceof setup.SetupRefusal);
        assert.match(err.message, /^system config at .* is not valid/);
        assert.match(err.message, reason);
        return true;
      });
      assert.ok(!fs.existsSync(path.join(knowledgeDir, 'store.bin')), 'no store written');
      assert.ok(!fs.existsSync(path.join(knowledgeDir, 'metadata.json')), 'no metadata written');
      assert.ok(!fs.existsSync(knowledgeDir), 'nothing written at all');
    }
  });

  it('treats a knowledge-less shared config (session settings only) as no system config', async () => {
    fs.mkdirSync(path.join(home, '.config', 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(home, '.config', 'workflows', 'config.json'),
      JSON.stringify({ session: { tmux_labels: true } })
    );
    await assert.rejects(() => forms.runFromSystem(call(), project), (err) => {
      assert.ok(err instanceof setup.SetupRefusal);
      assert.match(err.message, /no system config found/);
      return true;
    });
  });

  it('refuses an unresolvable openai key, naming the env var and --key-only', async () => {
    fs.mkdirSync(path.join(home, '.config', 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(home, '.config', 'workflows', 'config.json'),
      JSON.stringify({ knowledge: { provider: 'openai', model: 'text-embedding-3-small', dimensions: 1536 } })
    );
    await assert.rejects(() => forms.runFromSystem(call(), project), (err) => {
      assert.ok(err instanceof setup.SetupRefusal);
      assert.match(err.message, /\$OPENAI_API_KEY/);
      assert.match(err.message, /--key-only/);
      assert.match(err.message, /Never paste the key into a chat/);
      return true;
    });
    // Nothing was created before the refusal.
    assert.ok(!fs.existsSync(path.join(project, '.workflows', '.knowledge')));
  });
});

describe('runInitialIndexStep', () => {
  let project;
  let held;

  /** A keyword-only project whose one discussion is completed, holding `body`. @param {string} body */
  function discussionProject(body) {
    const wf = path.join(project, '.workflows');
    fs.mkdirSync(path.join(wf, 'auth', 'discussion'), { recursive: true });
    fs.writeFileSync(path.join(wf, 'manifest.json'), JSON.stringify({ work_units: { auth: { work_type: 'feature' } } }));
    fs.writeFileSync(path.join(wf, 'auth', 'manifest.json'), JSON.stringify({
      name: 'auth', work_type: 'feature', status: 'in-progress',
      phases: { discussion: { items: { auth: { status: 'completed' } } } },
    }));
    fs.writeFileSync(path.join(wf, 'auth', 'discussion', 'auth.md'), body);
    fs.mkdirSync(path.join(wf, '.knowledge'), { recursive: true });
    fs.writeFileSync(path.join(wf, '.knowledge', 'config.json'), '{ "knowledge": { "provider": null } }\n');
  }

  beforeEach(() => {
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-initial-'));
    held = heldCall(project);
  });

  afterEach(() => {
    fs.rmSync(project, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  const initialIndex = () => setup.runInitialIndexStep(held.call, project, knowledgeFiles(project));

  it('a clean initial index says nothing on stderr', async () => {
    discussionProject('# Auth\n\nTokens rotate.\n');
    await initialIndex();
    assert.strictEqual(held.output.stderr, '');
    assert.match(held.output.stdout, /^1 new, 0 changed, 0 removed, 0 unchanged\.$/m);
  });

  it('artifacts that failed to index are counted, and setup still succeeds', async () => {
    discussionProject('');
    await initialIndex();
    assert.match(held.output.stderr, /^Failed to index \.workflows\/auth\/discussion\/auth\.md: No chunks produced/m);
    assert.ok(held.output.stderr.endsWith('\n1 artifact(s) failed to index — the next start retries them.\n'));
  });

  it('chunks awaiting vectors are counted, and setup still succeeds', async () => {
    discussionProject('# Auth\n\nTokens rotate.\n');
    const files = knowledgeFiles(project);
    const openai = { provider: 'openai', model: 'text-embedding-3-small', dimensions: 8 };
    store.saveStore(store.createStore(), files.store);
    store.writeMetadata(files.metadata, { ...openai, last_indexed: null });
    fs.writeFileSync(files.config, JSON.stringify({ knowledge: openai }));
    await initialIndex();
    assert.ok(held.output.stderr.endsWith('\n1 chunk(s) await vectors — searchable by keyword; each start retries them.\n'));
  });

  it('an initial index that throws is reported, and setup still succeeds', async () => {
    discussionProject('# Auth\n\nTokens rotate.\n');
    fs.writeFileSync(path.join(project, '.workflows', 'manifest.json'), '{ not json');
    await initialIndex();
    assert.match(held.output.stderr, /Initial indexing hit an error: manifest read failed: /);
    assert.match(held.output.stderr, /The project is initialised; the next start retries the indexing\./);
  });
});

describe('the interactive wizard', () => {
  let configHome;
  let project;

  beforeEach(() => {
    configHome = fakeConfigHome();
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-wizard-proj-'));
    fs.mkdirSync(path.join(project, '.workflows'), { recursive: true });
  });

  afterEach(() => {
    configHome.restore();
    fs.rmSync(project, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  /** A prompter answering each question in turn. @param {string[]} answers */
  const prompter = (answers) => () => ({ question: (_prompt, answer) => answer(answers.shift()), close: () => {} });

  it('lifts a project pinned keyword-only when it keeps a system config naming a provider', async () => {
    const system = config.systemConfigPath();
    fs.mkdirSync(path.dirname(system), { recursive: true });
    fs.writeFileSync(system, JSON.stringify({
      knowledge: { provider: 'openai-compatible', base_url: 'http://127.0.0.1:9/v1', model: 'm', dimensions: 8 },
    }));
    const files = knowledgeFiles(project);
    await forms.runKeywordOnly(heldCall(project).call, project);
    assert.deepStrictEqual(config.readConfigFile(files.config), { provider: null });

    await runWizard(heldCall(project).call, project, { requireTTY: () => {}, createPrompter: prompter(['n', 'n']) });
    assert.deepStrictEqual(config.readConfigFile(files.config), {});
    assert.strictEqual(loadSettings(files).cfg.provider, 'openai-compatible');
  });

  it('a store it creates records the model its provider embeds with, where the config names none', async (t) => {
    const system = config.systemConfigPath();
    fs.mkdirSync(path.dirname(system), { recursive: true });
    fs.writeFileSync(system, JSON.stringify({ knowledge: { provider: 'openai' } }));
    process.env.OPENAI_API_KEY = 'sk-wizard';
    t.after(() => { delete process.env.OPENAI_API_KEY; });

    const held = heldCall(project);
    await runWizard(held.call, project, { requireTTY: () => {}, createPrompter: prompter(['n']) });
    const files = knowledgeFiles(project);
    const { provider } = loadSettings(files);
    assert.deepStrictEqual(store.readMetadata(files.metadata), {
      provider: 'openai', model: provider.model(), dimensions: provider.dimensions(), last_indexed: store.readMetadata(files.metadata).last_indexed, fill_failure: null,
    });
    assert.doesNotMatch(held.output.stderr, /Initial indexing hit an error/);
  });

  it('refuses without a terminal, before it asks anything', async () => {
    const held = heldCall(project);
    await assert.rejects(runWizard(held.call, project), (err) => err.code === 1);
    assert.strictEqual(held.output.stderr,
      'knowledge setup requires an interactive terminal. Run it directly, not through Claude or a pipe.\n');
  });
});

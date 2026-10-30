'use strict';

// `engine knowledge setup` end to end through the door: --key-only refused
// without a terminal or a provider it knows, the --key flag refused, and each
// non-interactive form — --keyword-only, --from-system, --provider — from
// its arguments to the config, the store and the summary it leaves, the key
// kept out of every output and file. Verb layer: the door in process
// (knowledge-harness), over the project world copied for each test with no
// knowledge set up, the system config a directory of the test's own, an
// endpoint the stand-in (embeddingEndpoint). Each form's own refusals and
// what it writes of a config are test-knowledge-setup-forms.cjs's.

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');
const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { setupFixture, cleanupFixture, statePath, createFile } = require('./discovery-test-utils.cjs');
const {
  ENGINE_COMMAND, KEYWORD_ONLY, OPENAI,
  embeddingEndpoint, engineKnowledge, refuseLaunches, knowledgeUnit, knowledgeAt, knowledgeMetadata, systemConfigDir,
} = require('./knowledge-harness.cjs');

const UPGRADE = `Upgrade anytime: \`${ENGINE_COMMAND} knowledge setup --provider ...\` `
  + `or the interactive \`${ENGINE_COMMAND} knowledge setup\`.`;

describe('engine knowledge setup', () => {
  let root;
  let system;
  let endpoint;

  /** `setup` with the flags, under the test's system config. @param {...string} flags */
  const setup = (...flags) => engineKnowledge(root, ['setup', ...flags], { LEEWAY_CONFIG_DIR: system });
  /** @param {string} file */
  const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
  const check = async () => (await engineKnowledge(root, ['check'], { LEEWAY_CONFIG_DIR: system })).stdout;
  const systemConfig = () => path.join(system, 'config.json');
  refuseLaunches();

  before(async () => {
    endpoint = await embeddingEndpoint(4);
  });

  after(() => endpoint.close());

  beforeEach((t) => {
    root = setupFixture('kb-setup-');
    system = systemConfigDir(t);
    endpoint.requests.length = 0;
  });

  afterEach(() => cleanupFixture(root));

  it('--key-only needs an interactive terminal, and a provider it stores keys for — refused before anything is asked or written', async () => {
    assert.deepStrictEqual(await setup('--key-only'), {
      code: 1, stdout: '', stderr: 'engine knowledge setup requires an interactive terminal. Run it directly, not through Claude or a pipe.\n',
    });
    assert.deepStrictEqual(await setup('--key-only', '--provider', 'bogus'),
      { code: 1, stdout: '', stderr: 'Error: --key-only supports providers openai and openai-compatible (got "bogus").\n' });
    assert.deepStrictEqual(fs.readdirSync(system), []);
    assert.ok(!fs.existsSync(knowledgeAt(root).dir));
  });

  it('refuses --key wherever it stands, never echoing the key, before any form writes', async () => {
    for (const flags of [['--key', 'sk-oops'], ['--from-system', '--key=sk-oops']]) {
      const answer = await setup(...flags);
      assert.strictEqual(answer.code, 1, flags.join(' '));
      assert.match(answer.stderr, /^Error: --key is not accepted: API keys must never pass through command arguments .*--key-only/);
      assert.ok(!`${answer.stdout}${answer.stderr}`.includes('sk-oops'), 'the key never echoes back');
    }
    assert.ok(!fs.existsSync(knowledgeAt(root).dir));
  });

  describe('--keyword-only', () => {
    it('pins the provider off in the project, never touching a system config that names one, and leaves a ready store', async () => {
      fs.writeFileSync(systemConfig(), JSON.stringify({ knowledge: OPENAI }));
      const answer = await setup('--keyword-only');
      assert.strictEqual(answer.code, 0, answer.stderr);
      assert.strictEqual(answer.stdout, [
        '  store.bin written', '  metadata.json written', '',
        'Initial indexing', '----------------', '0 new, 0 changed, 0 removed, 0 unchanged.', '',
        'Knowledge base ready — keyword-only (BM25) mode.', 'Semantic search is disabled until an embedding provider is configured.', UPGRADE, '',
      ].join('\n'));
      assert.deepStrictEqual(readJson(systemConfig()), { knowledge: OPENAI });
      assert.deepStrictEqual(readJson(knowledgeAt(root).config), { knowledge: KEYWORD_ONLY });
      assert.strictEqual(knowledgeMetadata(root).provider, null);
      assert.strictEqual(await check(), 'ready\n');
    });

    it('travels with the project: a checkout holding its config alone builds keyword-only, whatever the system names', async () => {
      await setup('--keyword-only');
      fs.writeFileSync(systemConfig(), JSON.stringify({ knowledge: OPENAI }));
      fs.rmSync(knowledgeAt(root).store);
      fs.rmSync(knowledgeAt(root).metadata);
      assert.strictEqual(await check(), 'buildable\n');
      assert.strictEqual((await engineKnowledge(root, ['index'], { LEEWAY_CONFIG_DIR: system })).code, 0);
      assert.strictEqual(knowledgeMetadata(root).provider, null);
      assert.strictEqual(await check(), 'ready\n');
    });

    it('run again, keeps the metadata it wrote and reaches its summary', async () => {
      await setup('--keyword-only');
      const metadata = fs.readFileSync(knowledgeAt(root).metadata, 'utf8');
      const again = await setup('--keyword-only');
      assert.strictEqual(again.code, 0);
      assert.match(again.stdout, /keyword-only \(BM25\)/);
      assert.strictEqual(fs.readFileSync(knowledgeAt(root).metadata, 'utf8'), metadata);
      assert.strictEqual(await check(), 'ready\n');
    });

    it('fills in a config that went missing', async () => {
      await setup('--keyword-only');
      fs.rmSync(knowledgeAt(root).config);
      assert.strictEqual((await setup('--keyword-only')).code, 0);
      assert.deepStrictEqual(readJson(knowledgeAt(root).config), { knowledge: KEYWORD_ONLY });
      assert.strictEqual(await check(), 'ready\n');
    });

    it('refuses a store left without its metadata, pointing at the rebuild', async () => {
      await setup('--keyword-only');
      fs.rmSync(knowledgeAt(root).metadata);
      const answer = await setup('--keyword-only');
      assert.strictEqual(answer.code, 1);
      assert.match(answer.stderr, /^Error: project knowledge base at .* is in an inconsistent state:\n  store\.bin is present but metadata\.json is missing\.\n  Run `.* knowledge rebuild` to re-create the store/);
    });
  });

  describe('--from-system', () => {
    it('writes nothing over a system config that does not parse', async () => {
      fs.writeFileSync(systemConfig(), 'not json');
      const answer = await setup('--from-system');
      assert.strictEqual(answer.code, 1);
      assert.match(answer.stderr, /^Error: system config at .* is not valid: /);
      assert.ok(!fs.existsSync(knowledgeAt(root).dir));
    });

    it('sets up keyword-only from a system config that names no provider, embedding nothing to validate', async () => {
      fs.writeFileSync(systemConfig(), '{ "knowledge": {} }');
      const answer = await setup('--from-system');
      assert.strictEqual(answer.code, 0, answer.stderr);
      assert.doesNotMatch(answer.stdout, /Validating/);
      assert.match(answer.stdout, /keyword-only \(BM25\)/);
      assert.strictEqual(await check(), 'ready\n');
    });

    it('validates the system\'s provider by a test embed, indexes what the project holds, and records the provider', async () => {
      fs.writeFileSync(systemConfig(), JSON.stringify({ knowledge: { provider: 'stub', dimensions: 64 } }));
      knowledgeUnit(root, 'seeded', 'epic', { imports: [{ path: 'imports/seed-conversation.md', imported_at: '2026-05-10T10:00:00Z' }] });
      createFile(statePath(root), 'seeded/imports/seed-conversation.md', '# Imported Seed\n\nOAuth notes.\n');
      const answer = await setup('--from-system');
      assert.strictEqual(answer.code, 0, answer.stderr);
      assert.strictEqual(answer.stdout, [
        'Validating stub via a test embed...', 'Embedding provider works.', '  config.json written', '  store.bin written', '  metadata.json written', '',
        'Initial indexing', '----------------', `Indexed ${statePath(root, 'seeded/imports/seed-conversation.md')} — 1 chunks (new)`,
        '1 new, 0 changed, 0 removed, 0 unchanged.', '', 'Knowledge base ready.', '  provider: stub', '',
      ].join('\n'));
      assert.strictEqual(knowledgeMetadata(root).provider, 'stub');
      assert.strictEqual(await check(), 'ready\n');
    });
  });

  describe('--provider', () => {
    it('openai refuses with no key that resolves, writing no system config', async () => {
      const answer = await setup('--provider', 'openai', '--model', 'text-embedding-3-small');
      assert.strictEqual(answer.code, 1);
      assert.match(answer.stderr, /^Error: no OpenAI API key found\.\n  Checked \$OPENAI_API_KEY and .*\n  Export OPENAI_API_KEY in your shell, or run\n  `.* knowledge setup --key-only`\n/);
      assert.deepStrictEqual(fs.readdirSync(system), []);
      assert.ok(!fs.existsSync(knowledgeAt(root).dir));
    });

    it('openai-compatible with no key validates against the endpoint, then replaces the provider settings as a set, keeping every other key', async () => {
      fs.writeFileSync(systemConfig(), JSON.stringify({
        editor: { theme: 'dark' },
        knowledge: { provider: 'openai', model: 'old-model', dimensions: 1536, similarity_threshold: 0.4, strategy: 'hybrid' },
      }));
      const answer = await setup('--provider', 'openai-compatible', '--base-url', endpoint.url, '--model', 'fake-embed', '--dimensions', '4');
      assert.strictEqual(answer.code, 0, answer.stderr);
      assert.match(answer.stdout, /^Validating openai-compatible via a test embed/m);
      assert.ok(answer.stdout.endsWith(`\nKnowledge base ready.\n  provider: openai-compatible\n  model:    fake-embed\n  base URL: ${endpoint.url}\n`), answer.stdout);
      assert.ok(endpoint.requests.length > 0, 'the endpoint was asked');
      assert.deepStrictEqual(readJson(systemConfig()), {
        editor: { theme: 'dark' },
        knowledge: { provider: 'openai-compatible', base_url: endpoint.url, model: 'fake-embed', dimensions: 4, similarity_threshold: 0.4, strategy: 'hybrid' },
      });
      assert.strictEqual(await check(), 'ready\n');
    });

    it('never lets a stored key reach the output, the system config or the project\'s files', async () => {
      const SECRET = 'sk-COMPAT-SECRET';
      fs.writeFileSync(path.join(system, 'credentials.json'), JSON.stringify({ credentials: { 'openai-compatible': { api_key: SECRET } } }), { mode: 0o600 });
      const answer = await setup('--provider', 'openai-compatible', '--base-url', endpoint.url, '--model', 'fake-embed', '--dimensions', '4');
      assert.strictEqual(answer.code, 0, answer.stderr);
      assert.ok(!`${answer.stdout}${answer.stderr}`.includes(SECRET));
      assert.ok(!fs.readFileSync(systemConfig(), 'utf8').includes(SECRET));
      for (const name of fs.readdirSync(knowledgeAt(root).dir)) {
        assert.ok(!fs.readFileSync(path.join(knowledgeAt(root).dir, name)).includes(SECRET), name);
      }
    });

    it('refuses a provider it does not know, and each setting its provider needs that is missing', async () => {
      for (const [flags, said] of [
        [['--provider', 'bogus', '--model', 'm'], 'unknown provider "bogus". Available: openai, openai-compatible.'],
        [['--provider', 'openai-compatible', '--base-url', 'http://x/v1', '--model', 'm'], "--provider openai-compatible requires --dimensions — it must match the model's native output."],
        [['--provider', 'openai-compatible', '--model', 'm', '--dimensions', '4'], '--provider openai-compatible requires --base-url (e.g. http://localhost:1234/v1).'],
        [['--provider', 'openai'], '--provider openai requires --model (e.g. text-embedding-3-small).'],
      ]) {
        assert.deepStrictEqual(await setup(...flags), { code: 1, stdout: '', stderr: `Error: ${said}\n` }, flags.join(' '));
      }
      assert.deepStrictEqual(fs.readdirSync(system), []);
      assert.ok(!fs.existsSync(knowledgeAt(root).dir));
    });
  });
});

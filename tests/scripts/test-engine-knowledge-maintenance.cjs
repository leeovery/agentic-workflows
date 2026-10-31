'use strict';

// `engine knowledge remove`, `compact` and `rebuild` through the door: what
// a removal takes by unit, phase and topic, its dry run, the project-level
// identities, a name the registry does not hold, its refusals and its
// failure; what compact prunes, its dry run and its off switch; and the
// rebuild's confirmation, its refusals, its backup and its restore. Verb
// layer: the door in process (knowledge-harness), over the project world
// copied for each test, keyword-only. Which units compact prunes is
// test-knowledge-progress.cjs's (pruneTest).

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { setupFixture, cleanupFixture, statePath, createFile } = require('./discovery-test-utils.cjs');
const {
  ENGINE_COMMAND, KEYWORD_ONLY, engineKnowledge, knowledgeDoor, refuseLaunches,
  knowledgeUnit, setItems, completeUnit, setRegistry, configureKnowledge, knowledgeAt, storedChunks,
} = require('./knowledge-harness.cjs');

describe('engine knowledge remove, compact and rebuild', () => {
  let root;
  const { knowledge, at } = knowledgeDoor(() => root);
  refuseLaunches();

  /** Each file written and indexed on its own. @param {...string} rels */
  async function indexed(...rels) {
    for (const rel of rels) {
      createFile(statePath(root), rel, `# Notes\n\nWhat ${rel} settled.\n`);
      assert.strictEqual((await knowledge('index', `.leeway/${rel}`)).code, 0, rel);
    }
  }
  /** Each identity the store holds, `unit/phase/topic`, sorted. */
  const identities = () => [...new Set(storedChunks(root).map((c) => `${c.work_unit}/${c.phase}/${c.topic}`))].sort();

  beforeEach(() => {
    root = setupFixture('kb-maintenance-');
    configureKnowledge(root, KEYWORD_ONLY);
  });

  afterEach(() => cleanupFixture(root));

  describe('remove', () => {
    it('takes a unit\'s chunks in every phase, and leaves every other unit\'s', async () => {
      knowledgeUnit(root, 'mixed', 'epic');
      knowledgeUnit(root, 'kept', 'feature');
      await indexed('mixed/investigation/mixed.md', 'mixed/specification/mixed/specification.md', 'mixed/imports/seed.md',
        'mixed/seeds/origin.md', 'mixed/.state/discovery-gap-analysis.md', 'mixed/discovery/sessions/session-001.md', 'kept/investigation/kept.md');
      assert.deepStrictEqual(await knowledge('remove', '--work-unit', 'mixed'), { code: 0, stdout: 'Removed 6 chunks for mixed (all phases)\n', stderr: '' });
      assert.deepStrictEqual(identities(), ['kept/investigation/kept']);
    });

    it('narrows to a phase, and to a topic within it', async () => {
      knowledgeUnit(root, 'payments', 'epic');
      await indexed('payments/investigation/billing.md', 'payments/specification/billing/specification.md', 'payments/specification/invoicing/specification.md');
      assert.strictEqual((await knowledge('remove', '--work-unit', 'payments', '--phase', 'investigation')).stdout, 'Removed 1 chunks for payments/investigation\n');
      assert.deepStrictEqual(identities(), ['payments/specification/billing', 'payments/specification/invoicing']);
      assert.strictEqual((await knowledge('remove', '--work-unit', 'payments', '--phase', 'specification', '--topic', 'billing')).stdout,
        'Removed 1 chunks for payments/specification/billing\n');
      assert.deepStrictEqual(identities(), ['payments/specification/invoicing']);
    });

    it('--dry-run says what it would remove and removes nothing', async () => {
      knowledgeUnit(root, 'preview', 'feature');
      await indexed('preview/investigation/preview.md');
      assert.deepStrictEqual(await knowledge('remove', '--work-unit', 'preview', '--dry-run'), { code: 0, stdout: 'Would remove 1 chunks for preview (all phases)\n', stderr: '' });
      assert.deepStrictEqual(identities(), ['preview/investigation/preview']);
    });

    it('takes a project-level identity no registry names — the roadmap, the baseline — never as an orphan', async () => {
      await indexed('.roadmap/sessions/session-001.md', '.baseline/overview.md');
      assert.deepStrictEqual(await knowledge('remove', '--work-unit', 'roadmap'), { code: 0, stdout: 'Removed 1 chunks for roadmap (all phases)\n', stderr: '' });
      assert.deepStrictEqual(await knowledge('remove', '--work-unit', 'baseline'), { code: 0, stdout: 'Removed 1 chunks for baseline (all phases)\n', stderr: '' });
      assert.deepStrictEqual(identities(), []);
    });

    it('refuses a name the registry does not hold and the store holds nothing of, where a registered unit\'s empty match removes 0', async () => {
      knowledgeUnit(root, 'auth', 'feature');
      await indexed('auth/investigation/auth.md');
      assert.deepStrictEqual(await knowledge('remove', '--work-unit', 'nonexistent'), {
        code: 1,
        stdout: '',
        stderr: 'Error: Work unit "nonexistent" not found in project manifest, and no matching chunks exist in the knowledge base.\n'
          + `  Check the name with \`${ENGINE_COMMAND} knowledge status\`.\n`,
      });
      assert.deepStrictEqual(await knowledge('remove', '--work-unit', 'auth', '--phase', 'review', '--topic', 'nothing'),
        { code: 0, stdout: 'Removed 0 chunks for auth/review/nothing\n', stderr: '' });
      assert.deepStrictEqual(identities(), ['auth/investigation/auth']);
    });

    it('takes the chunks of a unit the registry no longer names as an orphan cleanup, saying so — and then refuses the name', async () => {
      knowledgeUnit(root, 'absorbed', 'feature');
      await indexed('absorbed/investigation/absorbed.md');
      setRegistry(root, {});
      assert.deepStrictEqual(await knowledge('remove', '--work-unit', 'absorbed'), {
        code: 0,
        stdout: 'Removed 1 chunks for absorbed (all phases) (orphan cleanup)\n',
        stderr: 'Work unit "absorbed" is not in the project manifest, but 1 chunks remain in the store. Removing as an orphan cleanup.\n',
      });
      const again = await knowledge('remove', '--work-unit', 'absorbed');
      assert.strictEqual(again.code, 1);
      assert.match(again.stderr, /no matching chunks exist/);
    });

    it('refuses --topic without --phase, and gives its usage without --work-unit', async () => {
      assert.deepStrictEqual(await knowledge('remove', '--work-unit', 'auth', '--topic', 'auth'), { code: 1, stdout: '', stderr: 'Error: --topic requires --phase\n' });
      assert.deepStrictEqual(await knowledge('remove'), {
        code: 1, stdout: '', stderr: 'Usage: engine knowledge remove --work-unit <wu> [--phase <p>] [--topic <t>] [--dry-run]\n',
      });
    });

    it('removes 0 for a registered unit where the checkout has no store', async () => {
      knowledgeUnit(root, 'auth', 'feature');
      assert.deepStrictEqual(await knowledge('remove', '--work-unit', 'auth'), { code: 0, stdout: 'Removed 0 chunks for auth (all phases)\n', stderr: '' });
    });

    it('exits 1 when the removal fails, naming what failed and that the next start removes them', async () => {
      knowledgeUnit(root, 'drop-me', 'feature');
      await indexed('drop-me/investigation/drop-me.md');
      fs.writeFileSync(knowledgeAt(root).store, 'corrupt-store-bytes');
      const answer = await knowledge('remove', '--work-unit', 'drop-me');
      assert.strictEqual(answer.code, 1);
      assert.strictEqual(answer.stdout, '');
      assert.match(answer.stderr, /^Removal of drop-me \(all phases\) failed: .*\nThe next start will remove them\.\n$/);
    });
  });

  describe('compact', () => {
    // S0 3 and a 0.95 floor: a unit two completions behind is at R ≈ 0.931,
    // below the floor.
    beforeEach(async () => {
      configureKnowledge(root, { ...KEYWORD_ONLY, decay_prune_below: 0.95, decay_base_stability: 3 });
      for (const [unit, date] of [['buried', '2024-01-01'], ['newer1', '2024-06-01'], ['newer2', '2024-12-01']]) {
        knowledgeUnit(root, unit, 'feature');
        completeUnit(root, unit, date);
      }
      await indexed('buried/investigation/buried.md', 'buried/specification/buried/specification.md');
    });

    it('prunes the non-specification chunks of a unit the clock has passed below the floor', async () => {
      assert.deepStrictEqual(await knowledge('compact'), {
        code: 0, stdout: 'Compacted: removed 1 chunks from 1 work units (retrievability < 0.95)\n  • buried: 1 chunks (investigation)\n', stderr: '',
      });
      assert.deepStrictEqual(identities(), ['buried/specification/buried']);
    });

    it('--dry-run prints the plan, marked, and removes nothing', async () => {
      assert.strictEqual((await knowledge('compact', '--dry-run')).stdout,
        '[dry-run] Compacted: removed 1 chunks from 1 work units (retrievability < 0.95)\n  • buried: 1 chunks (investigation)\n');
      assert.deepStrictEqual(identities(), ['buried/investigation/buried', 'buried/specification/buried']);
    });

    it('prunes nothing at a floor of 0, which no retrievability falls below', async () => {
      configureKnowledge(root, { ...KEYWORD_ONLY, decay_prune_below: 0, decay_base_stability: 3 });
      assert.deepStrictEqual(await knowledge('compact'), { code: 0, stdout: '', stderr: '' });
      assert.deepStrictEqual(identities(), ['buried/investigation/buried', 'buried/specification/buried']);
    });

    it('says compaction is disabled where decay_prune_below is false, and removes nothing', async () => {
      configureKnowledge(root, { ...KEYWORD_ONLY, decay_prune_below: false });
      assert.deepStrictEqual(await knowledge('compact'), { code: 0, stdout: 'Compaction disabled\n', stderr: '' });
      assert.deepStrictEqual(identities(), ['buried/investigation/buried', 'buried/specification/buried']);
    });
  });

  describe('rebuild', () => {
    /** `rebuild`, `typed` its stdin. @param {string} typed */
    const rebuild = (typed) => engineKnowledge(root, ['rebuild'], {}, typed);
    const PROMPT = "Warning: This will delete the existing index and rebuild from scratch.\n"
      + 'This is non-deterministic — the rebuilt index will differ from the original.\n'
      + "Type 'rebuild' to confirm: ";
    const backups = () => ['store.bin.bak', 'metadata.json.bak'].filter((name) => fs.existsSync(path.join(knowledgeAt(root).dir, name)));

    beforeEach(async () => {
      knowledgeUnit(root, 'auth', 'feature');
      setItems(root, 'auth', { investigation: ['auth'] });
      await indexed('auth/investigation/auth.md');
    });

    it('aborts on anything but rebuild typed back, the store untouched', async () => {
      const before = fs.readFileSync(knowledgeAt(root).store);
      for (const typed of ['no\n', '\n', 're']) {
        assert.deepStrictEqual(await rebuild(typed), { code: 1, stdout: '', stderr: `${PROMPT}\nAborted.\n` }, JSON.stringify(typed));
      }
      assert.ok(fs.readFileSync(knowledgeAt(root).store).equals(before));
    });

    it('aborts where nothing is indexable, saying the index was not modified', async () => {
      fs.rmSync(at('auth'), { recursive: true });
      setRegistry(root, {});
      const answer = await rebuild('rebuild\n');
      assert.strictEqual(answer.code, 1);
      assert.ok(answer.stderr.startsWith(`${PROMPT}No artifacts to index. Aborting rebuild — the existing index has NOT been modified.\n`), answer.stderr);
      assert.strictEqual(identities().length, 1);
    });

    it('refuses before its prompt where the provider\'s key does not resolve, the store untouched', async () => {
      configureKnowledge(root, { provider: 'openai', model: 'text-embedding-3-small', dimensions: 1536 });
      fs.writeFileSync(knowledgeAt(root).store, 'store bytes');
      const answer = await rebuild('rebuild\n');
      assert.strictEqual(answer.code, 1);
      assert.match(answer.stderr, /could not be resolved/);
      assert.ok(!answer.stderr.includes("Type 'rebuild' to confirm"));
      assert.strictEqual(fs.readFileSync(knowledgeAt(root).store, 'utf8'), 'store bytes');
    });

    it('rebuilds from the files, clearing the backups an earlier rebuild left', async () => {
      for (const name of ['store.bin.bak', 'metadata.json.bak']) fs.writeFileSync(path.join(knowledgeAt(root).dir, name), '');
      assert.deepStrictEqual(await rebuild('rebuild\n'), {
        code: 0,
        stdout: `Deleted existing index.\nIndexed ${at('auth/investigation/auth.md')} — 1 chunks (new)\n1 new, 0 changed, 0 removed, 0 unchanged.\n`,
        stderr: PROMPT,
      });
      assert.deepStrictEqual(backups(), []);
      assert.deepStrictEqual(identities(), ['auth/investigation/auth']);
    });

    it('exits 1 when a file fails, the rebuilt store standing with no backup left', async () => {
      knowledgeUnit(root, 'empty', 'feature');
      setItems(root, 'empty', { investigation: ['empty'] });
      createFile(statePath(root), 'empty/investigation/empty.md', '\n');
      const answer = await rebuild('rebuild\n');
      assert.strictEqual(answer.code, 1);
      assert.ok(answer.stderr.startsWith(`${PROMPT}Failed to index ${at('empty/investigation/empty.md')}: No chunks produced`), answer.stderr);
      assert.deepStrictEqual(identities(), ['auth/investigation/auth']);
      assert.deepStrictEqual(backups(), []);
    });

    it('puts the previous store back, byte for byte, when the manifest cannot be read mid-rebuild', async () => {
      await indexed('.baseline/overview.md');
      const before = fs.readFileSync(knowledgeAt(root).store);
      fs.writeFileSync(at('manifest.json'), '{ not json');
      const answer = await rebuild('rebuild\n');
      assert.strictEqual(answer.code, 1);
      assert.match(answer.stderr, /^Rebuild failed; restored previous index from backup\.$/m);
      assert.ok(fs.readFileSync(knowledgeAt(root).store).equals(before));
      assert.deepStrictEqual(backups(), []);
    });
  });
});

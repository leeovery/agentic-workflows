'use strict';

//
// Tests for migration 071: triage-queue-to-mailbox (.cjs)
//
// Against real git: every file under each phase's .triage/ moved to the same
// place under .mailbox/ and both sides staged with nothing committed — a
// tracked file gone from disk staged as removed, an untracked one staged as
// added — and the emptied .triage/ removed; outside a repository, moved on
// disk alone. A mailbox already there: a different topic's merged beside,
// the same topic's taking each message whose number it holds at one above
// its highest, in name order, slug kept; a file that is no message, whose
// name is taken, left behind. The manifest: `triaged`
// rewritten `unstarted` in status and the stashed previous_status of every
// phase item, every other status kept; each comma-separated reroute: segment
// of a discovery map source rewritten message:, every other segment and its
// spacing kept; the rest of the manifest in the engine's serialisation.
// The send records: each "Rerouted to {topic} triage ({date})" in a
// research or discussion document rewritten "Sent to {topic}'s mailbox
// ({date})", in place on its line, the punctuation after it kept, written on disk and never staged; a
// near-miss and another phase's document left alone.
// The mailbox-path addendum: handed back where a research or discussion
// document holds a straggler — a triage section (heading plain or
// malformed, any case) whose body carries anything but whitespace and a
// lone "(none)", text after a "(none)" included — on a run that otherwise
// skips too, stating the recovery into the mailbox and that nothing goes
// into a .triage/ directory; nothing for an emptied section, an empty
// heading, a section closed by the next heading, or a heading in another
// phase's document.
// Completed and cancelled units alike, one update per changed unit,
// skip/no-op, idempotency, and the guards: no .workflows/, a directory whose
// manifest is absent, malformed or not an object, dot directories, and
// shapes that are not objects.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { git, initRepo, cleanupFixture } = require('./engine-harness.cjs');
const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/071-triage-queue-to-mailbox.cjs');

let dir, updates, skips;

function run() {
  return MIGRATION.run({ projectDir: dir, reportUpdate: () => { updates++; }, reportSkip: () => { skips++; } });
}

/** @param {object} value */
const json = (value) => JSON.stringify(value, null, 2) + '\n';

const manifestPath = (name) => path.join(dir, '.workflows', name, 'manifest.json');

function writeUnit(name, manifest) {
  fs.mkdirSync(path.join(dir, '.workflows', name), { recursive: true });
  fs.writeFileSync(manifestPath(name), typeof manifest === 'string' ? manifest : json(manifest));
}

/** @param {string} rel  project-relative @param {string} [content] */
function write(rel, content = `${path.basename(rel)}\n`) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

const exists = (rel) => fs.existsSync(path.join(dir, rel));
const readText = (rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const read = (name) => JSON.parse(fs.readFileSync(manifestPath(name), 'utf8'));
const commitAll = () => { git(dir, ['add', '-A']); git(dir, ['commit', '-q', '-m', 'init']); };
const head = () => git(dir, ['rev-parse', 'HEAD']).trim();
const staged = () => git(dir, ['diff', '--cached', '--name-status', '-M']).trim().split('\n').filter(Boolean).sort();
const untracked = () => git(dir, ['ls-files', '--others', '--exclude-standard']).trim().split('\n').filter(Boolean).sort();

/** An epic holding messages on both sides of one topic, a parked stub, and a sent-in map row. */
function epic() {
  return {
    name: 'payments',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discovery: { items: {
        billing: { routing: 'discussion', source: 'discovery', summary: 'Billing' },
        refunds: { routing: 'research', source: 'reroute:billing', summary: 'Refunds' },
      } },
      research: { items: {
        billing: { status: 'completed' },
        refunds: { status: 'triaged' },
      } },
      discussion: { items: {
        billing: { status: 'in-progress', reconcile_needed: 'research' },
      } },
    },
  };
}

describe('migration 071: the triage queue becomes the mailbox', () => {
  beforeEach(() => {
    dir = initRepo(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'migration-071-'))));
    updates = 0;
    skips = 0;
  });
  afterEach(() => { cleanupFixture(dir); });

  describe('the directories', () => {
    /** @param {string} rel @returns {string[]} */
    const listing = (rel) => fs.readdirSync(path.join(dir, rel)).sort();

    it('moves a tracked .triage/ — the rename staged, the files at the new path, nothing committed', () => {
      writeUnit('payments', epic());
      write('.workflows/payments/research/.triage/refunds/001-currency.md', 'currency\n');
      write('.workflows/payments/discussion/.triage/billing/001-tax.md', 'tax\n');
      write('.workflows/payments/discussion/.triage/billing/002-vat.md', 'vat\n');
      commitAll();
      const before = head();

      run();

      assert.strictEqual(exists('.workflows/payments/research/.triage'), false);
      assert.strictEqual(exists('.workflows/payments/discussion/.triage'), false);
      assert.strictEqual(readText('.workflows/payments/research/.mailbox/refunds/001-currency.md'), 'currency\n');
      assert.strictEqual(readText('.workflows/payments/discussion/.mailbox/billing/001-tax.md'), 'tax\n');
      assert.strictEqual(readText('.workflows/payments/discussion/.mailbox/billing/002-vat.md'), 'vat\n');
      assert.deepStrictEqual(staged().filter((l) => l.startsWith('R')), [
        'R100\t.workflows/payments/discussion/.triage/billing/001-tax.md\t.workflows/payments/discussion/.mailbox/billing/001-tax.md',
        'R100\t.workflows/payments/discussion/.triage/billing/002-vat.md\t.workflows/payments/discussion/.mailbox/billing/002-vat.md',
        'R100\t.workflows/payments/research/.triage/refunds/001-currency.md\t.workflows/payments/research/.mailbox/refunds/001-currency.md',
      ]);
      assert.strictEqual(head(), before, 'a migration never commits');
    });

    it('stages an untracked file inside a tracked .triage/ as added at its new path', () => {
      writeUnit('payments', epic());
      write('.workflows/payments/discussion/.triage/billing/001-tax.md');
      commitAll();
      write('.workflows/payments/discussion/.triage/billing/002-vat.md', 'not yet committed\n');

      run();

      assert.strictEqual(readText('.workflows/payments/discussion/.mailbox/billing/002-vat.md'), 'not yet committed\n');
      assert.deepStrictEqual(untracked(), []);
      assert.deepStrictEqual(staged(), [
        'A\t.workflows/payments/discussion/.mailbox/billing/002-vat.md',
        'R100\t.workflows/payments/discussion/.triage/billing/001-tax.md\t.workflows/payments/discussion/.mailbox/billing/001-tax.md',
      ]);
    });

    it('moves an untracked .triage/ and stages its files as added', () => {
      writeUnit('payments', { name: 'payments', work_type: 'feature', status: 'in-progress', phases: {} });
      commitAll();
      write('.workflows/payments/discussion/.triage/payments/001-tax.md');

      run();

      assert.strictEqual(exists('.workflows/payments/discussion/.triage'), false);
      assert.ok(exists('.workflows/payments/discussion/.mailbox/payments/001-tax.md'));
      assert.deepStrictEqual(staged(), ['A\t.workflows/payments/discussion/.mailbox/payments/001-tax.md']);
      assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 0 });
    });

    it('moves the rest and stages the removal where a tracked file is already gone from disk', () => {
      writeUnit('payments', epic());
      write('.workflows/payments/discussion/.triage/billing/001-tax.md', 'tax\n');
      write('.workflows/payments/discussion/.triage/billing/002-vat.md', 'vat\n');
      commitAll();
      fs.rmSync(path.join(dir, '.workflows/payments/discussion/.triage/billing/001-tax.md'));

      run();

      assert.strictEqual(exists('.workflows/payments/discussion/.triage'), false);
      assert.deepStrictEqual(listing('.workflows/payments/discussion/.mailbox/billing'), ['002-vat.md']);
      assert.deepStrictEqual(staged(), [
        'D\t.workflows/payments/discussion/.triage/billing/001-tax.md',
        'R100\t.workflows/payments/discussion/.triage/billing/002-vat.md\t.workflows/payments/discussion/.mailbox/billing/002-vat.md',
      ]);
    });

    it('joins a mailbox the topic already has — a taken number renumbered one above the highest, in name order, slug kept, nothing nested', () => {
      writeUnit('payments', epic());
      write('.workflows/payments/discussion/.mailbox/billing/002-new.md', 'new\n');
      write('.workflows/payments/discussion/.triage/billing/003-fee.md', 'fee\n');
      write('.workflows/payments/discussion/.triage/billing/001-tax.md', 'tax\n');
      write('.workflows/payments/discussion/.triage/billing/002-vat.md', 'vat\n');
      commitAll();

      run();

      assert.strictEqual(exists('.workflows/payments/discussion/.triage'), false);
      assert.deepStrictEqual(listing('.workflows/payments/discussion/.mailbox'), ['billing']);
      const mailbox = '.workflows/payments/discussion/.mailbox/billing';
      assert.deepStrictEqual(listing(mailbox), ['001-tax.md', '002-new.md', '003-vat.md', '004-fee.md']);
      assert.deepStrictEqual(
        ['001-tax.md', '002-new.md', '003-vat.md', '004-fee.md'].map((f) => readText(`${mailbox}/${f}`)),
        ['tax\n', 'new\n', 'vat\n', 'fee\n'],
      );
      assert.deepStrictEqual(staged(), [
        `R100\t.workflows/payments/discussion/.triage/billing/001-tax.md\t${mailbox}/001-tax.md`,
        `R100\t.workflows/payments/discussion/.triage/billing/002-vat.md\t${mailbox}/003-vat.md`,
        `R100\t.workflows/payments/discussion/.triage/billing/003-fee.md\t${mailbox}/004-fee.md`,
      ]);
    });

    it('merges into a mailbox holding another topic\'s messages', () => {
      writeUnit('payments', epic());
      write('.workflows/payments/research/.mailbox/billing/001-ledger.md', 'ledger\n');
      write('.workflows/payments/research/.triage/refunds/001-currency.md', 'currency\n');
      commitAll();

      run();

      assert.strictEqual(exists('.workflows/payments/research/.triage'), false);
      assert.deepStrictEqual(listing('.workflows/payments/research/.mailbox'), ['billing', 'refunds']);
      assert.strictEqual(readText('.workflows/payments/research/.mailbox/billing/001-ledger.md'), 'ledger\n');
      assert.strictEqual(readText('.workflows/payments/research/.mailbox/refunds/001-currency.md'), 'currency\n');
    });

    it('moves a file that is no message under its own name, and leaves one whose name is taken behind', () => {
      writeUnit('payments', epic());
      write('.workflows/payments/discussion/.mailbox/billing/notes.txt', 'mailbox notes\n');
      write('.workflows/payments/discussion/.triage/billing/notes.txt', 'queue notes\n');
      write('.workflows/payments/discussion/.triage/billing/draft.txt', 'draft\n');
      write('.workflows/payments/discussion/.triage/billing/001-tax.md', 'tax\n');

      run();

      assert.deepStrictEqual(listing('.workflows/payments/discussion/.mailbox/billing'), ['001-tax.md', 'draft.txt', 'notes.txt']);
      assert.strictEqual(readText('.workflows/payments/discussion/.mailbox/billing/notes.txt'), 'mailbox notes\n');
      assert.deepStrictEqual(listing('.workflows/payments/discussion/.triage/billing'), ['notes.txt']);
      assert.strictEqual(readText('.workflows/payments/discussion/.triage/billing/notes.txt'), 'queue notes\n');
    });

    it('moves on disk outside a repository, a taken number renumbered there too', () => {
      cleanupFixture(dir);
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-071-plain-'));
      writeUnit('payments', epic());
      write('.workflows/payments/research/.mailbox/refunds/001-fx.md', 'fx\n');
      write('.workflows/payments/research/.triage/refunds/001-currency.md', 'currency\n');

      run();

      assert.strictEqual(exists('.workflows/payments/research/.triage'), false);
      assert.deepStrictEqual(listing('.workflows/payments/research/.mailbox/refunds'), ['001-fx.md', '002-currency.md']);
      assert.strictEqual(readText('.workflows/payments/research/.mailbox/refunds/002-currency.md'), 'currency\n');
      assert.strictEqual(updates, 1);
    });

    it('moves the investigation side too — every phase directory holding one', () => {
      writeUnit('crash', { name: 'crash', work_type: 'bugfix', status: 'in-progress', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
      write('.workflows/crash/investigation/.triage/crash/001-logs.md');
      commitAll();

      run();

      assert.ok(exists('.workflows/crash/investigation/.mailbox/crash/001-logs.md'));
      assert.strictEqual(exists('.workflows/crash/investigation/.triage'), false);
      assert.strictEqual(updates, 1);
    });

    it('leaves a .triage file that is not a directory, and a dot directory\'s .triage/, alone', () => {
      writeUnit('payments', { name: 'payments', work_type: 'feature', status: 'in-progress', phases: {} });
      write('.workflows/payments/discussion/.triage', 'a file\n');
      write('.workflows/payments/.state/.triage/payments/001-x.md');

      run();

      assert.strictEqual(readText('.workflows/payments/discussion/.triage'), 'a file\n');
      assert.ok(exists('.workflows/payments/.state/.triage/payments/001-x.md'));
      assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    });
  });

  describe('the manifest', () => {
    it('rewrites triaged to unstarted in status and the stashed previous_status of every phase item, every other value kept', () => {
      writeUnit('payments', {
        name: 'payments',
        work_type: 'epic',
        status: 'in-progress',
        phases: {
          research: { items: {
            refunds: { status: 'triaged' },
            billing: { status: 'cancelled', previous_status: 'triaged' },
            ledger: { status: 'postponed', previous_status: 'in-progress' },
          } },
          discussion: { items: {
            refunds: { status: 'triaged', reconcile_needed: 'research' },
            billing: { status: 'completed' },
          } },
          investigation: { items: { crash: { status: 'triaged' } } },
        },
      });

      run();

      const m = read('payments');
      assert.deepStrictEqual(m.phases.research.items, {
        refunds: { status: 'unstarted' },
        billing: { status: 'cancelled', previous_status: 'unstarted' },
        ledger: { status: 'postponed', previous_status: 'in-progress' },
      });
      assert.deepStrictEqual(m.phases.discussion.items, {
        refunds: { status: 'unstarted', reconcile_needed: 'research' },
        billing: { status: 'completed' },
      });
      assert.deepStrictEqual(m.phases.investigation.items, { crash: { status: 'unstarted' } });
      assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 0 });
    });

    it('rewrites each reroute: segment of a comma-accumulated source to message:, every other segment and its spacing kept', () => {
      writeUnit('payments', {
        name: 'payments',
        work_type: 'epic',
        status: 'in-progress',
        phases: { discovery: { items: {
          refunds: { source: 'reroute:billing' },
          tax: { source: 'discovery,reroute:billing' },
          vat: { source: 'reroute:billing, gap-analysis,reroute:ledger' },
          ledger: { source: 'legacy-split:billing,research-split:money' },
          plain: { source: 'discovery' },
          bare: { routing: 'research' },
          odd: { source: 42 },
        } } },
      });

      run();

      const items = read('payments').phases.discovery.items;
      assert.strictEqual(items.refunds.source, 'message:billing');
      assert.strictEqual(items.tax.source, 'discovery,message:billing');
      assert.strictEqual(items.vat.source, 'message:billing, gap-analysis,message:ledger');
      assert.strictEqual(items.ledger.source, 'legacy-split:billing,research-split:money');
      assert.strictEqual(items.plain.source, 'discovery');
      assert.deepStrictEqual(items.bare, { routing: 'research' });
      assert.strictEqual(items.odd.source, 42);
    });

    it('keeps every other field and writes the engine\'s serialisation', () => {
      const m = epic();
      m.description = 'Card payments';
      m.imports = [{ path: 'imports/brief.md', imported_at: '2026-10-01', origin: 'discovery' }];
      writeUnit('payments', m);

      run();

      const expected = epic();
      expected.description = 'Card payments';
      expected.imports = [{ path: 'imports/brief.md', imported_at: '2026-10-01', origin: 'discovery' }];
      expected.phases.research.items.refunds.status = 'unstarted';
      expected.phases.discovery.items.refunds.source = 'message:billing';
      assert.strictEqual(fs.readFileSync(manifestPath('payments'), 'utf8'), json(expected));
    });

    it('migrates completed and cancelled units alike', () => {
      const completed = epic();
      completed.status = 'completed';
      const cancelled = epic();
      cancelled.name = 'ledger';
      cancelled.status = 'cancelled';
      cancelled.phases.research.items.refunds = { status: 'cancelled', previous_status: 'triaged' };
      writeUnit('payments', completed);
      writeUnit('ledger', cancelled);
      write('.workflows/ledger/research/.triage/refunds/001-currency.md');

      run();

      assert.strictEqual(read('payments').phases.research.items.refunds.status, 'unstarted');
      assert.deepStrictEqual(read('ledger').phases.research.items.refunds, { status: 'cancelled', previous_status: 'unstarted' });
      assert.ok(exists('.workflows/ledger/research/.mailbox/refunds/001-currency.md'));
      assert.deepStrictEqual({ updates, skips }, { updates: 2, skips: 0 });
    });
  });

  describe('the send records', () => {
    const SENT = [
      '- **Hidden-note discoverability.** Rerouted to management-window triage (2026-08-10).',
      '*Rerouted to `engine-architecture` triage (2026-09-06).* Then more prose.',
      '~~Rerouted to note-model triage (2026-08-06).~~ Answered since.',
      '**Rerouted to build-and-release triage (2026-08-20)**, whose brief owns the update UX.',
    ];
    const NEAR_MISSES = [
      'Rerouted to `note-window` discussion triage (2026-09-17), which reopened that topic.',
      'Rerouted to billing triage.',
      'Rerouted to billing triage (see above).',
      'rerouted to billing triage (2026-08-10).',
      'Rerouted to space-homing (research, 2026-08-03).',
    ];
    const document = (lines) => `# Billing\n\n${lines.join('\n\n')}\n`;

    it('rewrites each exact record in a research or discussion document in place, every near-miss left alone', () => {
      writeUnit('payments', { name: 'payments', work_type: 'epic', status: 'in-progress', phases: {} });
      write('.workflows/payments/discussion/billing.md', document([...SENT, ...NEAR_MISSES]));
      write('.workflows/payments/research/refunds.md', document([SENT[0]]));

      run();

      assert.strictEqual(readText('.workflows/payments/discussion/billing.md'), document([
        "- **Hidden-note discoverability.** Sent to management-window's mailbox (2026-08-10).",
        "*Sent to `engine-architecture`'s mailbox (2026-09-06).* Then more prose.",
        "~~Sent to note-model's mailbox (2026-08-06).~~ Answered since.",
        "**Sent to build-and-release's mailbox (2026-08-20)**, whose brief owns the update UX.",
        ...NEAR_MISSES,
      ]));
      assert.strictEqual(readText('.workflows/payments/research/refunds.md'), document([
        "- **Hidden-note discoverability.** Sent to management-window's mailbox (2026-08-10).",
      ]));
      assert.deepStrictEqual({ updates, skips }, { updates: 1, skips: 0 });
    });

    it('writes the rewrite on disk and stages nothing for it', () => {
      writeUnit('payments', { name: 'payments', work_type: 'epic', status: 'in-progress', phases: {} });
      write('.workflows/payments/discussion/billing.md', document([SENT[0]]));
      commitAll();

      run();

      assert.match(readText('.workflows/payments/discussion/billing.md'), /Sent to management-window's mailbox/);
      assert.deepStrictEqual(staged(), []);
    });

    it('leaves a document that holds only near-misses, and another phase\'s document, alone', () => {
      writeUnit('payments', { name: 'payments', work_type: 'epic', status: 'in-progress', phases: {} });
      write('.workflows/payments/discussion/billing.md', document(NEAR_MISSES));
      write('.workflows/payments/investigation/billing.md', document([SENT[0]]));
      write('.workflows/payments/specification/billing/specification.md', document([SENT[0]]));

      run();

      assert.strictEqual(readText('.workflows/payments/discussion/billing.md'), document(NEAR_MISSES));
      assert.strictEqual(readText('.workflows/payments/investigation/billing.md'), document([SENT[0]]));
      assert.strictEqual(readText('.workflows/payments/specification/billing/specification.md'), document([SENT[0]]));
      assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    });
  });

  describe('the mailbox-path addendum', () => {
    const doc = (rel, text) => write(`.workflows/payments/${rel}`, `# Doc\n\nBody.\n\n${text}\n`);

    for (const [phase, heading] of [
      ['research', '## Triage'],
      ['discussion', '## Triage'],
      ['discussion', '## Triage:'],
      ['research', '##Triage'],
      ['discussion', '## triage'],
    ]) {
      it(`hands it back for a ${phase} document whose "${heading}" section holds a parked entry`, () => {
        writeUnit('payments', epic());
        doc(`${phase}/billing.md`, `${heading}\n\n### Parked\nText.`);

        const result = run();

        assert.ok(result && typeof result.verify === 'string', JSON.stringify(result));
        assert.ok(result.verify.includes('.workflows/{wu}/{phase}/.mailbox/{topic}/'), result.verify);
        assert.ok(result.verify.includes('NNN-{slug}.md'), result.verify);
        assert.ok(result.verify.includes('Nothing goes into a .triage/ directory, whatever an earlier check in this start-up says'), result.verify);
        assert.ok(typeof MIGRATION.info === 'string' && MIGRATION.info.length > 0);
      });
    }

    it('hands it back for stray text after a "(none)"', () => {
      writeUnit('payments', epic());
      doc('discussion/billing.md', '## Triage\n\n(none)\n\nRate limits need re-deciding against the batch signals.');

      assert.ok(run()?.verify);
    });

    it('hands it back on a run that otherwise skips', () => {
      writeUnit('payments', { name: 'payments', work_type: 'epic', status: 'in-progress', phases: {} });
      doc('discussion/billing.md', '## Triage:\n\n### Parked\nText.');

      const result = run();

      assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
      assert.ok(result && typeof result.verify === 'string');
    });

    it('hands back nothing for an emptied section — the "(none)" 054 leaves on a completed topic', () => {
      writeUnit('payments', epic());
      doc('discussion/billing.md', '## Triage\n\n(none)\n\n## Summary\n\nDecided.');
      doc('research/billing.md', '## Triage\n\n  (none)  \n');

      assert.strictEqual(run(), undefined);
    });

    it('hands back nothing for an empty heading, and for text that belongs to the next section', () => {
      writeUnit('payments', epic());
      doc('discussion/billing.md', '## Triage');
      doc('research/billing.md', '## Triage\n\n# Appendix\n\nNot triage content.');

      assert.strictEqual(run(), undefined);
    });

    it('hands back nothing where no research or discussion document carries a triage heading', () => {
      writeUnit('payments', epic());
      doc('research/billing.md', '## Findings\n\nThe triage of incidents is manual.');
      doc('discussion/billing.md', '### Triage notes\n\nNot a section heading.');

      assert.strictEqual(run(), undefined);
    });

    it('hands back nothing for a triage heading only in another phase\'s document', () => {
      writeUnit('payments', epic());
      doc('investigation/billing.md', '## Triage\n\n### Parked\nText.');
      doc('specification/billing/specification.md', '## Triage\n\nText.');

      assert.strictEqual(run(), undefined);
    });
  });

  describe('reporting, idempotency and guards', () => {
    it('reports one update per changed unit, whatever changed in it, and none for an unchanged one', () => {
      writeUnit('payments', epic());
      write('.workflows/payments/research/.triage/refunds/001-currency.md');
      writeUnit('crash', { name: 'crash', work_type: 'bugfix', status: 'in-progress', phases: {} });
      write('.workflows/crash/investigation/.triage/crash/001-logs.md');
      writeUnit('quiet', { name: 'quiet', work_type: 'feature', status: 'in-progress', phases: { discussion: { items: { quiet: { status: 'completed' } } } } });
      const quietBefore = fs.readFileSync(manifestPath('quiet'), 'utf8');

      run();

      assert.deepStrictEqual({ updates, skips }, { updates: 2, skips: 0 });
      assert.strictEqual(fs.readFileSync(manifestPath('quiet'), 'utf8'), quietBefore);
    });

    it('skips once when nothing carries the old words', () => {
      writeUnit('payments', { name: 'payments', work_type: 'epic', status: 'in-progress', phases: { discovery: { items: { billing: { source: 'discovery' } } } } });
      const before = fs.readFileSync(manifestPath('payments'), 'utf8');

      run();

      assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
      assert.strictEqual(fs.readFileSync(manifestPath('payments'), 'utf8'), before);
    });

    it('is idempotent — a second run skips and changes nothing', () => {
      writeUnit('payments', epic());
      write('.workflows/payments/research/.mailbox/refunds/001-fx.md');
      write('.workflows/payments/research/.triage/refunds/001-currency.md');
      write('.workflows/payments/discussion/billing.md', '# Billing\n\nRerouted to refunds triage (2026-08-10).\n');
      commitAll();
      run();
      const manifest = fs.readFileSync(manifestPath('payments'), 'utf8');
      const mailbox = fs.readdirSync(path.join(dir, '.workflows/payments/research/.mailbox/refunds')).sort();
      const document = readText('.workflows/payments/discussion/billing.md');
      const index = staged();
      updates = 0;
      skips = 0;

      run();

      assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
      assert.strictEqual(fs.readFileSync(manifestPath('payments'), 'utf8'), manifest);
      assert.deepStrictEqual(fs.readdirSync(path.join(dir, '.workflows/payments/research/.mailbox/refunds')).sort(), mailbox);
      assert.deepStrictEqual(mailbox, ['001-fx.md', '002-currency.md']);
      assert.strictEqual(readText('.workflows/payments/discussion/billing.md'), document);
      assert.strictEqual(document, "# Billing\n\nSent to refunds's mailbox (2026-08-10).\n");
      assert.deepStrictEqual(staged(), index);
    });

    it('skips a project with no .workflows/', () => {
      fs.rmSync(path.join(dir, '.workflows'), { recursive: true, force: true });

      run();

      assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    });

    it('leaves a directory whose manifest is absent, malformed or not an object alone — its .triage/ included', () => {
      write('.workflows/no-manifest/discussion/.triage/x/001-a.md');
      writeUnit('broken', '{ not json');
      write('.workflows/broken/discussion/.triage/x/001-a.md');
      writeUnit('listed', '[]\n');
      write('.workflows/listed/discussion/.triage/x/001-a.md');

      run();

      assert.ok(exists('.workflows/no-manifest/discussion/.triage/x/001-a.md'));
      assert.ok(exists('.workflows/broken/discussion/.triage/x/001-a.md'));
      assert.ok(exists('.workflows/listed/discussion/.triage/x/001-a.md'));
      assert.strictEqual(fs.readFileSync(manifestPath('broken'), 'utf8'), '{ not json');
      assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    });

    it('passes over dot directories under .workflows/', () => {
      write('.workflows/.cache/payments/manifest.json', json({ phases: { research: { items: { x: { status: 'triaged' } } } } }));

      run();

      assert.match(readText('.workflows/.cache/payments/manifest.json'), /"triaged"/);
      assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    });

    it('passes over shapes that are not objects', () => {
      writeUnit('a', { name: 'a', phases: [] });
      writeUnit('b', { name: 'b', phases: { research: 'x', discussion: { items: [] }, discovery: { items: 'x' } } });
      writeUnit('c', { name: 'c', phases: { research: { items: { x: null, y: 'triaged' } }, discovery: { items: { z: null } } } });

      run();

      assert.deepStrictEqual({ updates, skips }, { updates: 0, skips: 1 });
    });
  });
});

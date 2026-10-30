'use strict';

// ---------------------------------------------------------------------------
// The mailboxes between topics (leeway-engine/scripts/domain/mail.cjs, the
// screens projections/mail.cjs): `topic send`, landing a message as the next
// file of the target topic's one mailbox, its path naming no phase (10.S1),
// writing no entry (10.S6, 5.S11), the topic's conversation parked as a
// landing parks it — set back in progress where decided (10.S10) — a
// postponed topic's message waiting in its mailbox and a cancelled topic's
// gone to the inbox as an idea (10.1.8), each send under the writer lock and
// committed; `topic mailbox`, what waits, taking no lock (10.S4); `topic
// answered`, a message removed once the topic holds the question it raised
// (5.3.8); and `render send-report`, the send report ending with the command
// that opens the target (10.3.4, 27.S4). The waiting mail raised at a
// topic's opening is test-engine-enter.cjs's, a closed decided worked afresh
// after a reopen test-engine-checklist.cjs's.
//
// Layer: verb. World, built once and copied: an epic, `fumi`, whose map
// holds `commercialization` under discussion with a question asked on it,
// `licence` not yet discussed, `first-run` decided with a question of its
// own and sourced by a concluded specification, `widgets` postponed,
// `removal` cancelled, `dead-end` closed as one, and `export` promoted; a
// feature, `quick-sync`; a bugfix, `crash`, under investigation; a
// quick-fix, `typo`; and a cancelled feature, `retired`.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const {
  ok, output, refusedPristine, statePath, layout, writeState, readState, readManifest, stateGit, lastMessage, commitAll,
  fixtureFrom, cleanupFixture, holdLock, lockAttempts, withFrozenClock, FROZEN_AT,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { computeTopicLifecycle, buildDiscoveryMap } = require('../../skills/leeway-engine/scripts/domain/derivations.cjs');

const EPIC = 'fumi';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'mail-session' });
const MESSAGE = 'The licence window carries a "Lost your key?" link\n\nTheir reasoning: a buyer on a new Mac has no key to hand.\n';

/** A map row. @param {number} order @param {Record<string, unknown>} [marks] */
const row = (order, marks = {}) => ({ order, summary: `Topic ${order}`, routing: 'discussion', source: 'discovery', ...marks });

/** The questions the world asks, by topic: each one's short id. @type {Record<string, string>} */
const asked = {};

const world = fixtureFrom('engine-mail-', (dir) => {
  createManifest(dir, EPIC, {
    work_type: 'epic',
    phases: {
      discovery: {
        items: {
          commercialization: row(1), licence: row(2), 'first-run': row(3), widgets: row(4, { postponed: true }),
          removal: row(5, { cancelled: true }), 'dead-end': row(6, { handled: true }), export: row(7),
        },
      },
      discussion: {
        items: {
          commercialization: { status: 'in-progress' }, 'first-run': { status: 'completed' }, widgets: { status: 'postponed' },
          removal: { status: 'cancelled' }, export: { status: 'promoted', promoted_to: 'portability' },
        },
      },
      specification: { items: { onboarding: { status: 'completed', sources: { 'first-run': { status: 'incorporated' } } } } },
    },
  });
  createManifest(dir, 'quick-sync');
  createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
  createManifest(dir, 'typo', { work_type: 'quick-fix' });
  createManifest(dir, 'retired', { status: 'cancelled' });
  commitAll(dir, 'the world');
  for (const topic of ['commercialization', 'first-run']) {
    asked[topic] = ok(dir, ['ledger', 'ask', `${EPIC}.discussion.${topic}`], { env: SESSION, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: `What of ${topic}?` }) }).id;
  }
});

let dir;

beforeEach(() => { dir = world(); });
afterEach(() => { cleanupFixture(dir); });

/** A message's scratch under the cache, absolute. @param {string} [text] */
function scratch(text = MESSAGE) {
  return writeState(dir, layout.cache('scratch', 'message.md'), text);
}

/** A send that must succeed: its response. @param {string} unit @param {string} topic @param {string} slug @param {string} [text] */
function send(unit, topic, slug, text) {
  return ok(dir, ['topic', 'send', unit, topic, '--content', scratch(text), '--slug', slug]);
}

/** A call that must refuse, writing nothing: its error. @param {string[]} args */
function refused(args) {
  return refusedPristine(dir, args).error;
}

/** A path in the state, absolute. @param {string} rel */
const at = (rel) => statePath(dir, rel);

/** What a state commit changed, each `{status}\t{path}`. @param {string} rev */
const changed = (rev) => stateGit(dir, ['show', '--name-status', '--no-renames', '--format=', rev]).trim().split('\n');

/** The state branch's head, short. */
const shortHead = () => stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim();

/** A topic's discussion item as the unit's manifest holds it. @param {string} topic */
const discussion = (topic) => readManifest(dir, EPIC).phases.discussion.items[topic];

describe('topic send (10.1, 10.2.7)', () => {
  it('lands the message as the next file of the target\'s own mailbox, its path naming no phase, writing no entry, the scratch consumed and the message committed alone (10.S1, 10.S6, 5.S11)', () => {
    const ledger = readState(dir, layout.ledger);
    const message = scratch();
    const first = ok(dir, ['topic', 'send', EPIC, 'commercialization', '--content', message, '--slug', 'lost-key']);
    assert.deepStrictEqual(first, { ok: true, unit: EPIC, topic: 'commercialization', message_path: at(layout.mailbox(EPIC, 'commercialization', '001-lost-key.md')), committed: shortHead() });
    assert.deepStrictEqual([readState(dir, layout.mailbox(EPIC, 'commercialization', '001-lost-key.md')), fs.existsSync(message)], [MESSAGE, false]);
    assert.deepStrictEqual([lastMessage(dir), changed('HEAD')], [`mail(${EPIC}): send 001-lost-key.md to commercialization`, [`A\t${layout.mailbox(EPIC, 'commercialization', '001-lost-key.md')}`]]);
    assert.strictEqual(send(EPIC, 'commercialization', 'refund-window').message_path, at(layout.mailbox(EPIC, 'commercialization', '002-refund-window.md')));
    assert.strictEqual(readState(dir, layout.ledger), ledger);
  });

  it('takes the next number under the writer lock: a send racing another lands after it', (t) => {
    const lock = holdLock(at(layout.lock));
    const attempts = lockAttempts(t, lock, () => {
      writeState(dir, layout.mailbox(EPIC, 'commercialization', '001-raced.md'), 'Raced\n');
      fs.unlinkSync(lock);
    });
    assert.strictEqual(send(EPIC, 'commercialization', 'lost-key').message_path, at(layout.mailbox(EPIC, 'commercialization', '002-lost-key.md')));
    assert.deepStrictEqual(attempts.slice(0, 2), ['taken', 'made']);
  });

  it('parks the topic\'s conversation as a landing does: created not started where absent, left so by a second message, one under way untouched', () => {
    send(EPIC, 'licence', 'first');
    send(EPIC, 'licence', 'second');
    send(EPIC, 'commercialization', 'lost-key');
    assert.deepStrictEqual([discussion('licence'), discussion('commercialization')], [{ status: 'unstarted' }, { status: 'in-progress' }]);
    assert.deepStrictEqual(changed('HEAD~1'), [`A\t${layout.mailbox(EPIC, 'licence', '002-second.md')}`]);
  });

  it('heals a conversation with fields but no status to not started, its fields kept', () => {
    const manifest = readManifest(dir, EPIC);
    manifest.phases.discussion.items.licence = { reconcile_needed: true };
    writeState(dir, layout.manifest(EPIC), JSON.stringify(manifest, null, 2) + '\n');
    send(EPIC, 'licence', 'first');
    assert.deepStrictEqual(discussion('licence'), { reconcile_needed: true, status: 'unstarted' });
  });

  it('sets a decided topic back in progress: it shows mail waiting and is decided no longer (10.S10, P9)', () => {
    const res = send(EPIC, 'first-run', 'lost-key');
    const manifest = readManifest(dir, EPIC);
    const mapRow = buildDiscoveryMap(manifest, statePath(dir)).map.find((r) => r.name === 'first-run');
    assert.deepStrictEqual([res.reopened, discussion('first-run').status, computeTopicLifecycle(manifest, 'first-run').lifecycle, mapRow?.mail_waiting], [true, 'in-progress', 'discussing', true]);
  });

  it('stales the extraction of a specification sourcing the topic, and flags the specification', () => {
    const res = send(EPIC, 'first-run', 'lost-key');
    const { onboarding } = readManifest(dir, EPIC).phases.specification.items;
    assert.deepStrictEqual([res.reconcile_flagged, res.sources_staled, onboarding.reconcile_needed, onboarding.sources['first-run'].status], [true, ['onboarding'], 'discussion', 'stale']);
  });

  it('leaves a postponed topic as it stands, its message waiting in its mailbox for its return (10.1.8)', () => {
    const before = readState(dir, layout.manifest(EPIC));
    assert.strictEqual(send(EPIC, 'widgets', 'lost-key').message_path, at(layout.mailbox(EPIC, 'widgets', '001-lost-key.md')));
    assert.strictEqual(readState(dir, layout.manifest(EPIC)), before);
  });

  it('sends a cancelled topic\'s message, or a cancelled unit\'s, to the inbox as an idea, its first line the title (10.1.8, P5)', () => {
    const idea = (/** @type {string} */ slug) => layout.inbox('ideas', `${FROZEN_AT.slice(0, 10)}--${slug}.md`);
    const res = withFrozenClock(() => send(EPIC, 'removal', 'lost-key'));
    assert.deepStrictEqual(res, { ok: true, unit: EPIC, topic: 'removal', inbox_path: at(idea('lost-key')), committed: shortHead() });
    assert.strictEqual(readState(dir, idea('lost-key')), '# The licence window carries a "Lost your key?" link\n\nTheir reasoning: a buyer on a new Mac has no key to hand.\n');
    assert.deepStrictEqual([lastMessage(dir), fs.existsSync(at(layout.topic(EPIC, 'removal')))], [`mail(${EPIC}): lost-key to the inbox — removal is cancelled`, false]);
    assert.strictEqual(withFrozenClock(() => send('retired', 'retired', 'stray', '# A stray thought\n')).inbox_path, at(idea('stray')));
    assert.strictEqual(readState(dir, idea('stray')), '# A stray thought\n');
  });

  it('waits a feature\'s message for its discussion and a bugfix\'s for its investigation', () => {
    send('quick-sync', 'quick-sync', 'lost-key');
    send('crash', 'crash', 'repro');
    assert.deepStrictEqual([readManifest(dir, 'quick-sync').phases.discussion.items['quick-sync'], readManifest(dir, 'crash').phases.investigation.items.crash], [{ status: 'unstarted' }, { status: 'in-progress' }]);
    assert.strictEqual(fs.existsSync(at(layout.mailbox('crash', 'crash', '001-repro.md'))), true);
  });

  it('refuses, writing nothing and keeping the scratch: a send missing its message or slug, a slug not kebab-case, a message outside the cache, missing or with no title, a topic named across folders', () => {
    const message = scratch();
    const live = writeState(dir, layout.unit(EPIC, 'notes.md'), MESSAGE);
    const untitled = writeState(dir, layout.cache('scratch', 'untitled.md'), '\nBody.\n');
    const cases = [
      [[EPIC, 'commercialization', '--slug', 'lost-key'], 'Usage: engine topic send <work-unit> <topic> --content <file> --slug <kebab>'],
      [[EPIC, 'commercialization', '--content', message], 'Usage: engine topic send <work-unit> <topic> --content <file> --slug <kebab>'],
      [[EPIC, 'commercialization', '--content', message, '--slug', 'Lost_Key'], '--slug must be kebab-case, got "Lost_Key"'],
      [[EPIC, 'commercialization', '--content', live, '--slug', 'lost-key'], `--content must point inside ${at('.cache')}/ — got "${live}"`],
      [[EPIC, 'commercialization', '--content', at(layout.cache('scratch', 'absent.md')), '--slug', 'lost-key'], `message file not found: ${at(layout.cache('scratch', 'absent.md'))}`],
      [[EPIC, 'commercialization', '--content', untitled, '--slug', 'lost-key'], `a message's first line is its title, and ${untitled}'s is blank`],
      [[EPIC, '../evil', '--content', message, '--slug', 'lost-key'], 'invalid topic name "../evil" — no separators or ".."'],
    ];
    assert.deepStrictEqual(cases.map(([args]) => refused(['topic', 'send', ...args])), cases.map(([, error]) => error));
    assert.strictEqual(fs.existsSync(message), true);
  });

  it('refuses a target it cannot land on, writing nothing: a unit the project lacks, a topic the unit lacks, one closed as a dead end, one promoted out of the unit, a quick-fix', () => {
    const cases = [
      [['nowhere', 'nowhere'], /^there is no work unit "nowhere"$/],
      [[EPIC, 'billing'], /^fumi has no topic "billing" — a message goes to a topic the unit holds$/],
      [[EPIC, 'dead-end'], /^"dead-end" is closed as a dead end — reopen it in discovery first$/],
      [[EPIC, 'export'], /portability/],
      [['typo', 'typo'], /^a quick-fix has no conversation for a message to wait in$/],
    ];
    for (const [[unit, topic], error] of cases) {
      assert.match(refused(['topic', 'send', unit, topic, '--content', scratch(), '--slug', 'lost-key']), error, `${unit} ${topic}`);
    }
  });
});

describe('topic mailbox (10.1.5)', () => {
  it('lists what waits in the order it landed, as absolute paths, taking no lock — a message sent since among them (10.S4)', (t) => {
    assert.deepStrictEqual(ok(dir, ['topic', 'mailbox', EPIC, 'commercialization']), { ok: true, unit: EPIC, topic: 'commercialization', count: 0, files: [] });
    send(EPIC, 'commercialization', 'lost-key');
    send(EPIC, 'commercialization', 'refund-window');
    fs.mkdirSync(at(layout.mailbox(EPIC, 'commercialization', 'folder.md')));
    const attempts = lockAttempts(t, holdLock(at(layout.lock)), () => { throw new Error('the read tried the writer lock'); });
    assert.deepStrictEqual(ok(dir, ['topic', 'mailbox', EPIC, 'commercialization']).files, [
      at(layout.mailbox(EPIC, 'commercialization', '001-lost-key.md')), at(layout.mailbox(EPIC, 'commercialization', '002-refund-window.md')),
    ]);
    assert.deepStrictEqual(attempts, []);
  });

  it('refuses a call of another shape, a topic named across folders, and a unit the project lacks', () => {
    assert.deepStrictEqual([refused(['topic', 'mailbox', EPIC]), refused(['topic', 'mailbox', EPIC, '../evil']), refused(['topic', 'mailbox', 'nowhere', 'any'])], [
      'Usage: engine topic mailbox <work-unit> <topic>', 'invalid topic name "../evil" — no separators or ".."', 'there is no work unit "nowhere"',
    ]);
  });
});

describe('topic answered (P4, 5.3.8)', () => {
  it('removes the message once the topic holds the question it raised, committing the removal alone, and git keeps the file — the mailbox then reads empty', () => {
    send(EPIC, 'commercialization', 'lost-key');
    send(EPIC, 'commercialization', 'refund-window');
    const res = ok(dir, ['topic', 'answered', EPIC, 'commercialization', '001', '--entry', asked.commercialization]);
    assert.deepStrictEqual(res, { ok: true, unit: EPIC, topic: 'commercialization', answered: '001-lost-key.md', entry: asked.commercialization, remaining: 1, committed: shortHead() });
    const file = layout.mailbox(EPIC, 'commercialization', '001-lost-key.md');
    assert.deepStrictEqual([fs.existsSync(at(file)), lastMessage(dir), changed('HEAD'), stateGit(dir, ['show', `HEAD~1:${file}`])], [
      false, `mail(${EPIC}): commercialization answered 001-lost-key.md`, [`D\t${file}`], MESSAGE,
    ]);
    ok(dir, ['topic', 'answered', EPIC, 'commercialization', '002', '--entry', asked.commercialization]);
    const item = ok(dir, ['checklist', 'show', 'decided', EPIC, 'commercialization']).items.find((/** @type {{key: string}} */ i) => i.key === 'mailbox-empty');
    assert.strictEqual(item.state, 'done');
  });

  it('holds the writer lock around the removal: a live holder keeps the message until it lets go', (t) => {
    send(EPIC, 'commercialization', 'lost-key');
    const lock = holdLock(at(layout.lock));
    /** @type {boolean[]} */
    const whileHeld = [];
    const attempts = lockAttempts(t, lock, () => {
      whileHeld.push(fs.existsSync(at(layout.mailbox(EPIC, 'commercialization', '001-lost-key.md'))));
      fs.unlinkSync(lock);
    });
    ok(dir, ['topic', 'answered', EPIC, 'commercialization', '001', '--entry', asked.commercialization]);
    assert.deepStrictEqual([attempts.slice(0, 2), whileHeld], [['taken', 'made'], [true]]);
  });

  it('refuses, writing nothing: a call of another shape, a number no message holds, an id no entry begins, an entry that is no question, a question standing on another topic', () => {
    send(EPIC, 'commercialization', 'lost-key');
    const finding = ok(dir, ['ledger', 'find', `${EPIC}.discussion.commercialization`], { env: SESSION, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'A finding.', how: 'Read it.', known: 'read' }) }).id;
    const answered = (/** @type {string[]} */ args) => refused(['topic', 'answered', EPIC, 'commercialization', ...args]);
    assert.deepStrictEqual([
      answered(['001']), answered(['1', '--entry', asked.commercialization]), answered(['002', '--entry', asked.commercialization]), answered(['001', '--entry', 'ffffffff']),
      answered(['001', '--entry', finding]), answered(['001', '--entry', asked['first-run']]),
    ], [
      'Usage: engine topic answered <work-unit> <topic> <NNN> --entry <id>',
      'Usage: engine topic answered <work-unit> <topic> <NNN> --entry <id>',
      'no message 002 waits in commercialization\'s mailbox — it holds 001-lost-key.md',
      'topic answered --entry: no ledger entry\'s id begins "ffffffff"',
      `topic answered --entry names ${finding}, a finding — it must name the question the message raised`,
      `topic answered --entry names ${asked['first-run']}, a question on first-run of ${EPIC} — the question the message raised stands on commercialization`,
    ]);
  });
});

describe('render send-report (10.3.4)', () => {
  /** The report for a send's response. @param {string} address @param {Record<string, any>} res */
  const report = (address, res) => output(dir, ['render', 'send-report', address, '--sent', res.message_path ?? res.inbox_path]);

  it('says where the message landed, its title beneath, and ends with the command that opens the target (10.S1, 27.S4)', () => {
    assert.strictEqual(report(`${EPIC}.commercialization`, send(EPIC, 'commercialization', 'lost-key')), [
      '=== DISPLAY: send report (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Sent to Commercialization, on Fumi',
      '  The licence window carries a "Lost your key?" link',
      '  ↳ Waiting in its mailbox, with my reasoning',
      '',
      `/leeway ${EPIC} commercialization`,
      '',
    ].join('\n'));
  });

  it('names a single-topic unit once, a postponed topic\'s wait for its return, and a cancelled topic\'s inbox in one line', () => {
    assert.match(report('quick-sync.quick-sync', send('quick-sync', 'quick-sync', 'lost-key')), /^Sent to Quick Sync\n/m);
    assert.match(report(`${EPIC}.widgets`, send(EPIC, 'widgets', 'lost-key')), /^ {2}↳ Postponed — waiting in its mailbox for its return$/m);
    assert.deepStrictEqual(report(`${EPIC}.removal`, send(EPIC, 'removal', 'lost-key')).split('\n').slice(1), ['Removal is cancelled, so the message went to the inbox as an idea', '']);
  });

  it('refuses a path that is no message sent to the topic, and a call of another shape', () => {
    const { message_path: sent } = send(EPIC, 'commercialization', 'lost-key');
    assert.deepStrictEqual([refused(['render', 'send-report', `${EPIC}.licence`, '--sent', sent]), refused(['render', 'send-report', EPIC, '--sent', sent])], [
      `render send-report: ${sent} is no message sent to licence — --sent takes the path topic send answered`,
      'Usage: engine render send-report <work-unit>.<topic> --sent <path>',
    ]);
  });
});

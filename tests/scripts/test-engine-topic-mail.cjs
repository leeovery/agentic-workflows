'use strict';

// ---------------------------------------------------------------------------
// The mailboxes between topics (leeway-engine/scripts/domain/mail.cjs, the
// screens projections/mail.cjs): `topic send`, landing a message as the next
// file of the target topic's one mailbox, its path naming no phase (10.S1),
// the line under its title naming who sent it and when, as the waiting mail
// heads it (10.4.2) — a sender a topic of the unit, another unit's topic or
// an experiment of the target, never text — writing no entry (10.S6, 5.S11),
// the topic's conversation parked as a
// landing parks it — set back in progress where decided (10.S10) — a
// postponed topic's message waiting in its mailbox and a cancelled topic's
// gone to the inbox as an idea, as is a cancelled unit's, the report and the
// commit naming which is cancelled (10.1.8), each send under the writer lock and
// committed, and any other target the entry refuses refused by its rule — a
// unit completed, or past its spec (10.2.2); `topic mailbox`, what waits,
// taking no lock (10.S4); `topic answered`, a message named whole removed
// once the topic holds the question it raised there (5.3.8) or one any
// move of the unit's took there, wherever it stands since (9.S17); a pending
// commit's retry, in a scope that commits what was left; and `render
// send-report`, the send report ending with the command that opens the
// target (10.3.4, 27.S4). The waiting mail raised at a topic's opening is
// test-engine-enter.cjs's, a closed decided worked afresh after a reopen
// test-engine-checklist.cjs's. What a message changes in the decisions it
// touches is the ledger's: a moved question's standing on the maps is
// test-engine-ledger-map.cjs's (9.S17); another topic's same answer leaving the owner's entry to stand
// test-engine-ledger-map.cjs's (10.S7); a record showing another topic's
// current answer test-engine-ledger-read.cjs's (10.S8); and a decided topic
// relying on a replaced answer waiting on the person
// test-engine-ledger-affected.cjs's (10.S9).
//
// Layer: verb. World, built once and copied: an epic, `fumi`, whose map
// holds `commercialization` under discussion with a question asked on it and
// an experiment, E1, `licence` not yet discussed, `first-run` decided with a question of its
// own and sourced by a concluded specification, `widgets` postponed,
// `removal` cancelled, `dead-end` closed as one, and `export` promoted; a
// feature, `quick-sync`; a bugfix, `crash`, under investigation; a
// quick-fix, `typo`; a cancelled feature, `retired`; a completed one,
// `shipped`; one with its spec, `specced`; and a cancelled epic, `shelved`,
// whose map holds `pricing`.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  ok, output, refusedPristine, statePath, layout, writeState, readState, readManifest, stateGit, lastMessage, commitAll,
  fixtureFrom, cleanupFixture, holdLock, lockAttempts, withFrozenClock, FROZEN_AT,
} = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { computeTopicLifecycle, buildDiscoveryMap } = require('../../skills/leeway-engine/scripts/domain/derivations.cjs');
const { BRANCH_REF } = require('../../skills/leeway-engine/scripts/kernel/state-root.cjs');

const EPIC = 'fumi';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'mail-session' });
const MESSAGE = 'The licence window carries a "Lost your key?" link\n\nTheir reasoning: a buyer on a new Mac has no key to hand.\n';

/** Who each unit's sends in this suite come from: a topic of the unit. @type {Record<string, string>} */
const SENDER = { [EPIC]: 'first-run', shelved: 'pricing' };

/** MESSAGE as it lands, sent by `sender` on the frozen day. @param {string} sender */
const landed = (sender) => MESSAGE.replace('\n', `\nFrom ${sender} · 1 Jan\n`);

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
      experiment: { items: { commercialization: { status: 'in-progress', experiments: { E1: { slug: 'latency', status: 'running' } } } } },
    },
  });
  createManifest(dir, 'shelved', { work_type: 'epic', status: 'cancelled', phases: { discovery: { items: { pricing: row(1) } } } });
  createManifest(dir, 'quick-sync');
  createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
  createManifest(dir, 'typo', { work_type: 'quick-fix' });
  createManifest(dir, 'retired', { status: 'cancelled' });
  createManifest(dir, 'shipped', { status: 'completed' });
  createManifest(dir, 'specced');
  writeState(dir, layout.unit('specced', 'spec.md'), '# Spec\n');
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

/** A send from the unit's sender that must succeed: its response. @param {string} unit @param {string} topic @param {string} slug @param {string} [text] */
function send(unit, topic, slug, text) {
  return ok(dir, ['topic', 'send', unit, topic, '--from', SENDER[unit] ?? unit, '--content', scratch(text), '--slug', slug]);
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

/** What is uncommitted in the state, each `{XY} {path}`. */
const dirt = () => stateGit(dir, ['status', '--porcelain', '--untracked-files=all']).trim().split('\n').filter(Boolean);

/** Blocks the state branch, so a commit fails and the state stays saved: the call that frees it. */
function blockStateBranch() {
  const lock = path.join(dir, '.git', `${BRANCH_REF}.lock`);
  fs.writeFileSync(lock, '');
  return () => fs.unlinkSync(lock);
}

/**
 * The retry a pending commit's note prescribes, run as written once the
 * branch is free: what it committed.
 * @param {Record<string, any>} res @param {() => void} free
 */
function retried(res, free) {
  const [, scope] = /^commit pending — state saved; retry with: engine commit (.+) -m "<message>"$/.exec(res.note) ?? [];
  assert.ok(scope, `a retry is prescribed: ${res.note}`);
  free();
  ok(dir, ['commit', ...scope.split(' '), '-m', 'the retry']);
  return changed('HEAD');
}

describe('topic send (10.1, 10.2.7)', () => {
  it('lands the message as the next file of the target\'s own mailbox, its path naming no phase, writing no entry, the scratch consumed and the message committed alone, a peer\'s dirt left as it was (10.S1, 10.S6, 5.S11)', () => {
    const ledger = readState(dir, layout.ledger);
    writeState(dir, layout.doc(EPIC, 'discussion', 'licence'), '# Licence, mid-conversation\n');
    const peer = dirt();
    const message = scratch();
    const first = withFrozenClock(() => ok(dir, ['topic', 'send', EPIC, 'commercialization', '--from', 'first-run', '--content', message, '--slug', 'lost-key']));
    assert.deepStrictEqual(first, { ok: true, unit: EPIC, topic: 'commercialization', message_path: at(layout.mailbox(EPIC, 'commercialization', '001-lost-key.md')), committed: shortHead() });
    assert.deepStrictEqual([readState(dir, layout.mailbox(EPIC, 'commercialization', '001-lost-key.md')), fs.existsSync(message)], [landed('First Run'), false]);
    assert.deepStrictEqual([lastMessage(dir), changed('HEAD')], [`mail(${EPIC}): send 001-lost-key.md to commercialization`, [`A\t${layout.mailbox(EPIC, 'commercialization', '001-lost-key.md')}`]]);
    assert.strictEqual(send(EPIC, 'commercialization', 'refund-window').message_path, at(layout.mailbox(EPIC, 'commercialization', '002-refund-window.md')));
    assert.deepStrictEqual([readState(dir, layout.ledger), dirt()], [ledger, peer]);
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

  it('names the sender under the title as the waiting mail heads it: a topic of the unit, another unit\'s topic — a single-topic unit by its name alone — an experiment of the target, or one of another topic by that topic, each on the day it was sent (10.4.2, 9.1.11)', () => {
    const fromLine = (/** @type {string} */ unit, /** @type {string} */ topic, /** @type {string} */ from) => {
      const res = withFrozenClock(() => ok(dir, ['topic', 'send', unit, topic, '--from', from, '--content', scratch(), '--slug', `from-${from.replace(/[./]/g, '-').toLowerCase()}`]));
      return fs.readFileSync(res.message_path, 'utf8').split('\n')[1];
    };
    assert.deepStrictEqual([
      fromLine(EPIC, 'licence', 'commercialization'), fromLine('quick-sync', 'quick-sync', 'fumi.first-run'),
      fromLine(EPIC, 'licence', 'quick-sync.quick-sync'), fromLine(EPIC, 'commercialization', 'E1'),
      fromLine(EPIC, 'licence', 'commercialization/E1'),
    ], ['From Commercialization · 1 Jan', 'From First Run, on Fumi · 1 Jan', 'From Quick Sync · 1 Jan', 'From Experiment E1 · 1 Jan', 'From Experiment E1, on Commercialization · 1 Jan']);
  });

  it('refuses a sender that is no name it takes, writing nothing and keeping the scratch: text, a topic the unit lacks, a unit the project lacks, a topic another unit lacks, an experiment the target has not run, one another topic\'s series lacks, a topic with no series, the target\'s own by its topic, a name of three parts', () => {
    const message = scratch();
    const refusal = (/** @type {string} */ from) => `--from names "${from}" — it takes who sent the message: a topic of ${EPIC}, {unit}.{topic} for another unit's topic, E{n} for an experiment of licence, or {topic}/E{n} for one of another topic`;
    const senders = ['Lost key', 'billing', 'nowhere.any', 'quick-sync.other', 'E1', 'commercialization/E9', 'first-run/E1', 'commercialization/E1/E1', 'fumi.first-run.extra'];
    assert.deepStrictEqual(senders.map((from) => refused(['topic', 'send', EPIC, 'licence', '--from', from, '--content', message, '--slug', 'lost-key'])), senders.map(refusal));
    assert.strictEqual(
      refused(['topic', 'send', EPIC, 'commercialization', '--from', 'commercialization/E1', '--content', message, '--slug', 'lost-key']),
      `--from names "commercialization/E1" — it takes who sent the message: a topic of ${EPIC}, {unit}.{topic} for another unit's topic, E{n} for an experiment of commercialization, or {topic}/E{n} for one of another topic`,
    );
    assert.strictEqual(fs.existsSync(message), true);
  });

  it('sends a cancelled topic\'s message, or a cancelled unit\'s, to the inbox as an idea, its first line the title, the line naming its sender kept under it, the commit naming what is cancelled (10.1.8, P5)', () => {
    const idea = (/** @type {string} */ slug) => layout.inbox('ideas', `${FROZEN_AT.slice(0, 10)}--${slug}.md`);
    const res = withFrozenClock(() => send(EPIC, 'removal', 'lost-key'));
    assert.deepStrictEqual(res, { ok: true, unit: EPIC, topic: 'removal', inbox_path: at(idea('lost-key')), committed: shortHead() });
    assert.strictEqual(readState(dir, idea('lost-key')), `# ${landed('First Run')}`);
    assert.deepStrictEqual([lastMessage(dir), fs.existsSync(at(layout.topic(EPIC, 'removal')))], [`mail(${EPIC}): lost-key to the inbox — removal is cancelled`, false]);
    assert.strictEqual(withFrozenClock(() => send('retired', 'retired', 'stray', '# A stray thought\n')).inbox_path, at(idea('stray')));
    assert.strictEqual(readState(dir, idea('stray')), '# A stray thought\nFrom Retired · 1 Jan\n');
    withFrozenClock(() => send('shelved', 'pricing', 'price-floor'));
    assert.strictEqual(lastMessage(dir), 'mail(shelved): price-floor to the inbox — shelved is cancelled');
    assert.strictEqual(readState(dir, idea('price-floor')), `# ${landed('Pricing')}`);
  });

  it('waits a feature\'s message for its discussion and a bugfix\'s for its investigation', () => {
    send('quick-sync', 'quick-sync', 'lost-key');
    send('crash', 'crash', 'repro');
    assert.deepStrictEqual([readManifest(dir, 'quick-sync').phases.discussion.items['quick-sync'], readManifest(dir, 'crash').phases.investigation.items.crash], [{ status: 'unstarted' }, { status: 'in-progress' }]);
    assert.strictEqual(fs.existsSync(at(layout.mailbox('crash', 'crash', '001-repro.md'))), true);
  });

  it('refuses, writing nothing and keeping the scratch: a send missing its sender, message or slug, a slug not kebab-case, a message outside the cache, missing or with no title, a topic named across folders', () => {
    const message = scratch();
    const live = writeState(dir, layout.unit(EPIC, 'notes.md'), MESSAGE);
    const untitled = writeState(dir, layout.cache('scratch', 'untitled.md'), '\nBody.\n');
    const usage = 'Usage: engine topic send <work-unit> <topic> --from <sender> --content <file> --slug <kebab>';
    const from = ['--from', 'first-run'];
    const cases = [
      [[EPIC, 'commercialization', '--content', message, '--slug', 'lost-key'], usage],
      [[EPIC, 'commercialization', ...from, '--slug', 'lost-key'], usage],
      [[EPIC, 'commercialization', ...from, '--content', message], usage],
      [[EPIC, 'commercialization', ...from, '--content', message, '--slug', 'Lost_Key'], '--slug must be kebab-case, got "Lost_Key"'],
      [[EPIC, 'commercialization', ...from, '--content', live, '--slug', 'lost-key'], `--content must point inside ${at('.cache')}/ — got "${live}"`],
      [[EPIC, 'commercialization', ...from, '--content', at(layout.cache('scratch', 'absent.md')), '--slug', 'lost-key'], `message file not found: ${at(layout.cache('scratch', 'absent.md'))}`],
      [[EPIC, 'commercialization', ...from, '--content', untitled, '--slug', 'lost-key'], `a message's first line is its title, and ${untitled}'s is blank`],
      [[EPIC, '../evil', ...from, '--content', message, '--slug', 'lost-key'], 'invalid topic name "../evil" — no separators or ".."'],
    ];
    assert.deepStrictEqual(cases.map(([args]) => refused(['topic', 'send', ...args])), cases.map(([, error]) => error));
    assert.strictEqual(fs.existsSync(message), true);
  });

  it('refuses a target the entry refuses, by its rule, writing nothing and keeping the scratch: a unit the project lacks, one completed, one past its spec — a change from there settled where it is found (10.2.2) — a topic the unit lacks, one closed as a dead end, one promoted out of the unit, a quick-fix', () => {
    const cases = [
      [['nowhere', 'nowhere'], 'there is no work unit "nowhere"'],
      [['shipped', 'shipped'], 'shipped is completed — new work starts from the start menu'],
      [['specced', 'specced'], 'specced has its spec — a topic exists only before it, and a change is settled in the spec from here'],
      [[EPIC, 'billing'], 'fumi has no topic "billing" — the epic\'s map holds its topics, and a new one comes through its discovery'],
      [[EPIC, 'dead-end'], 'the topic "dead-end" is closed as a dead end — reopening it goes through the epic menu\'s discovery row'],
      [[EPIC, 'export'], 'the topic "export" was promoted to "portability" — it carries on there'],
      [['typo', 'typo'], 'a quick-fix has no conversation for a message to wait in'],
    ];
    const message = scratch();
    assert.deepStrictEqual(cases.map(([[unit, topic]]) => refused(['topic', 'send', unit, topic, '--from', SENDER[unit] ?? unit, '--content', message, '--slug', 'lost-key'])), cases.map(([, error]) => error));
    assert.strictEqual(fs.existsSync(message), true);
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
    withFrozenClock(() => send(EPIC, 'commercialization', 'lost-key'));
    send(EPIC, 'commercialization', 'refund-window');
    const res = ok(dir, ['topic', 'answered', EPIC, 'commercialization', '001-lost-key', '--entry', asked.commercialization]);
    assert.deepStrictEqual(res, { ok: true, unit: EPIC, topic: 'commercialization', answered: '001-lost-key.md', entry: asked.commercialization, remaining: 1, committed: shortHead() });
    const file = layout.mailbox(EPIC, 'commercialization', '001-lost-key.md');
    assert.deepStrictEqual([fs.existsSync(at(file)), lastMessage(dir), changed('HEAD'), stateGit(dir, ['show', `HEAD~1:${file}`])], [
      false, `mail(${EPIC}): commercialization answered 001-lost-key.md`, [`D\t${file}`], landed('First Run'),
    ]);
    ok(dir, ['topic', 'answered', EPIC, 'commercialization', '002-refund-window', '--entry', asked.commercialization]);
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
    ok(dir, ['topic', 'answered', EPIC, 'commercialization', '001-lost-key', '--entry', asked.commercialization]);
    assert.deepStrictEqual([attempts.slice(0, 2), whileHeld], [['taken', 'made'], [true]]);
  });

  it('takes the message by its whole name, since a number comes back once the highest is answered: the name of one answered refuses where a later one took its number', () => {
    send(EPIC, 'commercialization', 'lost-key');
    ok(dir, ['topic', 'answered', EPIC, 'commercialization', '001-lost-key', '--entry', asked.commercialization]);
    assert.strictEqual(send(EPIC, 'commercialization', 'refund-window').message_path, at(layout.mailbox(EPIC, 'commercialization', '001-refund-window.md')));
    assert.strictEqual(refused(['topic', 'answered', EPIC, 'commercialization', '001-lost-key', '--entry', asked.commercialization]),
      'no message 001-lost-key waits in commercialization\'s mailbox — it holds 001-refund-window.md');
  });

  it('takes the question the message raised on the topic wherever it stands since: moved to another topic, or later to the roadmap', () => {
    send(EPIC, 'commercialization', 'lost-key');
    send(EPIC, 'commercialization', 'refund-window');
    const address = `${EPIC}.discussion.commercialization`;
    const made = { env: SESSION, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none' }) };
    const later = ok(dir, ['ledger', 'ask', address], { ...made, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Is a refund window owed?' }) }).id;
    ok(dir, ['ledger', 'move', address, '--question', asked.commercialization, '--to', 'licence'], made);
    assert.strictEqual(ok(dir, ['topic', 'answered', EPIC, 'commercialization', '001-lost-key', '--entry', asked.commercialization]).remaining, 1);
    ok(dir, ['roadmap', 'add', 'refunds', '--horizon', 'v2', '--summary', 'Refunds']);
    ok(dir, ['ledger', 'move', address, '--question', later, '--to', 'roadmap:refunds'], made);
    assert.strictEqual(ok(dir, ['topic', 'answered', EPIC, 'commercialization', '002-refund-window', '--entry', later]).remaining, 0);
  });

  it('takes the question a move brought to the topic, the message that carried it answered by it there (9.S17)', () => {
    const made = { env: SESSION, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none' }) };
    ok(dir, ['ledger', 'move', `${EPIC}.discussion.commercialization`, '--question', asked.commercialization, '--to', 'licence'], made);
    ok(dir, ['topic', 'send', EPIC, 'licence', '--from', 'commercialization', '--content', scratch(), '--slug', 'moved-question']);
    assert.strictEqual(ok(dir, ['topic', 'answered', EPIC, 'licence', '001-moved-question', '--entry', asked.commercialization]).remaining, 0);
  });

  it('takes the question any move of the unit\'s took to the topic wherever it stands since — moved on to another topic, or back where it was raised — and refuses one no move took there (9.S17)', () => {
    const made = { env: SESSION, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none' }) };
    const move = (/** @type {string} */ from, /** @type {string} */ question, /** @type {string} */ to) => ok(dir, ['ledger', 'move', `${EPIC}.discussion.${from}`, '--question', question, '--to', to], made);
    const onward = asked.commercialization;
    const back = ok(dir, ['ledger', 'ask', `${EPIC}.discussion.commercialization`], { ...made, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Is a refund window owed?' }) }).id;
    move('commercialization', onward, 'licence');
    move('commercialization', back, 'licence');
    send(EPIC, 'licence', 'moved-on');
    send(EPIC, 'licence', 'moved-back');
    send(EPIC, 'first-run', 'never-here');
    move('licence', onward, 'first-run');
    move('licence', back, 'commercialization');
    assert.deepStrictEqual([
      ok(dir, ['topic', 'answered', EPIC, 'licence', '001-moved-on', '--entry', onward]).remaining,
      ok(dir, ['topic', 'answered', EPIC, 'licence', '002-moved-back', '--entry', back]).remaining,
    ], [1, 0]);
    assert.strictEqual(
      refused(['topic', 'answered', EPIC, 'first-run', '001-never-here', '--entry', back]),
      `topic answered --entry names ${back}, a question raised on commercialization of ${EPIC} that no move of ${EPIC}'s took to first-run — it must name the question the message raised: one first raised on first-run, or one a move of ${EPIC}'s took there`,
    );
  });

  it('refuses a unit no longer in progress, writing nothing, its message left waiting', () => {
    send(EPIC, 'commercialization', 'lost-key');
    const manifest = readManifest(dir, EPIC);
    writeState(dir, layout.manifest(EPIC), JSON.stringify({ ...manifest, status: 'cancelled' }, null, 2) + '\n');
    assert.strictEqual(refused(['topic', 'answered', EPIC, 'commercialization', '001-lost-key', '--entry', asked.commercialization]), 'fumi is cancelled — reactivating it comes first');
  });

  it('refuses, writing nothing: a call of another shape — a message named by its number alone, or as its file — a name no message holds, an id no entry begins, an entry that is no question, a question raised on another topic', () => {
    send(EPIC, 'commercialization', 'lost-key');
    const finding = ok(dir, ['ledger', 'find', `${EPIC}.discussion.commercialization`], { env: SESSION, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'A finding.', how: 'Read it.', known: 'read' }) }).id;
    const answered = (/** @type {string[]} */ args) => refused(['topic', 'answered', EPIC, 'commercialization', ...args]);
    const usage = 'Usage: engine topic answered <work-unit> <topic> <NNN-slug> --entry <id>';
    assert.deepStrictEqual([
      answered(['001-lost-key']), answered(['001', '--entry', asked.commercialization]), answered(['1-lost-key', '--entry', asked.commercialization]),
      answered(['001-lost-key.md', '--entry', asked.commercialization]), answered(['002-lost-key', '--entry', asked.commercialization]),
      answered(['001-lost-key', '--entry', 'ffffffff']), answered(['001-lost-key', '--entry', finding]), answered(['001-lost-key', '--entry', asked['first-run']]),
    ], [
      usage, usage, usage, usage,
      'no message 002-lost-key waits in commercialization\'s mailbox — it holds 001-lost-key.md',
      'topic answered --entry: no ledger entry\'s id begins "ffffffff"',
      `topic answered --entry names ${finding}, a finding — it must name the question the message raised`,
      `topic answered --entry names ${asked['first-run']}, a question raised on first-run of ${EPIC} that no move of ${EPIC}'s took to commercialization — it must name the question the message raised: one first raised on commercialization, or one a move of ${EPIC}'s took there`,
    ]);
  });
});

describe('a pending commit\'s retry', () => {
  it('retries a send to the mailbox and a removal in the topic\'s scope, as a sweep, and an inbox landing in the inbox\'s — each committing what was left', () => {
    let free = blockStateBranch();
    const sent = send(EPIC, 'licence', 'lost-key');
    assert.match(sent.note, / commit fumi --topic discussion\/licence --sweep -m /);
    assert.deepStrictEqual(retried(sent, free), [`M\t${layout.manifest(EPIC)}`, `A\t${layout.mailbox(EPIC, 'licence', '001-lost-key.md')}`]);

    send(EPIC, 'commercialization', 'refund-window');
    free = blockStateBranch();
    const answered = ok(dir, ['topic', 'answered', EPIC, 'commercialization', '001-refund-window', '--entry', asked.commercialization]);
    assert.deepStrictEqual(retried(answered, free), [`D\t${layout.mailbox(EPIC, 'commercialization', '001-refund-window.md')}`]);

    free = blockStateBranch();
    const idea = withFrozenClock(() => send(EPIC, 'removal', 'lost-key'));
    assert.match(idea.note, / commit --inbox -m /);
    assert.deepStrictEqual(retried(idea, free), [`A\t${layout.inbox('ideas', `${FROZEN_AT.slice(0, 10)}--lost-key.md`)}`]);
  });

  it('retries a bugfix\'s send in its investigation\'s scope', () => {
    const free = blockStateBranch();
    assert.deepStrictEqual(retried(send('crash', 'crash', 'repro'), free), [`A\t${layout.mailbox('crash', 'crash', '001-repro.md')}`]);
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

  it('names a single-topic unit once, a postponed topic\'s wait for its return, and a cancelled topic\'s inbox in one line — or a cancelled unit\'s, naming the unit', () => {
    assert.match(report('quick-sync.quick-sync', send('quick-sync', 'quick-sync', 'lost-key')), /^Sent to Quick Sync\n/m);
    assert.match(report(`${EPIC}.widgets`, send(EPIC, 'widgets', 'lost-key')), /^ {2}↳ Postponed — waiting in its mailbox for its return$/m);
    assert.deepStrictEqual(report(`${EPIC}.removal`, send(EPIC, 'removal', 'lost-key')).split('\n').slice(1), ['Removal is cancelled, so the message went to the inbox as an idea', '']);
    assert.deepStrictEqual(report('shelved.pricing', send('shelved', 'pricing', 'price-floor')).split('\n').slice(1), ['Shelved is cancelled, so the message went to the inbox as an idea', '']);
  });

  it('refuses a path that is no message sent to the topic, and a call of another shape', () => {
    const { message_path: sent } = send(EPIC, 'commercialization', 'lost-key');
    assert.deepStrictEqual([refused(['render', 'send-report', `${EPIC}.licence`, '--sent', sent]), refused(['render', 'send-report', EPIC, '--sent', sent])], [
      `render send-report: ${sent} is no message sent to licence — --sent takes the path topic send answered`,
      'Usage: engine render send-report <work-unit>.<topic> --sent <path>',
    ]);
  });
});

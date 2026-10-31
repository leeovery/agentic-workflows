'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's discovery entry: the ways into the product's
// conversation — the start menu's p, the roadmap's p and start's new-work
// rows, each handing into `discovery none` — and its one log carried on from
// conversation to conversation, each caught up from the last; the next
// day's session; the note a compaction carries at either level; the
// brownfield offer's research, owed from its yes until the findings land;
// and the conversation moving between the product, an epic's discovery and
// a topic in one session, with no handoff.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const LIB = require(path.join(ROOT, 'skills/leeway-engine/scripts/lib.cjs'));
const { stateGit } = require('./engine-harness.cjs');
const { Sim, sessionLog, handoff, startKeys, startNew, pickRoute, arrive, carryOn, mappedEpic, enterEntry, waitAgents, presenceRow } = require('./pipeline-world.cjs');

const PRODUCT = 'product';
const EPIC = 'fumi';

/** A log of discovery's, state-relative: the product's, or the epic's. @param {string} home @param {number} n */
const logOf = (home, n) => `${home === PRODUCT ? '.product/sessions' : `${home}/discovery`}/session-00${n}.md`;

/** @param {Sim} sim @param {string} home @param {number} n */
const logPath = (sim, home, n) => path.join(sim.dir, '.leeway', logOf(home, n));

/** Every value the entry's DATA names under `key`. @param {Sim} sim @param {string} key @returns {string[]} */
function named(sim, key) {
  return [...sim.sections.matchAll(new RegExp(`^${key}: (.*)$`, 'gm'))].map((m) => m[1]);
}

/** @param {Sim} sim @param {string} home @param {number} n */
function headersIn(sim, home, n) {
  return fs.readFileSync(logPath(sim, home, n), 'utf8').split('\n').filter((line) => line.startsWith('## '));
}

/**
 * A handoff into `discovery none` landing: a fresh conversation, whose
 * discovery skill enters the product's conversation, asks nothing first, and
 * carries on there after a compaction.
 * @param {Sim} sim
 */
function inTheProduct(sim) {
  sim.handOver();
  const res = sim.run(['enter', 'discovery', PRODUCT]);
  assert.strictEqual(res.entered, true, 'no other session holds it');
  assert.match(sim.sections, /^=== DATA /, 'no question before the reads (8.S1)');
  const here = carryOn(sim);
  assert.deepStrictEqual(here.position, { name: PRODUCT });
  assert.strictEqual(here.skill, path.join(sim.dir, '.claude/skills/leeway-discovery/SKILL.md'));
  return res;
}

/** The handoff the roadmap's p makes (the roadmap skill's open_product), its row checked first. @param {Sim} sim */
function roadmapsProduct(sim) {
  pickRoute(sim, startKeys(sim), 'open_roadmap');
  arrive(sim, 'roadmap');
  const keys = LIB.project.roadmapHomeMenu(LIB.roadmap.roadmapState(sim.dir)).keys;
  assert.ok(keys.some((k) => k.key === 'p' && k.action === 'open_product'), 'the roadmap offers the product\'s conversation as p');
  handoff(sim, '/leeway-discovery none none');
}

/** A transcript Claude Code keeps for a conversation, in the sim's own projects folder. @param {Sim} sim @param {string} sessionId */
function transcriptOf(sim, sessionId) {
  const file = path.join(sim.env.CLAUDE_CONFIG_DIR, 'projects', 'sim-project', `${sessionId}.jsonl`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{}\n');
  return file;
}

describe('pipeline simulation: discovery\'s entry', () => {
  /** @type {Sim} */
  let sim;
  beforeEach(() => {
    sim = new Sim();
    sim.env = { ...sim.env, CLAUDE_CONFIG_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-sim-claude-')) };
  });
  afterEach(() => {
    fs.rmSync(sim.env.CLAUDE_CONFIG_DIR, { recursive: true, force: true });
    sim.destroy();
  });

  it('the start menu\'s p, the roadmap\'s p and start\'s s all reach the product\'s conversation, one log carried on across them, each conversation catching up the last (8.S3, 8.S62, 8.S65, 8.S70)', () => {
    sim.run(['session', 'repair']);
    pickRoute(sim, startKeys(sim), 'open_product');
    const first = inTheProduct(sim);
    assert.deepStrictEqual([first.started, typeof first.committed], [true, 'string'], 'the first entry opens the session and commits it');
    assert.match(stateGit(sim.dir, ['ls-files', '--', logOf(PRODUCT, 1)]), /session-001\.md/, 'logged in .product/sessions, committed with its start');
    assert.deepStrictEqual([named(sim, 'session log'), named(sim, 'catch up'), named(sim, 'log')], [[], [], [logPath(sim, PRODUCT, 1)]]);
    fs.appendFileSync(logPath(sim, PRODUCT, 1), '\nPricing comes first.\n');

    roadmapsProduct(sim);
    const second = inTheProduct(sim);
    assert.deepStrictEqual([second.started, second.committed], [false, undefined], 'a return carries on in the open log, nothing opened or committed');
    assert.deepStrictEqual(named(sim, 'session log'), [logPath(sim, PRODUCT, 1)]);
    assert.deepStrictEqual(named(sim, 'catch up'),
      ['the transcript of session sim-session-1, which last wrote the log, is gone — say so in one line, and carry on from the log']);

    const left = transcriptOf(sim, 'sim-session-2');
    startNew(sim, 'none');
    inTheProduct(sim);
    assert.deepStrictEqual(named(sim, 'catch up'), [`read ${left} from the log's last write onward, and add to the log what it is missing`],
      'the conversation that ended without a word is named for catch-up at the next return');
    assert.strictEqual(headersIn(sim, PRODUCT, 1).length, 3, 'each conversation adds its own line to the one log');
    assert.ok(!fs.existsSync(logPath(sim, PRODUCT, 2)), 'one product conversation, one log');
  });

  it('the next day\'s opening, after the session was ended, opens the next log and reads where it had got to (8.S69)', () => {
    pickRoute(sim, startKeys(sim), 'open_product');
    inTheProduct(sim);
    fs.appendFileSync(logPath(sim, PRODUCT, 1), '\nLicensing waits on pricing.\n');
    sim.run(['discovery-session', 'close', PRODUCT, '-m', 'discovery(product): end session 001']);

    pickRoute(sim, startKeys(sim), 'open_product');
    const next = inTheProduct(sim);
    assert.strictEqual(next.started, true);
    assert.deepStrictEqual([named(sim, 'session log'), named(sim, 'log'), named(sim, 'research owed')],
      [[logPath(sim, PRODUCT, 1)], [logPath(sim, PRODUCT, 2)], ['no']]);
    assert.strictEqual(LIB.project.startMenu(LIB.detail.startDetail(sim.dir)).keys.find((k) => k.action === 'open_product')?.label.tail?.startsWith('2 sessions, last on '), true,
      'the start menu\'s row counts the sessions and names the last date');
  });

  it('a compaction at either level names the skill, the open log and the log\'s transcript to catch up from (8.S67, 8.S75, 24.S19)', () => {
    mappedEpic(sim, EPIC, ['licensing']);
    pickRoute(sim, startKeys(sim), 'open_product');
    inTheProduct(sim);
    const transcript = transcriptOf(sim, sim.env.CLAUDE_CODE_SESSION_ID);
    const atProduct = carryOn(sim).text;
    for (const part of ['leeway-discovery/SKILL.md and its framework', `Catch the log, ${logPath(sim, PRODUCT, 1)}, up from this conversation's transcript, ${transcript}`]) {
      assert.ok(atProduct.includes(part), `the product's note names ${part}:\n${atProduct}`);
    }

    sim.run(['enter', 'discovery', EPIC, '--move']);
    const atEpic = carryOn(sim).text;
    for (const part of ['leeway-discovery/SKILL.md and its framework', `render discovery-map ${EPIC}\``, `Catch the log, ${logPath(sim, EPIC, 2)}, up from this conversation's transcript, ${transcript}`]) {
      assert.ok(atEpic.includes(part), `the epic's note names ${part}:\n${atEpic}`);
    }
  });

  it('the level moves in one session: the product to an epic and back, each log ending on a pointer to the next, the position and presence moving with no handoff (8.S71, 24.S20)', () => {
    mappedEpic(sim, EPIC, ['licensing']);
    pickRoute(sim, startKeys(sim), 'open_product');
    inTheProduct(sim);
    const conversation = sim.conversations;

    const down = sim.run(['enter', 'discovery', EPIC, '--move']);
    assert.deepStrictEqual([down.started, typeof down.committed], [true, 'string'], 'the epic\'s next session opened, the move committed');
    assert.strictEqual(fs.readFileSync(logPath(sim, PRODUCT, 1), 'utf8').trimEnd().split('\n').at(-1),
      `→ Carried on in the discovery of "${EPIC}": [session-002.md](../../${EPIC}/discovery/session-002.md)`);
    assert.strictEqual(headersIn(sim, EPIC, 2).length, 1, 'the epic\'s log takes the conversation\'s line');
    assert.deepStrictEqual(carryOn(sim).position, { name: EPIC, phase: 'discovery', topic: EPIC });
    assert.ok(presenceRow(sim.run(['presence', 'scan', EPIC]), 'discovery', EPIC)?.held, 'the presence moved to the epic');
    assert.ok(!sim.run(['presence', 'scan']).sessions.some((/** @type {{work_unit: string}} */ r) => r.work_unit === PRODUCT), 'and left the product');

    sim.run(['enter', 'discovery', PRODUCT, '--move']);
    assert.strictEqual(fs.readFileSync(logPath(sim, EPIC, 2), 'utf8').trimEnd().split('\n').at(-1),
      '→ Carried on in the product\'s conversation: [session-001.md](../../.product/sessions/session-001.md)');
    assert.strictEqual(headersIn(sim, PRODUCT, 1).length, 1, 'the product\'s log already names this conversation');
    assert.deepStrictEqual(carryOn(sim).position, { name: PRODUCT });
    assert.strictEqual(sim.conversations, conversation, 'no handoff: the same conversation throughout');
  });

  // The discussion skill's Moving Up: the log brought up to date, the wait
  // for the topic's agents, then the move in the same conversation.
  it('a topic\'s talk moving up to its epic: its agents waited on, the sitting committed and the topic\'s presence gone, in the same conversation (8.S72, 24.S20)', () => {
    mappedEpic(sim, EPIC, ['licensing']);
    enterEntry(sim, EPIC, 'discussion', 'licensing');
    const conversation = sim.conversations;
    sim.write(`.leeway/${EPIC}/topics/licensing/log.md`, `${named(sim, 'log header')[0]}\n\nThis is about the whole epic.\n`);
    waitAgents(sim, EPIC, 'licensing');

    const up = sim.run(['enter', 'discovery', EPIC, '--move']);
    assert.strictEqual(typeof up.committed, 'string');
    assert.strictEqual(stateGit(sim.dir, ['status', '--porcelain', '--', `${EPIC}/topics/licensing/log.md`]), '', 'the sitting is committed with the move');
    assert.strictEqual(presenceRow(sim.run(['presence', 'scan', EPIC]), 'discussion', 'licensing'), undefined, 'the topic\'s presence is gone');
    assert.deepStrictEqual(carryOn(sim).position, { name: EPIC, phase: 'discovery', topic: EPIC });
    assert.strictEqual(sim.conversations, conversation);
  });

  it('code that predates the workflows: the offer accepted, the research owed at each opening of the product\'s conversation until the product researcher\'s findings land, then completed and never owed again (8.S37, 8.S78, 8.12.4, 8.12.13)', () => {
    assert.strictEqual(sim.run(['boot']).brownfield_offer, 'none', 'the judgment is made');
    sim.render(['brownfield-offer-gate'], { expect: 'content' });
    sim.run(['brownfield', 'record', 'accepted']);
    handoff(sim, '/leeway-discovery none none');
    inTheProduct(sim);
    assert.deepStrictEqual(named(sim, 'research owed'), ['yes']);

    // The conversation ends before the research lands. The next start goes
    // to its menu, and opening the product's conversation from it resumes
    // the research.
    sim.run(['boot']);
    pickRoute(sim, startKeys(sim), 'open_product');
    inTheProduct(sim);
    assert.deepStrictEqual(named(sim, 'research owed'), ['yes']);

    sim.run(['brief', 'product-researcher']);
    const finding = sim.run(['ledger', 'find', 'product.discovery'], null,
      JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Orders are pushed downstream by a polling dispatcher.', how: 'read app/Dispatcher.php', known: 'read' })).id;
    sim.run(['brownfield', 'record', 'completed']);
    assert.deepStrictEqual(sim.run(['ledger', 'product']).discovery.map((/** @type {{id: string}} */ e) => e.id), [finding], 'the findings landed at the product\'s place');

    sim.run(['boot']);
    startNew(sim, 'none');
    inTheProduct(sim);
    assert.deepStrictEqual(named(sim, 'research owed'), ['no'], 'a later session does not run it again');
  });

  it('a single-topic unit\'s talk moving up to the product\'s conversation, the only place above it (8.2.12, 24.S20)', () => {
    const wu = 'saved-filters';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Saved filters', '--session-log-file', sessionLog(sim, wu)]);
    enterEntry(sim, wu, 'discussion', wu);
    const conversation = sim.conversations;
    sim.write(`.leeway/${wu}/topics/${wu}/log.md`, `${named(sim, 'log header')[0]}\n\nThis is about the product.\n`);
    waitAgents(sim, wu, wu);

    sim.refuses(['enter', 'discovery', wu, '--move'], /its discovery ended at start this work/);
    sim.run(['enter', 'discovery', PRODUCT, '--move']);
    assert.strictEqual(stateGit(sim.dir, ['status', '--porcelain', '--', `${wu}/topics/${wu}/log.md`]), '', 'the sitting is committed with the move');
    assert.strictEqual(presenceRow(sim.run(['presence', 'scan', wu]), 'discussion', wu), undefined);
    assert.deepStrictEqual(carryOn(sim).position, { name: PRODUCT });
    assert.strictEqual(sim.conversations, conversation);
  });
});

'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's discovery entry: the ways into the product's
// conversation — the start menu's p, the roadmap's p and start's new-work
// rows, each handing into `discovery none` — and its one log carried on from
// conversation to conversation, each caught up from the last; work brought
// in words taking its type call in no session of the product's, so a fix
// asked for in one window never stops, reads or closes the product's talk
// going on in another; the next
// day's session, after the last one ended on its roadmap items; the note a
// compaction carries at either level; the brownfield offer's research, owed
// from its yes until the findings land; the conversation moving between the
// product, an epic's discovery and a topic in one session, with no handoff;
// and the epic menu's d into its discovery, where the map changes at the
// person's word; and what a conversation outside Ledger keeps of the
// product, through the keep's doors, with no boot, read by a topic's
// opening.
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
const { startMenuRead } = require(path.join(ROOT, 'skills/ledger-engine/scripts/domain/start-menu.cjs'));
const { startMenuScreen } = require(path.join(ROOT, 'skills/ledger-engine/scripts/domain/projections/start-menu.cjs'));
const { stateGit, statePath, commitOnState } = require('./engine-harness.cjs');
const { highestMigration } = require(path.join(ROOT, 'skills/ledger-migrate/scripts/migration-ids.cjs'));
const {
  Sim, startUnit, handoff, handoffBy, answerGate, typeAtGate, startPick, startNew, startBare, startWith, startMenu, epicPick, carryOn, mappedEpic, enterEntry, presenceRow, briefDraft, roadmapMenu,
  startThisWork,
} = require('./pipeline-world.cjs');

const PRODUCT = 'product';
const EPIC = 'fumi';

/** A log of discovery's, state-relative: the product's, or the epic's. @param {string} home @param {number} n */
const logOf = (home, n) => `${home === PRODUCT ? '.product/sessions' : `${home}/discovery`}/session-00${n}.md`;

/** @param {Sim} sim @param {string} home @param {number} n */
const logPath = (sim, home, n) => path.join(sim.dir, '.ledger', logOf(home, n));

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
  assert.strictEqual(here.skill, path.join(sim.dir, '.claude/skills/ledger-discovery/SKILL.md'));
  return res;
}

/** The handoff the roadmap's p makes, the roadmap opened from the start menu. @param {Sim} sim */
function roadmapsProduct(sim) {
  startPick(sim, 'r');
  roadmapMenu(sim);
  const { next } = answerGate(sim, 'roadmap', '--pick', 'p');
  handoff(sim, `/${next.skill} ${next.args.join(' ')}`);
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

  it('the start menu\'s p, the roadmap\'s p and start\'s s all reach the product\'s conversation, one log carried on across them, each conversation catching up the last (8.S3, 8.S62, 8.S65, 8.S70, 19.S27)', () => {
    sim.run(['session', 'repair']);
    startPick(sim, 'p');
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
    startNew(sim);
    inTheProduct(sim);
    assert.deepStrictEqual(named(sim, 'catch up'), [`read ${left} from the log's last write onward, and add to the log what it is missing`],
      'the conversation that ended without a word is named for catch-up at the next return');
    assert.strictEqual(headersIn(sim, PRODUCT, 1).length, 3, 'each conversation adds its own line to the one log');
    assert.ok(!fs.existsSync(logPath(sim, PRODUCT, 2)), 'one product conversation, one log');
  });

  it('work brought in conversation comes through the one entry: boot given the words sends new work to Start\'s type call in this conversation, with no menu, and words naming a unit in progress into it as the start menu\'s number does — so Claude brings the request itself, which goes to Start beside a unit in progress — and talk about the product naming one into the product\'s conversation by the pick\'s Start, never its menu; the bare command draws the banner before boot, then the menu (8.S79, 18.S72, 18.2.15, 25.S10, 8.2.17)', () => {
    const conversation = sim.conversations;
    const brought = startWith(sim, 'Change what the help command prints when it has no topic');
    assert.deepStrictEqual([brought.go, brought.route], ['route', { kind: 'start', words: 'Change what the help command prints when it has no topic', next: { kind: 'invoke', skill: 'ledger-discovery', args: ['start', 'none'] } }]);
    const opened = sim.run(['enter', 'discovery', PRODUCT, '--type-call']);
    assert.strictEqual(opened.entered, true);
    assert.strictEqual(sim.conversations, conversation, 'the route opens in place, nothing cleared: what the person said stays with the work');

    startThisWork(sim, { type: 'quick-fix', name: 'help-topic', description: 'What help prints with no topic', reason: 'One known change.' });
    assert.strictEqual(startWith(sim, 'Make the sidebar margin match on narrow windows').route?.kind, 'start', 'the request, not a go-ahead, beside a unit in progress');
    const named = startWith(sim, 'carry on with help-topic');
    const { invoked } = handoffBy(sim, ['handoff', 'unit', 'help-topic']);
    assert.deepStrictEqual([named.go, named.route.unit, `/${named.route.next.skill} ${named.route.next.args.join(' ')}`], ['route', 'help-topic', invoked]);

    const talk = startWith(sim, 'I think help-topic should never print the whole list, the product is quieter than that');
    assert.deepStrictEqual([talk.go, talk.pick.start], ['pick', brought.route.next]);
    assert.strictEqual(sim.run(['enter', 'discovery', PRODUCT]).entered, true, 'the talk carries the product\'s conversation on, the pick never drawn');

    assert.strictEqual(startBare(sim).go, 'menu', 'the bare command, in a new conversation, draws the banner before boot, then the menu');
    assert.ok(startMenu(sim).some(({ next }) => next?.kind === 'engine' && next.argv.join(' ') === 'handoff unit help-topic'), 'the menu lists the unit');
  });

  it('8.2.9: a fix asked for in one window while another talks product — its type call asks that window nothing, and its yes starts the quick-fix in place and leaves the product\'s session open, for that window to end its own session after', () => {
    const talking = sim.session('product-window');
    talking.run(['enter', 'discovery', PRODUCT]);
    startWith(sim, 'Change what the help command prints when it has no topic');
    sim.run(['enter', 'discovery', PRODUCT, '--type-call']);
    const asked = /=== MENU: held topic gate /.test(sim.sections);
    const started = startThisWork(sim, { type: 'quick-fix', name: 'help-topic', description: 'What help prints with no topic', reason: 'One known change.' });
    const ended = talking.run(['discovery-session', 'close', PRODUCT, '-m', 'discovery(product): end the session']);

    assert.deepStrictEqual([asked, started.product_session_closed, started.next.kind, ended.session], [false, null, 'invoke', '001']);
  });

  it('the next day\'s opening, after the session was ended, opens the next log and reads where it had got to (8.S69)', () => {
    startPick(sim, 'p');
    inTheProduct(sim);
    fs.appendFileSync(logPath(sim, PRODUCT, 1), '\nLicensing waits on pricing.\n');

    // A spike and a shared file land at the product's level; a path that is
    // not there lands nothing, and the prompt's skip lands the rest.
    assert.strictEqual(sim.run(['asset', 'spike', PRODUCT, 'pricing-page']).path, '.product/spikes/001-pricing-page');
    const shared = sim.write('notes/pricing.md', '# Pricing\n');
    sim.refuses(['asset', 'import', PRODUCT, shared, 'notes/gone.png'], /notes\/gone\.png/);
    // The person asks first in their own words, which sets the prompt
    // aside; once it is answered, their skip answers the prompt where it
    // waits, never drawn again.
    sim.render(['import-reprompt', '--file', sim.write('.ledger/.cache/product/discovery/product/import-reprompt.json', { missing: ['notes/gone.png'] })], { expect: 'content' });
    typeAtGate(sim, 'import reprompt', 'is the png one I need?');
    answerGate(sim, 'import reprompt', '--pick', 's');
    assert.deepStrictEqual(sim.run(['asset', 'import', PRODUCT, shared]).imports, ['.product/assets/pricing.md']);

    // The session's end proposes what it named as roadmap items on one
    // screen, and the person's yes lands them (18.S63).
    const items = sim.write('.ledger/.cache/product/discovery/product/roadmap-items.json',
      [{ name: 'licensing', horizon: 'later', summary: 'Teams buy seats', sources: [logOf(PRODUCT, 1)] }]);
    sim.render(['roadmap-harvest', '--file', items], { expect: 'content' });
    sim.run(answerGate(sim, 'roadmap harvest gate', '--pick', 'y').next.argv);
    sim.run(['discovery-session', 'close', PRODUCT, '-m', 'discovery(product): end session 001']);
    assert.deepStrictEqual(sim.run(['roadmap', 'state']).items.map((/** @type {{name: string, sources: string[]}} */ i) => [i.name, i.sources]), [['licensing', [logOf(PRODUCT, 1)]]]);

    startPick(sim, 'p');
    const next = inTheProduct(sim);
    assert.strictEqual(next.started, true);
    assert.deepStrictEqual([named(sim, 'session log'), named(sim, 'log'), named(sim, 'research owed')],
      [[logPath(sim, PRODUCT, 1)], [logPath(sim, PRODUCT, 2)], ['no']]);
    const tail = () => /** @type {any} */ (startMenuScreen(startMenuRead(sim.dir)).rows.find((row) => row.key === 'p')?.label).tail;
    const opened = tail();
    fs.appendFileSync(logPath(sim, PRODUCT, 2), '\nSeats before pricing.\n');
    assert.match(opened, /^1 session, last on /, 'a session nothing has been said in yet is not counted');
    assert.match(tail(), /^2 sessions, last on /, 'the start menu\'s row counts the sessions holding talk and names the last date');
  });

  it('a compaction at either level names the skill, the open log and the log\'s transcript to catch up from (8.S67, 8.S75, 24.S19)', () => {
    mappedEpic(sim, EPIC, ['licensing']);
    startPick(sim, 'p');
    inTheProduct(sim);
    const transcript = transcriptOf(sim, sim.env.CLAUDE_CODE_SESSION_ID);
    const atProduct = carryOn(sim).text;
    for (const part of ['ledger-discovery/SKILL.md and its framework', `Catch the log, ${logPath(sim, PRODUCT, 2)}, up from this conversation's transcript, ${transcript}`]) {
      assert.ok(atProduct.includes(part), `the product's note names ${part}:\n${atProduct}`);
    }

    sim.run(['enter', 'discovery', EPIC, '--move']);
    const atEpic = carryOn(sim).text;
    for (const part of ['ledger-discovery/SKILL.md and its framework', `render discovery-map ${EPIC}\``, `Catch the log, ${logPath(sim, EPIC, 2)}, up from this conversation's transcript, ${transcript}`]) {
      assert.ok(atEpic.includes(part), `the epic's note names ${part}:\n${atEpic}`);
    }
  });

  it('the level moves in one session: the product to an epic and back, each log ending on a pointer to the next, the position and presence moving with no handoff (8.S71, 24.S20)', () => {
    mappedEpic(sim, EPIC, ['licensing']);
    startPick(sim, 'p');
    inTheProduct(sim);
    const conversation = sim.conversations;

    const down = sim.run(['enter', 'discovery', EPIC, '--move']);
    assert.deepStrictEqual([down.started, typeof down.committed], [true, 'string'], 'the epic\'s next session opened, the move committed');
    assert.strictEqual(fs.readFileSync(logPath(sim, PRODUCT, 2), 'utf8').trimEnd().split('\n').at(-1),
      `→ Carried on in the discovery of "${EPIC}": [session-002.md](../../${EPIC}/discovery/session-002.md)`);
    assert.strictEqual(headersIn(sim, EPIC, 2).length, 1, 'the epic\'s log takes the conversation\'s line');
    assert.deepStrictEqual(carryOn(sim).position, { name: EPIC, phase: 'discovery', topic: EPIC });
    const again = sim.run(['enter', 'discovery', EPIC]);
    assert.deepStrictEqual([again.started, again.committed], [false, undefined], 'entering again after the move reads it as it stands');
    assert.ok(presenceRow(sim.run(['presence', 'scan', EPIC]), 'discovery', EPIC)?.held, 'the presence moved to the epic');
    assert.ok(!sim.run(['presence', 'scan']).sessions.some((/** @type {{work_unit: string}} */ r) => r.work_unit === PRODUCT), 'and left the product');

    sim.run(['enter', 'discovery', PRODUCT, '--move']);
    assert.strictEqual(fs.readFileSync(logPath(sim, EPIC, 2), 'utf8').trimEnd().split('\n').at(-1),
      '→ Carried on in the product\'s conversation: [session-002.md](../../.product/sessions/session-002.md)');
    assert.strictEqual(headersIn(sim, PRODUCT, 2).length, 1, 'the product\'s log already names this conversation');
    assert.deepStrictEqual(carryOn(sim).position, { name: PRODUCT });
    assert.strictEqual(sim.conversations, conversation, 'no handoff: the same conversation throughout');
  });

  it('the epic menu\'s d hands into its discovery, where the map changes at the person\'s word: a new topic, a cancel confirmed and reactivated, a park pulled forward, a finding, a spike, the log\'s fixed lists, and a message to a started topic (18.4.9, 8.8.6, 8.7.6, 20.11.1)', () => {
    mappedEpic(sim, EPIC, ['licensing', 'pricing']);
    enterEntry(sim, EPIC, 'discussion', 'licensing');
    assert.strictEqual(epicPick(sim, EPIC, 'd').text, `Invoke \`/ledger-discovery none ${EPIC}\`.`);
    sim.handOver();
    sim.run(['enter', 'discovery', EPIC]);
    const log = path.relative(path.join(sim.dir, '.ledger'), named(sim, 'log')[0]);
    sim.render(['discovery-map', EPIC], { expect: 'content' });

    sim.run(['topic', 'add', EPIC, 'seats', '--summary', 'How seats are counted', '--brief', briefDraft(sim, EPIC, 'seats')]);
    sim.render(['cancel-gate', `${EPIC}.discovery.pricing`], { expect: 'content' });
    sim.run(answerGate(sim, 'cancel gate', '--pick', 'y').next.argv);
    assert.match(sim.sections, /Cancelled "Pricing"\./);
    sim.run(['topic', 'reactivate', EPIC, 'discovery', 'pricing']);
    assert.match(sim.sections, /Reactivated "Pricing"\./);

    // Put aside onto the roadmap from here, then pulled into the epic after all.
    sim.run(['roadmap', 'add', 'offline-notes', '--horizon', 'later', '--summary', 'Notes without a network', '--origin', `park:${EPIC}`, '--source', log]);
    assert.deepStrictEqual(sim.run(['roadmap', 'state']).items[0].sources, [log]);
    sim.run(['roadmap', 'pull-forward', 'offline-notes', '--into', EPIC]);

    const finding = sim.run(['ledger', 'find', `${EPIC}.discovery`], null,
      JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Seats are counted per workspace today.', how: 'read app/Seats.php', known: 'read' })).id;
    assert.match(finding, /^\S+$/);

    const { spike } = sim.run(['asset', 'spike', EPIC, 'seat-picker']);
    const entries = [
      sim.run(['discovery-log', 'spike', EPIC, spike, '--tool', 'Paper', '--showed', 'A picker reads at a glance', '--link', 'https://paper.design/f/2']),
      sim.run(['discovery-log', 'not-taken', EPIC, '--direction', 'Seats per user', '--why', 'workspaces are what is billed']),
      sim.run(['discovery-log', 'view', EPIC, '--text', 'Pricing stays one-time']),
    ];
    assert.deepStrictEqual(entries.map(({ log: written, heading }) => [written, heading]), [[log, 'Spikes'], [log, 'Not taken'], [log, 'Views of the product']]);

    const sent = sim.run(['topic', 'send', EPIC, 'licensing', '--from', `${EPIC}.discovery`, '--slug', 'seat-counting',
      '--content', sim.write(`.ledger/.cache/${EPIC}/discovery/${EPIC}/message-seat-counting.md`, 'Seat counting\n\nSeats are per workspace today; decide whether licences follow.\n')]);
    assert.match(fs.readFileSync(sent.message_path, 'utf8'), /^From Discovery · /m);
    assert.match(sim.render(['send-report', `${EPIC}.licensing`, '--sent', sent.message_path], { expect: 'content' }), /^Sent to Licensing, on Fumi$/m);
    assert.deepStrictEqual(Object.keys(sim.manifest(EPIC).phases.discovery.items), ['licensing', 'pricing', 'seats', 'offline-notes']);
  });

  // The discussion skill's Moving Up: the log brought up to date, then the
  // move in the same conversation.
  it('a topic\'s talk moving up to its epic: the sitting committed and the topic\'s presence gone, in the same conversation (8.S72, 24.S20)', () => {
    mappedEpic(sim, EPIC, ['licensing']);
    enterEntry(sim, EPIC, 'discussion', 'licensing');
    const conversation = sim.conversations;
    sim.write(`.ledger/${EPIC}/topics/licensing/log.md`, `${named(sim, 'log header')[0]}\n\nThis is about the whole epic.\n`);

    const up = sim.run(['enter', 'discovery', EPIC, '--move']);
    assert.strictEqual(typeof up.committed, 'string');
    assert.strictEqual(stateGit(sim.dir, ['status', '--porcelain', '--', `${EPIC}/topics/licensing/log.md`]), '', 'the sitting is committed with the move');
    assert.strictEqual(presenceRow(sim.run(['presence', 'scan', EPIC]), 'discussion', 'licensing'), undefined, 'the topic\'s presence is gone');
    assert.deepStrictEqual(carryOn(sim).position, { name: EPIC, phase: 'discovery', topic: EPIC });
    assert.strictEqual(sim.conversations, conversation);
  });

  it('code that predates Ledger: the offer accepted, the research owed at each opening of the product\'s conversation until the product researcher\'s findings land, then completed and never owed again (8.S37, 8.S78, 8.12.4, 8.12.13)', () => {
    assert.strictEqual(sim.run(['boot']).brownfield_offer, 'none', 'the judgment is made');
    sim.render(['brownfield-offer-gate'], { expect: 'content' });
    sim.run(['brownfield', 'record', 'accepted']);
    handoff(sim, '/ledger-discovery none none');
    inTheProduct(sim);
    assert.deepStrictEqual(named(sim, 'research owed'), ['yes']);

    // The conversation ends before the research lands. The next start goes
    // to its menu, and opening the product's conversation from it resumes
    // the research.
    sim.run(['boot']);
    startPick(sim, 'p');
    inTheProduct(sim);
    assert.deepStrictEqual(named(sim, 'research owed'), ['yes']);

    sim.run(['brief', 'product-researcher']);
    const finding = sim.run(['ledger', 'find', 'product.discovery'], null,
      JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'Orders are pushed downstream by a polling dispatcher.', how: 'read app/Dispatcher.php', known: 'read' })).id;
    sim.run(['brownfield', 'record', 'completed']);
    assert.deepStrictEqual(sim.run(['ledger', 'product']).discovery.map((/** @type {{id: string}} */ e) => e.id), [finding], 'the findings landed at the product\'s place');

    sim.run(['boot']);
    startNew(sim);
    inTheProduct(sim);
    assert.deepStrictEqual(named(sim, 'research owed'), ['no'], 'a later session does not run it again');
  });

  it('a single-topic unit\'s talk moving up to the product\'s conversation, the only place above it (8.2.12, 24.S20)', () => {
    const wu = 'saved-filters';
    startUnit(sim, 'feature', wu, 'Saved filters');
    enterEntry(sim, wu, 'discussion', wu);
    const conversation = sim.conversations;
    sim.write(`.ledger/${wu}/topics/${wu}/log.md`, `${named(sim, 'log header')[0]}\n\nThis is about the product.\n`);

    sim.refuses(['enter', 'discovery', wu, '--move'], /its discovery ended at start this work/);
    sim.run(['enter', 'discovery', PRODUCT, '--move']);
    assert.strictEqual(stateGit(sim.dir, ['status', '--porcelain', '--', `${wu}/topics/${wu}/log.md`]), '', 'the sitting is committed with the move');
    assert.strictEqual(presenceRow(sim.run(['presence', 'scan', wu]), 'discussion', wu), undefined);
    assert.deepStrictEqual(carryOn(sim).position, { name: PRODUCT });
    assert.strictEqual(sim.conversations, conversation);
  });

  it('a conversation outside Ledger keeps what is said of the product through the keep\'s doors, never booted: a view, a direction dropped and a spike with its files in the product\'s log, a finding at its place with the file it rests on, a message to a topic, and an idea kept then dropped, marking nothing; the topic\'s opening reads them all (8.14.12, 18.11.1, 18.11.7, 10.1.9)', () => {
    mappedEpic(sim, EPIC, ['licensing']);
    commitOnState(statePath(sim.dir), { '.state/migrations': `${highestMigration()}\n` }, 'migrations: the record, as boot left it');
    sim.open();
    sim.refuses(['render', 'start-menu'], /has not booted Ledger/);

    sim.run(['discovery-log', 'view', PRODUCT, '--text', 'Notes are furniture.']);
    sim.run(['discovery-log', 'not-taken', PRODUCT, '--direction', 'A web client', '--why', 'the Mac is the product']);
    const { spike, path: folder } = sim.run(['asset', 'spike', PRODUCT, 'menu-bar']);
    sim.write(`.ledger/${folder}/MenuBar.swift`, 'struct MenuBar {}\n');
    sim.run(['discovery-log', 'spike', PRODUCT, spike, '--tool', 'Xcode', '--showed', 'A menu-bar note reads at a glance']);
    const { captured } = sim.run(['inbox', 'capture', 'idea'], null, '# Notes in the dock\n');
    sim.run(['inbox', 'archive', captured]);
    const finding = sim.run(['ledger', 'find', `${PRODUCT}.discovery`], null,
      JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'The brand is blue.', how: 'the brand guide', known: 'documented' })).id;
    const shared = path.join(sim.configDir, 'brand-guide.pdf');
    fs.writeFileSync(shared, 'blue\n');
    const [guide] = sim.run(['asset', 'import', PRODUCT, shared]).imports;
    sim.run(['asset', 'add', PRODUCT, guide, '--entry', finding, '--status', 'reference']);
    const sent = sim.run(['topic', 'send', EPIC, 'licensing', '--from', PRODUCT, '--slug', 'brand-colour',
      '--content', sim.write(`.ledger/.cache/${PRODUCT}/discovery/${PRODUCT}/message-brand-colour.md`, 'Brand colour\n\nThe brand is blue; a licence screen shows it.\n')]);
    assert.match(fs.readFileSync(sent.message_path, 'utf8'), /^From the product · /m);
    assert.match(sim.render(['send-report', `${EPIC}.licensing`, '--sent', sent.message_path], { expect: 'content' }), /^Sent to Licensing, on Fumi$/m);
    assert.strictEqual(stateGit(sim.dir, ['status', '--porcelain', '--untracked-files=all', '--', '.product', '.inbox', '.ledger.jsonl', EPIC]), '', 'every door committed what it kept');
    assert.strictEqual(fs.existsSync(path.join(sim.configDir, 'conversations', sim.env.CLAUDE_CODE_SESSION_ID, 'workflow')), false, 'no door marked the conversation as one that runs Ledger');

    sim.run(['boot']);
    enterEntry(sim, EPIC, 'discussion', 'licensing');
    assert.ok(named(sim, 'mail').includes(sent.message_path), 'the message waits for the opening');
    const call = /^product: `node \S+ (ledger product .+)`$/m.exec(sim.sections)?.[1];
    const read = JSON.parse(sim.read(/** @type {string} */ (call).split(' ')));
    assert.deepStrictEqual([read.views, read.not_taken], [['Notes are furniture.'], [{ direction: 'A web client', why: 'the Mac is the product' }]]);
    assert.deepStrictEqual(read.discovery.map((/** @type {{id: string, assets: object[]}} */ e) => [e.id, e.assets]), [[finding, [{ path: guide, status: 'reference', into: null }]]]);
  });
});

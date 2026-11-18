'use strict';

// ---------------------------------------------------------------------------
// The migration's briefs (ledger-engine/scripts/domain/brief.cjs, the
// records domain/brief-records.cjs, the templates content/briefs/; 21.10.5,
// 21.10.7): `engine brief migration-topic|migration-verifier --topic
// <unit.phase.topic> --directive <id>`. The per-topic agent's brief — the
// topic as the move left it, its files but its mail, and as the records
// directive's check reads them its specs, grouped under another name and
// kept as an asset or joined into the unit's spec.md where its building
// started, each part of it named, each approved, dated where its old item
// is, or a draft, its old map
// there, its research's threads still open, either "None — no entry needs"
// its mark where it has none, and its reviews never folded in, a promoted
// topic's where it was promoted from, all read in the main checkout from a
// linked worktree too; every file of the unit's assets but a dotfile and
// the topic's own spec, with where each came from, those the record walks
// apart from the rest and laid on the walk sheet — a split's research the
// topic's bearing its name, else the unit's own record's — the imports the
// record owes a link and those whose file is gone marked, where
// its record goes and whether it is composed yet, the other topics its
// sessions may speak of with what each is about, for judging whose a point
// is and never sources, the verifier's findings kept until a verifier
// reads the record again and every round's rulings, the carry's refusal
// taken by the brief and cleared, the call that checks the record writing
// nothing, and of the directive the sections its check names briefed, the
// session's own work none of them; a cancelled unit's topic briefed as any
// other; the verifier's — the topic, its record as composed, verbatim,
// every round of findings and rulings before, the last kept as a round and
// cleared, from the second round its walk sheet marking each entry and
// section against the rounds before so a later round walks what changed, the points the session settled, and the directive; every
// refusal storing nothing; and the two agents' definitions (21.S35): each
// fixes its model and effort, and its shell is for reading, the per-topic
// agent's for its record's check besides, so no other engine call and no
// ledger write is theirs.
//
// Layer: verb. World: the records directive's (migration-world.cjs), made
// once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { ok, git, statePath, layout, writeState, readState, cleanupFixture } = harness;
const { recordsMigration, refusedUntouched } = require('./migration-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/ledger-engine/scripts');
const { ENGINE_RUN } = require(path.join(SCRIPTS, 'kernel/call.cjs'));
const { ROLES, briefPath, issuedPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const { composedPath, findingsPath, rulingsPath, handbackPath, checkedPath, verifyingPath, refusedPath, roundsPath } = require(path.join(SCRIPTS, 'domain/ledger-carry.cjs'));
const TEMPLATES = path.join(__dirname, '../../skills/ledger-engine/content/briefs');
const DIRECTIVE = path.join(__dirname, '../../skills/ledger-migrate/scripts/migrations/079-records.md');
const AGENTS = path.join(__dirname, '../../agents');

const SESSION_ID = 'migration-brief-session';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: SESSION_ID });
const LICENSING = ['--topic', 'fumi.discussion.licensing', '--directive', '079-records'];
const RECORD = JSON.stringify({ entries: [{ ref: 'q1', event: 'asked', text: 'How long is the trial?', by: 'person' }] }, null, 2);

/** @type {string} */
let dir;
beforeEach(() => { dir = recordsMigration(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'brief-migration-')), 'fumi')); });
afterEach(() => {
  cleanupFixture(path.dirname(dir));
  fs.rmSync(conversationDir(SESSION_ID), { recursive: true, force: true });
});

/** A brief issued: the response and the brief as stored. @param {string[]} args */
function issued(args) {
  const res = ok(dir, ['brief', ...args], { env: SESSION });
  return { res, brief: fs.readFileSync(briefPath(SESSION_ID, res.id), 'utf8') };
}

/** A role's template as shipped, its slots filled with `drawn`. @param {string} role @param {Record<string, string>} drawn */
function filledTemplate(role, drawn) {
  return fs.readFileSync(path.join(TEMPLATES, `${role}.md`), 'utf8').split('\n').map((line) => drawn[line.slice(2, -2)] ?? line).join('\n');
}

/** licensing's sources laid out for its verifier, no entry of the record citing one. */
const UNCITED_SHEET = [
  '## fumi/topics/licensing/brief.md', '', '- Licensing, lines 1–3: no entry cites it', '',
  '## fumi/topics/licensing/experiments/E2-trial/report.md', '', '- Report > Result, lines 3–5: no entry cites it', '',
  '## fumi/topics/licensing/log.md', '', '- Discussion: Licensing > Trial Length > Decision, lines 7–9: no entry cites it', '',
  '## fumi/assets/specs/commerce.md', '', '- Specification: Commerce > Corrigenda, lines 3–5: no entry cites it',
].join('\n');

/** Files of fumi's assets beside its imports, by their paths in its assets, each holding text: one of every kind the move leaves there. */
const UNIT_ASSETS = Object.freeze({
  'research/exploration-superseded-20260101.md': '# Exploration\n\nSeats or usage.\n',
  'research/licensing-superseded-20260101.md': '# Licensing\n\nA trial of a month.\n',
  '.DS_Store': 'Finder\n',
  'deck/pitch.md': '# Pitch\n\nFor teams.\n',
  'flow.png': 'PNG the flow\n',
  'plans/licensing/plan.md': '# Plan\n\nTask one.\n',
  'reviews/licensing/report.md': '# Review\n\nAll good.\n',
  'legacy/implementation/licensing/report.md': '# Analysis\n\nFast enough.\n',
});

/** A verifier's verdict on licensing's record: its findings, and its line on each entry. @param {string} findings @param {string} checked */
function verdict(findings, checked) {
  writeState(dir, findingsPath('fumi', 'licensing'), findings);
  writeState(dir, checkedPath('fumi', 'licensing'), checked);
}

/** Each line the role's template does not say. @param {string} role @param {string[]} lines */
const unsaid = (role, lines) => lines.filter((line) => !fs.readFileSync(path.join(TEMPLATES, `${role}.md`), 'utf8').includes(line));

/** The directive as a brief draws it: its two sections for the agents, a topic's sources and its record, as they stand. */
function directiveDrawn() {
  const text = fs.readFileSync(DIRECTIVE, 'utf8');
  return text.slice(text.indexOf('## A Topic\'s Sources'), text.indexOf('## Working Through the Topics')).trimEnd();
}

/** The call checking licensing's record, as its brief draws it. */
const RECORD_CHECK = `\`${ENGINE_RUN} ledger carry fumi.discussion.licensing --dry-run\``;

/** The heading the unit's approved specs a topic does not draw on are listed under. */
const LATER = '## The unit\'s approved specs it does not draw on: the later answer to its points';

/** The heading the project's other units cancelled are listed under. */
const CANCELLED = '## The project\'s cancelled units: a corrigendum one wrote is no later answer';

/** The licensing topic as a brief draws it, its record composed or not yet. @param {boolean} [composed] */
const licensingDrawn = (composed = false) => [
  '- **Unit:** fumi, epic, in-progress',
  '- **Topic:** licensing, in discussion, completed — its record carried in discussion',
  `- **The state:** ${statePath(dir)} — each path below is from there, as an entry cites it, but one under \`.workflows/\``,
  `- **The project:** ${dir} — each path under \`.workflows/\` is from there`,
  '',
  '## Its files',
  '',
  '- fumi/topics/licensing/brief.md',
  '- fumi/topics/licensing/experiments/E2-trial/report.md',
  '- fumi/topics/licensing/log.md',
  '',
  '## Its specs',
  '',
  '- fumi/assets/specs/commerce.md, a draft',
  '',
  LATER,
  '',
  'None recorded.',
  '',
  CANCELLED,
  '',
  '- gone',
  '',
  '## The unit\'s discovery sessions',
  '',
  'None recorded.',
  '',
  '## The unit\'s other topics: for judging whose a point is, never sources',
  '',
  '- auth, moved to platform: Thirty days, then sign in again, with tokens renewed on each.',
  '- billing',
  '- search: Still digging.',
  '- support',
  '',
  '## Its old map, as `.workflows/` holds it',
  '',
  '- trial-length: decided',
  '',
  '## Its research\'s threads still open',
  '',
  'None — no entry needs a thread.',
  '',
  '## The unit\'s assets it walks',
  '',
  '- fumi/assets/pricing.md, which came in from discussion/licensing — this topic\'s to link',
  '- fumi/assets/rates.md, which came in from research/billing',
  '- fumi/assets/sso.md, which came in from discussion/auth',
  '',
  '## The unit\'s other assets, never walked',
  '',
  '- fumi/assets/old.md, which came in from discussion/licensing — its file is gone, so no entry links it',
  '',
  '## Where the record goes',
  '',
  `- The record composed: .cache/migrate/records/fumi/licensing.json, ${composed ? 'composed already' : 'not composed yet'}`,
  '- The verifier\'s findings on it: .cache/migrate/records/fumi/licensing.findings.txt',
  '- The verifier\'s rulings on it: .cache/migrate/records/fumi/licensing.rulings.txt',
  '- The verifier\'s verdict on each entry: .cache/migrate/records/fumi/licensing.checked.txt',
  '- The findings its composer hands back to the session: .cache/migrate/records/fumi/licensing.handback.txt',
  '- A carry\'s refusal of it: .cache/migrate/records/fumi/licensing.refused.md',
].join('\n');

/** The briefs the conversation holds. */
const stored = () => (fs.existsSync(path.join(conversationDir(SESSION_ID), 'briefs')) ? fs.readdirSync(path.join(conversationDir(SESSION_ID), 'briefs')) : []);

/** @param {string[]} args @param {RegExp} pattern */
function refusedUnissued(args, pattern) {
  assert.match(refusedUntouched(dir, ['brief', ...args], { env: SESSION }, harness), pattern);
  assert.deepStrictEqual(stored(), []);
}

describe('the per-topic agent\'s brief (21.10.5)', () => {
  it('the topic as the move left it — its files but its mail, its spec grouped under another name and kept as an asset, its old map, the unit\'s assets and where each came in from, the one it owes a link and the one whose file is gone marked, where its record goes — no findings yet, and the directive', () => {
    writeState(dir, layout.topic('fumi', 'licensing', 'mail', '001-seats.md'), '### Seats\n');

    const { res, brief } = issued(['migration-topic', ...LICENSING]);

    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'migration-topic', agent: 'ledger-migration-topic', pointer: `brief:${res.id}` });
    assert.strictEqual(brief, `Brief ${res.id} — the migration's, for one topic\n\n${filledTemplate('migration-topic', {
      'migrated-topic': licensingDrawn(), 'verifier-findings': 'None recorded.', 'verifier-rulings': 'None recorded.', 'carry-refusal': 'None recorded.', 'settled-points': 'None recorded.', 'record-check': RECORD_CHECK, directive: directiveDrawn(),
    })}`);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(issuedPath(SESSION_ID, res.id), 'utf8')), { role: 'migration-topic', agent: 'ledger-migration-topic', unit: null, task: null, topic: null });
  });

  it('a topic\'s research threads still open and its map\'s undecided subtopics, and none of either where it has none; a building unit\'s specs as the parts of its spec.md each makes, approved', () => {
    const search = issued(['migration-topic', '--topic', 'fumi.discussion.search', '--directive', '079-records']).brief;
    const weights = issued(['migration-topic', '--topic', 'shop.discussion.weights', '--directive', '079-records']).brief;

    assert.ok(search.includes([
      '## Its specs', '', 'None recorded.', '', LATER, '', 'None recorded.', '', CANCELLED, '', '- gone', '',
      '## The unit\'s discovery sessions', '', 'None recorded.', '',
      '## The unit\'s other topics: for judging whose a point is, never sources', '', '- auth, moved to platform: Thirty days, then sign in again, with tokens renewed on each.', '- billing', '- licensing: How the trial works.', '- support', '',
      '## Its old map, as `.workflows/` holds it', '', '- ranking: decided', '- typo-tolerance: exploring', '- synonyms: deferred', '',
      '## Its research\'s threads still open', '', '- index-size, digging: How big does the index grow?', '',
      '## The unit\'s assets it walks', '',
    ].join('\n')), search);
    assert.ok(weights.includes([
      '## Its specs', '',
      '- shop/spec.md, its part "1. Weights", approved',
      '- shop/spec.md, its part "2. Wishlist", approved', '', LATER, '', 'None recorded.', '',
    ].join('\n')), weights);
    assert.ok(issued(['migration-topic', '--topic', 'fumi.discovery.support', '--directive', '079-records']).brief.includes([
      '## Its old map, as `.workflows/` holds it', '', 'None — no entry needs a map_item.', '',
      '## Its research\'s threads still open', '', 'None — no entry needs a thread.', '',
    ].join('\n')));
  });

  it('a promoted topic\'s research threads, read where it was promoted from', () => {
    const { brief } = issued(['migration-topic', '--topic', 'platform.discussion.auth', '--directive', '079-records']);

    assert.ok(brief.includes('## Its research\'s threads still open\n\n- token-expiry, open: When do tokens expire?\n'), brief);
  });

  it('issued from a linked worktree, it names the project in the main checkout and reads its sources there, not the worktree\'s branch', () => {
    const side = path.join(path.dirname(dir), 'side');
    git(dir, ['worktree', 'add', '-q', '-b', 'side', side]);

    const manifest = path.join(side, '.workflows/fumi/manifest.json');
    const old = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    fs.writeFileSync(manifest, JSON.stringify({ ...old, phases: { ...old.phases, research: {} } }));
    git(side, ['commit', '-q', '-am', 'the side branch drops search\'s threads']);

    const res = ok(side, ['brief', 'migration-topic', '--topic', 'fumi.discussion.search', '--directive', '079-records'], { env: SESSION });
    const brief = fs.readFileSync(briefPath(SESSION_ID, res.id), 'utf8');

    assert.ok(brief.includes(`- **The project:** ${dir} — each path under \`.workflows/\` is from there`), brief);
    assert.ok(brief.includes('- index-size, digging: How big does the index grow?'), brief);
  });

  it('briefed afresh after a carry refused its record, it carries the refusal verbatim and clears it, so the next brief carries none', () => {
    writeState(dir, refusedPath('fumi', 'licensing'), 'ledger carry: fumi\'s licensing breaks the records directive\'s rules, so nothing is carried — entry q1 cites nothing\n');

    const { brief } = issued(['migration-topic', ...LICENSING]);

    assert.ok(brief.includes('# The carry\'s refusal\n\nledger carry: fumi\'s licensing breaks the records directive\'s rules, so nothing is carried — entry q1 cites nothing\n\n# Points the session settled'), brief);
    assert.strictEqual(fs.existsSync(statePath(dir, refusedPath('fumi', 'licensing'))), false);
    assert.ok(issued(['migration-topic', ...LICENSING]).brief.includes('# The carry\'s refusal\n\nNone recorded.\n\n# Points the session settled'));
  });

  it('briefed afresh after the verifier, it carries the verifier\'s findings verbatim and keeps them, so the verifier reading the record amended carries them as a round, keeps it and clears them; each verifier reads every round before it, an empty file a pass, and both agents the points the session settled', () => {
    const FINDINGS = '## Trial Length\n\nThe record drops the trial\'s fourteen days.';
    const REVERSED = '## Trial Length\n\nReverses round 1: the trial runs thirty days, as the experiment\'s report says.';
    const SETTLED = '- The trial runs fourteen days: the log\'s last word, the person\'s.';
    writeState(dir, findingsPath('fumi', 'licensing'), `${FINDINGS}\n`);
    writeState(dir, composedPath('fumi', 'licensing'), `${RECORD}\n`);

    const composer = issued(['migration-topic', ...LICENSING]).brief;
    const verifier = issued(['migration-verifier', ...LICENSING]).brief;
    verdict(`${REVERSED}\n`, 'q1: see finding\n');
    writeState(dir, '.cache/migrate/records/fumi/licensing.settled.md', `${SETTLED}\n`);
    const settled = issued(['migration-topic', ...LICENSING]).brief;
    const second = issued(['migration-verifier', ...LICENSING]).brief;
    verdict('', 'q1: ok\n');
    const third = issued(['migration-verifier', ...LICENSING]).brief;

    assert.ok(composer.includes(`# The verifier's findings\n\n${FINDINGS}\n\n# The verifier's rulings\n\nNone recorded.\n\n# The carry's refusal`), composer);
    assert.ok(composer.includes('- The record composed: .cache/migrate/records/fumi/licensing.json, composed already'), composer);
    assert.ok(verifier.includes(`# The earlier rounds' findings and rulings\n\n## Round 1\n\n${FINDINGS}\n\n# Points the session settled\n\nNone recorded.\n\n# The directive`), verifier);
    assert.ok(settled.includes(`# Points the session settled\n\n${SETTLED}\n\n# The directive`), settled);
    assert.ok(second.includes(`# The earlier rounds' findings and rulings\n\n## Round 1\n\n${FINDINGS}\n\n## Round 2\n\n${REVERSED}\n\n# Points the session settled\n\n${SETTLED}\n\n# The directive`), second);
    assert.ok(third.includes(`## Round 2\n\n${REVERSED}\n\n## Round 3\n\nNone: the verifier passed it.\n\n# Points the session settled`), third);
    assert.strictEqual(fs.existsSync(statePath(dir, findingsPath('fumi', 'licensing'))), false);
  });

  it('a verifier\'s rulings kept with its round beneath its findings and cleared, a pass\'s among them; every later verifier reads them with their rounds, and every composer every round\'s', () => {
    const FINDINGS = '## Trial Length\n\nThe record drops the trial\'s fourteen days.';
    const RULED = '- "Seats" in fumi/discovery/session-001.md is billing\'s, not this record\'s.';
    const REPLACED = '- The thirty-day trial in log.md "Trial Length" is replaced by the corrigendum in commerce.md "Corrigenda".';
    writeState(dir, composedPath('fumi', 'licensing'), `${RECORD}\n`);
    writeState(dir, findingsPath('fumi', 'licensing'), `${FINDINGS}\n`);
    writeState(dir, rulingsPath('fumi', 'licensing'), `${RULED}\n`);

    const composer = issued(['migration-topic', ...LICENSING]).brief;
    const verifier = issued(['migration-verifier', ...LICENSING]).brief;
    const rulingsLeft = fs.existsSync(statePath(dir, rulingsPath('fumi', 'licensing')));
    verdict('', 'q1: ok\n');
    writeState(dir, rulingsPath('fumi', 'licensing'), `${REPLACED}\n`);
    const later = issued(['migration-topic', ...LICENSING]).brief;
    issued(['migration-verifier', ...LICENSING]);

    assert.ok(composer.includes(`# The verifier's rulings\n\n## Round 1\n\n${RULED}\n\n# The carry's refusal`), composer);
    assert.ok(verifier.includes(`# The earlier rounds' findings and rulings\n\n## Round 1\n\n${FINDINGS}\n\n### Rulings\n\n${RULED}\n\n# Points the session settled`), verifier);
    assert.strictEqual(rulingsLeft, false);
    assert.ok(later.includes(`# The verifier's rulings\n\n## Round 1\n\n${RULED}\n\n## Round 2\n\n${REPLACED}\n\n# The carry's refusal`), later);
    assert.strictEqual(readState(dir, roundsPath('fumi', 'licensing')), `## Round 1\n\n${FINDINGS}\n\n### Rulings\n\n${RULED}\n\n## Round 2\n\nNone: the verifier passed it.\n\n### Rulings\n\n${REPLACED}\n\n### Checked\n\nq1: ok\n`);
  });

  it('a unit\'s own record: its discovery sessions, its topics, which carry what the sessions say of each, the imports of its discovery as a whole its own to link, where it goes, and its check', () => {
    writeState(dir, layout.unit('shop', 'discovery', 'session-001.md'), '## Discovery Session 001\n');

    const { brief } = issued(['migration-topic', '--topic', 'shop.discovery', '--directive', '079-records']);

    for (const part of [
      '- **Unit:** shop, epic, in-progress\n- **The record:** the unit\'s own, carried in discovery — each point of its discovery sessions and the assets it walks bearing on no topic\'s subject',
      '## The unit\'s discovery sessions\n\n- shop/discovery/session-001.md\n\n## The unit\'s topics, each carrying the points of the sessions and the assets bearing on its subject: for judging whose a point is, never sources\n\n- weights: By name.\n',
      '- shop/assets/vision.md, which came in from discovery — this record\'s to link',
      '- The record composed: .cache/migrate/records/shop.json, not composed yet',
      `\`${ENGINE_RUN} ledger carry shop.discovery --dry-run\``,
    ]) assert.ok(brief.includes(part), `${part}\n\nin\n\n${brief}`);
    writeState(dir, composedPath('shop', null), `${RECORD}\n`);
    writeState(dir, findingsPath('shop', null), 'The session on selling is not carried.\n');
    const verifier = issued(['migration-verifier', '--topic', 'shop.discovery', '--directive', '079-records']).brief;
    assert.ok(verifier.includes(`# The record\n\n\`\`\`json\n${RECORD}`) && readState(dir, '.cache/migrate/records/shop.rounds.md').includes('The session on selling is not carried.'), verifier);
  });

  it('a promoted topic\'s discovery sessions: its unit\'s, and those of the unit it came from, so marked, whose other topics it lists so marked; the unit it came from lists it among its topics in its own record\'s brief, carried where it went', () => {
    writeState(dir, layout.unit('fumi', 'discovery', 'session-001.md'), '## Discovery Session 001\n');
    writeState(dir, layout.topic('platform', 'auth', 'brief.md'), '# Auth\n\nWho signs in, and for how long.\n');

    const { brief } = issued(['migration-topic', '--topic', 'platform.discussion.auth', '--directive', '079-records']);
    const own = issued(['migration-topic', '--topic', 'fumi.discovery', '--directive', '079-records']).brief;

    assert.ok(brief.includes('## The unit\'s discovery sessions\n\n- fumi/discovery/session-001.md, of fumi, which it moved from\n'), brief);
    assert.ok(brief.includes('## The unit\'s other topics: for judging whose a point is, never sources\n\n- billing, of fumi\n- licensing, of fumi: How the trial works.\n- search, of fumi: Still digging.\n- support, of fumi\n\n'), brief);
    assert.ok(own.includes('## The unit\'s topics, each carrying the points of the sessions and the assets bearing on its subject: for judging whose a point is, never sources\n\n- auth, moved to platform: Who signs in, and for how long.\n- billing\n- licensing: How the trial works.\n'), own);
  });

  it('what each other topic is about, the first that holds: its map row\'s summary; its brief\'s first line of prose, the old brief\'s provenance line passed over; its log\'s first line of prose, past a section\'s frontmatter and the lines naming its sources alone; else its name alone', () => {
    const manifest = JSON.parse(readState(dir, layout.manifest('fumi')));
    manifest.phases.discovery.items.billing.summary = 'Invoices, refunds and seat billing.';
    manifest.phases.discovery.items.support.summary = '  ';
    writeState(dir, layout.manifest('fumi'), JSON.stringify(manifest));
    writeState(dir, layout.topic('fumi', 'billing', 'brief.md'), '# Discovery Brief — Billing\n\nDrawn from discovery session 001.\n\n## Soft decisions\n\n- Seats bill monthly.\n');
    writeState(dir, layout.topic('fumi', 'search', 'brief.md'), '# Discovery Brief — Search\n\nDrawn from discovery session 001.\n\n## Soft decisions\n\n- **Ranking**: newest first.\n');
    writeState(dir, layout.topic('fumi', 'support', 'brief.md'), '# Discovery Brief — Support\n\nDrawn from discovery sessions 001–002.\n');
    writeState(dir, layout.topic('fumi', 'support', 'log.md'), '## Discussion\n\n---\ntopic: support\nstatus: concluded\n---\n\n## Discussion: Support\n\nSource: https://example.com/support-survey\n\n- **Links**: [the survey](../../assets/survey.md), <https://example.com/faq>\n\n### Context\n\nCustomers reach us by email alone, as [the survey](../../assets/survey.md) shows.\n');

    const { brief } = issued(['migration-topic', ...LICENSING]);

    assert.ok(brief.includes('- billing: Invoices, refunds and seat billing.\n- search: **Ranking**: newest first.\n- support: Customers reach us by email alone, as [the survey](../../assets/survey.md) shows.\n'), brief);
    assert.ok(issued(['migration-topic', '--topic', 'fumi.discussion.search', '--directive', '079-records']).brief.includes('- auth, moved to platform: Thirty days'), 'a promoted topic\'s log read where it went');
  });

  it('a log\'s run of `key: value` lines no rule closes is read at once, its lines prose', () => {
    writeState(dir, layout.topic('fumi', 'support', 'log.md'), `## Discussion\n\n---\n${'at: 10:30\n'.repeat(40)}`);

    const { brief } = issued(['migration-topic', ...LICENSING]);

    assert.ok(brief.includes('- support: at: 10:30\n'), brief);
  });

  it('a long line of addresses, joined by commas or by nothing, then prose, is read at once, its line prose', () => {
    const line = `${'https://example.com/a,https://example.com/b'.repeat(30)} and more`;
    writeState(dir, layout.topic('fumi', 'support', 'log.md'), `## Discussion: Support\n\n${line}\n`);

    const { brief } = issued(['migration-topic', ...LICENSING]);

    assert.ok(brief.includes(`- support: ${line}\n`), brief);
  });

  it('lists the unit\'s discovery sessions, the migration\'s research session among them, and nothing else its discovery holds; an epic\'s topic never started carried in discovery, and shown so', () => {
    writeState(dir, layout.unit('fumi', 'discovery', 'session-001.md'), '## Discovery Session 001\n');
    writeState(dir, layout.unit('fumi', 'discovery', 'session-002.md'), '## Discovery Session 002\n\nResearch the migration placed: index-size.\n');
    writeState(dir, layout.unit('fumi', 'discovery', 'notes.md'), '# Notes\n');

    const { brief } = issued(['migration-topic', '--topic', 'fumi.discovery.support', '--directive', '079-records']);

    assert.ok(brief.includes('## The unit\'s discovery sessions\n\n- fumi/discovery/session-001.md\n- fumi/discovery/session-002.md\n\n## The unit\'s other topics'), brief);
    assert.match(brief, /^- \*\*Topic:\*\* support, in discovery, pending — its record carried in discovery, the topic never started$/m);
  });

  it('every file of the unit\'s assets but a dotfile, with where each came from: the markdown ones the topic walks — an import, listed or come in with them, and research a legacy split superseded bearing its name — apart from the rest but its own spec, listed as its spec alone; research bearing no topic\'s name walked by none in a unit with no record of its own', () => {
    for (const [rel, text] of Object.entries(UNIT_ASSETS)) writeState(dir, layout.assets('fumi', ...rel.split('/')), text);

    const { brief } = issued(['migration-topic', ...LICENSING]);

    assert.ok(brief.includes([
      '## The unit\'s assets it walks', '',
      '- fumi/assets/deck/pitch.md, an import',
      '- fumi/assets/pricing.md, which came in from discussion/licensing — this topic\'s to link',
      '- fumi/assets/rates.md, which came in from research/billing',
      '- fumi/assets/research/licensing-superseded-20260101.md, research a legacy split superseded',
      '- fumi/assets/sso.md, which came in from discussion/auth', '',
      '## The unit\'s other assets, never walked', '',
      '- fumi/assets/flow.png, an import',
      '- fumi/assets/legacy/implementation/licensing/report.md, kept as legacy, at its path from the unit\'s old folder',
      '- fumi/assets/plans/licensing/plan.md, a plan',
      '- fumi/assets/research/exploration-superseded-20260101.md, research a legacy split superseded',
      '- fumi/assets/reviews/licensing/report.md, an old review of a build',
      '- fumi/assets/old.md, which came in from discussion/licensing — its file is gone, so no entry links it', '',
    ].join('\n')), brief);
    assert.deepStrictEqual([brief.includes('.DS_Store'), brief.split('fumi/assets/specs/commerce.md').length - 1], [false, 1]);
  });

  it('a unit\'s own record walks the assets every record walks and a split\'s research bearing no topic\'s name, and owes a link to no asset but an import from its discovery as a whole', () => {
    for (const [rel, text] of Object.entries(UNIT_ASSETS)) writeState(dir, layout.assets('fumi', ...rel.split('/')), text);
    writeState(dir, layout.unit('fumi', 'discovery', 'session-001.md'), '## Pricing\n\nSeats.\n');

    const { brief } = issued(['migration-topic', '--topic', 'fumi.discovery', '--directive', '079-records']);

    assert.ok(brief.includes([
      '## The unit\'s assets it walks', '',
      '- fumi/assets/deck/pitch.md, an import',
      '- fumi/assets/pricing.md, which came in from discussion/licensing',
      '- fumi/assets/rates.md, which came in from research/billing',
      '- fumi/assets/research/exploration-superseded-20260101.md, research a legacy split superseded',
      '- fumi/assets/sso.md, which came in from discussion/auth', '',
      '## The unit\'s other assets, never walked', '',
      '- fumi/assets/flow.png, an import',
      '- fumi/assets/legacy/implementation/licensing/report.md, kept as legacy, at its path from the unit\'s old folder',
      '- fumi/assets/plans/licensing/plan.md, a plan',
      '- fumi/assets/research/licensing-superseded-20260101.md, research a legacy split superseded',
      '- fumi/assets/reviews/licensing/report.md, an old review of a build',
      '- fumi/assets/specs/commerce.md, a spec',
      '- fumi/assets/old.md, which came in from discussion/licensing — its file is gone, so no entry links it', '',
    ].join('\n')), brief);
  });

  it('21.S44: a cancelled unit\'s topic is briefed as any other, the import from its discovery its own to link', () => {
    const { brief } = issued(['migration-topic', '--topic', 'gone.discussion.gone', '--directive', '079-records']);

    assert.ok(brief.includes('- **Unit:** gone, feature, cancelled\n- **Topic:** gone, in discussion, in-progress — its record carried in discussion\n'), brief);
    assert.ok(brief.includes(`${CANCELLED}\n\nNone recorded.\n`), 'its own unit is not among the others cancelled');
    assert.ok(brief.includes('## The unit\'s assets it walks\n\n- gone/assets/notes.md, which came in from discovery — this topic\'s to link\n'), brief);
  });
});

describe('the verifier\'s brief (21.10.7)', () => {
  it('the topic, its record as composed, verbatim, no last findings yet, and the directive', () => {
    writeState(dir, composedPath('fumi', 'licensing'), `${RECORD}\n`);

    const { res, brief } = issued(['migration-verifier', ...LICENSING]);

    assert.deepStrictEqual([res.role, res.agent], ['migration-verifier', 'ledger-migration-verifier']);
    assert.strictEqual(brief, `Brief ${res.id} — the migration verifier's\n\n${filledTemplate('migration-verifier', {
      'migrated-topic': licensingDrawn(true), 'composed-record': `\`\`\`json\n${RECORD}\n\`\`\``, 'walk-sheet': UNCITED_SHEET, 'earlier-findings': 'None recorded.', 'settled-points': 'None recorded.', directive: directiveDrawn(),
    })}`);
  });
});

describe('a cite of a heading held more than once', () => {
  it('both briefs say it names the heading\'s path, and a heading sharing its whole path its place among them, with an example of each, the carry refusing a bare one, which tells none of its copies apart', () => {
    writeState(dir, composedPath('fumi', 'licensing'), `${RECORD}\n`);

    const briefs = ['migration-topic', 'migration-verifier'].map((role) => issued([role, ...LICENSING]).brief);

    assert.deepStrictEqual(briefs.map((brief) => [
      'more than once in the parts the topic draws on, or in the whole file where none of them holds it — by its path, as many of the headings over it as tell it apart, then its own: `Identity & Naming > Decision`; and where headings share their whole path, siblings of one heading, by that path and its place among them, from one: `Skill Identity > Decision > revised [2]`, the second.',
      '`{"path": "{unit}/spec.md", "section": "Identity & Naming > Decision"}`, and one of headings sharing their whole path by its place among them, `"Skill Identity > Decision > revised [2]"`, as the walk sheet shows it: the carry refuses a cite naming several — a bare one tells none of its copies apart — and names those that tell them apart',
    ].filter((said) => !brief.includes(said))), [[], []]);
  });
});

describe('the walk of a record\'s sources', () => {
  const LATER_ANSWERS = 'Check each decision and open question against its later answers, as the directive names them: the unit\'s approved specs the brief below lists, searched for its subject rather than walked, each to what the log settled before its approval — by the date the brief below gives it against the dates the log\'s headings carry, the log first where none shows otherwise, but for a section appended after the approval, such as a review never folded in — but for what a corrigendum records of a cancelled unit\'s own decisions; and the log\'s own word, a scope note wherever it stands or a later section, that sets it aside, delegates it or puts it out of scope.';
  const CONFINED = 'Its sources are those the brief below lists, and no other: never another topic\'s log, brief or record, nor another unit\'s, nor the project\'s code. The other topics the brief below lists, with what each is about, are for judging whose a point is, never sources.';
  const LISTED = 'its sources section by section, as the brief below lists them: its files, its log, its brief and its experiments among them; each section of the specs it draws on, every section of them the record cites among them; and each point of the discovery sessions, and of the unit\'s assets the brief below lists to walk, bearing on its subject, or for a unit\'s own record on no topic\'s subject.';

  it('the composer composing a record from the start walks its sources section by section, each current decision, finding and open question carried or not the record\'s, an amend answering the findings in its place and keeping everything else; the verifier walks every one, its findings every gap the walk turns up, a cited section carried whole; neither reads another topic\'s log, brief or record, nor another unit\'s, nor the project\'s code, which the per-topic agent\'s definition names among no sources, the other topics listed to judge whose a point is by', () => {
    assert.ok(!fs.readFileSync(path.join(AGENTS, 'ledger-migration-topic.md'), 'utf8').includes('the code'), 'the per-topic agent\'s definition names no source of its own');
    assert.deepStrictEqual([
      unsaid('migration-topic', [CONFINED, 'keep everything no finding or fault asks you to change.', `Where you compose the record from the start, walk ${LISTED} For each section, confirm that each current decision, finding and open question it holds is carried by an entry, or is not this record's, and carry each it misses.`, `${LATER_ANSWERS} Where one decides it otherwise or answers it, the record carries that answer, as the directive says; a point the log settled after a spec\'s approval is the log\'s, its entry naming the spec\'s section it departs from.`, 'Where you amend it, the findings stand in for the walk.']),
      unsaid('migration-verifier', [
        CONFINED,
        'The record passes when it holds each current decision, finding and open question its sources hold,',
        'Walk the sheet below section by section: it lays the record against its sources, each section of each file with its lines and every entry citing it. Read each section in its source, then check that what each entry listed beneath it takes from the section is what the section says, and that each current decision, finding and open question the section holds is carried, by an entry listed there or elsewhere, or is not this record\'s; of the discovery sessions and the unit\'s assets, each point bearing on its subject, or for a unit\'s own record on no topic\'s subject. That a cited heading exists is no check.',
        '- each section it cites of a spec drawing on it is carried whole: each current decision, finding and open question of it that concerns this record is carried; one it cites of a spec it does not draw on, the later answer, gives that answer alone;',
        `${LATER_ANSWERS} One they decide otherwise or answer, carried as the earlier word has it, is a finding; a point the log settled after a spec\'s approval is the log\'s, its entry naming the spec\'s section it departs from.`,
        '- nothing is carried that you rule is not this record\'s: such an entry is a finding, to remove, with the ruling beside it.',
      ]),
    ], [[], []]);
  });
});

describe('what no one measured, and sources at odds', () => {
  it('the composer carries each point a section leaves unmeasured, but one a scope note puts out of scope wherever it stands, and names each contradiction no later section settles; the verifier\'s walk checks both, setting the first aside only where a later section measured it or made it moot, or a scope note put it out of scope', () => {
    assert.deepStrictEqual([
      unsaid('migration-topic', ['Carry each point a section leaves unmeasured, untested, unverified or to check, but one a scope note puts out of scope, wherever it stands, and where two sections contradict each other on a point no later one settles, have the record name the contradiction.']),
      unsaid('migration-verifier', ['That a cited heading exists is no check. Check that each point a section leaves unmeasured, untested, unverified or to check is carried, a ruling setting it aside only where a later section measured it or made it moot, or a scope note, wherever it stands, put it out of scope; and that where a section contradicts another on a point no later one settles, the record names the contradiction. Walk every open section']),
    ], [[], []]);
  });
});

describe('a verifier\'s rulings', () => {

  it('the verifier writes each point it ruled is not the record\'s, or a later answer replaced, one line with its source, and asks for one an earlier round ruled out only as a reversal; the composer never carries one the session has not settled otherwise', () => {
    assert.deepStrictEqual([
      unsaid('migration-verifier', [
        'Where you ruled that a point of the sources is not this record\'s, or is replaced by a later answer, write each such ruling into the rulings file the brief names, one line each, naming the point and its source\'s section.',
        'A point an earlier round\'s rulings set aside, or the session settled, is closed: it is raised again only where a line of its source that ruling or settlement missed says otherwise, and that finding is a reversal, opening `Reverses round {R}:`, R the round that ruled, or `Reverses the session:`, naming that line. A new point on what an earlier round passed, or on what its findings changed, is a finding as any other, never a reversal.',
        'check that each finding is answered and each ruling kept.',
        'Write the findings file the brief names afresh: each finding one list item, the section of the source and what the record misses or misstates,',
      ]),
      unsaid('migration-phase-verifier', ['A point the session settled is closed: it is raised again only where a line of its source or the code that settlement missed says otherwise, and that finding is a reversal, opening `Reverses the session:`, naming that line. A new point on what an earlier round passed, or on what its findings changed, is a finding as any other, never a reversal.']),
      unsaid('migration-topic', ['Never carry a point the verifier\'s rulings below set aside, unless a point the session settled says otherwise. A finding asking for a point the rulings set aside, which no point the session settled covers, is not yours to answer: write it into the hand-back file the brief names, one line each, the finding and why you hand it back, for the session to settle as a reversal.', 'and how many findings you wrote into the hand-back file.']),
    ], [[], [], []]);
  });
});

describe('the walk sheet (the verifier\'s brief)', () => {
  it('each source in the brief\'s order, then each other file an entry cites; each section holding text or cited, in order, with its lines and every entry citing it once, its text cut at a word; one no entry cites so said', () => {
    writeState(dir, layout.unit('fumi', 'discovery', 'session-001.md'), '## Pricing\n\nSeats.\n');
    const log = (section) => ({ path: 'fumi/topics/licensing/log.md', section });
    const entries = [
      { ref: 'q1', event: 'asked', text: 'How long is the trial?', by: 'person', cites: [log('Trial Length')] },
      { ref: 'd1', event: 'decided', answers: 'q1', text: 'Fourteen days.', cites: [log('Decision'), { path: 'fumi/assets/specs/commerce.md', section: 'Corrigenda' }, log('Trial Length > Decision')] },
      {
        ref: 'f1', event: 'found', text: 'A week converts as well as fourteen days in the trial experiment, measured over three cohorts of new teams signing up in spring.',
        cites: [{ path: 'fumi/topics/licensing/experiments/E2-trial/report.md', section: 'Result' }, { path: 'fumi/assets/pricing.md', section: 'Pricing' }],
      },
    ];
    writeState(dir, composedPath('fumi', 'licensing'), JSON.stringify({ entries }));
    writeState(dir, layout.topic('fumi', 'licensing', 'experiments', 'E2-trial', 'data.json'), '{"converted": 0.31}\n');
    const F1 = '  - f1, found: A week converts as well as fourteen days in the trial experiment, measured over three cohorts of…';

    const { brief } = issued(['migration-verifier', ...LICENSING]);

    assert.ok(brief.includes(`# The walk sheet\n\n${[
      '## fumi/topics/licensing/brief.md', '', '- Licensing, lines 1–3: no entry cites it', '',
      '## fumi/topics/licensing/experiments/E2-trial/report.md', '', '- Report > Result, lines 3–5', F1, '',
      '## fumi/topics/licensing/log.md', '', '- Discussion: Licensing > Trial Length, lines 5–6', '  - q1, asked: How long is the trial?',
      '- Discussion: Licensing > Trial Length > Decision, lines 7–9', '  - d1, decided: Fourteen days.', '',
      '## fumi/assets/specs/commerce.md', '', '- Specification: Commerce > Corrigenda, lines 3–5', '  - d1, decided: Fourteen days.', '',
      '## fumi/discovery/session-001.md', '', '- Pricing, lines 1–3: no entry cites it', '',
      '## fumi/assets/pricing.md', '', '- Pricing, line 1', F1,
    ].join('\n')}\n\n# The earlier rounds'`), brief);
  });

  it('the assets a record walks after its discovery sessions, each section holding text, a unit\'s own record\'s too — a split\'s research the topic\'s bearing its name, the own record\'s bearing none; no spec, plan, old review, legacy file or other file, and no file holding no section to walk', () => {
    for (const [rel, text] of Object.entries(UNIT_ASSETS)) writeState(dir, layout.assets('fumi', ...rel.split('/')), text);
    writeState(dir, layout.unit('fumi', 'discovery', 'session-001.md'), '## Pricing\n\nSeats.\n');
    writeState(dir, composedPath('fumi', 'licensing'), `${RECORD}\n`);
    writeState(dir, composedPath('fumi', null), `${RECORD}\n`);
    const walked = (/** @type {string} */ research, /** @type {string} */ section) => [
      '## fumi/discovery/session-001.md', '', '- Pricing, lines 1–3: no entry cites it', '',
      '## fumi/assets/deck/pitch.md', '', '- Pitch, lines 1–3: no entry cites it', '',
      `## fumi/assets/research/${research}-superseded-20260101.md`, '', `- ${section}, lines 1–3: no entry cites it`, '', '# The earlier rounds\'',
    ].join('\n');

    const topic = issued(['migration-verifier', ...LICENSING]).brief;
    const own = issued(['migration-verifier', '--topic', 'fumi.discovery', '--directive', '079-records']).brief;

    assert.deepStrictEqual([
      topic.includes(`- Specification: Commerce > Corrigenda, lines 3–5: no entry cites it\n\n${walked('licensing', 'Licensing')}`),
      own.includes(`# The walk sheet\n\n${walked('exploration', 'Exploration')}`),
    ], [true, true], `${topic}\n\n${own}`);
  });

  it('a joined spec\'s sections in the parts the topic draws on alone, and a section an entry cites in another part; a cite of a heading several parts hold, bare, is its part\'s, as the carry reads it; and of headings sharing their whole path, the one its place names, shown by it', () => {
    fs.appendFileSync(statePath(dir, 'shop/spec.md'), '\n### Notes\n\nOne.\n\n### Notes\n\nTwo.\n');
    writeState(dir, composedPath('shop', 'weights'), JSON.stringify({ entries: [
      { ref: 'q1', event: 'asked', text: 'How do ties break?', cites: [{ path: 'shop/spec.md', section: 'Ranking' }] },
      { ref: 'q2', event: 'asked', text: 'May a wish be saved twice?', cites: [{ path: 'shop/spec.md', section: '2. Wishlist > Saving' }] },
      { ref: 'q3', event: 'asked', text: 'Is a note kept?', cites: [{ path: 'shop/spec.md', section: 'Notes [2]' }] },
    ] }));
    const old = path.join(dir, '.workflows/shop/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(old, 'utf8'));
    manifest.phases.specification.items.wishlist.sources = {};
    fs.writeFileSync(old, JSON.stringify(manifest));

    const { brief } = issued(['migration-verifier', '--topic', 'shop.discussion.weights', '--directive', '079-records']);

    assert.ok(brief.includes([
      '## shop/spec.md', '', '- Shop > 1. Weights > Ranking, lines 5–8', '  - q1, asked: How do ties break?',
      '- Shop > 1. Weights > Ranking > Detail, lines 9–12: no entry cites it', '- Shop > 1. Weights > Corrigenda, lines 13–16: no entry cites it',
      '- Shop > 1. Weights > Corrigenda > Detail, lines 17–20: no entry cites it',
      '- Shop > 2. Wishlist > Saving, lines 23–26', '  - q2, asked: May a wish be saved twice?', '- Shop > 2. Wishlist > Notes [2], lines 35–37', '  - q3, asked: Is a note kept?', '', '# The earlier rounds\'',
    ].join('\n')), brief);
  });

  it('21.6.3: the unit\'s approved specs a topic does not draw on, kept or a part of its spec.md, listed as the later answer to its points — a draft none — each approved spec dated where its old item is, and of one it draws no part of only the sections its entries cite, the answer searched for, never walked', () => {
    const old = path.join(dir, '.workflows', 'fumi', 'manifest.json');
    const fumi = JSON.parse(fs.readFileSync(old, 'utf8'));
    fumi.phases.specification.items.commerce = { status: 'completed', date: '2026-03-30', sources: {} };
    fs.writeFileSync(old, JSON.stringify(fumi));
    const shop = path.join(dir, '.workflows', 'shop', 'manifest.json');
    const wishlist = JSON.parse(fs.readFileSync(shop, 'utf8'));
    wishlist.phases.specification.items.wishlist.sources = {};
    wishlist.phases.specification.items.weights.date = '2026-06-06';
    fs.writeFileSync(shop, JSON.stringify(wishlist));
    writeState(dir, layout.assets('fumi', 'specs', 'commerce.md'), '# Specification: Commerce\n\n## Corrigenda\n\nThe trial is fourteen days, not thirty.\n\n## Refunds\n\nWithin a week.\n');
    writeState(dir, composedPath('fumi', 'licensing'), JSON.stringify({ entries: [
      { ref: 'q1', event: 'asked', text: 'How long is the trial?', cites: [{ path: 'fumi/topics/licensing/log.md', section: 'Trial Length' }] },
      { ref: 'd1', event: 'decided', answers: 'q1', text: 'Fourteen days.', cites: [{ path: 'fumi/assets/specs/commerce.md', section: 'Corrigenda' }] },
    ] }));

    const topic = issued(['migration-topic', ...LICENSING]).brief;
    const verifier = issued(['migration-verifier', ...LICENSING]).brief;
    const weights = issued(['migration-topic', '--topic', 'shop.discussion.weights', '--directive', '079-records']).brief;

    assert.deepStrictEqual([
      [topic.includes('## Its specs\n\nNone recorded.\n'), topic.includes(`${LATER}\n\n- fumi/assets/specs/commerce.md, approved on 2026-03-30\n`)],
      verifier.slice(verifier.indexOf('## fumi/assets/specs/commerce.md'), verifier.indexOf('\n\n# The earlier rounds')),
      weights.includes(`- shop/spec.md, its part "1. Weights", approved on 2026-06-06\n\n${LATER}\n\n- shop/spec.md, its part "2. Wishlist"\n`),
    ], [[true, true], '## fumi/assets/specs/commerce.md\n\n- Specification: Commerce > Corrigenda, lines 3–6\n  - d1, decided: Fourteen days.', true]);
  });
});

describe('the verifier\'s verdict on each entry', () => {
  it('its brief issued, the refs it gives a verdict on written beside the record; once it has written its findings, the next brief refused until its verdicts name each of them, and none the record it read does not hold, naming what is wrong and the way on; a complete one kept with its round', () => {
    const RECORD2 = JSON.stringify({ entries: [{ ref: 'q1', event: 'asked', text: 'How long is the trial?', by: 'person' }, { ref: 'q2', event: 'asked', text: 'Is a card needed?', by: 'person' }] });
    writeState(dir, composedPath('fumi', 'licensing'), RECORD2);
    issued(['migration-verifier', ...LICENSING]);
    const read = JSON.parse(readState(dir, verifyingPath('fumi', 'licensing')));
    const way = 'a verifier writes a line for each entry its walk sheet does not mark passed, `{ref}: ok` or `{ref}: see finding`, and one that does not has given no verdict — remove .cache/migrate/records/fumi/licensing.findings.txt, .cache/migrate/records/fumi/licensing.rulings.txt and .cache/migrate/records/fumi/licensing.checked.txt, and brief a fresh verifier';
    const refusedBrief = (/** @type {string[]} */ args, /** @type {RegExp} */ pattern) => assert.match(refusedUntouched(dir, ['brief', ...args], { env: SESSION }, harness), pattern);
    const refusal = (/** @type {string} */ told) => new RegExp(`^brief: fumi's licensing has no verdict from its last verifier on every entry its brief asked one of — ${told.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: ${way.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

    verdict('The trial is wrong.\n', 'q1: see finding\n');
    refusedBrief(['migration-topic', ...LICENSING], refusal('it names no verdict on q2'));
    writeState(dir, checkedPath('fumi', 'licensing'), 'q1: see finding\nq2: ok\nq9: ok\n');
    refusedBrief(['migration-verifier', ...LICENSING], refusal('it names q9, which the record it read does not hold'));
    fs.rmSync(statePath(dir, checkedPath('fumi', 'licensing')));
    refusedBrief(['migration-topic', ...LICENSING], refusal('.cache/migrate/records/fumi/licensing.checked.txt is no file; it names no verdict on q1, q2'));
    writeState(dir, checkedPath('fumi', 'licensing'), 'q1: see finding\nq2: ok\n');
    writeState(dir, composedPath('fumi', 'licensing'), `${RECORD}\n`);
    issued(['migration-topic', ...LICENSING]);
    issued(['migration-verifier', ...LICENSING]);

    assert.deepStrictEqual([read.hash, read.refs], [crypto.createHash('sha256').update(RECORD2).digest('hex'), ['q1', 'q2']]);
    assert.strictEqual(readState(dir, roundsPath('fumi', 'licensing')), '## Round 1\n\nThe trial is wrong.\n\n### Checked\n\nq1: see finding\nq2: ok\n');
    assert.deepStrictEqual(JSON.parse(readState(dir, verifyingPath('fumi', 'licensing'))).refs, ['q1']);
  });

  it('a verifier briefed again before it wrote anything is briefed: no findings is no verdict to hold', () => {
    writeState(dir, composedPath('fumi', 'licensing'), `${RECORD}\n`);

    issued(['migration-verifier', ...LICENSING]);

    assert.ok(issued(['migration-verifier', ...LICENSING]).brief.includes('# The walk sheet'));
  });
});

describe('a later round (21.10.18)', () => {
  const log = { path: 'fumi/topics/licensing/log.md', section: 'Trial Length > Decision' };
  const report = { path: 'fumi/topics/licensing/experiments/E2-trial/report.md', section: 'Result' };
  const Q1 = { ref: 'q1', event: 'asked', text: 'How long is the trial?', by: 'person', cites: [log] };
  const D1 = { ref: 'd1', event: 'decided', answers: 'q1', text: 'Thirty days.', cites: [log] };
  const F1 = { ref: 'f1', event: 'found', text: 'A week converts as well.', cites: [report] };
  const Q2 = { ref: 'q2', event: 'asked', text: 'Does the corrigendum hold?', cites: [{ path: 'fumi/assets/specs/commerce.md', section: 'Corrigenda' }] };
  const CLOSED = 'closed — walked in an earlier round, nothing citing it changed since';

  /** The verifier's brief issued on licensing's record of `entries`: its walk sheet, and the refs it gives a verdict on. @param {Record<string, unknown>[]} entries */
  function round(entries) {
    writeState(dir, composedPath('fumi', 'licensing'), JSON.stringify({ entries }));
    const { brief } = issued(['migration-verifier', ...LICENSING]);
    const sheet = brief.slice(brief.indexOf('# The walk sheet\n\n') + '# The walk sheet\n\n'.length, brief.indexOf('\n\n# The earlier rounds'));
    return { sheet, asked: JSON.parse(readState(dir, verifyingPath('fumi', 'licensing'))).refs };
  }

  it('the first walks everything; from the second, a section passed unchanged is closed and an entry passed unchanged asked no verdict, each other marked changed — passed before or not — new or not passed; a section an entry left reopened, each entry removed listed with its cites; a round whose verifier never wrote counting for nothing, and a `see finding` on an entry not asked of unpassing it', () => {
    const first = round([Q1, D1, F1]);
    verdict('Trial Length > Decision: d1 says thirty days, the log fourteen.\n', 'q1: ok\nd1: see finding\nf1: ok\n');
    const second = round([Q1, { ...D1, text: 'Fourteen days.' }, F1, Q2]);
    verdict('Corrigenda: q2 asks what the section settles.\n', 'q1: ok\nd1: ok\nq2: see finding\n');
    const third = round([{ ...Q1, text: 'How long does the trial run?' }, { ...D1, text: 'Fourteen days.' }, Q2]);
    const again = round([{ ...Q1, text: 'How long does the trial run?' }, { ...D1, text: 'Fourteen days.' }, Q2]);
    verdict('Trial Length > Decision: d1 drops the week the log weighed.\n', 'q1: ok\nq2: ok\nd1: see finding\n');
    const fourth = round([{ ...Q1, text: 'How long does the trial run?' }, { ...D1, text: 'Fourteen days.' }]);

    assert.deepStrictEqual([first.asked, second, third, again, fourth], [
      ['q1', 'd1', 'f1'],
      {
        sheet: [
          '## fumi/topics/licensing/brief.md', '', `- Licensing, lines 1–3: ${CLOSED}`, '',
          '## fumi/topics/licensing/experiments/E2-trial/report.md', '', `- Report > Result, lines 3–5: ${CLOSED}`, '',
          '## fumi/topics/licensing/log.md', '', '- Discussion: Licensing > Trial Length > Decision, lines 7–9', '  - q1, asked, passed unchanged: How long is the trial?', '  - d1, decided, changed: Fourteen days.', '',
          '## fumi/assets/specs/commerce.md', '', '- Specification: Commerce > Corrigenda, lines 3–5', '  - q2, asked, new: Does the corrigendum hold?',
        ].join('\n'),
        asked: ['d1', 'q2'],
      },
      {
        sheet: [
          '## fumi/topics/licensing/brief.md', '', `- Licensing, lines 1–3: ${CLOSED}`, '',
          '## fumi/topics/licensing/experiments/E2-trial/report.md', '', '- Report > Result, lines 3–5: no entry cites it', '',
          '## fumi/topics/licensing/log.md', '', '- Discussion: Licensing > Trial Length > Decision, lines 7–9', '  - q1, asked, changed: How long does the trial run?', '  - d1, decided, passed unchanged: Fourteen days.', '',
          '## fumi/assets/specs/commerce.md', '', '- Specification: Commerce > Corrigenda, lines 3–5', '  - q2, asked, not passed: Does the corrigendum hold?', '',
          '## Removed since the last round', '', '- f1, found: A week converts as well.', '  - cited Result in fumi/topics/licensing/experiments/E2-trial/report.md',
        ].join('\n'),
        asked: ['q1', 'q2'],
      },
      third,
      {
        sheet: [
          '## fumi/topics/licensing/brief.md', '', `- Licensing, lines 1–3: ${CLOSED}`, '',
          '## fumi/topics/licensing/experiments/E2-trial/report.md', '', `- Report > Result, lines 3–5: ${CLOSED}`, '',
          '## fumi/topics/licensing/log.md', '', '- Discussion: Licensing > Trial Length > Decision, lines 7–9', '  - q1, asked, passed unchanged: How long does the trial run?', '  - d1, decided, not passed: Fourteen days.', '',
          '## fumi/assets/specs/commerce.md', '', '- Specification: Commerce > Corrigenda, lines 3–5: no entry cites it', '',
          '## Removed since the last round', '', '- q2, asked: Does the corrigendum hold?', '  - cited Corrigenda in fumi/assets/specs/commerce.md',
        ].join('\n'),
        asked: ['d1'],
      },
    ]);
    assert.ok(!first.sheet.includes('closed') && !first.sheet.includes('passed'), first.sheet);
  });

  it('the verifiers\' briefs: an open section walked, a closed one no finding; a later round checks what changed and raises nothing on what an earlier one passed unchanged, leanness judged on it alone; a verdict on each entry not passed unchanged', () => {
    assert.deepStrictEqual([
      unsaid('migration-verifier', [
        'Walk every open section of the sheet, every section in a first round: a closed one was walked in an earlier round, nothing citing it changed since, and is no finding, and your findings are every gap the walk turns up, never a sample.',
        'In a later round, check each finding answered, each entry or line changed since true to its source, and that no entry the sheet lists as removed since the last round took a point still to carry; raise nothing on what an earlier round passed unchanged.',
        '- nothing is carried twice — in a later round, judged on what changed since alone;',
        'Write the checked file the brief names afresh, a line for each entry of the record the sheet does not mark passed unchanged, by its ref: `{ref}: ok`, or `{ref}: see finding` where a finding names it.',
      ]),
      unsaid('migration-phase-verifier', [
        'In a later round, check each finding answered, each scenario, note or correction changed since true to its source, and nothing removed that was a point to carry; the changes since the last round below list them. Raise nothing on what an earlier round passed unchanged.',
        '- the piece is lean: no scenario or note that says again what another does — judged in the first round, and later on what changed since alone.',
      ]),
      ['migration-verifier', 'migration-phase-verifier'].filter((role) => fs.readFileSync(path.join(TEMPLATES, `${role}.md`), 'utf8').includes('however often')),
    ], [[], [], []]);
  });
});

describe('a finding handed back to the session', () => {
  it('while the composer\'s hand-back file stands, the verifier is briefed for nothing, the refusal naming the way on; settled and removed, it is briefed', () => {
    writeState(dir, composedPath('fumi', 'licensing'), `${RECORD}\n`);
    writeState(dir, findingsPath('fumi', 'licensing'), 'Carry the CLI framework.\n');
    writeState(dir, handbackPath('fumi', 'licensing'), '- Carry the CLI framework: round 1 ruled it replaced.\n');

    refusedUnissued(['migration-verifier', ...LICENSING], /^brief: fumi's licensing has findings handed back to the session in \.cache\/migrate\/records\/fumi\/licensing\.handback\.txt: settle each into \.cache\/migrate\/records\/fumi\/licensing\.settled\.md, replace it in \.cache\/migrate\/records\/fumi\/licensing\.findings\.txt with `Settled: \{point\}, amend to agree` where the record changes, or take it out where it stands, then remove \.cache\/migrate\/records\/fumi\/licensing\.handback\.txt$/);
    assert.strictEqual(readState(dir, findingsPath('fumi', 'licensing')), 'Carry the CLI framework.\n');
    writeState(dir, handbackPath('fumi', 'licensing'), '\n');
    assert.ok(issued(['migration-verifier', ...LICENSING]).brief.includes('## Round 1\n\nCarry the CLI framework.'), 'a hand-back file of nothing is none');
  });
});

describe('the refusals, nothing stored', () => {
  it('a directive the migrations lack, a place naming no topic, a phase the records carry no topic of, a topic the unit lacks, a topic promoted, a place at a phase before the one its item is in, and the verifier\'s brief with no record composed, or an empty one', () => {
    refusedUnissued(['migration-topic', '--topic', 'fumi.discussion.licensing', '--directive', '078-move'], /^there is no directive 078-move$/);
    refusedUnissued(['migration-topic', '--topic', 'fumi.discussion.licensing', '--directive', '../079'], /^"\.\.\/079" is no directive's id/);
    refusedUnissued(['migration-topic', '--topic', 'fumi.licensing', '--directive', '079-records'], /^brief: "fumi\.licensing" names no topic — <work-unit>\.<phase>\.<topic>, or <work-unit>\.discovery for a unit's own$/);
    refusedUnissued(['migration-topic', '--topic', 'fumi.research.search', '--directive', '079-records'], /^brief: the records carry no topic in "research" — one of discovery, discussion, investigation$/);
    refusedUnissued(['migration-topic', '--topic', 'fumi.discussion.billing', '--directive', '079-records'], /^brief: fumi has no topic "billing" in discussion$/);
    refusedUnissued(['migration-topic', '--topic', 'fumi.discussion.auth', '--directive', '079-records'], /^brief: fumi's auth was promoted to platform, which carries its record$/);
    const manifest = readState(dir, layout.manifest('fumi'));
    const mapped = JSON.parse(manifest);
    mapped.phases.discovery.items.licensing = { source: 'discovery', summary: 'Licensing', order: 3 };
    writeState(dir, layout.manifest('fumi'), JSON.stringify(mapped));
    for (const role of ['migration-topic', 'migration-verifier']) {
      refusedUnissued([role, '--topic', 'fumi.discovery.licensing', '--directive', '079-records'], /^brief: fumi's licensing is in discussion, past discovery — its record is carried there: fumi\.discussion\.licensing$/);
    }
    writeState(dir, layout.manifest('fumi'), manifest);
    refusedUnissued(['migration-verifier', ...LICENSING], /^fumi's licensing has no record composed — .*licensing\.json is no file$/);
    writeState(dir, composedPath('fumi', 'licensing'), '\n');
    refusedUnissued(['migration-verifier', ...LICENSING], /^fumi's licensing has no record composed — .*licensing\.json is empty$/);
  });
});

describe('the migration\'s agents and the plain search (21.S35, 26.5.1)', () => {
  /** The rule confining an agent's shell, word for word in each agent's file: reading alone, or reading and the check its brief names. */
  const CONFINED = '**The shell is for reading and searching alone:** `rg`, `find`, `ls`, `cat`, `head`, `tail`, `wc` and their like. Never run the engine, never run git, and never write, move or delete a file through it.';
  const CHECKING = '**The shell is for reading and searching, and for the check your brief names:** `rg`, `find`, `ls`, `cat`, `head`, `tail`, `wc` and their like. Never run the engine for anything else, never run git, and never write, move or delete a file through it.';

  it('each searches through a shell confined to reading, the per-topic agent\'s running its record\'s check besides — Claude Code giving no Glob or Grep tool — and no agent file names an engine call, nor any brief but the check it names: only the session writes the ledger and the state', () => {
    assert.ok(fs.readFileSync(path.join(AGENTS, 'ledger-migration-topic.md'), 'utf8').includes('- Touch only the files the directive names for a topic or a phase, and only this one\'s: what you compose, and the hand-back file where your brief names one.'), 'the per-topic agent writes its hand-back');
    assert.ok(fs.readFileSync(path.join(AGENTS, 'ledger-migration-verifier.md'), 'utf8').includes('- Write only the findings file, and the rulings file and the checked file where your brief names them, the `.txt` files your brief names, with the Write tool.'), 'the verifier writes its rulings and verdicts');
    for (const [agent, rule] of [['ledger-migration-topic', CHECKING], ['ledger-migration-verifier', CONFINED], ['ledger-plain-search', CONFINED]]) {
      const text = fs.readFileSync(path.join(AGENTS, `${agent}.md`), 'utf8');
      const tools = String(/^tools: (.*)$/m.exec(text)?.[1]).split(', ');

      assert.deepStrictEqual(['Bash', 'Glob', 'Grep'].map((tool) => tools.includes(tool)), [true, false, false], `${agent}'s tools: ${tools.join(', ')}`);
      assert.ok(text.includes(rule), `${agent} confines its shell`);
      assert.ok(!text.includes('engine.cjs'), `${agent} names no engine call`);
    }
    writeState(dir, composedPath('fumi', 'licensing'), `${RECORD}\n`);
    const engineCalls = (/** @type {string} */ brief) => brief.split('engine.cjs').length - 1;
    assert.deepStrictEqual([
      engineCalls(issued(['migration-topic', ...LICENSING]).brief), engineCalls(issued(['migration-verifier', ...LICENSING]).brief), fs.readFileSync(DIRECTIVE, 'utf8').includes('engine.cjs'),
    ], [1, 0, true], 'the briefs draw the directive without the session\'s engine calls, the per-topic agent\'s naming its record\'s check alone');
  });
});

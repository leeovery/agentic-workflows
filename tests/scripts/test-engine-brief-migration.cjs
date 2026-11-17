'use strict';

// ---------------------------------------------------------------------------
// The migration's briefs (ledger-engine/scripts/domain/brief.cjs, the
// records domain/brief-records.cjs, the templates content/briefs/; 21.10.5,
// 21.10.7): `engine brief migration-topic|migration-verifier --topic
// <unit.phase.topic> --directive <id>`. The per-topic agent's brief — the
// topic as the move left it, its files but its mail, and as the records
// directive's check reads them its specs, grouped under another name and
// kept as an asset or joined into the unit's spec.md where its building
// started, each part of it named, each approved or a draft, its old map
// there, its research's threads still open, either "None — no entry needs"
// its mark where it has none, and its reviews never folded in, a promoted
// topic's where it was promoted from, all read in the main checkout from a
// linked worktree too; the unit's assets with where each came in from,
// those the topic owes a link and those whose file is gone marked, where
// its record goes and whether it is composed yet, the verifier's findings
// kept until a verifier reads the record again, the carry's refusal taken
// by the brief and cleared, the call that checks the record writing
// nothing, and of the directive the sections its check names briefed, the
// session's own work none of them; a cancelled unit's topic briefed as any
// other; the verifier's — the topic, its record as composed, verbatim, every
// round of findings before, the last kept as a round and cleared, the points
// the session settled, and the directive; every
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
const { composedPath, findingsPath, refusedPath } = require(path.join(SCRIPTS, 'domain/ledger-carry.cjs'));
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

/** The directive as a brief draws it: its two sections for the agents, a topic's sources and its record, as they stand. */
function directiveDrawn() {
  const text = fs.readFileSync(DIRECTIVE, 'utf8');
  return text.slice(text.indexOf('## A Topic\'s Sources'), text.indexOf('## Working Through the Topics')).trimEnd();
}

/** The call checking licensing's record, as its brief draws it. */
const RECORD_CHECK = `\`${ENGINE_RUN} ledger carry fumi.discussion.licensing --dry-run\``;

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
  '## The unit\'s discovery sessions',
  '',
  'None recorded.',
  '',
  '## Its old map, as `.workflows/` holds it',
  '',
  '- trial-length: decided',
  '',
  '## Its research\'s threads still open',
  '',
  'None — no entry needs a thread.',
  '',
  '## The unit\'s assets',
  '',
  '- fumi/assets/pricing.md, which came in from discussion/licensing — this topic\'s to link',
  '- fumi/assets/sso.md, which came in from discussion/auth',
  '- fumi/assets/rates.md, which came in from research/billing',
  '- fumi/assets/old.md, which came in from discussion/licensing — its file is gone, so no entry links it',
  '',
  '## Where the record goes',
  '',
  `- The record composed: .cache/migrate/records/fumi/licensing.json, ${composed ? 'composed already' : 'not composed yet'}`,
  '- The verifier\'s findings on it: .cache/migrate/records/fumi/licensing.findings.txt',
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
      'migrated-topic': licensingDrawn(), 'verifier-findings': 'None recorded.', 'carry-refusal': 'None recorded.', 'settled-points': 'None recorded.', 'record-check': RECORD_CHECK, directive: directiveDrawn(),
    })}`);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(issuedPath(SESSION_ID, res.id), 'utf8')), { role: 'migration-topic', agent: 'ledger-migration-topic', unit: null, task: null, topic: null });
  });

  it('a topic\'s research threads still open and its map\'s undecided subtopics, and none of either where it has none; a building unit\'s specs as the parts of its spec.md each makes, approved', () => {
    const search = issued(['migration-topic', '--topic', 'fumi.discussion.search', '--directive', '079-records']).brief;
    const weights = issued(['migration-topic', '--topic', 'shop.discussion.weights', '--directive', '079-records']).brief;

    assert.ok(search.includes([
      '## Its specs', '', 'None recorded.', '',
      '## The unit\'s discovery sessions', '', 'None recorded.', '',
      '## Its old map, as `.workflows/` holds it', '', '- ranking: decided', '- typo-tolerance: exploring', '- synonyms: deferred', '',
      '## Its research\'s threads still open', '', '- index-size, digging: How big does the index grow?', '',
      '## The unit\'s assets', '',
    ].join('\n')), search);
    assert.ok(weights.includes([
      '## Its specs', '',
      '- shop/spec.md, its part "1. Weights", approved',
      '- shop/spec.md, its part "2. Wishlist", approved', '',
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
    writeState(dir, findingsPath('fumi', 'licensing'), `${REVERSED}\n`);
    writeState(dir, '.cache/migrate/records/fumi/licensing.settled.md', `${SETTLED}\n`);
    const settled = issued(['migration-topic', ...LICENSING]).brief;
    const second = issued(['migration-verifier', ...LICENSING]).brief;
    writeState(dir, findingsPath('fumi', 'licensing'), '');
    const third = issued(['migration-verifier', ...LICENSING]).brief;

    assert.ok(composer.includes(`# The verifier's findings\n\n${FINDINGS}\n\n# The carry's refusal`), composer);
    assert.ok(composer.includes('- The record composed: .cache/migrate/records/fumi/licensing.json, composed already'), composer);
    assert.ok(verifier.includes(`# The earlier rounds' findings\n\n## Round 1\n\n${FINDINGS}\n\n# Points the session settled\n\nNone recorded.\n\n# The directive`), verifier);
    assert.ok(settled.includes(`# Points the session settled\n\n${SETTLED}\n\n# The directive`), settled);
    assert.ok(second.includes(`# The earlier rounds' findings\n\n## Round 1\n\n${FINDINGS}\n\n## Round 2\n\n${REVERSED}\n\n# Points the session settled\n\n${SETTLED}\n\n# The directive`), second);
    assert.ok(third.includes(`## Round 2\n\n${REVERSED}\n\n## Round 3\n\nNone: the verifier passed it.\n\n# Points the session settled`), third);
    assert.strictEqual(fs.existsSync(statePath(dir, findingsPath('fumi', 'licensing'))), false);
  });

  it('a unit\'s own record: its discovery sessions, its topics, which carry what the sessions say of each, the imports of its discovery as a whole its own to link, where it goes, and its check', () => {
    writeState(dir, layout.unit('shop', 'discovery', 'session-001.md'), '## Discovery Session 001\n');

    const { brief } = issued(['migration-topic', '--topic', 'shop.discovery', '--directive', '079-records']);

    for (const part of [
      '- **Unit:** shop, epic, in-progress\n- **The record:** the unit\'s own, carried in discovery — what its discovery sessions hold of the unit as a whole, or of no one topic',
      '## The unit\'s discovery sessions\n\n- shop/discovery/session-001.md\n\n## The unit\'s topics, each carrying what the sessions say of it\n\n- weights, its folder shop/topics/weights/',
      '- shop/assets/vision.md, which came in from discovery — this record\'s to link',
      '- The record composed: .cache/migrate/records/shop.json, not composed yet',
      `\`${ENGINE_RUN} ledger carry shop.discovery --dry-run\``,
    ]) assert.ok(brief.includes(part), `${part}\n\nin\n\n${brief}`);
    writeState(dir, composedPath('shop', null), `${RECORD}\n`);
    writeState(dir, findingsPath('shop', null), 'The session on selling is not carried.\n');
    const verifier = issued(['migration-verifier', '--topic', 'shop.discovery', '--directive', '079-records']).brief;
    assert.ok(verifier.includes(`# The record\n\n\`\`\`json\n${RECORD}`) && readState(dir, '.cache/migrate/records/shop.rounds.md').includes('The session on selling is not carried.'), verifier);
  });

  it('a promoted topic\'s discovery sessions: its unit\'s, and those of the unit it came from, so marked; the unit it came from lists it among its topics in its own record\'s brief, carried where it went', () => {
    writeState(dir, layout.unit('fumi', 'discovery', 'session-001.md'), '## Discovery Session 001\n');

    const { brief } = issued(['migration-topic', '--topic', 'platform.discussion.auth', '--directive', '079-records']);
    const own = issued(['migration-topic', '--topic', 'fumi.discovery', '--directive', '079-records']).brief;

    assert.ok(brief.includes('## The unit\'s discovery sessions\n\n- fumi/discovery/session-001.md, of fumi, which it moved from\n'), brief);
    assert.ok(own.includes('## The unit\'s topics, each carrying what the sessions say of it\n\n- auth, moved to platform, which carries what the sessions say of it\n- billing, its folder fumi/topics/billing/\n'), own);
  });

  it('lists the unit\'s discovery sessions, the migration\'s research session among them, and nothing else its discovery holds; an epic\'s topic never started carried in discovery, and shown so', () => {
    writeState(dir, layout.unit('fumi', 'discovery', 'session-001.md'), '## Discovery Session 001\n');
    writeState(dir, layout.unit('fumi', 'discovery', 'session-002.md'), '## Discovery Session 002\n\nResearch the migration placed: index-size.\n');
    writeState(dir, layout.unit('fumi', 'discovery', 'notes.md'), '# Notes\n');

    const { brief } = issued(['migration-topic', '--topic', 'fumi.discovery.support', '--directive', '079-records']);

    assert.ok(brief.includes('## The unit\'s discovery sessions\n\n- fumi/discovery/session-001.md\n- fumi/discovery/session-002.md\n\n## Its old map'), brief);
    assert.match(brief, /^- \*\*Topic:\*\* support, in discovery, pending — its record carried in discovery, the topic never started$/m);
  });

  it('21.S44: a cancelled unit\'s topic is briefed as any other, the import from its discovery its own to link', () => {
    const { brief } = issued(['migration-topic', '--topic', 'gone.discussion.gone', '--directive', '079-records']);

    assert.ok(brief.includes('- **Unit:** gone, feature, cancelled\n- **Topic:** gone, in discussion, in-progress — its record carried in discussion\n'), brief);
    assert.ok(brief.includes('## The unit\'s assets\n\n- gone/assets/notes.md, which came in from discovery — this topic\'s to link\n'), brief);
  });
});

describe('the verifier\'s brief (21.10.7)', () => {
  it('the topic, its record as composed, verbatim, no last findings yet, and the directive', () => {
    writeState(dir, composedPath('fumi', 'licensing'), `${RECORD}\n`);

    const { res, brief } = issued(['migration-verifier', ...LICENSING]);

    assert.deepStrictEqual([res.role, res.agent], ['migration-verifier', 'ledger-migration-verifier']);
    assert.strictEqual(brief, `Brief ${res.id} — the migration verifier's\n\n${filledTemplate('migration-verifier', {
      'migrated-topic': licensingDrawn(true), 'composed-record': `\`\`\`json\n${RECORD}\n\`\`\``, 'earlier-findings': 'None recorded.', 'settled-points': 'None recorded.', directive: directiveDrawn(),
    })}`);
  });
});

describe('a cite of a heading held more than once', () => {
  it('both briefs say it names the heading\'s path, with an example, the carry refusing a bare one, which tells none of its copies apart', () => {
    writeState(dir, composedPath('fumi', 'licensing'), `${RECORD}\n`);

    const briefs = ['migration-topic', 'migration-verifier'].map((role) => issued([role, ...LICENSING]).brief);

    assert.deepStrictEqual(briefs.map((brief) => ['more than once in its part — by its path, as many of the headings over it as tell it apart, then its own: `Identity & Naming > Decision`', '`{"path": "{unit}/spec.md", "section": "Identity & Naming > Decision"}`: the carry refuses a cite naming several — a bare one tells none of its copies apart — and names the paths that do'].filter((said) => !brief.includes(said))), [[], []]);
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

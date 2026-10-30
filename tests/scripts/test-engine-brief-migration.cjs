'use strict';

// ---------------------------------------------------------------------------
// The migration's briefs (leeway-engine/scripts/domain/brief.cjs, the
// records domain/brief-records.cjs, the templates content/briefs/; 21.10.5,
// 21.10.7): `engine brief migration-topic|migration-verifier --topic
// <unit.phase.topic> --directive <id>`. The per-topic agent's brief — the
// topic as the move left it, its files but its mail, its spec kept as an
// asset, the unit's assets with where each came in from, where its record
// goes, the verifier's findings where it has any, and the directive, its
// headings a level down; the verifier's — the topic, its record as
// composed, verbatim, and the directive; every refusal storing nothing; and
// the two agents' definitions (21.S35): each fixes its model and effort,
// and its tools hold no shell, so no engine call and no ledger write is
// theirs.
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
const { ok, statePath, layout, writeState, cleanupFixture } = require('./engine-harness.cjs');
const { recordsMigration, refusedUntouched } = require('./migration-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { ROLES, briefPath, issuedPath } = require(path.join(SCRIPTS, 'domain/brief-names.cjs'));
const { conversationDir } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const { composedPath, findingsPath } = require(path.join(SCRIPTS, 'domain/ledger-carry.cjs'));
const TEMPLATES = path.join(__dirname, '../../skills/leeway-engine/content/briefs');
const DIRECTIVE = path.join(__dirname, '../../skills/leeway-migrate/scripts/migrations/079-records.md');
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

/** The directive as a brief draws it: each heading a level down. */
const directiveDrawn = () => fs.readFileSync(DIRECTIVE, 'utf8').trimEnd().split('\n').map((line) => (/^#{1,6} /.test(line) ? `#${line}` : line)).join('\n');

/** The licensing topic as a brief draws it. */
const licensingDrawn = () => [
  '- **Unit:** fumi, epic, in-progress',
  '- **Topic:** licensing, in discussion, completed',
  `- **The state:** ${statePath(dir)} — each path below is from there, as an entry cites it`,
  '',
  '## Its files',
  '',
  '- fumi/topics/licensing/brief.md',
  '- fumi/topics/licensing/log.md',
  '- fumi/assets/specs/licensing.md',
  '',
  '## The unit\'s assets',
  '',
  '- fumi/assets/pricing.md, which came in from discussion/licensing',
  '',
  '## Where the record goes',
  '',
  '- The record composed: .cache/migrate/records/fumi/licensing.json',
  '- The verifier\'s findings on it: .cache/migrate/records/fumi/licensing.findings.md',
].join('\n');

/** The briefs the conversation holds. */
const stored = () => (fs.existsSync(path.join(conversationDir(SESSION_ID), 'briefs')) ? fs.readdirSync(path.join(conversationDir(SESSION_ID), 'briefs')) : []);

/** @param {string[]} args @param {RegExp} pattern */
function refusedUnissued(args, pattern) {
  assert.match(refusedUntouched(dir, ['brief', ...args], { env: SESSION }), pattern);
  assert.deepStrictEqual(stored(), []);
}

describe('the per-topic agent\'s brief (21.10.5)', () => {
  it('the topic as the move left it — its files but its mail, its spec kept as an asset, the unit\'s assets and where each came in from, where its record goes — no findings yet, and the directive', () => {
    writeState(dir, layout.topic('fumi', 'licensing', 'mail', '001-seats.md'), '### Seats\n');

    const { res, brief } = issued(['migration-topic', ...LICENSING]);

    assert.deepStrictEqual(res, { ok: true, id: res.id, role: 'migration-topic', agent: 'leeway-migration-topic', pointer: `brief:${res.id}` });
    assert.strictEqual(brief, `Brief ${res.id} — the migration's, for one topic\n\n${filledTemplate('migration-topic', {
      'migrated-topic': licensingDrawn(), 'verifier-findings': 'None recorded.', directive: directiveDrawn(),
    })}`);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(issuedPath(SESSION_ID, res.id), 'utf8')), { role: 'migration-topic', agent: 'leeway-migration-topic', unit: null, task: null, topic: null });
  });

  it('briefed afresh after the verifier, it carries the verifier\'s findings verbatim', () => {
    writeState(dir, findingsPath('fumi', 'licensing'), '## Trial Length\n\nThe record drops the trial\'s fourteen days.\n');

    const { brief } = issued(['migration-topic', ...LICENSING]);

    assert.ok(brief.includes('# The verifier\'s findings\n\n## Trial Length\n\nThe record drops the trial\'s fourteen days.\n\n# The directive'));
  });
});

describe('the verifier\'s brief (21.10.7)', () => {
  it('the topic, its record as composed, verbatim, and the directive', () => {
    writeState(dir, composedPath('fumi', 'licensing'), `${RECORD}\n`);

    const { res, brief } = issued(['migration-verifier', ...LICENSING]);

    assert.deepStrictEqual([res.role, res.agent], ['migration-verifier', 'leeway-migration-verifier']);
    assert.strictEqual(brief, `Brief ${res.id} — the migration verifier's\n\n${filledTemplate('migration-verifier', {
      'migrated-topic': licensingDrawn(), 'composed-record': `\`\`\`json\n${RECORD}\n\`\`\``, directive: directiveDrawn(),
    })}`);
  });
});

describe('the refusals, nothing stored', () => {
  it('a directive the migrations lack, a place naming no topic, a topic the unit lacks, and the verifier\'s brief with no record composed, or an empty one', () => {
    refusedUnissued(['migration-topic', '--topic', 'fumi.discussion.licensing', '--directive', '078-move'], /^there is no directive 078-move$/);
    refusedUnissued(['migration-topic', '--topic', 'fumi.discussion.licensing', '--directive', '../079'], /^"\.\.\/079" is no directive's id/);
    refusedUnissued(['migration-topic', '--topic', 'fumi.licensing', '--directive', '079-records'], /^brief: "fumi\.licensing" names no topic — <work-unit>\.<phase>\.<topic>$/);
    refusedUnissued(['migration-topic', '--topic', 'fumi.discussion.billing', '--directive', '079-records'], /^brief: fumi has no topic "billing" in discussion$/);
    refusedUnissued(['migration-verifier', ...LICENSING], /^fumi's licensing has no record composed — .*licensing\.json is no file$/);
    writeState(dir, composedPath('fumi', 'licensing'), '\n');
    refusedUnissued(['migration-verifier', ...LICENSING], /^fumi's licensing has no record composed — .*licensing\.json is empty$/);
  });
});

describe('the migration\'s agents (21.S35, 26.5.1)', () => {
  it('each role\'s agent is defined, fixing Opus at medium, its tools holding no shell: no engine call and no ledger write is the agent\'s, only the session\'s', () => {
    for (const role of ['migration-topic', 'migration-verifier']) {
      const { agent } = ROLES[role];
      const head = /^---\n([^]*?)\n---\n/.exec(fs.readFileSync(path.join(AGENTS, `${agent}.md`), 'utf8'));
      const fields = Object.fromEntries(String(head?.[1]).split('\n').map((line) => line.split(/: (.*)/s).slice(0, 2)));

      assert.deepStrictEqual([fields.name, fields.model, fields.effort], [agent, 'opus', 'medium'], agent);
      assert.ok(!fields.tools.split(', ').includes('Bash'), `${agent}'s tools: ${fields.tools}`);
    }
  });
});

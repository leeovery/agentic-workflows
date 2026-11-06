'use strict';

// ---------------------------------------------------------------------------
// The spec's entry (leeway-engine/scripts/domain/spec-entry.cjs, its
// standing spec-standing.cjs): `engine enter specification <unit>`, at the
// work unit. What it refuses, each refusal naming its way on and writing
// nothing — an epic while any topic is neither decided, cancelled nor
// postponed, each named by the name it goes by, let in once they are
// postponed to the roadmap (11.S1, 18.S21, 18.5.2), and an epic with no
// live topic, its map unshaped or every topic set aside; a feature's topic
// not yet closed into its spec — its decided checklist closed, nothing
// delivered to it since (11.2.1, 9.7.9) — a bugfix's investigation not yet
// concluded; a quick-fix (11.1.6) and a migrated cross-cutting unit, a type
// the reshape retires (19.6.1); a topic named; and, for
// every verb that holds the spec to its refusal, a unit not in progress.
// What it writes: nothing but where the conversation is working (4.11.2),
// starting nothing and committing nothing. What it reads: each live topic's
// record and log — a bugfix's its investigation's, and beside it the
// document today's investigation writes — and the files the unit's
// current entries link as canonical (11.6.3); once the spec is written, the
// spec and the cut, and while the review page is open, its address and the
// file its marks are read back to; then the unit's own record; and the
// agents the spec was left with, landed or lost (9.7.8). Approve the map,
// named while the sweep's candidates wait, is test-engine-sweep.cjs's. And the spec's standing, none, written or concluded (P7). The
// settled rule as topics-settled reads it is test-engine-checklist.cjs's,
// the move after a topic is decided test-engine-decided-yes.cjs's, every
// door past the spec test-engine-past-spec.cjs's, and the recovery note
// test-engine-position.cjs's.
//
// Layer: verb. World, built once and copied: an epic, `fumi`, whose map
// holds three topics decided, one cancelled, one postponed, one under
// discussion, renamed, and one not started; an epic, `ready`, its topics
// settled — `alpha` decided with its log and a decision linking one file
// canonical and one reference, `beta` decided with neither, `removal`
// cancelled with a decision linking a file canonical, `widgets` postponed;
// an epic with no topic, and one whose topics are all set aside; a feature
// under discussion and one decided; a bugfix under investigation and one
// concluded, its investigation written; a quick-fix; and a migrated
// cross-cutting unit. Each test's conversation has its own system config.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ok, okSections, refusedPristine, statePath, layout, writeState, readState, readManifest, stateGit, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { specStanding, specEntryRefusal } = require('../../skills/leeway-engine/scripts/domain/spec-entry.cjs');

const ENGINE = 'node .claude/skills/leeway-engine/scripts/engine.cjs';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'spec-entry-world' });
const MADE = Object.freeze({ by: 'claude', who_moved_whom: 'none' });

// A process that no longer runs.
const GONE = '2147483646';

/** The refusal of the feature `solo` while its topic has not closed into its spec. */
const SOLO_WAITS = 'solo\'s spec waits until its discussion closes, nothing of the person\'s open and its closing pass run — its discussion carries on: engine enter discussion solo';

/** A map row. @param {number} order @param {Record<string, unknown>} [marks] */
const row = (order, marks = {}) => ({ order, summary: `Topic ${order}`, source: 'discovery', ...marks });

/** A decision written on a topic, linking each file given its status: the decision's short id. @param {string} dir @param {string} unit @param {string} topic @param {Record<string, string>} files */
function decisionLinking(dir, unit, topic, files) {
  const at = `${unit}.discussion.${topic}`;
  const asked = ok(dir, ['ledger', 'ask', at], { env: SESSION, stdin: JSON.stringify({ ...MADE, text: `What does ${topic} settle?` }) }).id;
  const decided = ok(dir, ['ledger', 'decide', at, '--answers', asked], { env: SESSION, stdin: JSON.stringify({ ...MADE, text: 'This.', why: 'Because.' }) }).id;
  for (const [file, status] of Object.entries(files)) {
    writeState(dir, file, `${file}\n`);
    ok(dir, ['asset', 'add', unit, file, '--entry', decided, '--status', status], { env: SESSION });
  }
  return decided;
}

const world = fixtureFrom('engine-spec-entry-', (dir) => {
  createManifest(dir, 'fumi', {
    work_type: 'epic',
    phases: {
      discovery: {
        items: {
          alpha: row(1), beta: row(2), gamma: row(3), licence: row(4, { title: 'licensing' }), onboarding: row(5),
          removal: row(6, { cancelled: true }), widgets: row(7, { postponed: true }),
        },
      },
      discussion: {
        items: {
          alpha: { status: 'completed' }, beta: { status: 'completed' }, gamma: { status: 'completed' }, licence: { status: 'in-progress' },
          removal: { status: 'cancelled' }, widgets: { status: 'postponed' },
        },
      },
    },
  });
  const ready = (/** @type {Record<string, unknown>} */ marks, /** @type {(topic: string) => string} */ status) => createManifest(dir, 'ready', {
    work_type: 'epic',
    phases: {
      discovery: { items: { alpha: row(1), beta: row(2), removal: row(3, marks.removal), widgets: row(4, marks.widgets) } },
      discussion: { items: Object.fromEntries(['alpha', 'beta', 'removal', 'widgets'].map((topic) => [topic, { status: status(topic) }])) },
    },
  });
  ready({}, () => 'in-progress');
  decisionLinking(dir, 'ready', 'alpha', { [layout.assets('ready', 'design.png')]: 'canonical', [layout.assets('ready', 'notes.md')]: 'reference' });
  decisionLinking(dir, 'ready', 'removal', { [layout.assets('ready', 'old.png')]: 'canonical' });
  ready({ removal: { cancelled: true }, widgets: { postponed: true } }, (topic) => ({ removal: 'cancelled', widgets: 'postponed' })[topic] ?? 'completed');
  writeState(dir, layout.doc('ready', 'discussion', 'alpha'), '# Alpha\n');
  createManifest(dir, 'solo', { phases: { discussion: { items: { solo: { status: 'in-progress' } } } } });
  createManifest(dir, 'tally', { phases: { discussion: { items: { tally: { status: 'completed' } } } } });
  createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
  createManifest(dir, 'fixed', { work_type: 'bugfix', phases: { investigation: { items: { fixed: { status: 'completed' } } } } });
  writeState(dir, layout.doc('fixed', 'investigation', 'fixed'), '# Fixed\n');
  createManifest(dir, 'unshaped', { work_type: 'epic', phases: { discovery: { items: {} } } });
  createManifest(dir, 'aside', {
    work_type: 'epic',
    phases: {
      discovery: { items: { removal: row(1, { cancelled: true }), widgets: row(2, { postponed: true }) } },
      discussion: { items: { removal: { status: 'cancelled' }, widgets: { status: 'postponed' } } },
    },
  });
  createManifest(dir, 'tweak', { work_type: 'quick-fix' });
  createManifest(dir, 'tracing', { work_type: 'cross-cutting', phases: { discussion: { items: { tracing: { status: 'completed' } } } } });
});

let dir; // the project
let config; // the system config: the conversations' folders

/** The engine as the conversation runs it. */
function env() {
  return { LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'sess-1', CLAUDE_PID: String(process.pid), TMUX: undefined, TMUX_PANE: undefined };
}

/** An entry that must succeed: its response and its sections. @param {string} unit */
const enter = (unit) => okSections(dir, ['enter', 'specification', unit], { env: env() });

/** An entry that must refuse, writing nothing and recording no position: its error. @param {string[]} args */
function refused(args) {
  const { error } = refusedPristine(dir, ['enter', 'specification', ...args], { env: env() });
  assert.strictEqual(position(), null, `engine enter specification ${args.join(' ')} recorded a position on refusing`);
  return error;
}

/** The position recorded for the conversation, or null. */
function position() {
  try { return JSON.parse(fs.readFileSync(path.join(config, 'conversations', 'sess-1', 'position.json'), 'utf8')); } catch { return null; }
}

/** A DATA section of `lines`, as the entry draws it. @param {string[]} lines */
const data = (lines) => `=== DATA (reason from this — never display or parse the sections below) ===\n${lines.join('\n')}\n`;

/** A path in the state, absolute. @param {string} rel */
const at = (rel) => statePath(dir, rel);

/** Each topic's record call, then the unit's own, as the DATA names them. @param {string} unit @param {...string} topics */
const records = (unit, ...topics) => [...topics.map((topic) => `record: \`${ENGINE} ledger record ${unit} ${topic}\``), `record: \`${ENGINE} ledger record ${unit}\``];

beforeEach(() => {
  dir = world();
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-spec-entry-config-'));
});

afterEach(() => {
  cleanupFixture(dir);
  fs.rmSync(config, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('what cannot enter the spec is refused, naming the way on, and nothing is written', () => {
  it('an epic while any topic is neither decided, cancelled nor postponed — one under discussion, one not started — each named by the name it goes by; postponed to the roadmap, they let it in (11.S1, 18.S21, 18.5.2)', () => {
    assert.strictEqual(refused(['fumi']),
      'fumi\'s spec waits until every topic is decided, cancelled or postponed — still open: "licensing", "onboarding"; work them from the epic\'s menu, or postpone them to the roadmap');
    for (const topic of ['licence', 'onboarding']) ok(dir, ['topic', 'postpone', 'fumi', topic, '--horizon', 'next'], { env: env() });
    assert.strictEqual(enter('fumi').res.entered, true);
  });

  it('an epic whose topic has closed its decided checklist and not yet had its gate answered (11.2.1)', () => {
    ok(dir, ['topic', 'postpone', 'fumi', 'licence', '--horizon', 'next'], { env: env() });
    createManifest(dir, 'fumi', { ...readManifest(dir, 'fumi'), checklists: { decided: { onboarding: { items: {}, closed: '2026-10-01T09:00:00.000Z' } } } });
    assert.strictEqual(refused(['fumi']),
      'fumi\'s spec waits until every topic is decided, cancelled or postponed — still open: "onboarding"; work them from the epic\'s menu, or postpone them to the roadmap');
  });

  it('an epic with no live topic decided — its map not yet shaped, or every topic set aside — the way on its discovery or the roadmap', () => {
    const none = (unit) => `${unit}'s spec waits until a topic is decided — none on its map is live: shape the map in its discovery, or pull a topic forward from the roadmap`;
    assert.deepStrictEqual([refused(['unshaped']), refused(['aside'])], [none('unshaped'), none('aside')]);
  });

  it('a feature whose topic has not closed, and a bugfix whose investigation has not concluded; each enters once it has', () => {
    assert.deepStrictEqual([refused(['solo']), refused(['crash'])], [SOLO_WAITS, 'crash\'s spec waits until its investigation concludes — the investigation carries on, from the start menu']);
    assert.deepStrictEqual([enter('tally').res.entered, enter('fixed').res.entered], [true, true]);
  });

  it('a feature\'s topic once it has closed into its spec, undecided: its decided checklist closed, a message delivered since voiding the close until it closes again (11.2.1, 9.7.9)', () => {
    const states = [{ closed: '2026-10-01T09:00:00.000Z' }, { closed: '2026-10-01T09:00:00.000Z', voided: '2026-10-01T10:00:00.000Z' }, { closed: '2026-10-01T11:00:00.000Z', voided: '2026-10-01T10:00:00.000Z' }].map((record) => {
      createManifest(dir, 'solo', { ...readManifest(dir, 'solo'), checklists: { decided: { solo: { items: {}, ...record } } } });
      return specEntryRefusal(dir, 'solo');
    });
    assert.deepStrictEqual(states, [null, SOLO_WAITS, null]);
    assert.strictEqual(readManifest(dir, 'solo').phases.discussion.items.solo.status, 'in-progress', 'the one screen marks it decided');
  });

  it('a quick-fix, which has no spec (11.1.6), a migrated cross-cutting unit, whose type goes (19.6.1), and a topic named', () => {
    assert.deepStrictEqual([refused(['tweak']), refused(['tracing']), refused(['ready', 'alpha'])], [
      'a quick-fix has no specification — its phases are scoping, implementation, review',
      'tracing is a cross-cutting unit, a type the reshape retires — it waits on the reshape\'s 29.17 migration, and nothing is done in it until then',
      'specification is entered at the work unit — name no topic: engine enter specification ready',
    ]);
  });

  it('answers the refusal for any verb that holds the spec to it, as the entry refuses: a quick-fix, a unit the project lacks, and none where the unit may enter', () => {
    assert.deepStrictEqual([specEntryRefusal(dir, 'tweak'), specEntryRefusal(dir, 'nowhere'), specEntryRefusal(dir, 'ready')], [
      'a quick-fix has no specification — its phases are scoping, implementation, review',
      'there is no work unit "nowhere" — the start menu lists the work in progress',
      null,
    ]);
  });

  it('answers the refusal of a unit not in progress, which its settled topics would let in: a cancelled one reactivated first, a completed one closed to new work', () => {
    for (const [unit, status] of [['ready', 'cancelled'], ['tally', 'completed']]) createManifest(dir, unit, { ...readManifest(dir, unit), status });
    assert.deepStrictEqual([specEntryRefusal(dir, 'ready'), specEntryRefusal(dir, 'tally')], [
      'ready is cancelled — reactivating it comes first',
      'tally is completed — new work starts from the start menu',
    ]);
  });
});

describe('the entry writes nothing but where the conversation is working (4.11.2)', () => {
  it('starts nothing and commits nothing — the manifest as it was — and records the place, the unit itself, with its presence', () => {
    const [head, manifest] = [stateGit(dir, ['rev-parse', 'HEAD']).trim(), readState(dir, layout.manifest('ready'))];
    const { res } = enter('ready');
    assert.deepStrictEqual(res, { ok: true, phase: 'specification', unit: 'ready', entered: true, started: false });
    assert.deepStrictEqual([stateGit(dir, ['rev-parse', 'HEAD']).trim(), readState(dir, layout.manifest('ready'))], [head, manifest]);
    assert.deepStrictEqual(position(), { name: 'ready', phase: 'specification', topic: 'ready' });
    assert.strictEqual(JSON.parse(readState(dir, layout.cache('ready', 'specification', 'ready', 'presence'))).session_id, 'sess-1');
  });
});

describe('what the spec reads at its entry', () => {
  it('each live topic\'s record and its log, the unit\'s own record, and the files its current entries link as canonical — none of a reference link, none of a cancelled topic\'s — with no log of its own', () => {
    assert.strictEqual(enter('ready').sections, data([
      ...records('ready', 'alpha', 'beta'),
      `topic log: ${at(layout.doc('ready', 'discussion', 'alpha'))}`,
      `asset: ${at(layout.assets('ready', 'design.png'))}`,
    ]));
  });

  it('a bugfix\'s topic logs: its investigation\'s log, and beside it, while there is one, the document today\'s investigation writes — each read once on disk (19.4.15)', () => {
    const document = `topic log: ${at(layout.doc('fixed', 'investigation', 'fixed'))}`;
    assert.strictEqual(enter('fixed').sections, data([...records('fixed', 'fixed'), document]));
    writeState(dir, layout.topic('fixed', 'fixed', 'log.md'), '# Fixed\n');

    assert.strictEqual(enter('fixed').sections, data([...records('fixed', 'fixed'), `topic log: ${at(layout.topic('fixed', 'fixed', 'log.md'))}`, document]));
  });

  it('once the spec is written, the spec and, once cut, the cut; and the agents the spec was left with, landed or lost with a process gone (9.7.8)', () => {
    writeState(dir, layout.unit('ready', 'spec.md'), '# Ready\n');
    createManifest(dir, 'ready', { ...readManifest(dir, 'ready'), cut: { phases: [] } });
    const gone = { LEEWAY_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: 'earlier', CLAUDE_PID: GONE };
    const [landed, lost] = ['landed', 'lost'].map((label) => ok(dir, ['agent', 'dispatch', 'ready', 'specification', 'ready', '--kind', 'review', '--label', label], { env: gone }));
    fs.writeFileSync(landed.file, '# Findings\n');

    assert.strictEqual(enter('ready').sections, data([
      ...records('ready', 'alpha', 'beta'),
      `topic log: ${at(layout.doc('ready', 'discussion', 'alpha'))}`,
      `asset: ${at(layout.assets('ready', 'design.png'))}`,
      `spec: ${at(layout.unit('ready', 'spec.md'))}`,
      `cut: \`${ENGINE} manifest get ready cut\``,
      `landed: ${landed.file}`,
      `lost: ${lost.id}`,
    ]));
  });

  it('while the review page is open, its address and the file its marks are read back to', () => {
    writeState(dir, layout.unit('ready', 'spec.md'), '# Ready\n');
    const url = 'https://claude.ai/public/artifacts/ready';
    writeState(dir, layout.cache('ready', 'specification', 'published.json'), JSON.stringify({ url, at: '2026-11-01T00:00:00.000Z' }));

    assert.strictEqual(enter('ready').sections, data([
      ...records('ready', 'alpha', 'beta'),
      `topic log: ${at(layout.doc('ready', 'discussion', 'alpha'))}`,
      `asset: ${at(layout.assets('ready', 'design.png'))}`,
      `spec: ${at(layout.unit('ready', 'spec.md'))}`,
      `review page: ${url}`,
      `read back: ${at(layout.cache('ready', 'specification', 'read-back.json'))}`,
    ]));
  });
});

describe('the spec\'s standing, derived (P7)', () => {
  it('none until spec.md is written, written once it is, concluded once ready to build\'s yes began the build', () => {
    const seen = [specStanding(dir, 'ready')];
    writeState(dir, layout.unit('ready', 'spec.md'), '# Ready\n');
    seen.push(specStanding(dir, 'ready'));
    createManifest(dir, 'ready', { ...readManifest(dir, 'ready'), build: { position: 'auto' } });
    assert.deepStrictEqual([...seen, specStanding(dir, 'ready')], ['none', 'written', 'concluded']);
  });
});

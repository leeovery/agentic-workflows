'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const { setupFixture, cleanupFixture, createManifest } = require('./discovery-test-utils.cjs');
const {
  addThread, setThreadState, reframeThread, removeThread, registerState, threadsOf,
} = require('../../skills/workflow-engine/scripts/domain/research-threads.cjs');
const { researchThreads } = require('../../skills/workflow-engine/scripts/domain/projections/research-threads.cjs');
const { VALID_THREAD_STATUSES, isThreadOrigin } = require('../../skills/workflow-engine/scripts/kernel/manifest-schema.cjs');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');

/** A manifest with one in-progress research item, optionally pre-seeded threads. */
function manifestWith(threads) {
  const item = { status: 'in-progress' };
  if (threads) item.threads = threads;
  return { name: 'fumi', work_type: 'epic', phases: { research: { items: { 'space-homing': item } } } };
}

/** One stored row. */
function row(question, status, origin, parent = null, note) {
  return { question, status, origin, parent, ...(note ? { note } : {}) };
}

/** The tree beneath the header — the header wraps by content, the rows start at the first branch. */
function rows(rendered) {
  const lines = rendered.split('\n');
  return lines.slice(lines.findIndex((l) => /^ {2}[├└]─ /.test(l)), -1);
}

// The design's own example — the register at the pinned width.
const SPACE_HOMING = {
  'space-identity': row('Does a Space identify a home alone, or is home a display+Space pair?', 'learned', 'seed'),
  'placement-routes': row('Which routes place a window on a non-active Space?', 'learned', 'brief', 'space-identity'),
  'launch-placement': row('How do Chrome and Rectangle place a window at launch?', 'digging', 'deep-dive-001'),
  'cold-login': row('Cold-login placement', 'parked', 'conversation', null, 'needs a machine cycle; laboratory candidate'),
};

describe('research-threads domain: addThread', () => {
  it('adds an open top-level thread with its origin recorded', () => {
    const m = manifestWith();
    const thread = addThread(m, 'space-homing', 'space-identity', { question: 'Does a Space identify a home alone?', origin: 'seed' });
    assert.deepStrictEqual(thread, { question: 'Does a Space identify a home alone?', status: 'open', origin: 'seed', parent: null });
    assert.deepStrictEqual(m.phases.research.items['space-homing'].threads, { 'space-identity': thread });
  });

  it('nests a child under a top-level parent', () => {
    const m = manifestWith();
    addThread(m, 'space-homing', 'space-identity', { question: 'Q1?', origin: 'seed' });
    const child = addThread(m, 'space-homing', 'placement-routes', { question: 'Q2?', origin: 'brief', parent: 'space-identity' });
    assert.deepStrictEqual(child, { question: 'Q2?', status: 'open', origin: 'brief', parent: 'space-identity' });
  });

  it('trims the question and keeps it as asked', () => {
    const m = manifestWith();
    assert.strictEqual(addThread(m, 'space-homing', 'a', { question: '  Where does home live?  ', origin: 'user' }).question, 'Where does home live?');
  });

  it('accepts every origin form — the fixed words, a deep-dive id with or without its label, a topic name', () => {
    const m = manifestWith();
    for (const origin of ['seed', 'brief', 'user', 'conversation', 'deep-dive-001', 'deep-dive-012-launch', 'deep-dive-1000', 'behavioural-ranking']) {
      assert.strictEqual(addThread(m, 'space-homing', `t-${origin}`, { question: 'Q?', origin }).origin, origin);
    }
  });

  it('throws when the research item does not exist', () => {
    const m = manifestWith();
    assert.throws(() => addThread(m, 'nope', 'x', { question: 'Q?', origin: 'seed' }), /no research item "nope"/);
  });

  it('throws on a duplicate slug', () => {
    const m = manifestWith({ 'space-identity': row('Q?', 'open', 'seed') });
    assert.throws(() => addThread(m, 'space-homing', 'space-identity', { question: 'Q?', origin: 'seed' }), /already exists/);
  });

  it('throws when the parent does not exist', () => {
    const m = manifestWith();
    assert.throws(() => addThread(m, 'space-homing', 'child', { question: 'Q?', origin: 'seed', parent: 'ghost' }), /parent thread "ghost" not found/);
  });

  it('throws when the parent is itself a child (two levels max)', () => {
    const m = manifestWith();
    addThread(m, 'space-homing', 'a', { question: 'Q?', origin: 'seed' });
    addThread(m, 'space-homing', 'b', { question: 'Q?', origin: 'seed', parent: 'a' });
    assert.throws(() => addThread(m, 'space-homing', 'c', { question: 'Q?', origin: 'seed', parent: 'b' }), /two levels max/);
  });

  it('throws on a non-kebab-case slug', () => {
    const m = manifestWith();
    assert.throws(() => addThread(m, 'space-homing', 'Bad Slug', { question: 'Q?', origin: 'seed' }), /kebab-case slug/);
    assert.throws(() => addThread(m, 'space-homing', '', { question: 'Q?', origin: 'seed' }), /kebab-case slug/);
  });

  it('throws on an origin outside the grammar — a malformed dive id never passes as a topic name', () => {
    const m = manifestWith();
    for (const origin of ['auth/flow', 'auth.flow', 'deep-dive-1', 'deep-dive-abc', 'deep-dive-001-', '', undefined]) {
      assert.throws(() => addThread(m, 'space-homing', 'x', { question: 'Q?', origin }), /thread origin must be/, `origin ${JSON.stringify(origin)}`);
    }
  });

  it('throws on an empty or multi-line question', () => {
    const m = manifestWith();
    assert.throws(() => addThread(m, 'space-homing', 'x', { question: '  ', origin: 'seed' }), /question must be one non-empty line/);
    assert.throws(() => addThread(m, 'space-homing', 'x', { question: 'One\ntwo', origin: 'seed' }), /question must be one non-empty line/);
    assert.throws(() => addThread(m, 'space-homing', 'x', { question: undefined, origin: 'seed' }), /question must be one non-empty line/);
  });
});

describe('research-threads domain: setThreadState', () => {
  it('records any state from the enum, in any order', () => {
    const m = manifestWith({ a: row('Q?', 'open', 'seed') });
    for (const state of ['learned', 'digging', 'parked', 'open', 'learned', 'open']) {
      assert.strictEqual(setThreadState(m, 'space-homing', 'a', state).status, state);
    }
  });

  it('throws on a state outside the enum', () => {
    const m = manifestWith({ a: row('Q?', 'open', 'seed') });
    assert.throws(() => setThreadState(m, 'space-homing', 'a', 'done'), /unknown thread state "done"/);
  });

  it('throws when the thread does not exist', () => {
    const m = manifestWith();
    assert.throws(() => setThreadState(m, 'space-homing', 'ghost', 'learned'), /thread "ghost" not found/);
  });

  it('records a note with parked, trimmed', () => {
    const m = manifestWith({ a: row('Q?', 'open', 'seed') });
    assert.deepStrictEqual(setThreadState(m, 'space-homing', 'a', 'parked', { note: ' needs a machine cycle ' }),
      row('Q?', 'parked', 'seed', null, 'needs a machine cycle'));
  });

  it('refuses a note with any state but parked — and writes nothing', () => {
    const m = manifestWith({ a: row('Q?', 'open', 'seed') });
    for (const state of ['open', 'digging', 'learned']) {
      assert.throws(() => setThreadState(m, 'space-homing', 'a', state, { note: 'x' }), /note is legal on a parked thread alone/);
    }
    assert.deepStrictEqual(threadsOf(m, 'space-homing').a, row('Q?', 'open', 'seed'));
  });

  it('throws on an empty or multi-line note', () => {
    const m = manifestWith({ a: row('Q?', 'open', 'seed') });
    assert.throws(() => setThreadState(m, 'space-homing', 'a', 'parked', { note: '' }), /note must be one non-empty line/);
    assert.throws(() => setThreadState(m, 'space-homing', 'a', 'parked', { note: 'a\nb' }), /note must be one non-empty line/);
  });

  it('keeps the note while the thread stays parked, replaces it when a new one is given', () => {
    const m = manifestWith({ a: row('Q?', 'parked', 'seed', null, 'first reason') });
    assert.strictEqual(setThreadState(m, 'space-homing', 'a', 'parked').note, 'first reason');
    assert.strictEqual(setThreadState(m, 'space-homing', 'a', 'parked', { note: 'second reason' }).note, 'second reason');
  });

  it('clears the note the moment the state leaves parked', () => {
    const m = manifestWith({ a: row('Q?', 'parked', 'seed', null, 'reason') });
    const thread = setThreadState(m, 'space-homing', 'a', 'open');
    assert.deepStrictEqual(thread, row('Q?', 'open', 'seed'));
    assert.ok(!('note' in thread), 'the key goes, not just the value');
  });
});

describe('research-threads domain: reframeThread', () => {
  it('rewrites the question in place — origin, status, parent untouched', () => {
    const m = manifestWith({ a: row('Old?', 'digging', 'deep-dive-001', null) });
    assert.deepStrictEqual(reframeThread(m, 'space-homing', 'a', ' New, sharper? '), row('New, sharper?', 'digging', 'deep-dive-001'));
  });

  it('throws when the thread does not exist or the question is empty', () => {
    const m = manifestWith({ a: row('Q?', 'open', 'seed') });
    assert.throws(() => reframeThread(m, 'space-homing', 'ghost', 'Q?'), /thread "ghost" not found/);
    assert.throws(() => reframeThread(m, 'space-homing', 'a', ''), /question must be one non-empty line/);
    assert.strictEqual(threadsOf(m, 'space-homing').a.question, 'Q?');
  });
});

describe('research-threads domain: removeThread', () => {
  it('removes a thread', () => {
    const m = manifestWith({ a: row('Q?', 'open', 'seed'), b: row('Q?', 'open', 'seed') });
    removeThread(m, 'space-homing', 'a');
    assert.deepStrictEqual(Object.keys(threadsOf(m, 'space-homing')), ['b']);
  });

  it('refuses while children nest under it, naming them — then allows once they are gone', () => {
    const m = manifestWith({
      p: row('Q?', 'open', 'seed'),
      c1: row('Q?', 'open', 'brief', 'p'),
      c2: row('Q?', 'open', 'brief', 'p'),
    });
    assert.throws(() => removeThread(m, 'space-homing', 'p'), /thread "p" can't be removed — "c1", "c2" nest under it; pass --into <survivor> to move them, or remove them first/);
    removeThread(m, 'space-homing', 'c1');
    assert.throws(() => removeThread(m, 'space-homing', 'p'), /"c2" nests under it; pass --into <survivor> to move it, or remove it first/);
    removeThread(m, 'space-homing', 'c2');
    removeThread(m, 'space-homing', 'p');
    assert.deepStrictEqual(threadsOf(m, 'space-homing'), {});
  });

  it('merges into a survivor — the children move under it; the survivor must exist, be top-level, and differ', () => {
    const m = manifestWith({
      p: row('Q?', 'open', 'seed'),
      q: row('Q?', 'digging', 'user'),
      c1: row('Q?', 'open', 'brief', 'p'),
      c2: row('Q?', 'parked', 'brief', 'p', 'why'),
      qc: row('Q?', 'open', 'brief', 'q'),
    });
    assert.throws(() => removeThread(m, 'space-homing', 'p', { into: 'p' }), /can't merge into itself/);
    assert.throws(() => removeThread(m, 'space-homing', 'p', { into: 'ghost' }), /thread "ghost" not found/);
    assert.throws(() => removeThread(m, 'space-homing', 'p', { into: 'qc' }), /"qc" is itself a child of "q"/);
    removeThread(m, 'space-homing', 'p', { into: 'q' });
    assert.deepStrictEqual(threadsOf(m, 'space-homing'), {
      q: row('Q?', 'digging', 'user'),
      c1: row('Q?', 'open', 'brief', 'q'),
      c2: row('Q?', 'parked', 'brief', 'q', 'why'),
      qc: row('Q?', 'open', 'brief', 'q'),
    });
    removeThread(m, 'space-homing', 'c1', { into: 'q' });
    assert.deepStrictEqual(Object.keys(threadsOf(m, 'space-homing')), ['q', 'c2', 'qc'], 'a childless thread merges too');
  });

  it('throws when the thread does not exist', () => {
    const m = manifestWith();
    assert.throws(() => removeThread(m, 'space-homing', 'ghost'), /thread "ghost" not found/);
  });
});

describe('research-threads domain: registerState', () => {
  it('derives counts and total', () => {
    const m = manifestWith({
      a: row('Q?', 'learned', 'seed'),
      b: row('Q?', 'digging', 'brief'),
      c: row('Q?', 'open', 'user', 'b'),
      d: row('Q?', 'parked', 'conversation', null, 'later'),
      e: row('Q?', 'open', 'seed'),
    });
    assert.deepStrictEqual(registerState(m, 'space-homing'), {
      counts: { open: 2, digging: 1, learned: 1, parked: 1 },
      total: 5,
    });
  });

  it('is empty with zero threads and with no threads field at all', () => {
    assert.deepStrictEqual(registerState(manifestWith(), 'space-homing'), { counts: { open: 0, digging: 0, learned: 0, parked: 0 }, total: 0 });
    assert.deepStrictEqual(registerState(manifestWith({}), 'space-homing').total, 0);
  });

  it('throws on every corrupt row shape — the audit\'s invariant', () => {
    const corrupt = [
      [{ a: row('Q?', 'finished', 'seed') }, /unknown state "finished"/],
      [{ a: row('Q?', 'open', 'seed', 'ghost') }, /references missing parent "ghost"/],
      [{ a: row('Q?', 'open', 'seed'), b: row('Q?', 'open', 'seed', 'a'), c: row('Q?', 'open', 'seed', 'b') }, /nests under "b", itself a child/],
      [{ a: row('Q?', 'open', 'seed', null, 'why') }, /carries a note while open/],
      [{ a: { status: 'open', origin: 'seed', parent: null } }, /lacks its question or origin/],
      [{ a: null }, /is not an object/],
    ];
    for (const [threads, pattern] of corrupt) {
      assert.throws(() => registerState(manifestWith(threads), 'space-homing'), pattern);
    }
  });

  it('throws when the research item does not exist', () => {
    assert.throws(() => registerState(manifestWith(), 'ghost'), /no research item "ghost"/);
  });
});

describe('research-threads projection: golden renders', () => {
  it('the design\'s register at the pinned width — questions wrap under their first letter, origins column, note beneath the parked row', () => {
    assert.strictEqual(researchThreads('space-homing', manifestWith(SPACE_HOMING)), [
      'Research Threads — Space Homing (4 threads — 1 digging · 2',
      'learned · 1 parked)',
      '  ├─ ◐ How do Chrome and Rectangle place a      [deep-dive-001]',
      '  │    window at launch?',
      '  ├─ ● Does a Space identify a home alone,      [seed]',
      '  │    or is home a display+Space pair?',
      '  │    └─ ● Which routes place a window on a    [brief]',
      '  │         non-active Space?',
      '  └─ ◌ Cold-login placement                     [conversation]',
      '       ↳ Needs a machine cycle; laboratory candidate',
      '',
    ].join('\n'));
  });

  it('keeps every line within the pinned width — a long question wraps rather than overruns', () => {
    const { TREE_WIDTH } = require('../../skills/workflow-engine/scripts/domain/conventions.cjs');
    for (const l of researchThreads('space-homing', manifestWith(SPACE_HOMING)).split('\n')) {
      assert.ok(l.length <= TREE_WIDTH, `"${l}" (${l.length}) overruns ${TREE_WIDTH}`);
    }
  });

  it('ranks live first — digging, then open — then learned, parked last, insertion order within a rank', () => {
    const m = manifestWith({
      a: row('Alpha?', 'learned', 'seed'),
      b: row('Bravo?', 'parked', 'user', null, 'later'),
      c: row('Charlie?', 'open', 'brief'),
      d: row('Delta?', 'digging', 'deep-dive-001'),
      e: row('Echo?', 'open', 'conversation'),
    });
    assert.deepStrictEqual(rows(researchThreads('space-homing', m)), [
      '  ├─ ◐ Delta?      [deep-dive-001]',
      '  ├─ ○ Charlie?    [brief]',
      '  ├─ ○ Echo?       [conversation]',
      '  ├─ ● Alpha?      [seed]',
      '  └─ ◌ Bravo?      [user]',
      '       ↳ Later',
    ]);
  });

  it('re-ranks children inside their parent by the same rule', () => {
    const m = manifestWith({
      p: row('Parent?', 'open', 'seed'),
      c1: row('One?', 'learned', 'brief', 'p'),
      c2: row('Two?', 'digging', 'brief', 'p'),
      c3: row('Three?', 'parked', 'brief', 'p'),
      c4: row('Four?', 'open', 'brief', 'p'),
    });
    assert.deepStrictEqual(rows(researchThreads('space-homing', m)), [
      '  └─ ○ Parent?        [seed]',
      '       ├─ ◐ Two?      [brief]',
      '       ├─ ○ Four?     [brief]',
      '       ├─ ● One?      [brief]',
      '       └─ ◌ Three?    [brief]',
    ]);
  });

  it('nests a child stored before its parent', () => {
    const m = manifestWith({
      child: row('Child?', 'open', 'brief', 'p'),
      p: row('Parent?', 'open', 'seed'),
    });
    assert.strictEqual(researchThreads('space-homing', m), [
      'Research Threads — Space Homing (2 threads)',
      '  └─ ○ Parent?        [seed]',
      '       └─ ○ Child?    [brief]',
      '',
    ].join('\n'));
  });

  it('spells a parked row\'s note on a ↳ line under the question\'s first letter, the rail intact above a sibling', () => {
    const m = manifestWith({
      a: row('Alpha?', 'parked', 'seed', null, 'needs a machine cycle'),
      b: row('Bravo?', 'parked', 'user'),
    });
    assert.deepStrictEqual(rows(researchThreads('space-homing', m)), [
      '  ├─ ◌ Alpha?    [seed]',
      '  │    ↳ Needs a machine cycle',
      '  └─ ◌ Bravo?    [user]',
    ]);
  });

  it('omits the breakdown when only one category is non-zero', () => {
    const m = manifestWith({ a: row('Alpha?', 'open', 'seed'), b: row('Bravo?', 'open', 'user') });
    assert.strictEqual(researchThreads('space-homing', m), [
      'Research Threads — Space Homing (2 threads)',
      '  ├─ ○ Alpha?    [seed]',
      '  └─ ○ Bravo?    [user]',
      '',
    ].join('\n'));
  });

  it('two categories — breakdown present in rank order, zero categories omitted', () => {
    const m = manifestWith({ a: row('Alpha?', 'parked', 'seed'), b: row('Bravo?', 'open', 'user') });
    assert.strictEqual(researchThreads('space-homing', m).split('\n')[0],
      'Research Threads — Space Homing (2 threads — 1 open · 1 parked)');
  });

  it('single thread — singular header, └─ row, no ┌─', () => {
    assert.strictEqual(researchThreads('space-homing', manifestWith({ a: row('Alpha?', 'open', 'seed') })), [
      'Research Threads — Space Homing (1 thread)',
      '  └─ ○ Alpha?    [seed]',
      '',
    ].join('\n'));
  });

  it('empty register — the header line alone', () => {
    assert.strictEqual(researchThreads('space-homing', manifestWith()), 'Research Threads — Space Homing (0 threads)\n');
    assert.strictEqual(researchThreads('space-homing', manifestWith({})), 'Research Threads — Space Homing (0 threads)\n');
  });

  it('throws on a corrupt register rather than drawing it', () => {
    assert.throws(() => researchThreads('space-homing', manifestWith({ a: row('Q?', 'open', 'seed', 'ghost') })), /references missing parent "ghost"/);
    assert.throws(() => researchThreads('ghost', manifestWith()), /no research item "ghost"/);
  });
});

describe('schema: the thread vocabulary', () => {
  it('exports the status enum', () => {
    assert.deepStrictEqual(VALID_THREAD_STATUSES, ['open', 'digging', 'learned', 'parked']);
  });

  it('isThreadOrigin admits the fixed words, dive ids, and any topic name the map accepts — and nothing else', () => {
    for (const ok of ['seed', 'brief', 'user', 'conversation', 'deep-dive-001', 'deep-dive-001-auth', 'deep-dive-1234-a-b', 'auth-flow', 'x', 'Auth Flow', 'auth_flow', 'v2 ranking']) {
      assert.strictEqual(isThreadOrigin(ok), true, ok);
    }
    for (const bad of ['deep-dive-', 'deep-dive-01', 'deep-dive-abc', 'deep-dive-001-Auth', 'auth/flow', 'auth.flow', 'a\\b', '', 7, null, undefined]) {
      assert.strictEqual(isThreadOrigin(/** @type {any} */ (bad)), false, String(bad));
    }
  });
});

describe('engine CLI: research-threads round-trip', () => {
  let dir;
  beforeEach(() => { dir = setupFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function threads(args) {
    return JSON.parse(execFileSync('node', [ENGINE, 'research-threads', ...args], { cwd: dir, encoding: 'utf8' }).trim());
  }
  function refuses(args) {
    const res = spawnSync('node', [ENGINE, 'research-threads', ...args], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(res.status, 1, `expected a refusal: ${args.join(' ')}`);
    assert.strictEqual(res.stdout, '');
    return JSON.parse(res.stderr.trim());
  }
  function saved() {
    return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'fumi', 'manifest.json'), 'utf8')).phases.research.items['space-homing'].threads;
  }

  it('add → set → reframe → remove, decision-ready JSON each step, manifest persisted', () => {
    createManifest(dir, 'fumi', manifestWith());
    const zero = { counts: { open: 0, digging: 0, learned: 0, parked: 0 }, total: 0 };

    assert.deepStrictEqual(threads(['add', 'fumi', 'space-homing', 'space-identity', '--question', 'Does a Space identify a home alone?', '--origin', 'seed']), {
      ok: true, thread: 'space-identity', question: 'Does a Space identify a home alone?', status: 'open', origin: 'seed', parent: null,
      counts: { ...zero.counts, open: 1 }, total: 1,
    });
    assert.deepStrictEqual(threads(['add', 'fumi', 'space-homing', 'placement-routes', '--question', 'Which routes place a window?', '--origin', 'brief', '--parent', 'space-identity']), {
      ok: true, thread: 'placement-routes', question: 'Which routes place a window?', status: 'open', origin: 'brief', parent: 'space-identity',
      counts: { ...zero.counts, open: 2 }, total: 2,
    });
    assert.deepStrictEqual(threads(['set', 'fumi', 'space-homing', 'space-identity', 'digging']), {
      ok: true, thread: 'space-identity', question: 'Does a Space identify a home alone?', status: 'digging', origin: 'seed', parent: null,
      counts: { ...zero.counts, open: 1, digging: 1 }, total: 2,
    });
    assert.deepStrictEqual(threads(['set', 'fumi', 'space-homing', 'placement-routes', 'parked', '--note', 'needs a machine cycle']), {
      ok: true, thread: 'placement-routes', question: 'Which routes place a window?', status: 'parked', origin: 'brief', parent: 'space-identity', note: 'needs a machine cycle',
      counts: { ...zero.counts, digging: 1, parked: 1 }, total: 2,
    });
    assert.deepStrictEqual(threads(['reframe', 'fumi', 'space-homing', 'space-identity', '--question', 'Is home a display+Space pair?']), {
      ok: true, thread: 'space-identity', question: 'Is home a display+Space pair?', status: 'digging', origin: 'seed', parent: null,
      counts: { ...zero.counts, digging: 1, parked: 1 }, total: 2,
    });
    assert.deepStrictEqual(saved(), {
      'space-identity': row('Is home a display+Space pair?', 'digging', 'seed'),
      'placement-routes': row('Which routes place a window?', 'parked', 'brief', 'space-identity', 'needs a machine cycle'),
    });

    assert.match(refuses(['add', 'fumi', 'space-homing', 'orphan', '--question', 'Q?', '--origin', 'user', '--parent', 'ghost']).error,
      /parent thread "ghost" not found/);
    assert.match(refuses(['remove', 'fumi', 'space-homing', 'space-identity']).error, /"placement-routes" nests under it; pass --into <survivor>/);
    assert.deepStrictEqual(threads(['add', 'fumi', 'space-homing', 'survivor', '--question', 'Where does it all land?', '--origin', 'user']).total, 3);
    assert.deepStrictEqual(threads(['remove', 'fumi', 'space-homing', 'space-identity', '--into', 'survivor']), {
      ok: true, thread: 'space-identity', removed: true, into: 'survivor', counts: { ...zero.counts, open: 1, parked: 1 }, total: 2,
    });
    assert.strictEqual(saved()['placement-routes'].parent, 'survivor', 'the child moved under the survivor');
    assert.deepStrictEqual(threads(['remove', 'fumi', 'space-homing', 'placement-routes']), {
      ok: true, thread: 'placement-routes', removed: true, counts: { ...zero.counts, open: 1 }, total: 1,
    });
    assert.deepStrictEqual(threads(['remove', 'fumi', 'space-homing', 'survivor']), { ok: true, thread: 'survivor', removed: true, ...zero });
    assert.deepStrictEqual(saved(), {});
  });

  it('remove refuses the merge target it cannot honour', () => {
    createManifest(dir, 'fumi', manifestWith({ a: row('Q?', 'open', 'seed'), b: row('Q?', 'open', 'seed'), bc: row('Q?', 'open', 'seed', 'b') }));
    assert.match(refuses(['remove', 'fumi', 'space-homing', 'a', '--into', 'ghost']).error, /thread "ghost" not found/);
    assert.match(refuses(['remove', 'fumi', 'space-homing', 'a', '--into', 'bc']).error, /"bc" is itself a child of "b"/);
    assert.match(refuses(['remove', 'fumi', 'space-homing', 'a', '--into', 'a']).error, /can't merge into itself/);
    assert.deepStrictEqual(Object.keys(saved()), ['a', 'b', 'bc'], 'nothing written');
  });

  it('removes the last threads cleanly', () => {
    createManifest(dir, 'fumi', manifestWith({ 'space-identity': row('Q?', 'digging', 'seed'), 'placement-routes': row('Q?', 'parked', 'brief', 'space-identity', 'needs a machine cycle') }));
    const zero = { counts: { open: 0, digging: 0, learned: 0, parked: 0 }, total: 0 };
    assert.deepStrictEqual(threads(['remove', 'fumi', 'space-homing', 'placement-routes']), {
      ok: true, thread: 'placement-routes', removed: true, counts: { ...zero.counts, digging: 1 }, total: 1,
    });
    assert.deepStrictEqual(threads(['remove', 'fumi', 'space-homing', 'space-identity']), { ok: true, thread: 'space-identity', removed: true, ...zero });
    assert.deepStrictEqual(saved(), {});
  });

  it('set batch: uniform pairs land in one write, decision-ready JSON once', () => {
    createManifest(dir, 'fumi', manifestWith({
      a: row('Q?', 'digging', 'seed'),
      b: row('Q?', 'open', 'brief'),
      c: row('Q?', 'parked', 'user', null, 'why'),
    }));
    assert.deepStrictEqual(threads(['set', 'fumi', 'space-homing', 'a=learned', 'c=open']), {
      ok: true, set: { a: 'learned', c: 'open' }, counts: { open: 2, digging: 0, learned: 1, parked: 0 }, total: 3,
    });
    assert.deepStrictEqual(saved(), {
      a: row('Q?', 'learned', 'seed'),
      b: row('Q?', 'open', 'brief'),
      c: row('Q?', 'open', 'user'),
    });
  });

  it('set batch is atomic — a failing entry means nothing was written', () => {
    createManifest(dir, 'fumi', manifestWith({ a: row('Q?', 'open', 'seed') }));
    const before = fs.readFileSync(path.join(dir, '.workflows', 'fumi', 'manifest.json'), 'utf8');
    assert.match(refuses(['set', 'fumi', 'space-homing', 'a=learned', 'ghost=parked']).error, /thread "ghost" not found/);
    assert.match(refuses(['set', 'fumi', 'space-homing', 'a=done']).error, /unknown thread state "done"/);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'fumi', 'manifest.json'), 'utf8'), before);
  });

  it('set refuses mixing the positional and batch forms, and a note on the batch', () => {
    createManifest(dir, 'fumi', manifestWith({ a: row('Q?', 'open', 'seed'), b: row('Q?', 'open', 'seed') }));
    assert.match(refuses(['set', 'fumi', 'space-homing', 'a', 'b=learned']).error, /never mixed/);
    assert.match(refuses(['set', 'fumi', 'space-homing', 'a=parked', '--note', 'why']).error, /--note is legal with parked alone and takes the positional form/);
    assert.match(refuses(['set', 'fumi', 'space-homing', 'a', 'open', '--note', 'why']).error, /note is legal on a parked thread alone/);
    assert.deepStrictEqual(saved(), { a: row('Q?', 'open', 'seed'), b: row('Q?', 'open', 'seed') });
  });

  it('errors print {ok:false} JSON to stderr and exit 1, manifest untouched', () => {
    createManifest(dir, 'fumi', manifestWith());
    const before = fs.readFileSync(path.join(dir, '.workflows', 'fumi', 'manifest.json'), 'utf8');

    assert.deepStrictEqual(refuses(['set', 'fumi', 'space-homing', 'ghost', 'learned']),
      { ok: false, error: 'thread "ghost" not found under "space-homing"' });
    assert.match(refuses(['add', 'fumi', 'ghost-topic', 'x', '--question', 'Q?', '--origin', 'seed']).error, /no research item "ghost-topic"/);
    assert.match(refuses(['add', 'ghost-unit', 'space-homing', 'x', '--question', 'Q?', '--origin', 'seed']).error, /manifest not found/);
    assert.match(refuses(['add', 'fumi', 'space-homing', 'x', '--question', 'Q?', '--origin', 'deep-dive-x']).error, /thread origin must be/);

    assert.match(refuses(['add', 'fumi', 'space-homing', 'x', '--origin', 'seed']).error, /Usage: engine research-threads add/);
    assert.match(refuses(['add', 'fumi', 'space-homing', 'x', '--question', 'Q?']).error, /Usage: engine research-threads add/);
    assert.match(refuses(['set', 'fumi', 'space-homing', 'x']).error, /Usage: engine research-threads set .*open\|digging\|learned\|parked/);
    assert.match(refuses(['reframe', 'fumi', 'space-homing', 'x']).error, /Usage: engine research-threads reframe/);
    assert.match(refuses(['remove', 'fumi']).error, /Usage: engine research-threads remove/);
    assert.match(refuses(['rename', 'fumi', 'space-homing', 'x']).error, /Usage: engine research-threads <add\|set\|reframe\|remove>/);

    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'fumi', 'manifest.json'), 'utf8'), before);
  });
});

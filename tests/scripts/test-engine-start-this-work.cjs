'use strict';

// ---------------------------------------------------------------------------
// Start this work (ledger-engine/scripts/domain/start-this-work.cjs): the
// authority gate at the work-type commit — `render start-this-work` staging
// Claude's payload and drawing the screen the spec draws, creating nothing
// (8.S16), with no name question (8.S21), staged apart for each
// conversation; `start-this-work yes` creating the unit from the staged copy
// as one transaction, its first log pointing into the product's sessions, an
// epic's points from before written into its own place whichever way it
// started, a type call never touching the product's conversation
// (8.S64), the product's session closed where the work leaves the
// conversation's place there — never at a quick-fix's yes or a type call's,
// nor while another live window holds the product's conversation — and what
// comes next for each type (8.S47, 24.S1, 24.S2, 24.S15);
// and every refusal,
// at the screen and at a yes the project moved under, writing nothing —
// a type it does not create, cross-cutting among them (8.S2, 19.S1), a
// taken or numbered name (8.S57), a one-topic unit beside a waiting roadmap
// idea of its name (8.1.6), and a failure part-way leaving no unit. The
// seeds an inbox item and a roadmap item's note give it, the item left on
// the project manifest and put back by a cancel on its horizon as merged
// since (4.S35, 18.S66). What a created unit holds, whatever door made it, is
// test-engine-workunit-create.cjs's.
//
// Layer: verb. World: discovery's gate suites' (discovery-gates-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const { ok, output, refusedPristine, sectionOf, readManifest, readState, statePath, lastMessage, touched, head, layout, writeState } = require('./engine-harness.cjs');
const { joinedTo } = require('./roadmap-world.cjs');
const { withEnv } = require('./discovery-test-utils.cjs');
const { readPosition } = require('../../skills/ledger-engine/scripts/domain/conversation.cjs');
const { leavePosition } = require('../../skills/ledger-engine/scripts/domain/position.cjs');
const { PRODUCT_LOG, IDEA, BUG, SESSION, useGatesWorld, gatesHelpers, failingWrites, manifestTemp } = require('./discovery-gates-world.cjs');

const dir = useGatesWorld();
const { scratch, payload, screen, answer, run } = gatesHelpers(dir);

const STAGED = layout.cache('product', 'discovery', 'product', `start-this-work-${SESSION.CLAUDE_CODE_SESSION_ID}.json`);
const PAYLOAD = layout.cache('product', 'discovery', 'product', `start-this-work-payload-${SESSION.CLAUDE_CODE_SESSION_ID}.json`);

/** This conversation in the product's conversation, its place there, where it talks before a start. */
const inTheProduct = () => ok(dir(), ['enter', 'discovery', 'product'], { env: SESSION });

/** This conversation as its own live Claude process runs it. */
const LIVE = Object.freeze({ ...SESSION, CLAUDE_PID: String(process.pid) });

/** Another live window, its own Claude process. */
const PEER = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'other-window', CLAUDE_PID: String(process.ppid) });

/** Another live window holding the product's conversation, as its entry beats there. */
const peerInTheProduct = () => ok(dir(), ['presence', 'beat', 'product', 'discovery', 'product'], { env: PEER });

/** The product's conversation's presence rows, by the conversation each is. */
const productRows = () => fs.readdirSync(statePath(dir(), layout.cache('product', 'discovery', 'product'))).filter((name) => name.startsWith('presence')).sort();

/** The product's conversation with no window in it: the world's own entry, made in no conversation, gone. */
const noOneInTheProduct = () => {
  for (const name of productRows()) fs.rmSync(statePath(dir(), layout.cache('product', 'discovery', 'product', name)));
};

/** Fumi, as the spec draws its start: an epic from the product's notes. */
const FUMI = Object.freeze({
  type: 'epic',
  name: 'fumi',
  description: 'A smarter macOS Stickies alternative: notes assigned to specific macOS Spaces (returning to their Space on relaunch), remembering exact screen position, with titles and a full fumi CLI/MCP scripting surface.',
  reason: 'An epic: the note model, Spaces, the note window, the agent surface and selling it each need decisions of their own.',
  shaped_by: [`${PRODUCT_LOG}#notes`],
});

/** An epic's points from before, as the payload gives them and as its own place holds them. */
const POINTS = Object.freeze([
  { id: 'D101', point: 'One gift shape', file: '.product/assets/planning/decisions/decision-log.md' },
  { id: 'B51', point: 'How a pocket pays for itself is open', file: '.product/assets/planning/model/current.md' },
]);
const FROM_BEFORE = layout.fromBefore('fumi');
const HELD = '# From before\n\n- D101: One gift shape (.product/assets/planning/decisions/decision-log.md)\n- B51: How a pocket pays for itself is open (.product/assets/planning/model/current.md)\n';
/** A transcript shared in the product's conversation, as the payload names it and as the epic's own place holds it. */
const TRANSCRIPT = '.product/assets/planning/log/2026-01-04.md';
const SHARED = Object.freeze([{ path: TRANSCRIPT, holds: 'The gifting call with the shop owners', kind: 'reference' }]);
const HELD_FILES = `\n## Shared files\n\n- ${TRANSCRIPT} — The gifting call with the shop owners (reference)\n`;

/** A one-topic unit's payload, its brief drafted. @param {string} type @param {string} name */
function oneTopic(type, name) {
  return { type, name, description: `The ${name} work.`, reason: `A ${type}: one piece of work.`, shaped_by: [`${PRODUCT_LOG}#pricing`], brief: scratch(`# ${name}\n\nWhat discovery heard.\n`) };
}

/** The yes the staged screen's gate leads to, run. @param {unknown} given */
function started(given) {
  screen(['start-this-work'], given);
  return run(answer('start this work', 'y'));
}

/** The stage refused, writing nothing: its error. @param {unknown} given */
function refusedStage(given) {
  return refusedPristine(dir(), ['render', 'start-this-work', '--file', payload(given)], { env: SESSION }).error;
}

describe('start this work, the screen (8.8.2, 8.S16, 8.S21)', () => {
  it('stages the payload and creates nothing; the screen shows the work, its type and the reason, then the one yes and Keep shaping — no name is asked', () => {
    const before = head(dir());
    const out = screen(['start-this-work'], FUMI);
    assert.strictEqual(sectionOf(out, 'DISPLAY: start this work'), [
      'Fumi (epic)',
      'A smarter macOS Stickies alternative: notes assigned to specific',
      'macOS Spaces (returning to their Space on relaunch), remembering',
      'exact screen position, with titles and a full fumi CLI/MCP',
      'scripting surface.',
      '↳ An epic: the note model, Spaces, the note window, the agent',
      '  surface and selling it each need decisions of their own.',
      '',
    ].join('\n'));
    assert.strictEqual(sectionOf(out, 'MENU: start this work'), [
      '· · · · · · · · · · · ·',
      'Your yes creates the epic. We shape its topics next, and you approve the map.',
      '',
      '**`◆ Start this work?`**',
      '',
      '**`y/yes`**        → Start it — create the epic',
      '**Keep shaping** → Tell me what I\'m missing',
      '',
    ].join('\n'));
    assert.deepStrictEqual([head(dir()), fs.existsSync(statePath(dir(), 'fumi')), JSON.parse(readState(dir(), STAGED)).name], [before, false, 'fumi'],
      'nothing is created or committed before the yes; the payload waits in the product\'s cache');
    assert.deepStrictEqual(answer('start this work', 'y'), { kind: 'engine', argv: ['start-this-work', 'yes'] });
  });

  it('lists what an epic\'s yes carries from before beneath the reason: each point by its id, and each shared file with what it holds and how it is read', () => {
    writeState(dir(), TRANSCRIPT, '# The gifting call\n');
    const out = screen(['start-this-work'], { ...FUMI, from_before: POINTS, shared_files: SHARED });
    assert.strictEqual(sectionOf(out, 'DISPLAY: start this work').split('\n').slice(7).join('\n'), [
      '',
      'FROM BEFORE (2, into the epic)',
      '  ├─ D101: One gift shape',
      '  └─ B51: How a pocket pays for itself is open',
      '',
      'SHARED FILES (1, into the epic)',
      '  └─ .product/assets/planning/log/2026-01-04.md — The gifting',
      '     call with the shop owners (reference)',
      '',
    ].join('\n'));
  });

  it('read again without --file, draws what is staged; with nothing staged, refuses', () => {
    assert.match(refusedPristine(dir(), ['render', 'start-this-work'], { env: SESSION }).error,
      /^render start-this-work: nothing is staged — render start-this-work --file <payload\.json> stages the work$/);
    screen(['start-this-work'], oneTopic('bugfix', 'login-loop'));
    assert.match(sectionOf(output(dir(), ['render', 'start-this-work'], { env: SESSION }), 'DISPLAY: start this work'), /^Login Loop \(bugfix\)$/m);
  });
});

describe('start this work, the yes (8.8.1, 8.14.3, 8.14.11)', () => {
  it('creates the epic in one commit — its seeds out of the inbox, its roadmap item joined, its first log pointing into the product\'s session, that session closed — and carries on into its discovery with no handoff (8.S16, 8.S64, 24.S15)', () => {
    inTheProduct();
    const res = started({ ...FUMI, seeds: [statePath(dir(), IDEA)], roadmap: ['note-sync'] });
    assert.deepStrictEqual(res, {
      ok: true,
      work_unit: 'fumi',
      work_type: 'epic',
      seeds: [{ path: statePath(dir(), 'fumi/seeds/2026-06-01-smart-retry.md'), source: 'inbox:idea' }],
      roadmap: ['note-sync'],
      session_log: statePath(dir(), layout.session('fumi', '001')),
      product_session_closed: '001',
      committed: head(dir()).slice(0, res.committed.length),
      next: { kind: 'engine', argv: ['enter', 'discovery', 'fumi', '--move'] },
    });
    assert.strictEqual(readState(dir(), layout.session('fumi', '001')),
      'Shaped by: [.product/sessions/session-001.md#notes](../../.product/sessions/session-001.md#notes)\n');
    assert.strictEqual(readManifest(dir(), 'fumi').phases.discovery.active_session, '001', 'the epic\'s first session is open for its shaping');
    const project = readManifest(dir(), '.');
    assert.deepStrictEqual([project.work_units.fumi, project.roadmap.items['note-sync'].pulled_to, project.product_session], [{ work_type: 'epic' }, { work_unit: 'fumi' }, undefined]);
    assert.strictEqual(lastMessage(dir()), 'discovery(fumi): start this work (epic)');
    assert.deepStrictEqual(touched(statePath(dir()), 'HEAD'), [
      `A\t${layout.session('fumi', '001')}`,
      `A\t${layout.manifest('fumi')}`,
      'A\tfumi/seeds/2026-06-01-smart-retry.md',
      `D\t${IDEA}`,
      `M\t${PRODUCT_LOG}`,
      'M\tmanifest.json',
    ]);
    assert.ok(!fs.existsSync(statePath(dir(), STAGED)), 'the staged payload goes');
  });

  it('8.2.9: a type call\'s yes, the conversation in no place, takes no place in the product\'s sessions, leaves the product\'s open session to the conversation talking there, and enters the epic\'s discovery, having no place to move from', () => {
    const { shaped_by: _shaped, ...called } = FUMI;
    const res = started(called);
    assert.deepStrictEqual([res.product_session_closed, readManifest(dir(), '.').product_session, readState(dir(), layout.session('fumi', '001')), res.next],
      [null, '001', '', { kind: 'engine', argv: ['enter', 'discovery', 'fumi'] }]);
    assert.ok(!touched(statePath(dir()), 'HEAD').some((line) => line.includes('.product/')), 'the product\'s sessions are not the yes\'s to commit');
  });

  it('writes an epic\'s points from before and the shared files bearing on it once into its own place, and lands the picture thinned from its draft, all in the yes\'s one commit', () => {
    writeState(dir(), TRANSCRIPT, '# The gifting call\n');
    writeState(dir(), layout.productPicture, '# Where the product stands\n\n- One gift shape — from before, D101\n');
    inTheProduct();
    const thinned = scratch('# Where the product stands\n\n- Gifting — started, in fumi.\n');
    started({ ...FUMI, from_before: POINTS, shared_files: SHARED, picture: thinned });
    assert.deepStrictEqual([readState(dir(), FROM_BEFORE), readState(dir(), layout.productPicture), fs.existsSync(thinned)], [`${HELD}${HELD_FILES}`, '# Where the product stands\n\n- Gifting — started, in fumi.\n', false]);
    const committed = touched(statePath(dir()), 'HEAD').map((line) => line.split('\t')[1]);
    assert.deepStrictEqual([FROM_BEFORE, layout.productPicture].filter((rel) => !committed.includes(rel)), [], 'both in the one commit');
  });

  it('refuses a thinned picture once the picture is written after its draft — at the stage, and, staged, at the yes, writing nothing — so a draft never lands over what the picture gained since', () => {
    const live = statePath(dir(), layout.productPicture);
    writeState(dir(), layout.productPicture, '# Where the product stands\n');
    inTheProduct();
    const thinned = scratch('# Where the product stands\n\n- Gifting — started, in fumi.\n');
    /** `file` written `minutes` from now, as its time says. @param {string} file @param {number} minutes */
    const writtenIn = (file, minutes) => fs.utimesSync(file, new Date(Date.now() + minutes * 60_000), new Date(Date.now() + minutes * 60_000));
    const newer = 'the picture was rewritten after its thinned draft — draft the thinning again from the picture as it stands, then stage again';

    writtenIn(live, 1);
    const atStage = refusedStage({ ...FUMI, picture: thinned });
    writtenIn(thinned, 2);
    screen(['start-this-work'], { ...FUMI, picture: thinned });
    writtenIn(live, 3);

    assert.deepStrictEqual([atStage, refusedPristine(dir(), ['start-this-work', 'yes'], { env: SESSION }).error], [`render start-this-work: ${newer}`, `start-this-work yes: ${newer}`]);
  });

  it('a type call starting an epic beside another window holding the product\'s conversation open writes its points from before into the epic, that window\'s log untouched', () => {
    peerInTheProduct();
    const log = readState(dir(), PRODUCT_LOG);
    const { shaped_by: _shaped, ...called } = FUMI;
    started({ ...called, from_before: POINTS });
    assert.deepStrictEqual([readState(dir(), FROM_BEFORE), readState(dir(), PRODUCT_LOG), readManifest(dir(), '.').product_session], [HELD, log, '001']);
    assert.ok(!touched(statePath(dir()), 'HEAD').some((line) => line.includes('.product/')), 'nothing of the product\'s conversation is the yes\'s');
  });

  it('8.14.11: a quick-fix started in the product\'s conversation never ends its session; a feature started there ends it as the work leaves the conversation', () => {
    inTheProduct();
    const { brief: _brief, ...quick } = oneTopic('quick-fix', 'typo-fix');
    const fix = started(quick);
    const leftOpen = readManifest(dir(), '.').product_session;
    const feature = started(oneTopic('feature', 'saved-filters'));
    assert.deepStrictEqual([fix.product_session_closed, leftOpen, feature.product_session_closed, readManifest(dir(), '.').product_session], [null, '001', '001', undefined]);
  });

  it('8.14.11: a feature started in the product\'s conversation leaves its session open while another live window is in that conversation, whichever entered last', () => {
    noOneInTheProduct();
    inTheProduct();
    peerInTheProduct();
    const joinedFirst = started(oneTopic('feature', 'saved-filters')).product_session_closed;
    ok(dir(), ['enter', 'discovery', 'product'], { env: LIVE });
    const joinedLast = started(oneTopic('feature', 'pinned-notes'));
    assert.deepStrictEqual([joinedFirst, joinedLast.product_session_closed, readManifest(dir(), '.').product_session, joinedLast.next.kind], [null, null, '001', 'handoff']);
  });

  it('a bare start leaves the product\'s conversation, its presence row gone with its position', () => {
    noOneInTheProduct();
    ok(dir(), ['enter', 'discovery', 'product'], { env: LIVE });
    const before = productRows();
    ok(dir(), ['boot'], { env: LIVE });
    assert.deepStrictEqual([before, productRows()], [[`presence-${SESSION.CLAUDE_CODE_SESSION_ID}`], []]);
  });

  it('8.14.11: ending the product\'s session where another live window is still in it leaves it open, this conversation out of it; the last one out ends it', () => {
    noOneInTheProduct();
    ok(dir(), ['enter', 'discovery', 'product'], { env: LIVE });
    ok(dir(), ['enter', 'discovery', 'product'], { env: PEER });
    const first = ok(dir(), ['discovery-session', 'close', 'product', '-m', 'discovery(product): talk so far'], { env: PEER });
    const firstOut = [first.still_open, lastMessage(dir()), readManifest(dir(), '.').product_session, productRows()];
    const last = ok(dir(), ['discovery-session', 'close', 'product', '-m', 'discovery(product): end session 001'], { env: LIVE });
    assert.deepStrictEqual([firstOut, last.still_open, lastMessage(dir()), readManifest(dir(), '.').product_session, productRows()], [
      [true, 'discovery(product): talk so far — the session stays open for another conversation still in it', '001', [`presence-${SESSION.CLAUDE_CODE_SESSION_ID}`]],
      undefined, 'discovery(product): end session 001', undefined, [],
    ]);
  });

  it('8.14.11: a window in a quick-fix started from the product\'s talk stays in that conversation through the fix, so another window\'s feature leaves the session open; its cancel from inside it puts the window back in that conversation, so the other window\'s next feature leaves it open too', () => {
    noOneInTheProduct();
    ok(dir(), ['enter', 'discovery', 'product'], { env: PEER });
    ok(dir(), ['enter', 'discovery', 'product'], { env: LIVE });
    const { brief: _brief, ...quick } = oneTopic('quick-fix', 'typo-fix');
    started(quick);
    const fixing = productRows();
    output(dir(), ['render', 'start-this-work', '--file', payload(oneTopic('feature', 'saved-filters'))], { env: PEER });
    const beside = ok(dir(), ['start-this-work', 'yes'], { env: PEER }).product_session_closed;
    ok(dir(), ['enter', 'discovery', 'product'], { env: PEER });
    ok(dir(), ['enter', 'implementation', 'typo-fix'], { env: LIVE });
    ok(dir(), ['workunit', 'cancel', 'typo-fix'], { env: LIVE });
    const cancelled = productRows();
    output(dir(), ['render', 'start-this-work', '--file', payload(oneTopic('feature', 'pinned-notes'))], { env: PEER });
    const last = ok(dir(), ['start-this-work', 'yes'], { env: PEER }).product_session_closed;
    const both = ['presence-other-window', `presence-${SESSION.CLAUDE_CODE_SESSION_ID}`].sort();
    assert.deepStrictEqual([fixing, beside, cancelled, last, readManifest(dir(), '.').product_session], [both, null, both, null, '001']);
  });

  it('8.14.11: closes no session this conversation is not in — not one it ended, whose end dropped its place there, nor the next, which another window opened', () => {
    inTheProduct();
    ok(dir(), ['discovery-session', 'close', 'product', '-m', 'discovery(product): end session 001'], { env: SESSION });
    const placed = withEnv(SESSION, () => readPosition(SESSION.CLAUDE_CODE_SESSION_ID));
    ok(dir(), ['enter', 'discovery', 'product'], { env: { CLAUDE_CODE_SESSION_ID: 'other-window' } });
    const res = started(oneTopic('feature', 'saved-filters'));
    assert.deepStrictEqual([placed, res.product_session_closed, readManifest(dir(), '.').product_session], [null, null, '002']);
  });

  it('removes this conversation\'s payload with its staged copy', () => {
    const file = writeState(dir(), PAYLOAD, JSON.stringify(oneTopic('feature', 'saved-filters')));
    output(dir(), ['render', 'start-this-work', '--file', file], { env: SESSION });
    run(answer('start this work', 'y'));
    assert.deepStrictEqual([fs.existsSync(file), fs.existsSync(statePath(dir(), STAGED))], [false, false]);
  });

  it('stages each conversation\'s start apart: a start staged in another window is never the one this yes lands', () => {
    screen(['start-this-work'], FUMI);
    output(dir(), ['render', 'start-this-work', '--file', payload(oneTopic('bugfix', 'login-loop'))], { env: { CLAUDE_CODE_SESSION_ID: 'other-window' } });
    assert.strictEqual(run(answer('start this work', 'y')).work_unit, 'fumi');
    assert.ok(!fs.existsSync(statePath(dir(), 'login-loop')));
  });

  it('lands a feature\'s one topic with its brief, the draft consumed, and hands off into its discussion — carried by the mod where it runs, inline where it does not (8.7.7, 8.S47, 24.S1, 24.S2)', () => {
    const given = oneTopic('feature', 'saved-filters');
    const res = started(given);
    assert.deepStrictEqual([res.brief, readState(dir(), layout.brief('saved-filters', 'saved-filters')), fs.existsSync(given.brief)],
      [statePath(dir(), layout.brief('saved-filters', 'saved-filters')), '# saved-filters\n\nWhat discovery heard.\n', false]);
    assert.deepStrictEqual(readManifest(dir(), 'saved-filters').phases, {}, 'a feature has no discovery session to carry on');
    assert.deepStrictEqual(res.next, { kind: 'handoff', skill: 'ledger-discussion-process', args: ['feature', 'saved-filters'] });
    const hand = (/** @type {Record<string, string>} */ env) => sectionOf(output(dir(), ['handoff', res.next.skill, ...res.next.args], { env }), 'DATA');
    assert.match(hand({ ...SESSION, LEDGER_HANDOFF: '1' }), /^handoff: mod$/m);
    assert.match(hand(SESSION), /^handoff: inline$/m);
  });

  it('hands a bugfix into its investigation, and a quick-fix, which takes no brief, carries on into its fixes in this conversation (24.1.2, 24.1.3)', () => {
    assert.deepStrictEqual(started(oneTopic('bugfix', 'login-loop')).next, { kind: 'handoff', skill: 'ledger-investigation-process', args: ['bugfix', 'login-loop'] });
    const { brief, ...quick } = oneTopic('quick-fix', 'typo-fix');
    const res = started({ ...quick, seeds: [statePath(dir(), BUG)] });
    assert.deepStrictEqual([res.next, res.brief, fs.existsSync(statePath(dir(), layout.topic('typo-fix', 'typo-fix')))],
      [{ kind: 'invoke', skill: 'ledger-quick-fix-process', args: ['quick-fix', 'typo-fix'] }, undefined, false]);
  });

  it('lands an inbox item and a roadmap item\'s note as seeds, the manifest recording each source; a cancel puts the item back on its horizon as merged since (4.S35)', () => {
    ok(dir(), ['roadmap', 'add-batch', '--file', payload([{ name: 'retry-on-drop', horizon: 'next', summary: 'Retry when the line drops', note: `.ledger/${IDEA}` }])]);
    const stood = readManifest(dir(), '.').roadmap.items['retry-on-drop'];
    const res = started({ ...oneTopic('feature', 'checkout-retry'), seeds: [statePath(dir(), BUG)], roadmap: ['retry-on-drop'] });
    assert.deepStrictEqual(res.seeds, [
      { path: statePath(dir(), 'checkout-retry/seeds/2026-06-02-login-loop.md'), source: 'inbox:bug' },
      { path: statePath(dir(), 'checkout-retry/seeds/2026-06-01-smart-retry.md'), source: 'roadmap:retry-on-drop' },
    ]);
    assert.deepStrictEqual(readManifest(dir(), 'checkout-retry').seeds.map(({ seeded_at: at, ...seed }) => seed), [
      { path: 'seeds/2026-06-02-login-loop.md', source: 'inbox:bug' },
      { path: 'seeds/2026-06-01-smart-retry.md', source: 'roadmap:retry-on-drop' },
    ]);
    assert.deepStrictEqual([stood.horizon, stood.sources], ['next', ['.product/notes/2026-06-01--smart-retry.md']]);
    assert.deepStrictEqual(fs.readdirSync(statePath(dir(), 'checkout-retry/seeds')).sort(), ['2026-06-01-smart-retry.md', '2026-06-02-login-loop.md']);
    assert.strictEqual(readState(dir(), stood.sources[0]), '# Smart Retry\n', 'the note stays where its item names it');
    ok(dir(), ['roadmap', 'horizon', 'merge', 'next', '--into', 'later']);
    ok(dir(), ['workunit', 'cancel', 'checkout-retry']);
    assert.deepStrictEqual(readManifest(dir(), '.').roadmap.items['retry-on-drop'], { ...stood, horizon: 'later' }, 'the item is back, on the horizon its own was merged into');
  });

  it('takes two items waiting on "later" off the roadmap as the work\'s seeds, and the work\'s cancel shows both on "later" again (18.S66)', () => {
    ok(dir(), ['roadmap', 'add-batch', '--file', payload([
      { name: 'smart-retry', horizon: 'later', summary: 'Retry when the line drops', note: `.ledger/${IDEA}` },
      { name: 'login-loop', horizon: 'later', summary: 'Sign-in loops', note: `.ledger/${BUG}` },
    ])]);
    const waitingOnLater = () => ok(dir(), ['roadmap', 'state']).items.filter((i) => i.horizon === 'later' && i.state === 'waiting').map((i) => i.name);
    assert.deepStrictEqual(waitingOnLater(), ['lifetime-tier', 'smart-retry', 'login-loop']);

    started({ ...FUMI, roadmap: ['smart-retry', 'login-loop'] });

    assert.deepStrictEqual(waitingOnLater(), ['lifetime-tier'], 'neither waits on the roadmap');
    assert.deepStrictEqual(readManifest(dir(), 'fumi').seeds.map(({ seeded_at: at, ...seed }) => seed), [
      { path: 'seeds/2026-06-01-smart-retry.md', source: 'roadmap:smart-retry' },
      { path: 'seeds/2026-06-02-login-loop.md', source: 'roadmap:login-loop' },
    ]);
    ok(dir(), ['workunit', 'cancel', 'fumi']);
    assert.deepStrictEqual(waitingOnLater(), ['lifetime-tier', 'smart-retry', 'login-loop']);
  });

  it('points two units shaped in one session at their own sections of the same log (8.S64)', () => {
    started({ ...oneTopic('feature', 'prototype'), shaped_by: [`${PRODUCT_LOG}#notes`] });
    started({ ...oneTopic('feature', 'version-one'), shaped_by: [`${PRODUCT_LOG}#pricing`, `${PRODUCT_LOG}#notes`] });
    assert.deepStrictEqual([readState(dir(), layout.session('prototype', '001')), readState(dir(), layout.session('version-one', '001'))], [
      'Shaped by: [.product/sessions/session-001.md#notes](../../.product/sessions/session-001.md#notes)\n',
      'Shaped by: [.product/sessions/session-001.md#pricing](../../.product/sessions/session-001.md#pricing)\nShaped by: [.product/sessions/session-001.md#notes](../../.product/sessions/session-001.md#notes)\n',
    ]);
  });
});

describe('start this work, refused (8.2.4, 8.8.18)', () => {
  it('refuses cross-cutting as no type: discovery calls only the four (8.S2, 19.S1)', () => {
    assert.strictEqual(refusedStage({ ...FUMI, type: 'cross-cutting' }), 'render start-this-work: the type is one of feature, epic, bugfix, quick-fix — got "cross-cutting"');
  });

  it('refuses a taken name, and a taken name numbered — a more specific one passes, never a number (8.S57)', () => {
    assert.strictEqual(refusedStage({ ...FUMI, name: 'atlas' }), 'render start-this-work: a work unit is named "atlas" already — derive a more specific name from the work, never a number');
    assert.strictEqual(refusedStage({ ...FUMI, name: 'atlas-2' }), 'render start-this-work: "atlas-2" numbers the taken name "atlas" — derive a more specific name from the work, never a number');
    assert.match(screen(['start-this-work'], { ...FUMI, name: 'atlas-offline' }), /^Atlas Offline \(epic\)$/m);
  });

  it('refuses shaped_by naming no place in the product\'s sessions, or, in the product\'s conversation, none at all', () => {
    inTheProduct();
    assert.match(refusedStage({ ...FUMI, shaped_by: [] }), /^render start-this-work: shaped_by names at least one place in \.product\/sessions\/ — /);
    assert.match(refusedStage({ ...FUMI, shaped_by: ['atlas/discovery/session-001.md'] }), /^render start-this-work: shaped_by: "atlas\/discovery\/session-001\.md" is no place in the product's sessions — /);
    assert.strictEqual(refusedStage({ ...FUMI, shaped_by: ['.product/sessions/session-009.md#x'] }), 'render start-this-work: shaped_by: .product/sessions/session-009.md#x names no log on disk');
  });

  it('stages a type call\'s work with no shaped_by in a conversation whose talk the product\'s open log names, its place there left as a boot on the person\'s words leaves it', () => {
    inTheProduct();
    withEnv(SESSION, () => leavePosition(SESSION.CLAUDE_CODE_SESSION_ID));
    const { shaped_by: _shaped, ...called } = FUMI;
    assert.match(screen(['start-this-work'], called), /^Fumi \(epic\)$/m);
  });

  it('refuses shared files for any type but an epic, and one off disk, outside an asset home, of no kind it knows, or named twice; and a thinned picture from a type call', () => {
    writeState(dir(), TRANSCRIPT, '# The gifting call\n');
    assert.strictEqual(refusedStage({ ...oneTopic('feature', 'saved-filters'), shared_files: SHARED }), 'render start-this-work: shared_files is an epic\'s — a feature\'s brief carries them: drop shared_files');
    assert.strictEqual(refusedStage({ ...FUMI, shared_files: [{ ...SHARED[0], path: '.product/assets/gone.md' }] }), 'render start-this-work: shared_files 1: .product/assets/gone.md is no shared file on disk — a path from the state root, below an assets folder or a spike');
    assert.strictEqual(refusedStage({ ...FUMI, shared_files: [{ ...SHARED[0], path: PRODUCT_LOG }] }), `render start-this-work: shared_files 1: ${PRODUCT_LOG} is no shared file on disk — a path from the state root, below an assets folder or a spike`);
    assert.strictEqual(refusedStage({ ...FUMI, shared_files: [{ ...SHARED[0], kind: 'skim' }] }), 'render start-this-work: shared_files 1\'s kind is "reference" or "to read" — got "skim"');
    assert.strictEqual(refusedStage({ ...FUMI, shared_files: [SHARED[0], SHARED[0]] }), `render start-this-work: shared_files names ${TRANSCRIPT} twice`);
    const { shaped_by: _shaped, ...called } = FUMI;
    assert.strictEqual(refusedStage({ ...called, picture: scratch('# Thinned\n') }), 'render start-this-work: a type call only reads the picture — drop picture: the next return to the product\'s conversation brings it up to date');
  });

  it('refuses points from before for any type but an epic, and a point that is not one line apiece, an id written with a space, or an id twice', () => {
    assert.strictEqual(refusedStage({ ...oneTopic('feature', 'saved-filters'), from_before: POINTS }), 'render start-this-work: from_before is an epic\'s — a feature\'s brief carries them: drop from_before');
    const { brief: _brief, ...quick } = oneTopic('quick-fix', 'typo-fix');
    assert.strictEqual(refusedStage({ ...quick, from_before: POINTS }), 'render start-this-work: from_before is an epic\'s — a quick-fix\'s stay in the picture: drop from_before');
    assert.strictEqual(refusedStage({ ...FUMI, from_before: [{ ...POINTS[0], point: 'One\ngift' }] }), 'render start-this-work: from_before 1\'s point is one line of text');
    assert.strictEqual(refusedStage({ ...FUMI, from_before: [{ ...POINTS[0], id: 'D 101' }] }), 'render start-this-work: from_before 1\'s id is the record\'s own, as it writes it — no space or colon: got "D 101"');
    assert.strictEqual(refusedStage({ ...FUMI, from_before: [POINTS[0], POINTS[0]] }), 'render start-this-work: from_before names D101 twice');
    assert.strictEqual(refusedStage({ ...FUMI, from_before: [{ id: 'D101' }] }), 'render start-this-work: from_before 1 must be {id, point, file}');
  });

  it('refuses a one-topic unit without its brief, and a brief for an epic or a quick-fix', () => {
    const { brief, ...unbriefed } = oneTopic('feature', 'saved-filters');
    assert.strictEqual(refusedStage(unbriefed), 'render start-this-work: a feature\'s one topic lands with its brief — brief names its draft');
    assert.strictEqual(refusedStage({ ...FUMI, brief }), 'render start-this-work: an epic\'s topics get their briefs as the map is approved — drop the brief');
    assert.strictEqual(refusedStage({ ...unbriefed, type: 'quick-fix', brief }), 'render start-this-work: a quick-fix has no topic to brief — drop the brief');
  });

  it('refuses a roadmap item missing, named twice, joined to work already, or archived', () => {
    assert.strictEqual(refusedStage({ ...FUMI, roadmap: ['no-such'] }), 'render start-this-work: roadmap: the roadmap has no item "no-such" to seed the work');
    assert.strictEqual(refusedStage({ ...FUMI, roadmap: ['note-sync', 'note-sync'] }), 'render start-this-work: roadmap: roadmap item "note-sync" is named twice');
    joinedTo(dir(), 'atlas', 'note-sync');
    assert.strictEqual(refusedStage({ ...FUMI, roadmap: ['note-sync'] }), 'render start-this-work: roadmap: roadmap item "note-sync" is joined to work unit "atlas" already — only a waiting item seeds new work');
    ok(dir(), ['roadmap', 'archive', 'lifetime-tier']);
    assert.strictEqual(refusedStage({ ...FUMI, roadmap: ['lifetime-tier'] }),
      'render start-this-work: roadmap: roadmap item "lifetime-tier" is archived — only a waiting item seeds new work; bring it back onto a horizon (engine roadmap move lifetime-tier --horizon <h>) first');
  });

  it('refuses a feature or a bugfix beside a waiting roadmap idea of its name, unless it starts from the item (8.1.6)', () => {
    for (const type of ['feature', 'bugfix']) {
      assert.strictEqual(refusedStage(oneTopic(type, 'share-links')),
        'render start-this-work: "share-links" would stand beside the waiting roadmap item of its name — take it in with "roadmap": ["share-links"], or name the topic apart');
    }
    assert.match(screen(['start-this-work'], { ...oneTopic('quick-fix', 'share-links'), brief: undefined }), /^Share Links \(quick-fix\)$/m, 'a quick-fix has no topic to stand as a twin');
    assert.match(screen(['start-this-work'], oneTopic('bugfix', 'export-timeout')), /^Export Timeout \(bugfix\)$/m, 'a waiting bug never becomes a topic, so is no twin');
    started({ ...oneTopic('feature', 'share-links'), roadmap: ['share-links'] });
    assert.deepStrictEqual(readManifest(dir(), '.').roadmap.items['share-links'].pulled_to, { work_unit: 'share-links' });
  });

  it('checks the staged payload again at the yes: a name taken since refuses, writing nothing', () => {
    screen(['start-this-work'], FUMI);
    ok(dir(), ['workunit', 'create', 'fumi', 'feature', '--description', 'Taken meanwhile', '--session-log-file', writeState(dir(), layout.cache('fumi', 'log.md'), '# Fumi\n')]);
    assert.strictEqual(refusedPristine(dir(), ['start-this-work', 'yes'], { env: SESSION }).error,
      'start-this-work yes: a work unit is named "fumi" already — derive a more specific name from the work, never a number');
  });

  it('leaves no unit where the yes fails part-way: the seed back in the inbox, the brief\'s draft kept, nothing committed', () => {
    const given = { ...oneTopic('feature', 'saved-filters'), seeds: [statePath(dir(), IDEA)] };
    screen(['start-this-work'], given);
    const refused = failingWrites(manifestTemp(statePath(dir())), () => refusedPristine(dir(), ['start-this-work', 'yes'], { env: SESSION }));
    assert.strictEqual(refused.error, 'start-this-work yes: disk full');
    assert.ok(fs.existsSync(given.brief), 'the draft is kept, so the yes can run again');
  });
});

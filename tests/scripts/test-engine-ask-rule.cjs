'use strict';

// ---------------------------------------------------------------------------
// The ask rule (leeway-engine/scripts/domain/ask-rule.cjs), its settings
// (domain/trust-settings.cjs), and the decision point's `ruled`
// (domain/decision-point.cjs), what it decides once switched on: the order
// it decides in — discovery, no label, a question Claude could find out,
// what always asks, Claude's one-answer calls, the kind's count — the
// threshold a question takes, the reason in the person's words, and §16's
// worked scenarios held to their figures; the person's threshold and its
// raise mid-build read from the settings file; and the rule given the trust
// log's counts for the project as of the time.
//
// Layer: unit. World: the counts are the rule's input, from events built in
// memory a day before the frozen clock (trust-world.cjs, `history`); the
// settings' and `ruled`'s tests keep the log and the settings file in a
// config folder of their own, a project a plain folder whose state root is
// pinned.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { FROZEN_MS, statePath } = require('./engine-harness.cjs');
const { idOf, PROJECT_ID, MODEL, lines, useTrustWorld, history } = require('./trust-world.cjs');
const { labelled } = require('./labels.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { rule } = require(path.join(SCRIPTS, 'domain/ask-rule.cjs'));
const { DEFAULTS, trustSettings } = require(path.join(SCRIPTS, 'domain/trust-settings.cjs'));
const { ruled } = require(path.join(SCRIPTS, 'domain/decision-point.cjs'));
const { countsFrom } = require(path.join(SCRIPTS, 'domain/trust-counts.cjs'));
const { kindOf } = require(path.join(SCRIPTS, 'domain/labeller.cjs'));

/** @typedef {import('../../skills/leeway-engine/scripts/domain/ask-rule.cjs').Context} Context */
/** @typedef {ReturnType<typeof history>} History */

const ELSEWHERE = idOf('Aircon');
const MINT = { id: PROJECT_ID, name: 'Mint' };
const TOPIC = Object.freeze({ unit: 'mint', phase: 'discussion', topic: 'release-flow' });
const BEHAVIOUR = labelled('behaviour');
const HARD = labelled('behaviour', { hardToUndo: true });

/**
 * The context of a call on the topic in Mint, its counts those `h` holds
 * for Mint on the current model as of the frozen clock, at the defaults, no
 * care entry, no mark: `more` over it.
 * @param {History} h @param {Partial<Context>} [more]
 * @returns {Context}
 */
function contextOf(h, more = {}) {
  return {
    label: BEHAVIOUR, place: TOPIC, blocks_build: false, replaced_by: null, always: null, checked: false,
    project: MINT, counts: countsFrom(h.events, { project: PROJECT_ID, model: MODEL, now: FROZEN_MS }), settings: DEFAULTS, care: [],
    ...more,
  };
}

/**
 * The rule's answer on a call sorted `sort` with `h`'s counts, `more` over
 * the context.
 * @param {History} h @param {Partial<Context>} [more] @param {'one'|'several'} [sort]
 */
const ruling = (h, more, sort = 'several') => rule({ sort }, contextOf(h, more));

/** Its decision alone. @param {History} h @param {Partial<Context>} [more] @param {'one'|'several'} [sort] */
const decision = (h, more, sort) => ruling(h, more, sort).decision;

/** A history whose behaviour kind holds `clean` clean answers, then `then`'s. @param {number} clean @param {(h: History) => void} [then] */
function behaviourAfter(clean, then = () => {}) {
  const h = history();
  h.agree(clean);
  then(h);
  return h;
}

/** A loss landing on behaviour, then `more` clean answers. @param {number} [more] @returns {(h: History) => void} */
const lossThen = (more = 0) => (h) => {
  h.depart('loss');
  h.agree(more);
};

const QUIET = behaviourAfter(30);

describe('the order the rule decides in (16.7.3, 16.19.8, 16.3.1, 16.5, 16.4.10)', () => {
  it('16.S24: in discovery, a call asks however quiet its kind, where nothing is decided alone; and where in the cone the work is enters nowhere — the same counts decide alike at a topic, at a unit\'s level and in the build', () => {
    const places = [{ ...TOPIC, phase: 'discovery' }, TOPIC, { unit: 'pay', phase: 'specification', topic: null }, { unit: 'pay', phase: 'implementation', topic: null }];

    assert.deepStrictEqual(places.map((place) => ruling(QUIET, { place })), [
      { decision: 'ask', reason: 'Nothing is decided in discovery, so it comes to you.' },
      ...places.slice(1).map(() => ({ decision: 'proceed', reason: 'It\'s behaviour, and on behaviour in Mint my calls miss less often than you allow: 9%, under your 20%.' })),
    ]);
  });

  it('16.S68, the label\'s half: with no label — the labeller\'s call failed, or no login served it — a call asks, however quiet its kind, a one-answer call among them (16.19.8)', () => {
    const asked = { decision: 'ask', reason: 'I couldn\'t tell what kind of question this is, so it comes to you.' };

    assert.deepStrictEqual([ruling(QUIET, { label: null }), ruling(QUIET, { label: null }, 'one')], [asked, asked]);
  });

  it('a question Claude could find the answer to is sent to check, before anything else would ask it — danger among them — and raised again once sent, asks; one Claude could not find out follows the rule though sent before (16.3.1, 16.11.7)', () => {
    const checkable = labelled('behaviour', { yes: ['checkable'] });
    const dangerous = labelled('process', { yes: ['checkable', 'danger'] });
    const check = { decision: 'check', reason: 'You can find this out: check it — read the code or the record, or run something — and raise it again only if checking can\'t settle it.' };

    assert.deepStrictEqual([
      ruling(QUIET, { label: checkable }), ruling(QUIET, { label: dangerous }), ruling(QUIET, { label: checkable, checked: true }), decision(QUIET, { checked: true }),
    ], [check, check, { decision: 'ask', reason: 'Checking couldn\'t settle it, so it comes to you.' }, 'proceed']);
  });

  it('16.S17: a danger question asks however many clean answers its kind holds', () => {
    const h = history();
    h.agree(40, 'danger');

    assert.deepStrictEqual(ruling(h, { label: labelled('danger') }), { decision: 'ask', reason: 'An answer here could lose data or weaken security, so it always comes to you.' });
  });

  it('16.S62: a question about the session whose option could lose data composes as process and still asks, danger read from the label\'s ninth answer — a one-answer call too, the always-asks outranking the sort (16.3.7)', () => {
    const h = history();
    h.agree(40, 'process');
    const label = labelled('process', { yes: ['danger'] });

    assert.deepStrictEqual([kindOf(label), decision(h, { label }), decision(h, { label }, 'one'), decision(h, { label: labelled('process') })], ['process', 'ask', 'ask', 'proceed']);
  });

  it('a care entry on this project and the question\'s kind always asks (16.5.2); one on another project, or on another kind, leaves the counts to decide (16.5.3)', () => {
    const h = history();
    h.agree(30, 'look');
    const look = labelled('look');

    assert.deepStrictEqual([
      ruling(h, { label: look, care: [{ project: PROJECT_ID, kind: 'look' }] }),
      decision(h, { label: look, care: [{ project: ELSEWHERE, kind: 'look' }, { project: PROJECT_ID, kind: 'words' }] }),
    ], [{ decision: 'ask', reason: 'It\'s look, and you\'ve asked that look always comes to you in Mint.' }, 'proceed']);
  });

  it('replacing an entry the person decided asks whatever the counts (16.5.7); replacing one Claude decided, one the person handed over or the builder\'s by "don\'t care", or one carried over, follows the counts', () => {
    const yours = { decision: 'ask', reason: 'You decided this yourself, so changing it always comes to you.' };

    assert.deepStrictEqual(
      [ruling(QUIET, { replaced_by: 'person' }), ruling(QUIET, { replaced_by: 'person' }, 'one'), ...['claude', 'your-call', 'dont-care', 'carried'].map((by) => decision(QUIET, { replaced_by: /** @type {any} */ (by) }))],
      [yours, yours, 'proceed', 'proceed', 'proceed', 'proceed'],
    );
  });

  it('a mark Claude gives a question asks, however quiet its kind: a design problem (19.4.22) or testing against a live server (19.4.20)', () => {
    assert.deepStrictEqual([ruling(QUIET, { always: 'design-problem' }), ruling(QUIET, { always: 'live-server' }, 'one')], [
      { decision: 'ask', reason: 'The root cause is a design problem, so it always comes to you.' },
      { decision: 'ask', reason: 'It means testing against a live server, so it always comes to you.' },
    ]);
  });

  it('16.S71: Claude\'s one-answer calls proceed with no overrule however few they are — none at all among them (16.S50) — and once overrules lift that count\'s bound past the threshold the next asks, though still sorted one; sorted several, the same call follows its quiet kind', () => {
    const fresh = history();
    const h = history();
    h.agree(30);
    for (let i = 0; i < 3; i += 1) h.call('one');
    const before = ruling(h, {}, 'one');
    h.reverse(h.call('one'));

    assert.deepStrictEqual([ruling(fresh, {}, 'one'), before, ruling(h, {}, 'one'), decision(h)], [
      { decision: 'proceed', reason: 'It has one sensible answer, and you haven\'t overruled my one-answer calls in Mint.' },
      { decision: 'proceed', reason: 'It has one sensible answer, and you haven\'t overruled my one-answer calls in Mint.' },
      { decision: 'ask', reason: 'It has one sensible answer, but you\'ve overruled my one-answer calls in Mint more often than you allow: 66%, over your 20%.' },
      'proceed',
    ]);
  });

  it('a one-answer call whose count holds overrules and is quiet proceeds, saying how they stand: under the threshold (64 calls, 1 overruled: 6.99%), or quiet again, not yet a quarter above it (33 calls, 4 overruled: 22.49%)', () => {
    const under = history();
    for (let i = 0; i < 64; i += 1) under.call('one');
    under.reverse(under.call('one'));
    const between = history();
    for (let i = 0; i < 3; i += 1) between.reverse(between.call('one'));
    for (let i = 0; i < 33; i += 1) between.call('one');
    between.reverse(between.call('one'));

    assert.deepStrictEqual([ruling(under, {}, 'one'), ruling(between, {}, 'one')], [
      { decision: 'proceed', reason: 'It has one sensible answer, and you\'ve overruled my one-answer calls in Mint less often than you allow: 7%, under your 20%.' },
      { decision: 'proceed', reason: 'It has one sensible answer, and you haven\'t overruled my one-answer calls in Mint often enough to bring them to you: 22%.' },
    ]);
  });

  it('16.S2: the same counts, settings and call decide alike every time', () => {
    const h = behaviourAfter(13, lossThen());
    const context = contextOf(h);

    assert.deepStrictEqual(rule({ sort: 'several' }, context), rule({ sort: 'several' }, contextOf(h)));
    assert.deepStrictEqual(rule({ sort: 'several' }, context), { decision: 'ask', reason: 'It\'s behaviour, and on behaviour in Mint my calls still miss more often than you allow: 28%, over your 20%.' });
  });

  it('16.S3: Claude\'s stated confidence changes nothing — a call sure of itself and one unsure, over the same counts, decide alike', () => {
    const sure = { sort: /** @type {const} */ ('several'), why: 'I am certain: every app does it this way.' };
    const unsure = { sort: /** @type {const} */ ('several'), why: 'A guess.' };

    for (const h of [behaviourAfter(12), behaviourAfter(13)]) assert.deepStrictEqual(rule(sure, contextOf(h)), rule(unsure, contextOf(h)));
  });
});

describe('a kind\'s count at the threshold the question takes (16.4, 16.6)', () => {
  it('16.S11: with nothing from other projects and every answer at full weight, 12 clean answers ask (20.58%) and 13 do not (19.26%); with none, it asks, saying none are answered', () => {
    assert.deepStrictEqual([ruling(history()), ruling(behaviourAfter(12)), ruling(behaviourAfter(13))], [
      { decision: 'ask', reason: 'It\'s behaviour, and you haven\'t answered any behaviour questions in Mint yet, so it comes to you.' },
      { decision: 'ask', reason: 'It\'s behaviour, and on behaviour in Mint my calls still miss more often than you allow: 21%, over your 20%.' },
      { decision: 'proceed', reason: 'It\'s behaviour, and on behaviour in Mint my calls miss less often than you allow: 19%, under your 20%.' },
    ]);
  });

  it('16.S12\'s figure in the person\'s words: a loss, then 19 clean answers — one loss among 20 — asks at 21% (20.67%), over the 20% default', () => {
    assert.deepStrictEqual(ruling(behaviourAfter(0, lossThen(19))), { decision: 'ask', reason: 'It\'s behaviour, and on behaviour in Mint my calls still miss more often than you allow: 21%, over your 20%.' });
  });

  it('16.S14: a question hard to undo, its kind holding 18 clean answers (14.59%, under 15%), asks at the 20% default, its threshold halved to 10%; the same question not hard to undo proceeds (16.4.8)', () => {
    const h = behaviourAfter(18);

    assert.deepStrictEqual([ruling(h, { label: HARD }), decision(h)], [
      { decision: 'ask', reason: 'It\'s behaviour, and on behaviour in Mint my calls still miss more often than you allow: 15%, over the 10% for what\'s hard to undo.' },
      'proceed',
    ]);
  });

  it('16.S15: a contract question hard to undo asks with 27 clean answers (10.15%) and not with 28 (9.81%) (16.4.9)', () => {
    const contract = labelled('contract', { hardToUndo: true });
    /** @param {number} clean */
    const after = (clean) => {
      const h = history();
      h.agree(clean, 'contract');
      return ruling(h, { label: contract });
    };

    assert.deepStrictEqual([after(27), after(28)], [
      { decision: 'ask', reason: 'It\'s contract, and on contract in Mint my calls still miss more often than you allow: 10.1%, over the 10% for what\'s hard to undo.' },
      { decision: 'proceed', reason: 'It\'s contract, and on contract in Mint my calls miss less often than you allow: 9.8%, under the 10% for what\'s hard to undo.' },
    ]);
  });

  it('16.S16: a question blocking build work takes the threshold used elsewhere until the person picks a raise mid-build — 12 clean answers ask and 13 do not, blocking or not; picked at 30%, 8 clean answers (28.31%) let a blocking question proceed where one not blocking asks, and one hard to undo takes half the raise (16.4.7)', () => {
    const raised = { ...DEFAULTS, build_threshold: 0.3 };
    const eight = behaviourAfter(8);

    assert.deepStrictEqual([
      [behaviourAfter(12), behaviourAfter(13)].flatMap((h) => [decision(h, { blocks_build: true }), decision(h)]),
      ruling(eight, { blocks_build: true, settings: raised }), decision(eight, { settings: raised }),
      ruling(eight, { blocks_build: true, settings: raised, label: HARD }),
    ], [
      ['ask', 'ask', 'proceed', 'proceed'],
      { decision: 'proceed', reason: 'It\'s behaviour, and on behaviour in Mint my calls miss less often than you allow: 28%, under your 30% mid-build.' }, 'ask',
      { decision: 'ask', reason: 'It\'s behaviour, and on behaviour in Mint my calls still miss more often than you allow: 28%, over the 15% for what\'s hard to undo mid-build.' },
    ]);
  });

  it('16.S20: quiet behaviour at 20% holding 13 clean answers asks once a loss lands (27.94%), over 25% — so too a loss at 15 clean answers (25.01%) — and goes quiet again only once it holds 20 clean answers beside the loss: asking at 19 (20.67%), quiet at 20 (19.81%) (16.6.3)', () => {
    assert.deepStrictEqual([
      decision(behaviourAfter(13)), decision(behaviourAfter(13, lossThen())), ruling(behaviourAfter(15, lossThen())),
      decision(behaviourAfter(13, lossThen(6))), decision(behaviourAfter(13, lossThen(7))),
    ], [
      'proceed', 'ask', { decision: 'ask', reason: 'It\'s behaviour, and on behaviour in Mint my calls still miss more often than you allow: 25%, over your 20%.' },
      'ask', 'proceed',
    ]);
  });

  it('16.S21: quiet behaviour at 20% holding 16 clean answers stays quiet as a loss lands, its bound 23.77%, under 25%: the call proceeds, saying it has not risen over 25% since going under 20%', () => {
    assert.deepStrictEqual(ruling(behaviourAfter(16, lossThen())), {
      decision: 'proceed', reason: 'It\'s behaviour, and on behaviour in Mint my calls went under your 20% and haven\'t risen over 25% since: 24%.',
    });
  });

  it('16.S22: a kind gone quiet for questions hard to undo, under 10%, asks again for one as a loss lands at 34 clean answers (12.51%, over 12.5%); at 35 (12.19%) the question proceeds', () => {
    assert.deepStrictEqual([ruling(behaviourAfter(34, lossThen()), { label: HARD }), ruling(behaviourAfter(35, lossThen()), { label: HARD })], [
      { decision: 'ask', reason: 'It\'s behaviour, and on behaviour in Mint my calls still miss more often than you allow: 13%, over the 10% for what\'s hard to undo.' },
      { decision: 'proceed', reason: 'It\'s behaviour, and on behaviour in Mint my calls went under the 10% for what\'s hard to undo and haven\'t risen over 12.5% since: 12%.' },
    ]);
  });

  it('16.S47: more than 10 clean answers in the person\'s other projects and no loss start a new project at 24% (23.84%), and it asks; after two clean answers there it still asks (20.58%), after three it is quiet (19.26%) and proceeds (16.14.4)', () => {
    /** @param {number} here */
    const after = (here) => {
      const h = history();
      h.agree(15, 'behaviour', { project: ELSEWHERE });
      h.agree(here);
      return decision(h);
    };

    assert.deepStrictEqual([0, 2, 3].map(after), ['ask', 'ask', 'proceed']);
  });

  it('16.S48: look clean in the person\'s other projects, and quiet in Mint at three clean answers of its own, asks in Mint once a real loss there lifts its merged bound over 25% (27.94%)', () => {
    const h = history();
    h.agree(20, 'look', { project: ELSEWHERE });
    h.agree(3, 'look');
    const quiet = decision(h, { label: labelled('look') });
    h.depart('loss', 'look');

    assert.deepStrictEqual([quiet, ruling(h, { label: labelled('look') })], ['proceed', {
      decision: 'ask', reason: 'It\'s look, and on look in Mint my calls still miss more often than you allow: 28%, over your 20%.',
    }]);
  });
});

describe('the person\'s settings (16.4.6, 16.4.7, 16.13.7)', () => {
  const { folder } = useTrustWorld('ask-rule-settings-');
  const settingsFile = () => path.join(folder(), 'config', 'config.json');
  /** @param {string} text */
  const settingsHold = (text) => {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), text);
  };

  it('are the release\'s defaults — 20%, and no raise mid-build — with no settings file, or one holding the knowledge base\'s settings alone', () => {
    const none = trustSettings();
    settingsHold(JSON.stringify({ knowledge: { provider: 'stub' } }));

    assert.deepStrictEqual([none, trustSettings()], [{ threshold: 0.2, build_threshold: null }, { threshold: 0.2, build_threshold: null }]);
  });

  it('reads the threshold and its raise mid-build from the settings file\'s trust key, beside the knowledge base\'s, passing over a key no setting names', () => {
    settingsHold(JSON.stringify({ knowledge: { provider: 'stub' }, trust: { threshold: 0.25, build_threshold: 0.3, later: true } }));

    assert.deepStrictEqual(trustSettings(), { threshold: 0.25, build_threshold: 0.3 });
  });

  it('refuses, naming the file, a settings file that does not read as a JSON object, a trust key that is none, and a setting holding what it cannot', () => {
    const refusals = ['{"torn', '[]', '{"trust": 0.2}', '{"trust": {"threshold": 20}}', '{"trust": {"build_threshold": 0}}'].map((text) => {
      settingsHold(text);
      try {
        trustSettings();
        return 'read';
      } catch (err) {
        return /** @type {Error} */ (err).message.replace(settingsFile(), '{file}');
      }
    });

    assert.deepStrictEqual(refusals.map((message) => message.replace(/ — .*:/, ' — …:')), [
      'the settings file {file} does not read — …: the ask rule\'s settings are under its trust key',
      'the settings file {file} holds no JSON object — the ask rule\'s settings are under its trust key',
      'the settings file {file}\'s trust key is not an object of the ask rule\'s settings',
      'the settings file {file}\'s trust.threshold is not a fraction above 0 and below 1: 20',
      'the settings file {file}\'s trust.build_threshold is not null or a fraction above 0 and below 1: 0',
    ]);
  });
});

describe('the rule as the decision point gives it, once switched on (decision-point.cjs `ruled`)', () => {
  const { folder, logPath, project } = useTrustWorld('ask-rule-ruled-');

  it('decides over the trust log\'s counts for the project and the session\'s model as of the time it is given, and the person\'s threshold from the settings file: 13 clean answers proceed at 20% and ask at 15%, ask for a model no line holds, which takes them at half, and 12, counted as of a moment after the 12th, ask; the same inputs decide alike (16.S2, 16.S46)', () => {
    const dir = project('mint');
    const h = history();
    h.agree(12);
    const twelfth = h.now();
    h.agree(1);
    fs.mkdirSync(path.dirname(logPath()), { recursive: true });
    fs.writeFileSync(logPath(), lines(...h.events));
    const call = /** @type {any} */ ({ sort: 'several' });
    const at = (/** @type {number} */ now) => ({
      label: BEHAVIOUR, place: TOPIC, blocks_build: false, replaced_by: null, always: null, checked: false, project: { root: statePath(dir), name: 'Mint' }, model: MODEL, now,
    });
    const decided = [ruled(call, at(FROZEN_MS)).decision, ruled(call, { ...at(FROZEN_MS), model: 'claude-sonnet-5' }).decision, ruled(call, at(twelfth + 500)).decision];
    fs.writeFileSync(path.join(folder(), 'config', 'config.json'), JSON.stringify({ trust: { threshold: 0.15 } }));

    assert.deepStrictEqual([...decided, ruled(call, at(FROZEN_MS)), ruled(call, at(FROZEN_MS))], ['proceed', 'ask', 'ask', ...Array(2).fill({
      decision: 'ask', reason: 'It\'s behaviour, and on behaviour in Mint my calls still miss more often than you allow: 19%, over your 15%.',
    })]);
  });
});

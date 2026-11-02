'use strict';

// ---------------------------------------------------------------------------
// The ready to build suites' world and helpers
// (test-engine-ready-to-build-screen.cjs, test-engine-ready-to-build-close.cjs,
// test-engine-ready-to-build-yes.cjs): an epic, `payments`, its topics
// `cards` and `refunds` decided through the ledger's verbs, two calls of
// Claude's made at the spec, one labelled and one not, and a call of
// Claude's on `cards` that is not the spec's; its sweep taken, its spec
// written from the writer's brief and landed citing them, the land's review
// pass clean, and the spec cut into two phases — `landed`; and the same with ready to build's checklist worked
// and closed — `closed`. Each built once per process and copied for each
// test, its trust log in a config folder of the test's own.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { beforeEach, afterEach } = require('node:test');

const { ok, output, refusedPristine, sectionOf, layout, writeState, commitAll, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest, useTempFolder } = require('./discovery-test-utils.cjs');
const { MADE } = require('./ledger-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { trustLogPath } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));

const UNIT = 'payments';
const SESSION = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'ready-to-build-session' });
const PERSON = Object.freeze({ by: 'person', who_moved_whom: 'none' });
const SPEC_AT = `${UNIT}.specification`;
const READ_BACK = layout.cache(UNIT, 'specification', 'read-back.json');
/** The config folder the hermetic env pinned, put back after each test. */
const PINNED = /** @type {string} */ (process.env.LEEWAY_CONFIG_DIR);

/** Each entry's short id by name, filled as the world is built. @type {Record<string, string>} */
const made = {};

/** One ledger write: its short id. @param {string} dir @param {string} verb @param {string} at @param {string[]} flags @param {Record<string, unknown>} content */
function write(dir, verb, at, flags, content) {
  return ok(dir, ['ledger', verb, at, ...flags], { env: SESSION, stdin: JSON.stringify(content) }).id;
}

/** A question asked at `at` and answered as `answer` says: the answer's short id. @param {string} dir @param {string} at @param {string} text @param {Record<string, unknown>} answer */
function answered(dir, at, text, answer) {
  return write(dir, 'decide', at, ['--answers', write(dir, 'ask', at, [], { ...MADE, text })], { why: 'Because.', ...answer });
}

/** A discussion topic, mapped. @param {number} order */
const mapped = (order) => ({ order, summary: `Topic ${order}`, source: 'discovery' });

/** The epic, its two topics' discussions as `status` gives them. @param {string} dir @param {string} status */
function payments(dir, status) {
  createManifest(dir, UNIT, {
    work_type: 'epic',
    phases: {
      discovery: { items: { cards: mapped(1), refunds: mapped(2) } },
      discussion: { items: { cards: { status }, refunds: { status } } },
    },
  });
}

/** The spec, its statements citing the entries the world made. */
const spec = () => [
  '# Payments', '',
  '## 1. Cards', '', '### 1.1 The form', '',
  `1.1.1 Visa and Mastercard are taken. [${made.taken}]`, '',
  `1.1.2 An unknown brand is refused. [${made.brand}]`, '',
  '## 1-S. Scenarios for §1', '',
  '1.S1 Given a form, when a Visa is offered, then it is taken. (1.1.1)', '',
  '1.S2 Given a form, when the brand is unknown, then it is refused. (1.1.2)', '',
  '## 2. Refunds', '', '### 2.1 Whole', '',
  `2.1.1 A refund goes back to the card. [${made.refund}]`, '',
  `2.1.2 A refund is sent within a day. [${made.day}]`, '',
  '## 2-S. Scenarios for §2', '',
  '2.S1 Given a charge, when it is refunded, then the card is credited. (2.1.1, 2.1.2)', '',
].join('\n');

const CARDS = Object.freeze({ name: 'Cards', goal: 'Cards are taken as decided.', scenarios: ['1.S1', '1.S2'], sections: ['1'], relies_on: [] });
const REFUNDS = Object.freeze({ name: 'Refunds', goal: 'Refunds reach the card.', scenarios: ['2.S1'], sections: ['2.1'], relies_on: [1] });

/** The cut `phases` written by the verb from a file in the cache. @param {string} dir @param {object[]} phases */
function cut(dir, phases) {
  ok(dir, ['cut', UNIT, '--file', writeState(dir, layout.cache(UNIT, 'specification', 'cut.json'), JSON.stringify({ phases }))]);
}

/** A review pass on the spec's last land dispatched, briefed, and its clean report taken in and acknowledged. @param {string} dir */
function reviewPass(dir) {
  const pass = ok(dir, ['agent', 'dispatch', UNIT, 'specification', UNIT, '--kind', 'spec-review'], { env: { CLAUDE_PID: undefined } });
  ok(dir, ['brief', 'spec-reviewer', UNIT, '--agent', pass.id], { env: SESSION });
  fs.writeFileSync(pass.file, '# Spec Review\n\n## Findings\n\nNone identified.\n');
  ok(dir, ['agent', 'scan', UNIT, 'specification', UNIT]);
  ok(dir, ['agent', 'ack', UNIT, 'specification', UNIT, pass.id, '--clean']);
}

/** The spec landed, and the land reviewed clean. @param {string} dir */
function landReviewed(dir) {
  ok(dir, ['spec', 'land', UNIT]);
  reviewPass(dir);
}

/** The spec written from the writer's brief as `text`, landed and reviewed clean. @param {string} dir @param {string} text */
function written(dir, text) {
  ok(dir, ['brief', 'spec-writer', UNIT], { env: SESSION });
  writeState(dir, layout.unit(UNIT, 'spec.md'), text);
  landReviewed(dir);
}

/** The epic built through the verbs: its topics decided, the calls at the spec made, its sweep taken, its spec landed, reviewed and cut. @param {string} dir */
function buildLanded(dir) {
  payments(dir, 'in-progress');
  commitAll(dir, 'init');
  made.taken = answered(dir, `${UNIT}.discussion.cards`, 'Which cards are taken?', { ...PERSON, text: 'Visa and Mastercard.' });
  answered(dir, `${UNIT}.discussion.cards`, 'Is the brand shown?', { ...MADE, text: 'As a logo.' });
  made.refund = answered(dir, `${UNIT}.discussion.refunds`, 'Where does a refund go?', { ...PERSON, text: 'Back to the card.' });
  payments(dir, 'completed');
  writeState(dir, layout.unit(UNIT, 'sweep-taken.json'), JSON.stringify({ candidates: [], builder_calls: [] }));
  commitAll(dir, 'topics settled, the sweep taken');
  made.brand = answered(dir, SPEC_AT, 'What of an unknown brand?', { ...MADE, text: 'Refused.', kind: 'behaviour' });
  made.day = answered(dir, SPEC_AT, 'How soon is a refund sent?', { ...MADE, text: 'Within a day.' });
  written(dir, spec());
  cut(dir, [CARDS, REFUNDS]);
}

/** Claude's items of ready to build's checklist. */
const CLAUDES = Object.freeze(['replacements-checked', 'invariants-checked']);

/** Claude's items of ready to build's checklist marked done, and the checklist closed: the close's answer. @param {string} at */
function closeReady(at) {
  for (const item of CLAUDES) ok(at, ['checklist', 'done', 'ready-to-build', UNIT, item]);
  return ok(at, ['checklist', 'close', 'ready-to-build', UNIT]);
}

const landed = fixtureFrom('ready-to-build-', buildLanded);

const closed = fixtureFrom('ready-to-build-closed-', (at) => {
  buildLanded(at);
  closeReady(at);
});

/**
 * Each test of the calling file on a copy of `world`, removed after it, its
 * trust log in a config folder of its own.
 * @param {() => string} world
 * @returns {() => string} the running test's project
 */
function useReadyWorld(world) {
  const config = useTempFolder('ready-to-build-config-');
  let dir = '';
  beforeEach(() => {
    dir = world();
    process.env.LEEWAY_CONFIG_DIR = config();
  });
  afterEach(() => {
    process.env.LEEWAY_CONFIG_DIR = PINNED;
    cleanupFixture(dir);
  });
  return () => dir;
}

/**
 * The ready to build suites' helpers, over the project `dir()` names.
 * @param {() => string} dir
 */
function readyHelpers(dir) {
  return {
    /** The screen, `flags` given. @param {string[]} [flags] */
    screen: (flags = []) => output(dir(), ['render', 'ready-to-build', UNIT, ...flags], { env: SESSION }),
    /** The keys of the gate's rows, in order. @param {string} out */
    rowKeys: (out) => [...sectionOf(out, 'MENU: ready to build').matchAll(/^\*\*`?([a-zA-Z]+(?:\/[a-z]+)?)`?\*\*/gm)].map((m) => m[1]),
    /** What a row of the gate shown leads to. @param {string} name @param {string} key */
    pick: (name, key) => ok(dir(), ['gate', name, '--pick', key], { env: SESSION }).next,
    /** The refusal's error, nothing written or committed. @param {string[]} args */
    refused: (args) => refusedPristine(dir(), args, { env: SESSION }).error,
    /** The yes, `flags` after the unit. @param {string[]} flags */
    yes: (flags) => ok(dir(), ['ready-to-build', 'yes', UNIT, ...flags], { env: SESSION }),
    /** The trust log's events of `type`. @param {string} type */
    events(type) {
      const log = trustLogPath();
      return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line)).filter((event) => event.type === type) : [];
    },
    /** The review page built and its publishing recorded, which opens it. */
    publish() {
      ok(dir(), ['spec', 'page', UNIT]);
      ok(dir(), ['spec', 'published', UNIT, 'https://claude.ai/public/artifacts/0123']);
    },
    /** Marks Claude read back from the page, written where the gate's rows take them: its path. @param {Record<string, object>} marks */
    readBack: (marks) => writeState(dir(), READ_BACK, JSON.stringify(marks)),
  };
}

/** A comment the person left on a line, waiting for Claude. @param {string} id @param {string} text */
const commented = (id, text) => ({ [id]: { s: 'comment', t: { p1000: { by: 'p', x: text } } } });

module.exports = {
  UNIT, SESSION, SPEC_AT, READ_BACK, CARDS, REFUNDS, write, answered, cut, reviewPass, landReviewed, written, closeReady, landed, closed, useReadyWorld, readyHelpers, commented,
};

'use strict';

// ---------------------------------------------------------------------------
// The ledger at discovery's places (leeway-engine/scripts/domain/
// ledger-write.cjs, the fold in domain/ledger-fold.cjs and the read in
// domain/ledger-read.cjs): the product's place, `product.discovery`, where
// what is found of the product as a whole lands with no work unit for it
// (8.12.9); discovery, there or at a unit, taking findings alone and none
// product-wide, every other write refused in one line, appending nothing
// (8.3.4, 8.9.6); and what discovery found, which `ledger product` shows
// apart from the product record — the product's findings, given a unit the
// unit's own, and given a topic what discovery left on it (9.3.12); a
// finding of the product's whose ground a topic replaced waiting on that
// topic (5.6.12). A raise at a discovery place is test-engine-raise.cjs's;
// a record the migration carried at a topic's discovery place,
// test-migration-079.cjs's.
//
// Layer: verb. World: the ledger suites' unit (ledger-world.cjs) with its
// state worktree from the fixture library, a feature beside it.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const {
  UNIT, MADE, NOTE, WRITE_PHASES, ledgerWorld, ledgerWriteHelpers, ledgerReadHelpers,
} = require('./ledger-world.cjs');

/** @type {string} */
let dir;

beforeEach(() => {
  dir = ledgerWorld('ledger-discovery-', WRITE_PHASES);
});

afterEach(() => {
  cleanupFixture(dir);
});

const { write, assertLast, assertAnswered, refused, ask, decide, change } = ledgerWriteHelpers(() => dir);
const { find, read, current } = ledgerReadHelpers(() => dir);

const PRODUCT = 'product.discovery';

/** What the product researcher lands: a finding read from the code. */
const READ = Object.freeze({ ...MADE, text: 'Sessions are signed JWTs, checked in one middleware.', how: 'read Auth/Session.swift and Auth/Middleware.swift', known: 'read' });

/** The one line every write but a finding is refused with in discovery, in the words of `verb`. @param {string} verb */
const undecided = (verb) => new RegExp(`^ledger ${verb}: nothing is decided in discovery — carry it as input$`);

describe('the product\'s place (8.12.9)', () => {
  it('takes what is found of the product as a whole with no work unit for it: tagged with the product, discovery and no topic, the line written field by field and committed', () => {
    const res = write('find', PRODUCT, [], READ);

    const { known, ...said } = READ;
    const id = assertLast('found', { unit: 'product', phase: 'discovery', topic: null }, {
      ...said, relies_on: [], product_wide: false, known, command: null, result: null, cites: [],
    });
    assertAnswered(res, id);
  });

  it('is the product\'s one place: another phase, or a topic, is refused, writing nothing', () => {
    for (const address of ['product.discussion', 'product.specification', 'product.discovery.auth']) {
      refused('find', address, [], READ, new RegExp(`^ledger find: "${address.replaceAll('.', '\\.')}" is no place of the product's — what is found of the product as a whole goes at product\\.discovery$`));
    }
  });
});

describe('discovery takes findings alone (8.3.4, 8.9.6)', () => {
  it('8.S23, 8.S24: nothing that decides is written there — ask, decide, replace, hold, move and merge each refused in one line at the product\'s place, a decision at a unit\'s level and on a topic of its map, appending nothing', () => {
    const question = ask().id;
    const decision = decide(question).id;
    const finding = write('find', PRODUCT, ['--relies-on', decision], READ).id;
    const replacement = change(decision).id;

    refused('ask', PRODUCT, [], { ...MADE, text: 'Should sessions last a week?' }, undecided('ask'));
    refused('decide', PRODUCT, ['--answers', question], { ...MADE, text: 'Sessions last a week.', why: 'The person said so.' }, undecided('decide'));
    refused('replace', PRODUCT, ['--replaces', finding, '--reason', 'was-wrong'], { ...READ, drops: ['one middleware'], text: 'Sessions are signed JWTs.' }, undecided('replace'));
    refused('hold', PRODUCT, ['--entry', finding, '--after', replacement], MADE, undecided('hold'));
    refused('move', PRODUCT, ['--question', question, '--to', 'space-homing'], MADE, undecided('move'));
    refused('merge', PRODUCT, ['--question', question, '--into', decision], MADE, undecided('merge'));
    for (const address of [`${UNIT}.discovery`, `${UNIT}.discovery.note-window`]) {
      refused('decide', address, ['--answers', question], { ...MADE, text: 'A panel.', why: 'Furniture.' }, undecided('decide'));
    }
  });

  it('8.S23: a finding there is never product-wide — a line for the product record is decided in the first topic it bears on', () => {
    for (const address of [PRODUCT, `${UNIT}.discovery`]) {
      refused('find', address, [], { ...READ, product_wide: true },
        /^ledger find: nothing found in discovery is product-wide — a line for the product record is decided in the first topic it bears on$/);
    }
  });
});

describe('what discovery found (9.3.12)', () => {
  it('ledger product shows the product\'s findings apart from the product record, given a unit the unit\'s own at its level, and given a topic too what discovery left on it — never another topic\'s, another unit\'s or a later phase\'s', () => {
    createManifest(dir, 'mint', { work_type: 'feature', phases: { discussion: { items: { mint: { status: 'in-progress' } } } } });
    const product = write('find', PRODUCT, [], READ).id;
    const unitLevel = find(`${UNIT}.discovery`, 'Notes are kept in Core Data.', [], { known: 'read' });
    const spiked = find(`${UNIT}.discovery.note-window`, 'A spike floated a panel.');
    find(`${UNIT}.discovery.space-homing`, 'A spike pinned a note to its Space.');
    find('mint.discovery', 'Mint has no accounts.', [], { known: 'read' });
    find(`${UNIT}.specification`, 'The spec covers macOS 14 and later.', [], { known: 'documented' });
    find(NOTE, 'A panel opens in 4 ms.');
    const wide = find(NOTE, 'Notes sync through iCloud.', [], { product_wide: true });

    assert.deepStrictEqual(read('product'), { ok: true, findings: [current(wide)], decisions: [], discovery: [current(product)] });
    assert.deepStrictEqual(read('product', UNIT), { ok: true, findings: [current(wide)], decisions: [], discovery: [current(product), current(unitLevel)] });
    assert.deepStrictEqual(read('product', UNIT, 'note-window').discovery, [current(product), current(unitLevel), current(spiked)]);
  });

  it('a finding of the product\'s a topic replaces shows replaced where it stands, the topic\'s replacement over it', () => {
    const old = write('find', PRODUCT, [], READ).id;

    const replacement = write('replace', NOTE, ['--replaces', old, '--reason', 'was-wrong'], { ...READ, drops: ['one middleware'], text: 'Sessions are signed JWTs, checked per route.' }).id;

    assert.deepStrictEqual(read('product').discovery, [current(replacement, [old])]);
  });

  it('a finding of the product\'s relying on one a topic replaces waits on that topic, where no work is under way at the product\'s place: listed there, and held there (5.6.12)', () => {
    const rests = write('find', PRODUCT, [], READ).id;
    const relying = write('find', PRODUCT, ['--relies-on', rests], { ...READ, text: 'Logout revokes nothing, since sessions are signed JWTs.' }).id;
    const replacement = write('replace', NOTE, ['--replaces', rests, '--reason', 'was-wrong'], { ...READ, drops: ['signed JWTs'], text: 'Sessions are rows on the server.' }).id;

    const waiting = read('affected', UNIT, 'note-window');
    assert.deepStrictEqual([waiting.waiting, waiting.affected.map((/** @type {{id: string, waits: (string|null)[]}} */ { id, waits }) => [id, waits])], [['note-window'], [[relying, ['note-window']]]]);

    write('hold', NOTE, ['--entry', relying, '--after', replacement], MADE);
    assert.deepStrictEqual(read('affected', UNIT, 'note-window').affected, []);
  });
});

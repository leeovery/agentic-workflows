'use strict';

// ---------------------------------------------------------------------------
// The map's verbs (leeway-engine/scripts/domain/discovery-map.cjs): `engine
// topic add|add-batch|edit|rename|remove|order|brief`, each doing what it was
// asked, committing it, and answering its JSON and then its one-line report,
// with no confirm (8.8.6, 8.8.7); a topic's brief installed from Claude's
// draft at add and rewritten only before its topic starts (8.7.6); the
// names a topic may take (8.8.18) and the ones struck from the map (8.10.11);
// the roadmap item a topic takes in, and gives back at its removal (8.1.6,
// 18.8.20); a started topic renamed by its title (8.8.17); a removal's
// waiting mail sent to the inbox (8.8.16); and `discovery-map`, the verbs'
// alias until discovery's rewrite, its dead-end verbs gone (8.6.6). The race
// between a removal and a ledger write is test-engine-ledger-write.cjs's;
// a send to a removed topic, test-engine-topic-mail.cjs's.
//
// Layer: verb. World: a project with its state worktree, built once and
// copied, holding the epic `payments`, a topic at each lifecycle on its map —
// one parked by a message, its brief and mail waiting in its folder — a name
// struck from it, and a roadmap holding an idea and a bug.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const {
  ok, okSections, refusedPristine, fixtureFrom, commitAll, cleanupFixture, head, lastMessage, touched, withFrozenClock, FROZEN_AT,
} = require('./engine-harness.cjs');
const { createManifest, readManifest, readState, writeState, statePath, layout } = require('./discovery-test-utils.cjs');
const { SESSION, MADE } = require('./ledger-world.cjs');

const UNIT = 'payments';
const TODAY = FROZEN_AT.slice(0, 10);

const ITEMS = Object.freeze({
  'fresh-topic': { source: 'discovery', summary: 'Fresh', order: 1 },
  'discussing-topic': { source: 'discovery', summary: 'Discussing', order: 2 },
  'decided-topic': { source: 'discovery', summary: 'Decided', order: 3 },
  'cancelled-topic': { source: 'discovery', summary: 'Cancelled', cancelled: true, previous_order: 4 },
  'postponed-topic': { source: 'discovery', summary: 'Postponed', postponed: true, previous_order: 5 },
  'mailed-topic': { source: 'message:discussing-topic', summary: 'Mailed', order: 4 },
});

const MESSAGE = '### A word on refunds\nFrom Discussing Topic · 1 Jan\n\nRefunds settle nightly.\n';

const world = fixtureFrom('topic-map-', (dir) => {
  createManifest(dir, UNIT, {
    work_type: 'epic',
    phases: {
      discovery: { items: structuredClone(ITEMS), dismissed: ['dismissed-name'] },
      discussion: {
        items: {
          'discussing-topic': { status: 'in-progress' },
          'decided-topic': { status: 'completed' },
          'cancelled-topic': { status: 'cancelled', previous_status: 'in-progress' },
          'mailed-topic': { status: 'unstarted' },
        },
      },
    },
  });
  writeState(dir, layout.brief(UNIT, 'fresh-topic'), '# Fresh\n');
  writeState(dir, layout.brief(UNIT, 'mailed-topic'), '# Mailed\n');
  writeState(dir, layout.mailbox(UNIT, 'mailed-topic', '001-a-word-on-refunds.md'), MESSAGE);
  commitAll(dir, 'init');
  ok(dir, ['roadmap', 'horizon', 'add', 'later']);
  ok(dir, ['roadmap', 'add', 'loyalty', '--horizon', 'later', '--summary', 'Points for regulars']);
  ok(dir, ['roadmap', 'add', 'receipt-crash', '--horizon', 'later', '--summary', 'Receipts crash', '--kind', 'bug']);
});

/** @type {string} */
let dir;
beforeEach(() => { dir = world(); });
afterEach(() => { cleanupFixture(dir); });

/** The map's topics as they stand. */
const items = () => readManifest(dir, UNIT).phases.discovery.items;

/** Claude's draft of a brief, under the cache: its absolute path. @param {string} name @param {string} [text] */
function draft(name, text = `# ${name}\n\nLeans toward a nightly batch.\n`) {
  return writeState(dir, layout.cache(UNIT, 'discovery', `${name}.md`), text);
}

/** A verb's one-line report, as it follows its JSON. @param {string} line */
const report = (line) => `=== DISPLAY: confirmation (emit verbatim as a text code block (\`\`\`text fence) after the response) ===\n${line}\n`;

/** The state commit's files, each `{status}\t{path}`. */
const committedFiles = () => touched(statePath(dir), 'HEAD');

/** A roadmap item as the project manifest holds it. @param {string} name */
const roadmapItem = (name) => JSON.parse(readState(dir, layout.projectManifest)).roadmap.items[name];

/** A ledger entry written on a topic's discovery place. @param {string} topic */
const askOn = (topic) => ok(dir, ['ledger', 'ask', `${UNIT}.discovery.${topic}`], { env: SESSION, stdin: JSON.stringify({ ...MADE, text: 'Does it work offline?' }) });

describe('topic add (8.7.6, 8.8.18, 8.10.11)', () => {
  it('lands the topic with its brief installed from Claude\'s draft, the draft consumed, and commits both, its report one line with no confirm (8.S46, 8.S14, 8.S19)', () => {
    const scratch = draft('menu');

    const { res, sections } = okSections(dir, ['topic', 'add', UNIT, 'menu-management', '--summary', 'Owner-managed menus', '--description', 'Menus the owner edits.', '--brief', scratch]);

    assert.deepStrictEqual(res, {
      ok: true, work_unit: UNIT, op: 'add', name: 'menu-management', title: 'Menu Management', source: 'discovery', summary: 'Owner-managed menus',
      lifecycle: 'fresh', map_total: 7, description: 'Menus the owner edits.', brief: statePath(dir, layout.brief(UNIT, 'menu-management')), committed: head(statePath(dir)).slice(0, 7),
    });
    assert.deepStrictEqual(items()['menu-management'], { source: 'discovery', summary: 'Owner-managed menus', description: 'Menus the owner edits.' });
    assert.strictEqual(readState(dir, layout.brief(UNIT, 'menu-management')), '# menu\n\nLeans toward a nightly batch.\n');
    assert.strictEqual(fs.existsSync(scratch), false, 'the draft is consumed');
    assert.deepStrictEqual(committedFiles(), [`A\t${layout.brief(UNIT, 'menu-management')}`, `M\t${layout.manifest(UNIT)}`]);
    assert.strictEqual(lastMessage(dir), 'discovery(payments): add menu-management to the map');
    assert.strictEqual(sections, report('Added "Menu Management" to the map.'));
  });

  it('refuses, writing nothing: a name no lowercase slug, one on the map, one struck from it, a twin of a waiting roadmap idea, and a brief missing, outside the cache, gone or empty', () => {
    const scratch = draft('any');
    const empty = draft('empty', '  \n');
    const outside = writeState(dir, layout.unit(UNIT, 'notes.md'), '# Not a draft\n');
    const add = (/** @type {string} */ name, /** @type {string[]} */ brief) => ['topic', 'add', UNIT, name, '--summary', 'S', ...brief];

    for (const [args, refusal] of /** @type {[string[], string][]} */ ([
      [add('Menu_Admin', ['--brief', scratch]), 'topic add: "Menu_Admin" is not a topic name — a lowercase slug of letters, digits and hyphens, since it names the topic\'s folder'],
      [add('fresh-topic', ['--brief', scratch]), 'topic add: "fresh-topic" is already on the map — nothing was added; edit it, or pick a different name'],
      [add('dismissed-name', ['--brief', scratch]), 'topic add: "dismissed-name" was previously dismissed from this map — nothing was added; add it back only at the person\'s ask — pass --re-add'],
      [add('loyalty', ['--brief', scratch]), 'topic add: "loyalty" would stand beside the waiting roadmap item of its name — take it in with --from-roadmap loyalty, or name the topic apart'],
      [add('menu-admin', []), 'Usage: engine topic add <work-unit> <name> --summary <text> --brief <draft> [--description <text>] [--from-roadmap <item>] [--re-add] [--source <tag>]'],
      [add('menu-admin', ['--brief', outside]), `topic add: --brief must point inside ${statePath(dir, '.cache')}/ — got "${outside}"`],
      [add('menu-admin', ['--brief', `${scratch}.gone`]), `topic add: --brief names no draft: ${scratch}.gone`],
      [add('menu-admin', ['--brief', empty]), `topic add: --brief names an empty draft: ${empty}`],
    ])) {
      assert.strictEqual(refusedPristine(dir, args).error, refusal, args.join(' '));
    }
    assert.strictEqual(fs.existsSync(scratch), true, 'a refused add keeps the draft');
  });

  it('adds back a name struck from the map at the person\'s ask, taking it off the list (8.10.11)', () => {
    const { res, sections } = okSections(dir, ['topic', 'add', UNIT, 'dismissed-name', '--summary', 'Back again', '--brief', draft('back'), '--re-add']);

    assert.strictEqual(res.re_added, true);
    assert.deepStrictEqual(readManifest(dir, UNIT).phases.discovery.dismissed, []);
    assert.strictEqual(sections, report('Added "Dismissed Name" to the map again.'));
  });

  it('takes a waiting roadmap idea in: the item leaves the roadmap joined to the topic, which names it as its source; a bug of a name is no twin, and never taken in (8.1.6, 18.8.20)', () => {
    const { res, sections } = okSections(dir, ['topic', 'add', UNIT, 'points-scheme', '--summary', 'Points', '--brief', draft('points'), '--from-roadmap', 'loyalty', '--source', 'message:decided-topic']);

    assert.strictEqual(res.from_roadmap, 'loyalty');
    assert.deepStrictEqual(items()['points-scheme'], { source: 'message:decided-topic,roadmap:loyalty', summary: 'Points' });
    assert.deepStrictEqual(roadmapItem('loyalty').pulled_to, { work_unit: UNIT, topic: 'points-scheme' });
    assert.deepStrictEqual(committedFiles(), [`A\t${layout.brief(UNIT, 'points-scheme')}`, `M\t${layout.projectManifest}`, `M\t${layout.manifest(UNIT)}`]);
    assert.strictEqual(sections, report('Added "Points Scheme" to the map, taking "Loyalty" off the roadmap.'));

    ok(dir, ['topic', 'add', UNIT, 'receipt-crash', '--summary', 'A topic of the bug\'s name', '--brief', draft('crash')]);
    assert.strictEqual(refusedPristine(dir, ['topic', 'add', UNIT, 'crash-fix', '--summary', 'S', '--brief', draft('fix'), '--from-roadmap', 'receipt-crash']).error,
      'topic add: "crash-fix" can\'t take the item in — the roadmap\'s "receipt-crash" is a bug — it rides with work as material, never a topic');
  });
});

describe('topic add-batch', () => {
  it('lands every topic with its brief in one transaction and one commit', () => {
    const batch = writeState(dir, layout.cache(UNIT, 'discovery', 'topics.json'), JSON.stringify([
      { name: 'menu-management', summary: 'Menus', brief: draft('menu') },
      { name: 'points-scheme', summary: 'Points', description: 'Regulars earn.', brief: draft('points'), from_roadmap: 'loyalty' },
    ]));

    const { res, sections } = okSections(dir, ['topic', 'add-batch', UNIT, '--file', batch]);

    assert.deepStrictEqual(res, {
      ok: true, work_unit: UNIT, op: 'add-batch', readded: [], map_total: 8, committed: head(statePath(dir)).slice(0, 7),
      added: [{ name: 'menu-management', title: 'Menu Management' }, { name: 'points-scheme', title: 'Points Scheme', from_roadmap: 'loyalty' }],
    });
    assert.deepStrictEqual([items()['menu-management'], items()['points-scheme']], [
      { source: 'discovery', summary: 'Menus' }, { source: 'roadmap:loyalty', summary: 'Points', description: 'Regulars earn.' },
    ]);
    assert.deepStrictEqual(committedFiles(), [
      `A\t${layout.brief(UNIT, 'menu-management')}`, `A\t${layout.brief(UNIT, 'points-scheme')}`, `M\t${layout.projectManifest}`, `M\t${layout.manifest(UNIT)}`,
    ]);
    assert.strictEqual(sections, report('Added 2 topics to the map: "Menu Management", "Points Scheme".'));
  });

  it('writes nothing where any entry is refused, nor where the payload is no batch', () => {
    const file = (/** @type {unknown} */ entries) => writeState(dir, layout.cache(UNIT, 'discovery', 'topics.json'), JSON.stringify(entries));
    const good = { name: 'menu-management', summary: 'Menus', brief: draft('menu') };

    for (const [entries, refusal] of /** @type {[unknown, string][]} */ ([
      [[good, { name: 'dismissed-name', summary: 'S', brief: draft('d') }], 'topic add-batch: "dismissed-name" was previously dismissed from this map — nothing was added; add it back only at the person\'s ask — set re_add on the entry'],
      [[good, { name: 'other', summary: 'S' }], 'topic add-batch: a topic lands with its brief — entry 2 ("other") — "brief" names its draft'],
      [[good, { name: 'other', summary: ' ', brief: draft('o') }], 'topic add-batch: entry 2 ("other") — "summary" must be a non-empty string'],
      [[good, good], 'topic add-batch: "menu-management" appears more than once in the batch'],
      [[good, { name: 5, summary: 'S', brief: draft('n') }], 'topic add-batch: "5" is not a topic name — a lowercase slug of letters, digits and hyphens, since it names the topic\'s folder'],
      [[good, { name: 'loyalty', summary: 'S', brief: draft('l') }], 'topic add-batch: "loyalty" would stand beside the waiting roadmap item of its name — take it in with --from-roadmap loyalty, or name the topic apart'],
      [[], 'topic add-batch: entries must be a non-empty array of {name, summary, brief?, description?, from_roadmap?, re_add?}'],
    ])) {
      assert.strictEqual(refusedPristine(dir, ['topic', 'add-batch', UNIT, '--file', file(entries)]).error, refusal);
    }
  });
});

describe('topic edit', () => {
  it('sets a topic\'s summary, description or both at any lifecycle, committed, its report naming what changed', () => {
    const { res, sections } = okSections(dir, ['topic', 'edit', UNIT, 'decided-topic', '--summary', 'Decided, sharper']);

    assert.deepStrictEqual(res, {
      ok: true, work_unit: UNIT, op: 'edit', name: 'decided-topic', title: 'Decided Topic', lifecycle: 'decided', map_total: 6, summary: 'Decided, sharper', committed: head(statePath(dir)).slice(0, 7),
    });
    assert.deepStrictEqual(items()['decided-topic'], { ...ITEMS['decided-topic'], summary: 'Decided, sharper' });
    assert.strictEqual(sections, report('Updated "Decided Topic"\'s summary.'));
    assert.strictEqual(okSections(dir, ['topic', 'edit', UNIT, 'decided-topic', '--summary', 'S', '--description', 'D']).sections, report('Updated "Decided Topic"\'s summary and description.'));
  });

  it('refuses an edit naming no field, or no topic on the map, writing nothing', () => {
    assert.strictEqual(refusedPristine(dir, ['topic', 'edit', UNIT, 'decided-topic']).error, 'Usage: engine topic edit <work-unit> <name> [--summary <text>] [--description <text>]');
    assert.strictEqual(refusedPristine(dir, ['topic', 'edit', UNIT, 'ghost', '--summary', 'S']).error, 'no discovery item "ghost" in the manifest (phases.discovery.items)');
  });
});

describe('topic rename (8.8.17)', () => {
  it('moves an unstarted topic whole: its key in its place in the order, its folder with its brief and mail, and the stub its message parked', () => {
    const { res, sections } = okSections(dir, ['topic', 'rename', UNIT, 'mailed-topic', 'refund-timing']);

    assert.deepStrictEqual(res, {
      ok: true, work_unit: UNIT, op: 'rename', name: 'refund-timing', title: 'Refund Timing', was: 'Mailed Topic', renamed_from: 'mailed-topic', renamed_to: 'refund-timing', moved: true,
      lifecycle: 'fresh', map_total: 6, committed: head(statePath(dir)).slice(0, 7),
    });
    const manifest = readManifest(dir, UNIT);
    assert.deepStrictEqual(Object.entries(manifest.phases.discovery.items), Object.entries(ITEMS).map(([key, item]) => [key === 'mailed-topic' ? 'refund-timing' : key, item]));
    assert.deepStrictEqual(manifest.phases.discussion.items['refund-timing'], { status: 'unstarted' });
    assert.strictEqual('mailed-topic' in manifest.phases.discussion.items, false);
    assert.strictEqual(readState(dir, layout.mailbox(UNIT, 'refund-timing', '001-a-word-on-refunds.md')), MESSAGE);
    assert.strictEqual(fs.existsSync(statePath(dir, layout.topic(UNIT, 'mailed-topic'))), false);
    assert.deepStrictEqual(committedFiles(), [
      `A\t${layout.brief(UNIT, 'refund-timing')}`, `A\t${layout.mailbox(UNIT, 'refund-timing', '001-a-word-on-refunds.md')}`,
      `D\t${layout.brief(UNIT, 'mailed-topic')}`, `D\t${layout.mailbox(UNIT, 'mailed-topic', '001-a-word-on-refunds.md')}`, `M\t${layout.manifest(UNIT)}`,
    ]);
    assert.strictEqual(sections, report('Renamed "Mailed Topic" to "Refund Timing".'));
  });

  it('takes a roadmap item an unstarted topic took in along with it', () => {
    ok(dir, ['topic', 'add', UNIT, 'points-scheme', '--summary', 'Points', '--brief', draft('points'), '--from-roadmap', 'loyalty']);

    assert.deepStrictEqual(ok(dir, ['topic', 'rename', UNIT, 'points-scheme', 'reward-points']).roadmap_reaimed, ['loyalty']);
    assert.deepStrictEqual(roadmapItem('loyalty').pulled_to, { work_unit: UNIT, topic: 'reward-points' });
  });

  it('gives a started topic the new name as its title on every screen, its key and folder keeping the name it started under; renamed back, the title goes (P2)', () => {
    const { res } = okSections(dir, ['topic', 'rename', UNIT, 'discussing-topic', 'checkout-flow']);

    assert.deepStrictEqual([res.name, res.title, res.moved], ['discussing-topic', 'Checkout Flow', false]);
    assert.deepStrictEqual(items()['discussing-topic'], { ...ITEMS['discussing-topic'], title: 'checkout-flow' });
    assert.deepStrictEqual(committedFiles(), [`M\t${layout.manifest(UNIT)}`]);
    assert.strictEqual(okSections(dir, ['topic', 'edit', UNIT, 'discussing-topic', '--summary', 'S']).sections, report('Updated "Checkout Flow"\'s summary.'));

    assert.strictEqual(okSections(dir, ['topic', 'rename', UNIT, 'discussing-topic', 'discussing-topic']).sections, report('Renamed "Checkout Flow" to "Discussing Topic".'));
    assert.strictEqual('title' in items()['discussing-topic'], false);
  });

  it('keeps the key of an unstarted topic the ledger names, which names it for good, giving it the title', () => {
    askOn('fresh-topic');

    const res = ok(dir, ['topic', 'rename', UNIT, 'fresh-topic', 'offline-mode']);

    assert.deepStrictEqual([res.name, res.title, res.moved], ['fresh-topic', 'Offline Mode', false]);
    assert.strictEqual(readState(dir, layout.brief(UNIT, 'fresh-topic')), '# Fresh\n');
  });

  it('refuses, writing nothing: a name no lowercase slug, the name the topic goes by, one another topic goes by, and a folder standing at the new name', () => {
    ok(dir, ['topic', 'rename', UNIT, 'discussing-topic', 'checkout-flow']);
    writeState(dir, layout.brief(UNIT, 'stray'), '# Left behind\n');

    for (const [args, refusal] of /** @type {[string[], string][]} */ ([
      [['mailed-topic', 'Refund Timing'], 'topic rename: "Refund Timing" is not a topic name — a lowercase slug of letters, digits and hyphens, since it names the topic\'s folder'],
      [['mailed-topic', 'mailed-topic'], 'topic rename: "mailed-topic" goes by "mailed-topic" already'],
      [['mailed-topic', 'decided-topic'], 'topic rename: "decided-topic" on the map goes by "decided-topic" — pick a different name'],
      [['mailed-topic', 'checkout-flow'], 'topic rename: "discussing-topic" on the map goes by "checkout-flow" — pick a different name'],
      [['mailed-topic', 'stray'], '"mailed-topic" can\'t be renamed — a folder already stands at payments/topics/stray'],
    ])) {
      assert.strictEqual(refusedPristine(dir, ['topic', 'rename', UNIT, ...args]).error, refusal);
    }
  });
});

describe('topic remove (8.8.6, 8.8.16, 8.10.11)', () => {
  it('takes an unstarted topic off the map — its folder and stub gone, its name struck — each waiting message an idea in the inbox, and the report says so (8.S56)', () => {
    const idea = layout.inbox('ideas', `${TODAY}--a-word-on-refunds.md`);

    const { res, sections } = withFrozenClock(() => okSections(dir, ['topic', 'remove', UNIT, 'mailed-topic']));

    assert.deepStrictEqual(res, {
      ok: true, work_unit: UNIT, op: 'remove', name: 'mailed-topic', title: 'Mailed Topic', lifecycle: 'fresh', map_total: 5,
      inbox: [statePath(dir, idea)], roadmap_returned: [], committed: head(statePath(dir)).slice(0, 7),
    });
    const manifest = readManifest(dir, UNIT);
    assert.deepStrictEqual([Object.keys(manifest.phases.discovery.items).includes('mailed-topic'), 'mailed-topic' in manifest.phases.discussion.items], [false, false]);
    assert.deepStrictEqual(manifest.phases.discovery.dismissed, ['dismissed-name', 'mailed-topic']);
    assert.strictEqual(fs.existsSync(statePath(dir, layout.topic(UNIT, 'mailed-topic'))), false);
    assert.strictEqual(readState(dir, idea), '# A word on refunds\nFrom Discussing Topic · 1 Jan\n\nRefunds settle nightly.\n');
    assert.deepStrictEqual(committedFiles(), [
      `A\t${idea}`, `D\t${layout.brief(UNIT, 'mailed-topic')}`, `D\t${layout.mailbox(UNIT, 'mailed-topic', '001-a-word-on-refunds.md')}`, `M\t${layout.manifest(UNIT)}`,
    ]);
    assert.strictEqual(sections, report('Removed "Mailed Topic" from the map. Its 1 waiting message went to the inbox as an idea.'));
  });

  it('puts a roadmap item the topic took in back on its horizon (18.8.20)', () => {
    ok(dir, ['topic', 'add', UNIT, 'points-scheme', '--summary', 'Points', '--brief', draft('points'), '--from-roadmap', 'loyalty']);

    const { res, sections } = okSections(dir, ['topic', 'remove', UNIT, 'points-scheme']);

    assert.deepStrictEqual(res.roadmap_returned, [{ name: 'loyalty', horizon: 'later' }]);
    assert.deepStrictEqual(roadmapItem('loyalty'), { horizon: 'later', summary: 'Points for regulars', kind: 'idea', origin: 'harvest' });
    assert.deepStrictEqual(committedFiles(), [`D\t${layout.brief(UNIT, 'points-scheme')}`, `M\t${layout.projectManifest}`, `M\t${layout.manifest(UNIT)}`]);
    assert.strictEqual(sections, report('Removed "Points Scheme" from the map. "Loyalty" is back on the roadmap under later.'));
  });

  it('refuses a topic started, set aside or named by the ledger, pointing the way to what the person is after, writing nothing (8.8.8)', () => {
    askOn('fresh-topic');

    for (const [topic, refusal] of [
      ['discussing-topic', 'discussion is in flight on it; cancel from the epic menu instead'],
      ['decided-topic', 'discussion has concluded; cancel from the epic menu instead'],
      ['cancelled-topic', 'it is cancelled and stays on the map as record; reactivate it from the epic menu first'],
      ['postponed-topic', 'it is postponed and waits on the roadmap; pull it forward from the roadmap first'],
      ['fresh-topic', 'the ledger holds entries on it, which name it for good; cancel from the epic menu instead'],
    ]) {
      assert.strictEqual(refusedPristine(dir, ['topic', 'remove', UNIT, topic]).error, `"${topic}" can't be removed — ${refusal}`);
    }
  });
});

describe('topic order (8.6.2)', () => {
  it('sets each topic\'s order and commits the manifest alone, its report the order by the titles screens show', () => {
    fs.writeFileSync(`${dir}/unrelated.txt`, 'outside the scope\n');

    const { res, sections } = okSections(dir, ['topic', 'order', UNIT, 'mailed-topic=1', 'fresh-topic=2']);

    assert.deepStrictEqual(res, {
      ok: true, work_unit: UNIT, op: 'order', ordered: { 'mailed-topic': 1, 'fresh-topic': 2 }, titles: { 'mailed-topic': 'Mailed Topic', 'fresh-topic': 'Fresh Topic' }, committed: head(statePath(dir)).slice(0, 7),
    });
    assert.deepStrictEqual([items()['mailed-topic'].order, items()['fresh-topic'].order], [1, 2]);
    assert.deepStrictEqual(committedFiles(), [`M\t${layout.manifest(UNIT)}`]);
    assert.strictEqual(lastMessage(dir), 'discovery(payments): sequence topic map');
    assert.strictEqual(sections, report('Ordered the map: 1 "Mailed Topic", 2 "Fresh Topic".'));
  });

  it('refuses, writing nothing: a topic set aside, one not on the map, and a malformed assignment', () => {
    for (const [pairs, refusal] of [
      [['fresh-topic=1', 'cancelled-topic=2'], '"cancelled-topic" takes no order — it is cancelled and stays on the map as record'],
      [['fresh-topic=1', 'postponed-topic=2'], '"postponed-topic" takes no order — it is postponed and waits on the roadmap'],
      [['fresh-topic=1', 'ghost=2'], 'no discovery item "ghost" in the manifest (phases.discovery.items)'],
      [['fresh-topic=0'], 'bad assignment "fresh-topic=0" (expected {topic}={order}, order a positive integer)'],
      [['fresh-topic=1', 'fresh-topic=2'], 'topic "fresh-topic" assigned twice'],
      [[], 'Usage: engine topic order <work-unit> <topic>=<n> [<topic>=<n> …]'],
    ]) {
      assert.strictEqual(refusedPristine(dir, ['topic', 'order', UNIT, ...pairs]).error, refusal);
    }
  });
});

describe('topic brief (8.7.6)', () => {
  it('rewrites an unstarted topic\'s brief from Claude\'s draft, committed', () => {
    const { res, sections } = okSections(dir, ['topic', 'brief', UNIT, 'mailed-topic', '--brief', draft('mailed', '# Mailed, again\n')]);

    assert.deepStrictEqual(res, {
      ok: true, work_unit: UNIT, op: 'brief', name: 'mailed-topic', title: 'Mailed Topic', brief: statePath(dir, layout.brief(UNIT, 'mailed-topic')), committed: head(statePath(dir)).slice(0, 7),
    });
    assert.strictEqual(readState(dir, layout.brief(UNIT, 'mailed-topic')), '# Mailed, again\n');
    assert.deepStrictEqual(committedFiles(), [`M\t${layout.brief(UNIT, 'mailed-topic')}`]);
    assert.strictEqual(sections, report('Rewrote "Mailed Topic"\'s brief.'));
  });

  it('refuses once the topic has started — what bears on it goes as a message — keeping the draft (8.S46)', () => {
    const scratch = draft('late');

    assert.strictEqual(refusedPristine(dir, ['topic', 'brief', UNIT, 'discussing-topic', '--brief', scratch]).error,
      'topic brief: "discussing-topic" started — what bears on it goes as a message');
    assert.strictEqual(refusedPristine(dir, ['topic', 'brief', UNIT, 'cancelled-topic', '--brief', scratch]).error,
      'topic brief: "cancelled-topic" it is cancelled and stays on the map as record');
    assert.strictEqual(fs.existsSync(scratch), true);
  });
});

describe('discovery-map, the alias', () => {
  it('adds a topic without its brief, its routing dropped and --force-dismissed the re-add, answering its JSON alone; a brief pointer is refused', () => {
    const { res, sections } = okSections(dir, ['discovery-map', 'add', UNIT, 'dismissed-name', 'discussion', '--summary', 'Back', '--source', 'gap-analysis', '--force-dismissed']);

    assert.deepStrictEqual([res.re_added, sections], [true, '']);
    assert.deepStrictEqual(items()['dismissed-name'], { source: 'gap-analysis', summary: 'Back' });
    assert.strictEqual(refusedPristine(dir, ['discovery-map', 'add', UNIT, 'other', 'discussion', '--summary', 'S', '--brief-path', 'discovery/briefs/other.md']).error,
      'discovery-map add: --brief-path is refused — a topic\'s brief has one place, topics/{topic}/brief.md, installed from a draft by engine topic add');
  });

  it('lands a topic with no summary under --backfill, uncommitted, as it always has', () => {
    const before = head(statePath(dir));

    const res = ok(dir, ['discovery-map', 'add', UNIT, 'offline-sync', 'discussion', '--source', 'direct-start', '--backfill']);

    assert.deepStrictEqual(res, { ok: true, work_unit: UNIT, name: 'offline-sync', op: 'add', source: 'direct-start', lifecycle: 'fresh', map_total: 7 });
    assert.deepStrictEqual([items()['offline-sync'], head(statePath(dir))], [{ source: 'direct-start' }, before]);
  });

  it('adds a batch without briefs, each entry\'s routing dropped and force_dismissed the re-add; a brief_path is refused', () => {
    const file = (/** @type {unknown} */ entries) => writeState(dir, layout.cache(UNIT, 'discovery', 'topics.json'), JSON.stringify(entries));

    const res = ok(dir, ['discovery-map', 'add-batch', UNIT, '--file', file([{ name: 'dismissed-name', routing: 'discussion', summary: 'Back', force_dismissed: true }])]);

    assert.deepStrictEqual(res.readded, ['dismissed-name']);
    assert.deepStrictEqual(items()['dismissed-name'], { source: 'discovery', summary: 'Back' });
    assert.strictEqual(refusedPristine(dir, ['discovery-map', 'add-batch', UNIT, '--file', file([{ name: 'other', summary: 'S', brief_path: 'discovery/briefs/other.md' }])]).error,
      'discovery-map add-batch: "other"\'s brief_path is refused — a topic\'s brief has one place, topics/{topic}/brief.md, installed from a draft by engine topic add');
  });

  it('is the map verbs under their old names, and holds no dead end: handle and unhandle are gone (8.S13)', () => {
    assert.deepStrictEqual(ok(dir, ['discovery-map', 'sequence', UNIT, 'fresh-topic=2']).ordered, { 'fresh-topic': 2 });
    assert.strictEqual(ok(dir, ['discovery-map', 'edit', UNIT, 'fresh-topic', '--summary', 'S']).summary, 'S');
    assert.strictEqual(ok(dir, ['discovery-map', 'rename', UNIT, 'fresh-topic', 'offline-mode']).name, 'offline-mode');
    assert.strictEqual(ok(dir, ['discovery-map', 'remove', UNIT, 'offline-mode']).op, 'remove');
    for (const verb of ['handle', 'unhandle']) {
      assert.strictEqual(refusedPristine(dir, ['discovery-map', verb, UNIT, 'decided-topic']).error, 'Usage: engine discovery-map <sequence|add|add-batch|edit|remove|rename> …');
    }
  });
});

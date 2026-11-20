'use strict';

// The walkthrough's diagram layouts, its sample surfaces, and the screens
// they render into.
//
// The layouts are pinned byte-for-byte at the hermetic width, then driven at
// the kernel's floor and cap: a diagram that re-flows is only worth the
// notation if it re-flows without overflowing. The samples are pinned as
// goldens too — a sample renders through the live surface's own derivation
// and projection, so a golden here moves when that surface moves, which is
// the whole point of rendering it rather than drawing it; and each is drawn
// from its own fixture, a change there showing in it (23.1.1, 23.1.2). The
// screens are pinned whole, prose included, and driven at the same three
// widths.
//
// Layer: unit.

const HERMETIC = require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPTS = path.join(ROOT, 'skills', 'ledger-engine', 'scripts');
const DIAGRAMS = path.join(SCRIPTS, 'domain', 'projections', 'walkthrough-diagrams.cjs');
const WALKTHROUGH = path.join(SCRIPTS, 'domain', 'projections', 'walkthrough.cjs');
const SCREENS_DIR = path.join(ROOT, 'skills', 'ledger-engine', 'content', 'walkthrough', 'screens');

const {
  DIAGRAM_KINDS, SAMPLE_SURFACES, FIXTURES_DIR, FIXTURE_STATE,
  isDiagramKind, renderDiagram, flowDiagram, tableDiagram, barsDiagram, sampleDiagram,
} = require(DIAGRAMS);
const { parseContent, loadScreen, walkthroughOffer, walkthroughScreen } = require(WALKTHROUGH);
const { MIN, CAP, FALLBACK } = require(path.join(SCRIPTS, 'kernel', 'terminal.cjs'));
const schema = require(path.join(SCRIPTS, 'kernel', 'manifest-schema.cjs'));
const { STATE_DIR_NAME } = require(path.join(SCRIPTS, 'kernel', 'state-root.cjs'));
const derivations = require(path.join(SCRIPTS, 'domain', 'derivations.cjs'));
const { roadmapState } = require(path.join(SCRIPTS, 'domain', 'roadmap.cjs'));

/** The notation each screen's fence carries, verbatim from the approved content. */
const SOURCE = {
  flow: [
    'a piece of work, described in your own words',
    '↓',
    'DISCOVERY | discovery · discussion · experiment · investigation',
    '  → what the work is, what you decided, and why',
    '↓',
    'DEFINITION | specification',
    '  → the contract you approve, cut into phases',
    '↓',
    'DELIVERY | implementation · review',
    '  → the code, built test-first by agents and held to your specification',
    '↓',
    'the knowledge base keeps every current decision, so the next piece of work starts from what this one decided',
  ].join('\n'),
  kinds: [
    ' | DISCOVERY | DEFINITION | DELIVERY',
    'feature | discussion | spec | build · review',
    'epic | discussion, per topic | spec | build · review',
    'bugfix | investigation | spec | build · review',
    'quick-fix |  |  | fixes · close',
  ].join('\n'),
  effort: [
    'discovery | 1 | you lead',
    'discussion | 0.8 | you shape',
    'specification | 0.5 | you approve',
    'implementation | 0.2 | auto, or step',
    'review | 0.15 | finish is yours',
  ].join('\n'),
  situations: [
    'a stray thought | log it as an idea, a bug or a quick-fix; it waits in the inbox',
    'a later-release idea | put it on the roadmap in one line',
    'a feature grows | pivot it into an epic, in place',
    'a stray feature | absorb it into an epic as a topic',
    'a topic not worth it | cancel it; bring it back later if it is',
    'a decision was wrong | change it; what relied on it is flagged',
    'something is unclear | h/help on any menu, or just ask',
  ].join('\n'),
};


/** Every tagged fence in the walk, in screen order — the notation as the screens actually carry it. */
function screenFences() {
  return fs.readdirSync(SCREENS_DIR).filter((f) => f.endsWith('.md')).sort()
    .flatMap((name) => parseContent(path.join(SCREENS_DIR, name)).chunks
      .filter((c) => c.kind === 'diagram')
      .map((c) => ({ screen: name, tag: c.tag, text: c.text })));
}

/**
 * Each sample and the live surface it depicts, drawn in this process at its
 * width — run in a process of its own for each width, the width being
 * resolved once a process. Each surface is drawn by its own render over a
 * copy of the sample's fixture in `into`, which its drawing may write to,
 * given the project id setup would; the build's progress by its screen, from
 * the tracker's answer the fixture holds, no tracker standing behind a
 * shipped world.
 * @param {string} scripts @param {string} into
 * @returns {Record<string, {sample: string, surface: string}>}
 */
function samplesAndSurfaces(scripts, into) {
  const nodeFs = require('fs');
  const nodePath = require('path');
  const at = (/** @type {string} */ rel) => require(nodePath.join(scripts, rel));
  const { sampleDiagram: sampled, FIXTURES_DIR: fixtures, FIXTURE_STATE: state } = at('domain/projections/walkthrough-diagrams.cjs');
  const { SURFACES } = at('domain/render.cjs');
  const { asShipped } = at('domain/ledger.cjs');
  const { pinStateRoot } = at('kernel/state-root.cjs');
  const { progressScreen } = at('domain/projections/build.cjs');
  const { trackerGiven } = at('domain/phase-checks.cjs');
  const { standingOf } = at('domain/build-entry.cjs');
  const { finishedUnits } = at('domain/ledger-units.cjs');
  const json = (/** @type {string} */ file) => JSON.parse(nodeFs.readFileSync(file, 'utf8'));
  /** @type {Record<string, (dir: string, root: string) => string>} */
  const draw = {
    'start-menu': (dir) => SURFACES['start-menu'](dir, {}),
    roadmap: (dir) => SURFACES.roadmap(dir, {}),
    'epic-menu': (dir) => SURFACES['epic-menu'](dir, { dotpath: 'launch-core' }),
    'discussion-map': (dir) => SURFACES.map(dir, { dotpath: 'launch-core.billing' }),
    'build-progress': (dir, root) => progressScreen(standingOf(trackerGiven(dir, 'saved-filters',
      json(nodePath.join(root, 'saved-filters', 'manifest.json')), json(nodePath.join(dir, 'tracker.json')).phases), []), finishedUnits(root)),
  };
  return Object.fromEntries(Object.entries(draw).map(([surface, drawn]) => {
    const dir = nodePath.join(into, surface);
    const root = nodePath.join(dir, state);
    nodeFs.cpSync(nodePath.join(fixtures, surface), dir, { recursive: true });
    nodeFs.writeFileSync(nodePath.join(root, 'manifest.json'), JSON.stringify({ ...json(nodePath.join(root, 'manifest.json')), project_id: 'wAlKtHrOuGhSaMpLeS001' }));
    pinStateRoot(dir, root);
    return [surface, { sample: sampled(surface), surface: asShipped(root, () => drawn(dir, root)) }];
  }));
}

/**
 * The first line of a sample the surface does not draw where the sample has
 * it, null when it draws them all in order: the surface read as plain text,
 * its section headers dropped, and the sample's blank lines and the rows the
 * surface frames it with — its help and back, its dot rule — set aside.
 * @param {string} sample @param {string} surface @returns {string|null}
 */
function notDrawn(sample, surface) {
  const drawn = surface.split('\n').filter((line) => !line.startsWith('=== '))
    .map((line) => line.replace(/^# /, '').replace(/\*\*|\*|`/g, '').split('\u00a0').join(' ').trimEnd());
  const lines = sample.split('\n').filter(Boolean);
  let next = 0;
  for (const line of drawn) if (line === lines[next]) next += 1;
  return lines[next] ?? null;
}

// Characters, not bytes: the diagrams are drawn with arrows and blocks, each
// of which is several bytes wide.
/** @param {string} label @param {string} text @param {number} width */
function fits(label, text, width) {
  const over = text.split('\n').filter((l) => [...l].length > width);
  assert.deepStrictEqual(over, [], `${label} at ${width}: ${over.length} line(s) overflow\n${text}`);
}

describe('walkthrough diagram layouts', () => {
  it('the notation driven here is the notation the screens carry', () => {
    assert.deepStrictEqual(screenFences(), [
      { screen: '01-the-idea.md', tag: 'flow', text: SOURCE.flow },
      { screen: '02-where-everything-starts.md', tag: 'sample start-menu', text: '' },
      { screen: '03-what-the-work-is.md', tag: 'table', text: SOURCE.kinds },
      { screen: '04-the-product-takes-shape.md', tag: 'sample roadmap', text: '' },
      { screen: '05-an-epic-and-its-topics.md', tag: 'sample epic-menu', text: '' },
      { screen: '06-the-journey-of-one-piece-of-work.md', tag: 'sample discussion-map', text: '' },
      { screen: '06-the-journey-of-one-piece-of-work.md', tag: 'sample build-progress', text: '' },
      { screen: '07-how-much-of-you-it-needs.md', tag: 'bars', text: SOURCE.effort },
      { screen: '08-living-with-it.md', tag: 'table', text: SOURCE.situations },
    ]);
  });

  it('flow: the spine hangs off the gutter, labels share a column, text wraps under itself', () => {
    assert.strictEqual(flowDiagram(SOURCE.flow, FALLBACK), [
      '   a piece of work, described in your own words',
      '     ↓',
      '   DISCOVERY     discovery · discussion · experiment ·',
      '                 investigation',
      '     → what the work is, what you decided, and why',
      '     ↓',
      '   DEFINITION    specification',
      '     → the contract you approve, cut into phases',
      '     ↓',
      '   DELIVERY      implementation · review',
      '     → the code, built test-first by agents and held to your',
      '       specification',
      '     ↓',
      '   the knowledge base keeps every current decision, so the next',
      '   piece of work starts from what this one decided',
    ].join('\n'));
  });

  it('table: fixed columns take the longest cell plus a gap, the last takes the rest', () => {
    assert.strictEqual(tableDiagram(SOURCE.kinds, FALLBACK), [
      '              DISCOVERY              DEFINITION  DELIVERY',
      '   feature    discussion             spec        build · review',
      '   epic       discussion, per topic  spec        build · review',
      '   bugfix     investigation          spec        build · review',
      '   quick-fix                                     fixes · close',
    ].join('\n'));
  });

  it('table: the last column wraps under itself', () => {
    assert.strictEqual(tableDiagram(SOURCE.situations, FALLBACK), [
      '   a stray thought       log it as an idea, a bug or a quick-fix;',
      '                         it waits in the inbox',
      '   a later-release idea  put it on the roadmap in one line',
      '   a feature grows       pivot it into an epic, in place',
      '   a stray feature       absorb it into an epic as a topic',
      '   a topic not worth it  cancel it; bring it back later if it is',
      '   a decision was wrong  change it; what relied on it is flagged',
      '   something is unclear  h/help on any menu, or just ask',
    ].join('\n'));
  });

  it('bars: the bar takes what is left between the label column and the note column', () => {
    assert.strictEqual(barsDiagram(SOURCE.effort, FALLBACK), [
      '   discovery        ███████████████████████████   you lead',
      '   discussion       ██████████████████████        you shape',
      '   specification    ██████████████                you approve',
      '   implementation   █████                         auto, or step',
      '   review           ████                          finish is yours',
    ].join('\n'));
  });

  it('every layout re-flows to the floor and the cap without overflowing', () => {
    for (const width of [MIN, FALLBACK, CAP]) {
      fits('flow', flowDiagram(SOURCE.flow, width), width);
      fits('bars', barsDiagram(SOURCE.effort, width), width);
      for (const [name, src] of Object.entries(SOURCE)) {
        if (name === 'flow' || name === 'effort') continue;
        fits(`table ${name}`, tableDiagram(src, width), width);
      }
    }
  });

  it('table: a last column with no room falls back to one block per row, under its header label', () => {
    const kinds = tableDiagram(SOURCE.kinds, MIN);
    assert.match(kinds, /^ {3}feature\n {5}DISCOVERY: discussion\n {5}DEFINITION: spec\n {5}DELIVERY: build · review$/m);
    // The header row is the source of those labels, so it never renders as a row of its own.
    assert.ok(!kinds.split('\n')[0].includes('DEFINITION      DELIVERY'), kinds);
    // A row whose cell is empty contributes no line.
    assert.match(kinds, /^ {3}quick-fix\n {5}DELIVERY: fixes · close$/m);
    // A headerless table's cells stand alone beneath the first.
    assert.match(tableDiagram(SOURCE.situations, MIN), /^ {3}a feature grows\n {5}pivot it into an epic, in place$/m);
    // A row short of the table's columns keeps its cells in their own
    // columns rather than throwing its last one into the wrapping column.
    assert.strictEqual(tableDiagram('alpha | one | two\nbeta | three', FALLBACK), [
      '   alpha  one    two',
      '   beta   three',
    ].join('\n'));
    // Two columns still fit at the floor — the fallback engages on need, never on width alone.
    assert.match(tableDiagram('alpha | one two three', MIN), /^ {3}alpha {2}one two three$/m);
  });

  it('bars scale with the pane', () => {
    const bar = (text) => Math.max(...text.split('\n').map((l) => (l.match(/█+/) || [''])[0].length));
    assert.ok(bar(barsDiagram(SOURCE.effort, MIN)) < bar(barsDiagram(SOURCE.effort, FALLBACK)));
    assert.ok(bar(barsDiagram(SOURCE.effort, FALLBACK)) < bar(barsDiagram(SOURCE.effort, CAP)));
    // A share that rounds to nothing still draws — a row present in the
    // source is a row the reader can see.
    assert.match(barsDiagram('a | 1 | x\nb | 0.01 | y', MIN), /^ {3}b {3}█ +y$/m);
    // A share that is not a share is a typo in the notation, not a blank row.
    assert.throws(() => barsDiagram('a | most | x', FALLBACK),
      /`bars` row "a" takes a share between 0 and 1 — got "most"/);
  });

  it('an unknown fence tag names the tags it could have been', () => {
    assert.deepStrictEqual(DIAGRAM_KINDS, ['flow', 'table', 'bars', 'sample']);
    assert.throws(() => renderDiagram('mermaid', '', FALLBACK),
      /unknown fence tag "mermaid" \(tags: flow, table, bars, sample\)/);
    assert.ok(isDiagramKind('sample start-menu'));
    assert.ok(!isDiagramKind('mermaid'));
    assert.throws(() => renderDiagram('sample nowhere', '', FALLBACK),
      /`sample` names one of start-menu, roadmap, epic-menu, discussion-map, build-progress — got "nowhere"/);
  });
});

describe('walkthrough content fences', () => {
  /** A content file in a temp directory, parsed. @param {string} body */
  function parse(body) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'walkthrough-fence-'));
    const file = path.join(dir, '03-a-screen.md');
    fs.writeFileSync(file, `# A screen\n\n${body}`);
    try { return parseContent(file); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }

  it('an untagged fence stays verbatim; a tagged one carries its tag', () => {
    const { title, chunks } = parse('Before.\n\n```\n  drawn   by   hand\n```\n\nAfter.\n');
    assert.strictEqual(title, 'A screen');
    assert.deepStrictEqual(chunks, [
      { kind: 'prose', text: 'Before.' },
      { kind: 'diagram', text: '  drawn   by   hand', tag: '' },
      { kind: 'prose', text: 'After.' },
    ]);
    assert.deepStrictEqual(parse('```bars\na | 1 | x\n```\n').chunks, [
      { kind: 'diagram', text: 'a | 1 | x', tag: 'bars' },
    ]);
  });

  it('a tagged fence survives an empty body — a sample is nothing but its tag', () => {
    assert.deepStrictEqual(parse('```sample roadmap\n```\n').chunks, [
      { kind: 'diagram', text: '', tag: 'sample roadmap' },
    ]);
  });

  it('an unknown tag is refused where the file that carries it is still in hand', () => {
    assert.throws(() => parse('```mermaid\ngraph TD\n```\n'),
      /03-a-screen\.md fences a "mermaid" diagram \(tags: flow, table, bars, sample\)/);
  });

  it('an open fence is still refused', () => {
    assert.throws(() => parse('```flow\na node\n'), /03-a-screen\.md leaves a fence open/);
  });
});

describe('walkthrough sample surfaces', () => {
  it('start-menu: the inbox line, then the menu as plain text, its units first with their progress and h/help last', () => {
    const out = sampleDiagram('start-menu');
    assert.strictEqual(out, [
      'Inbox: 2 ideas · 1 bug · 1 quick-fix',
      '',
      '◆ What would you like to do?',
      '',
      '1         → Continue feature: Saved Filters — build, phase 1 of 3',
      '2         → Continue bugfix: Export Timeout — investigation',
      '3         → Continue epic: Payments Overhaul — discussion, 1 of 3',
      '            topics decided',
      'p/product → Talk about the product',
      's/start   → Start something new — describe it, and we\'ll find',
      '            what kind of work it is',
      't/triage  → Triage the inbox',
      'r/roadmap → Open the product roadmap',
      'v/view    → View completed & cancelled work units',
      'm/manage  → Manage work units, the project\'s setup and drivers,',
      '            and the matrix',
      'h/help    → How Ledger works',
    ].join('\n'));
    // A sample is an illustration inside a code block: no markdown, no
    // opening dot rule, and no non-breaking spaces a fence has no use for.
    assert.ok(!/[*`\u00a0]|· · ·/.test(out), out);
  });

  it('roadmap: two launch items in flight as one epic, so only the rest show, waiting, and the rows beneath', () => {
    assert.strictEqual(sampleDiagram('roadmap'), [
      'launch (1)',
      '  └─ 1. The Basic Reports    idea · discovery',
      '',
      'v1 (1)',
      '  └─ 2. Exports              idea · discovery',
      '',
      'someday (1)',
      '  └─ 3. Marketplace          idea · discovery',
      '',
      '◆ What would you like to do?',
      '',
      'w/work    → Work on items now — discovery finds what kind of work',
      '            they are',
      'n/new     → Add an item — I\'ll ask what it is and which horizon',
      'm/move    → Move an item to another horizon you name',
      'a/archive → Archive an item',
      'p/product → Talk about the product as a whole',
    ].join('\n'));
  });

  it('epic-menu: its heading, its tally and its decided topics, the rows beneath, no key and no callout', () => {
    const out = sampleDiagram('epic-menu');
    assert.strictEqual(out, [
      '■ Discussion — Launch Core',
      '3 topics · 1 decided · 1 in progress · 1 not started',
      '',
      'DECIDED',
      '  └─ Sign In',
      '',
      '◆ What would you like to do?',
      '',
      '1           → Continue "Billing" — in progress (recommended)',
      '2           → Start "Usage Limits" — not started',
      'd/discovery → Change the map — a new topic, cancel, postpone,',
      '              pull forward, reactivate, or reopen a decided topic',
    ].join('\n'));
    assert.ok(!out.includes('⚑'), 'a sample carries no callout');
    assert.ok(!/Key:|Status:/.test(out), 'a sample carries no legend');
  });

  it('discussion-map: a topic\'s map as the conversation shows it — Claude\'s call since the last look above the person\'s questions and Claude\'s calls', () => {
    assert.strictEqual(sampleDiagram('discussion-map'), [
      'Map — Billing',
      '4 of yours: 3 decided, 1 open · 2 calls by Claude',
      '',
      'SINCE YOU LAST LOOKED (1 call by Claude)',
      '  └─ ◇ The currency the pricing page shows',
      '        The customer\'s own, from their billing address.',
      '',
      'OPEN (1 of yours)',
      '  └─ ○ Whether invoices go out by email       [yours]',
      '',
      'DECIDED (3 of yours · 2 calls by Claude)',
      '  ├─ ✓ Which plans launch                     [yours]',
      '  ├─ ✓ When a card payment fails              [yours]',
      '  ├─ ◇ Where invoice numbers start            [Claude\'s call]',
      '  ├─ ✓ Whether a plan can change mid-cycle    [yours]',
      '  └─ ◇ The currency the pricing page shows    [Claude\'s call]',
    ].join('\n'));
  });

  it('build-progress: a build part-way through its first phase, the tracker\'s answer taken from beside its state, the phases not yet written listed', () => {
    assert.strictEqual(sampleDiagram('build-progress'), [
      '1 of 4 tasks done · 1 running',
      '',
      '  ├─ Phase 1 of 3 · Saving a filter          [running]',
      '  │  ├─ ✓ 1.1 Store a named filter set       [done]',
      '  │  ├─ ◐ 1.2 Save from the filter bar       [in progress]',
      '  │  ├─ ○ 1.3 Refuse a name already taken    [after 1.2]',
      '  │  └─ ○ 1.4 List the saved filter sets     [not started]',
      '  │',
      '  ├─ Phase 2 of 3 · Coming back to one       [not yet written]',
      '  │',
      '  └─ Phase 3 of 3 · Sharing a filter         [not yet written]',
    ].join('\n'));
  });

  it('a sample reads its world as it stands and writes nothing into it', () => {
    const before = fs.readdirSync(FIXTURES_DIR, { recursive: true }).sort();
    for (const surface of SAMPLE_SURFACES) sampleDiagram(surface);
    assert.deepStrictEqual(fs.readdirSync(FIXTURES_DIR, { recursive: true }).sort(), before);
  });

  it('23.S1: each sample is drawn from its own fixture, a change to the fixture showing in the sample', (t) => {
    const read = fs.readFileSync;
    t.after(() => { fs.readFileSync = read; });
    /** @type {Record<string, [string, string, string, string]>} the file changed, the text and its change, and the line the sample then shows */
    const changes = {
      'start-menu': ['state/payments-overhaul/manifest.json', '"completed"', '"in-progress"', '3         → Continue epic: Payments Overhaul — discussion, 0 of 3'],
      roadmap: ['state/manifest.json', '"marketplace"', '"storefront"', '  └─ 3. Storefront           idea · discovery'],
      'epic-menu': ['state/launch-core/manifest.json', '"completed"', '"in-progress"', '3 topics · 2 in progress · 1 not started'],
      'discussion-map': ['state/.cache/.marks/launch-core.json', '"nMkNSvJzL45sKoQcD9fwF"', '', 'SINCE YOU LAST LOOKED (2 calls by Claude)'],
      'build-progress': ['tracker.json', 'Store a named filter set', 'Keep a named filter set', '  │  ├─ ✓ 1.1 Keep a named filter set        [done]'],
    };
    const shown = Object.entries(changes).map(([surface, [rel, from, to, line]]) => {
      const file = path.join(FIXTURES_DIR, surface, rel);
      assert.ok(read(file, 'utf8').includes(from), `${surface}: ${rel} holds ${from}`);
      fs.readFileSync = /** @type {typeof fs.readFileSync} */ (/** @type {unknown} */ ((/** @type {any} */ at, /** @type {any} */ options) => {
        const text = read(at, options);
        return at === file ? String(text).split(from).join(to) : text;
      }));
      try {
        return sampleDiagram(surface).split('\n').includes(line);
      } finally {
        fs.readFileSync = read;
      }
    });

    assert.deepStrictEqual(shown, SAMPLE_SURFACES.map(() => true));
    assert.deepStrictEqual(Object.keys(changes), [...SAMPLE_SURFACES]);
  });

  it('23.S2: a change to the start menu\'s projection shows in the walkthrough\'s start-menu sample', (t) => {
    const projection = require(path.join(SCRIPTS, 'domain', 'projections', 'start-menu.cjs'));
    const { startMenuScreen } = projection;
    t.after(() => {
      projection.startMenuScreen = startMenuScreen;
      delete require.cache[DIAGRAMS];
    });
    projection.startMenuScreen = (/** @type {any} */ read) => ({ ...startMenuScreen(read), shows: ['Inbox: drawn afresh'] });
    delete require.cache[DIAGRAMS];

    assert.match(require(DIAGRAMS).sampleDiagram('start-menu'), /^Inbox: drawn afresh\n/);
  });

  it('every sample re-flows with the surface it depicts: at the floor, the fallback and the cap, the surface drawn at that width draws each of the sample\'s lines, in order', (t) => {
    const into = fs.mkdtempSync(path.join(os.tmpdir(), 'walkthrough-samples-'));
    t.after(() => fs.rmSync(into, { recursive: true, force: true }));
    const at = (/** @type {number} */ width) => {
      const script = `process.stdout.write(JSON.stringify((${samplesAndSurfaces})(${JSON.stringify(SCRIPTS)}, ${JSON.stringify(path.join(into, String(width)))})));`;
      /** @type {Record<string, {sample: string, surface: string}>} */
      const drawn = JSON.parse(execFileSync(process.execPath, ['-e', script], {
        encoding: 'utf8',
        env: { ...process.env, ...HERMETIC, LEDGER_DISPLAY_WIDTH: String(width) },
      }));
      return Object.entries(drawn).map(([surface, { sample, surface: live }]) => [surface, notDrawn(sample, live)]);
    };

    for (const width of [MIN, FALLBACK, CAP]) {
      assert.deepStrictEqual(at(width), SAMPLE_SURFACES.map((surface) => [surface, null]), `at ${width}`);
    }
  });

  it('no file the skills and agents ship sits in a folder named for Ledger\'s own state, which a project\'s ignore line hides', () => {
    const shipped = ['skills', 'agents'].flatMap((top) => fs.readdirSync(path.join(ROOT, top), { recursive: true, encoding: 'utf8' })
      .map((rel) => path.join(top, rel)));
    const hidden = shipped.filter((rel) => rel.split(path.sep).slice(0, -1).includes(STATE_DIR_NAME));

    assert.ok(shipped.some((rel) => rel.startsWith(path.join('skills', 'ledger-engine', 'content', 'walkthrough', 'fixtures', 'start-menu', FIXTURE_STATE, ''))), 'the scan reads the fixtures');
    assert.deepStrictEqual(hidden, []);
  });

  it('every fixture is a schema-valid state tree', () => {
    assert.deepStrictEqual(fs.readdirSync(FIXTURES_DIR).sort(), [...SAMPLE_SURFACES].sort());
    for (const surface of SAMPLE_SURFACES) {
      const dir = path.join(FIXTURES_DIR, surface);
      const wf = path.join(dir, FIXTURE_STATE);
      JSON.parse(fs.readFileSync(path.join(wf, 'manifest.json'), 'utf8'));
      // The roadmap derives from the project manifest alone; every item's
      // state has to land in vocabulary (lifecycle by join, never stored).
      for (const row of roadmapState(dir).items) {
        assert.ok(['waiting', 'in-flight', 'shipped', 'orphaned'].includes(row.state), `${surface}/${row.name}`);
      }
      const units = fs.readdirSync(wf, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'));
      assert.ok(units.length > 0, `${surface}: no work unit`);
      for (const unit of units) {
        const manifest = JSON.parse(fs.readFileSync(path.join(wf, unit.name, 'manifest.json'), 'utf8'));
        const where = `${surface}/${unit.name}`;
        assert.ok(schema.VALID_WORK_TYPES.includes(manifest.work_type), `${where}: work_type`);
        assert.ok(schema.VALID_WORK_UNIT_STATUSES.includes(manifest.status), `${where}: status`);
        for (const key of Object.keys(manifest)) {
          assert.ok(!schema.VALID_PHASES.includes(key), `${where}: root key "${key}" shadows a phase`);
        }
        for (const [phase, data] of Object.entries(manifest.phases || {})) {
          assert.ok(schema.VALID_PHASES.includes(phase), `${where}: unknown phase "${phase}"`);
          for (const [topic, item] of Object.entries((data && data.items) || {})) {
            if (phase === 'discovery') {
              assert.ok(!('status' in item), `${where}.${topic}: map items carry no status`);
            } else {
              assert.ok(schema.VALID_PHASE_STATUSES[phase].includes(item.status), `${where}.${phase}.${topic}: status`);
            }
          }
          derivations.phaseStatus(manifest, phase);
        }
        for (const topic of Object.keys((manifest.phases || {}).discovery?.items || {})) {
          assert.ok(derivations.computeTopicLifecycle(manifest, topic).lifecycle, `${where}.${topic}: lifecycle`);
        }
        derivations.computeNextPhase(manifest);
      }
    }
  });
});

describe('walkthrough screens', () => {
  // Every screen whole at the pinned width, as the reader meets it: the
  // heading, the prose exactly as the content file writes it, the diagrams
  // as the layouts and the live samples draw them, the menu. A screen
  // reworded moves its golden — which is the point, since the walk's words
  // are the product here and a silent edit to them should be read before it
  // ships.
  const SCREENS = [
    [
      "=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===",
      "# **`■ How Ledger works · 1 of 8 · The idea`**",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Claude Code is a capable engineer with two gaps. It forgets everything between sessions, and it has no process for how a piece of work should unfold, so every session starts cold and improvises from there. Ledger fills both. Every piece of work goes through phases, each building on what the last one recorded, and every question, finding and decision lands on a record that outlives the session, so nothing decided is decided twice.",
      "",
      "=== DISPLAY: walkthrough diagram (emit verbatim as a text code block (```text fence)) ===",
      "   a piece of work, described in your own words",
      "     ↓",
      "   DISCOVERY     discovery · discussion · experiment ·",
      "                 investigation",
      "     → what the work is, what you decided, and why",
      "     ↓",
      "   DEFINITION    specification",
      "     → the contract you approve, cut into phases",
      "     ↓",
      "   DELIVERY      implementation · review",
      "     → the code, built test-first by agents and held to your",
      "       specification",
      "     ↓",
      "   the knowledge base keeps every current decision, so the next",
      "   piece of work starts from what this one decided",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "You are the engineer throughout. What to build, why, and what it must do are your decisions, made in the early phases where a wrong turn costs a sentence to correct. Ledger's part is to argue back where it should, find the questions nobody has answered yet while you're still talking the product through, keep the record straight, and build from it. Claude answers most of the smaller calls the way you would, learning from your own answers, and brings you the ones you'd want to make yourself.",
      "",
      "=== MENU: walkthrough screen (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      "· · · · · · · · · · · ·",
      "**`◆ What next?`**",
      "",
      "**`n/next`** → Where everything starts",
      "**`s/skip`** → Stop here — it's under h/help whenever you want it",
      "**Ask**    → Ask anything about what's on this screen",
      "",
    ].join('\n'),
    [
      "=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===",
      "# **`■ How Ledger works · 2 of 8 · Where everything starts`**",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Everything begins at `/ledger`, and everything resumes there. It opens on the start menu: every piece of work in flight, each with where it has got to and what is waiting on you there, the ones waiting on you first. Ledger keeps track of where each piece of work is, not you, so there is no phase to remember and no separate command to continue anything. Picking a piece of work takes you straight to where it stands.",
      "",
      "=== DISPLAY: walkthrough diagram (emit verbatim as a text code block (```text fence)) ===",
      "Inbox: 2 ideas · 1 bug · 1 quick-fix",
      "",
      "◆ What would you like to do?",
      "",
      "1         → Continue feature: Saved Filters — build, phase 1 of 3",
      "2         → Continue bugfix: Export Timeout — investigation",
      "3         → Continue epic: Payments Overhaul — discussion, 1 of 3",
      "            topics decided",
      "p/product → Talk about the product",
      "s/start   → Start something new — describe it, and we'll find",
      "            what kind of work it is",
      "t/triage  → Triage the inbox",
      "r/roadmap → Open the product roadmap",
      "v/view    → View completed & cancelled work units",
      "m/manage  → Manage work units, the project's setup and drivers,",
      "            and the matrix",
      "h/help    → How Ledger works",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Starting something new is one row: `s` takes a description in your own words, and the kind of work is settled from it as you talk. You don't even need the menu for that. Ask Claude for a change in the middle of a conversation and it takes your words into Ledger itself, going straight to the work they name.",
      "",
      "Inside a piece of work the rhythm is the same everywhere. Ledger carries on until it reaches a decision that is genuinely yours, then it stops at a gate, shows a menu, and waits. The menu beneath this screen is one. You can answer with a key, in plain words, or close the terminal — where the Claude Code mod runs, a click on a row picks it and a second click sends it. Everything a session produces is committed to git as it goes, so leaving part-way costs nothing: the next `/ledger` shows the menu again, with that piece of work exactly where you left it.",
      "",
      "=== MENU: walkthrough screen (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      "· · · · · · · · · · · ·",
      "**`◆ What next?`**",
      "",
      "**`n/next`** → What the work is",
      "**`b/back`** → Go back a screen",
      "**`s/skip`** → Stop here — it's under h/help whenever you want it",
      "**Ask**    → Ask anything about what's on this screen",
      "",
    ].join('\n'),
    [
      "=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===",
      "# **`■ How Ledger works · 3 of 8 · What the work is`**",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Whatever you start with, the first phase is discovery, and its job is to settle what the work is. It never starts solving the problem. The kind of work decides the route through the three stages, and settling the kind is what puts the work on the right one.",
      "",
      "There are four kinds. A feature is one coherent thing to build. An epic is several distinct things wearing one name, which become topics that each travel on their own. A bugfix is something that used to work and now doesn't, with its cause still to find. A quick-fix is settled work of any size, a tweak or an update that needs no decision from you beyond a quick call. Sometimes what you describe is none of these but the product as a whole, with no single thing to build yet. Discovery notices that and carries on at that level instead, which the next screen covers.",
      "",
      "=== DISPLAY: walkthrough diagram (emit verbatim as a text code block (```text fence)) ===",
      "              DISCOVERY              DEFINITION  DELIVERY",
      "   feature    discussion             spec        build · review",
      "   epic       discussion, per topic  spec        build · review",
      "   bugfix     investigation          spec        build · review",
      "   quick-fix                                     fixes · close",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Discovery asks one question at a time and says back what it is hearing, so a wrong reading is corrected the moment it appears rather than three phases later. If you have notes, a design document or an error report, hand them over here and they travel with the work. When the picture holds steady it says what it thinks the work is and why, and asks whether that's right. Nothing is created until you say yes. At that point the work is saved, together with what you told it, and moves into its first real phase.",
      "",
      "=== MENU: walkthrough screen (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      "· · · · · · · · · · · ·",
      "**`◆ What next?`**",
      "",
      "**`n/next`** → The product takes shape",
      "**`b/back`** → Go back a screen",
      "**`s/skip`** → Stop here — it's under h/help whenever you want it",
      "**Ask**    → Ask anything about what's on this screen",
      "",
    ].join('\n'),
    [
      "=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===",
      "# **`■ How Ledger works · 4 of 8 · The product takes shape`**",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Not everything you describe is a piece of work. Sometimes it is the product: what it is, who it serves, what has to exist before launch and what can wait. Turning that into a piece of work straight away would force a shape onto it too early, so Ledger keeps a conversation about the product as a whole, the start menu's `p` row, and above the pieces of work a roadmap. When you ask for it laid out, Claude proposes the roadmap as items, at the grain you would move around a real roadmap, grouped into horizons you name yourself, in the order you mean them.",
      "",
      "The roadmap is also where a thought goes when it belongs to a later release. In the middle of any session, saying where something belongs (\"that's a v2 thing\") puts it there in one line and you carry on. Work begins when you pick items to start: they go into discovery together, which settles what kind of work they make, while the rest stay on the roadmap, visibly waiting. Each started item records which piece of work took it, so the roadmap stays true as things ship.",
      "",
      "=== DISPLAY: walkthrough diagram (emit verbatim as a text code block (```text fence)) ===",
      "launch (1)",
      "  └─ 1. The Basic Reports    idea · discovery",
      "",
      "v1 (1)",
      "  └─ 2. Exports              idea · discovery",
      "",
      "someday (1)",
      "  └─ 3. Marketplace          idea · discovery",
      "",
      "◆ What would you like to do?",
      "",
      "w/work    → Work on items now — discovery finds what kind of work",
      "            they are",
      "n/new     → Add an item — I'll ask what it is and which horizon",
      "m/move    → Move an item to another horizon you name",
      "a/archive → Archive an item",
      "p/product → Talk about the product as a whole",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Here only what still waits shows, one item to each horizon: an item leaves the roadmap once its work starts.",
      "",
      "=== MENU: walkthrough screen (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      "· · · · · · · · · · · ·",
      "**`◆ What next?`**",
      "",
      "**`n/next`** → An epic and its topics",
      "**`b/back`** → Go back a screen",
      "**`s/skip`** → Stop here — it's under h/help whenever you want it",
      "**Ask**    → Ask anything about what's on this screen",
      "",
    ].join('\n'),
    [
      "=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===",
      "# **`■ How Ledger works · 5 of 8 · An epic and its topics`**",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "An epic is what a piece of work becomes when it turns out to be several things wearing one name. Confirming one doesn't end discovery. It opens into a conversation across the whole of it, because the parts share decisions: a choice about accounts constrains billing, and a decision made twice is a decision made differently. Only when you say the ground is covered are the topics drawn out as the epic's map, which you approve, and each topic leaves with a brief carrying what concerns it and the questions still open.",
      "",
      "From then on the epic is lived through its menu: the phase it is in as the heading, how many topics are decided, in progress and not started, and a row for each topic you can pick up, the recommended one first. Each topic is talked through in a conversation of its own, topics send each other messages when one turns up something another owns, and the epic moves on to its specification once every topic is decided, cancelled or postponed.",
      "",
      "=== DISPLAY: walkthrough diagram (emit verbatim as a text code block (```text fence)) ===",
      "■ Discussion — Launch Core",
      "3 topics · 1 decided · 1 in progress · 1 not started",
      "",
      "DECIDED",
      "  └─ Sign In",
      "",
      "◆ What would you like to do?",
      "",
      "1           → Continue \"Billing\" — in progress (recommended)",
      "2           → Start \"Usage Limits\" — not started",
      "d/discovery → Change the map — a new topic, cancel, postpone,",
      "              pull forward, reactivate, or reopen a decided topic",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Here Sign In is decided, Billing is still being talked through and Usage Limits hasn't started. Changing the map, a new topic or one set aside, goes through the discovery row.",
      "",
      "=== MENU: walkthrough screen (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      "· · · · · · · · · · · ·",
      "**`◆ What next?`**",
      "",
      "**`n/next`** → The journey of one piece of work",
      "**`b/back`** → Go back a screen",
      "**`s/skip`** → Stop here — it's under h/help whenever you want it",
      "**Ask**    → Ask anything about what's on this screen",
      "",
    ].join('\n'),
    [
      "=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===",
      "# **`■ How Ledger works · 6 of 8 · The journey of one piece of work`**",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Whether it is a topic inside an epic or a feature on its own, a piece of work travels the same phases, and each builds on what the last one recorded. That is why Ledger can pick up cold: nothing downstream depends on remembering a session, only on the record.",
      "",
      "A discussion argues the design through, one conversation per topic. Its map lists your questions and the calls Claude made, each with where it stands, and the calls made since you last looked come first, so you can overrule one when it's made rather than at the end. The topic is done when nothing of yours is open. If a decision would rest on a number nobody has measured, an experiment measures it first.",
      "",
      "=== DISPLAY: walkthrough diagram (emit verbatim as a text code block (```text fence)) ===",
      "Map — Billing",
      "4 of yours: 3 decided, 1 open · 2 calls by Claude",
      "",
      "SINCE YOU LAST LOOKED (1 call by Claude)",
      "  └─ ◇ The currency the pricing page shows",
      "        The customer's own, from their billing address.",
      "",
      "OPEN (1 of yours)",
      "  └─ ○ Whether invoices go out by email       [yours]",
      "",
      "DECIDED (3 of yours · 2 calls by Claude)",
      "  ├─ ✓ Which plans launch                     [yours]",
      "  ├─ ✓ When a card payment fails              [yours]",
      "  ├─ ◇ Where invoice numbers start            [Claude's call]",
      "  ├─ ✓ Whether a plan can change mid-cycle    [yours]",
      "  └─ ◇ The currency the pricing page shows    [Claude's call]",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "The specification turns the decisions into the contract the build works from, every statement traced to a decision, and cuts it into phases. Ready to build is one screen: you approve the outline and the cut, and choose how the build runs. The build writes each phase's tasks as the phase starts; agents build them test-first, side by side, and the reviewers each one's stakes call for read it until they pass it. A review phase then holds the whole change to the specification, and finish waits for you.",
      "",
      "=== DISPLAY: walkthrough diagram (emit verbatim as a text code block (```text fence)) ===",
      "1 of 4 tasks done · 1 running",
      "",
      "  ├─ Phase 1 of 3 · Saving a filter          [running]",
      "  │  ├─ ✓ 1.1 Store a named filter set       [done]",
      "  │  ├─ ◐ 1.2 Save from the filter bar       [in progress]",
      "  │  ├─ ○ 1.3 Refuse a name already taken    [after 1.2]",
      "  │  └─ ○ 1.4 List the saved filter sets     [not started]",
      "  │",
      "  ├─ Phase 2 of 3 · Coming back to one       [not yet written]",
      "  │",
      "  └─ Phase 3 of 3 · Sharing a filter         [not yet written]",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "A bugfix finds the cause in an investigation instead of a discussion, and proves the bug with a failing test before fixing it. A quick-fix skips straight to its fixes, each built and reviewed the same way, in one session.",
      "",
      "=== MENU: walkthrough screen (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      "· · · · · · · · · · · ·",
      "**`◆ What next?`**",
      "",
      "**`n/next`** → How much of you it needs",
      "**`b/back`** → Go back a screen",
      "**`s/skip`** → Stop here — it's under h/help whenever you want it",
      "**Ask**    → Ask anything about what's on this screen",
      "",
    ].join('\n'),
    [
      "=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===",
      "# **`■ How Ledger works · 7 of 8 · How much of you it needs`**",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "The amount of you each phase needs falls as the work goes on, and that is by design. At the start nearly every turn is yours: discovery and discussion are conversations, because a wrong turn caught there costs a sentence to put right and the same wrong turn caught in review costs a rebuild. By the specification the decisions are already on record, so your part shifts to approving. The build and the review phase run largely on their own.",
      "",
      "=== DISPLAY: walkthrough diagram (emit verbatim as a text code block (```text fence)) ===",
      "   discovery        ███████████████████████████   you lead",
      "   discussion       ██████████████████████        you shape",
      "   specification    ██████████████                you approve",
      "   implementation   █████                         auto, or step",
      "   review           ████                          finish is yours",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "A few gates always stop for you: starting the work, approving an epic's map, a topic's decision, ready to build and finish. Everything smaller is a call, and Claude makes most of them the way you would, learning from your own answers. It asks you only where its calls of that kind have been missing more often than you allow, and a call that would be hard to undo, or that could lose data or weaken security, asks sooner or always. When you change one of its calls, you're later asked what its answer would have cost, so it learns. A routine gate you always answer the same way stops asking and reports in a line, and asks again once your answers vary.",
      "",
      "The build runs in one of two positions, chosen at ready to build. In auto it runs on its own and stops only for what needs you. In step it also stops after each task, for you to review and try it. You can switch at any time by saying so.",
      "",
      "=== MENU: walkthrough screen (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      "· · · · · · · · · · · ·",
      "**`◆ What next?`**",
      "",
      "**`n/next`** → Living with it",
      "**`b/back`** → Go back a screen",
      "**`s/skip`** → Stop here — it's under h/help whenever you want it",
      "**Ask**    → Ask anything about what's on this screen",
      "",
    ].join('\n'),
    [
      "=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===",
      "# **`■ How Ledger works · 8 of 8 · Living with it`**",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Once the product exists, the everyday rhythm is the same command and the same habit: `/ledger`, or just ask Claude, describe the feature or the bug or the small change, and the work takes the route its kind calls for. Thoughts that arrive at the wrong moment don't have to derail anything. Say \"log that as an idea\", or as a bug, or as a quick-fix, and it lands in the inbox, waiting for you to triage it from the start menu: work on it now, put it on the roadmap, or archive it.",
      "",
      "Nor is work locked to the shape it began with, because that shape was a reading made early, before the work had shown its size. A feature that outgrows itself becomes an epic in place, a stray feature can be absorbed into an epic as a topic, topics can be cancelled, postponed and brought back, and finished work stays finished, a later change to it new work. When a decision changes, everything that relied on it is flagged, so nothing stale is trusted by mistake.",
      "",
      "=== DISPLAY: walkthrough diagram (emit verbatim as a text code block (```text fence)) ===",
      "   a stray thought       log it as an idea, a bug or a quick-fix;",
      "                         it waits in the inbox",
      "   a later-release idea  put it on the roadmap in one line",
      "   a feature grows       pivot it into an epic, in place",
      "   a stray feature       absorb it into an epic as a topic",
      "   a topic not worth it  cancel it; bring it back later if it is",
      "   a decision was wrong  change it; what relied on it is flagged",
      "   something is unclear  h/help on any menu, or just ask",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Whenever something on screen is unclear, `h` on any menu says what that screen is for, and the start menu's help brings you back here. Any session will answer a question about how Ledger works and then put you back where you were.",
      "",
      "=== MENU: walkthrough screen (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      "· · · · · · · · · · · ·",
      "**`◆ What next?`**",
      "",
      "**`d/done`**  → Go to the start menu",
      "**Ask**     → Ask anything about what's on this screen",
      "**Tell me** → Tell me what you're likely to start with, and I'll say",
      "          what path it will take",
      "",
    ].join('\n'),
  ];

  it('every screen renders whole at the pinned width', () => {
    assert.strictEqual(loadScreen('1').total, SCREENS.length, 'a screen was added or removed without its golden');
    SCREENS.forEach((expected, i) => {
      assert.strictEqual(walkthroughScreen(loadScreen(String(i + 1)), 'first-run', false), expected, `screen ${i + 1}`);
    });
  });

  it('the first-run offer renders whole at the pinned width', () => {
    assert.strictEqual(walkthroughOffer(false), [
      "=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===",
      "# **`■ How Ledger works`**",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Before your first piece of work, there's a short guide to how Ledger fits together: what happens when you start something, what gets written down, and where you come in. It's worth reading once, because everything you meet afterwards makes more sense with the shape already in your head.",
      "",
      "Eight screens, about five minutes. Leave whenever you like.",
      "",
      "=== MENU: walkthrough offer (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      "· · · · · · · · · · · ·",
      "**`◆ Take the walkthrough?`**",
      "",
      "**`y/yes`**  → Let's do it",
      "**`s/skip`** → Skip for now — it's under h/help whenever you want it",
      "**Ask**    → Ask anything about how Ledger works",
      "",
    ].join('\n'));
  });

  it('no diagram on any screen overflows the floor, the fallback or the cap, and a sample is drawn as it stands at that width', () => {
    // The width is resolved once per process, so a second width is a second
    // process. Prose is markdown and re-flows in the reader's client; only
    // what emits as a code block has columns to hold. A sample is the live
    // surface, so its columns are the surface's at that width, which the
    // samples' own test holds.
    const at = (width) => {
      const script = `const w=require(${JSON.stringify(WALKTHROUGH)}),d=require(${JSON.stringify(DIAGRAMS)});`
        + 'const n=Number(process.env.LEDGER_DISPLAY_WIDTH),o=[];'
        + "for(let i=1;i<=w.loadScreen('1').total;i+=1){const s=w.loadScreen(String(i));"
        + "const tags=s.chunks.filter((c)=>c.kind==='diagram').map((c)=>c.tag);"
        + "const blocks=w.walkthroughScreen(s,'first-run',false).split(/^=== /m).filter((b)=>b.startsWith('DISPLAY: walkthrough diagram')).map((b)=>b.split('\\n').slice(1).join('\\n').trimEnd());"
        + "blocks.forEach((b,k)=>{const[kind,surface]=tags[k].split(' ');"
        + "if(kind==='sample'){if(b!==d.sampleDiagram(surface))o.push({screen:i,sample:surface});return;}"
        + 'for(const l of b.split(\'\\n\'))if([...l].length>n)o.push({screen:i,line:l});});}'
        + 'process.stdout.write(JSON.stringify(o));';
      return JSON.parse(execFileSync(process.execPath, ['-e', script], {
        encoding: 'utf8',
        env: { ...process.env, ...HERMETIC, LEDGER_DISPLAY_WIDTH: String(width) },
      }));
    };
    assert.deepStrictEqual(at(CAP), []);
    assert.deepStrictEqual(at(FALLBACK), []);
    assert.deepStrictEqual(at(MIN), []);
  });
});

'use strict';

// The walkthrough's diagram layouts, its sample surfaces, and the screens
// they render into.
//
// The layouts are pinned byte-for-byte at the hermetic width, then driven at
// the kernel's floor and cap: a diagram that re-flows is only worth the
// notation if it re-flows without overflowing. The samples are pinned as
// goldens too — a sample renders through the live surface's own derivation
// and projection, so a golden here moves when that surface moves, which is
// the whole point of rendering it rather than drawing it. The screens are
// pinned whole, prose included, and driven at the same three widths.

const HERMETIC = require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPTS = path.join(ROOT, 'skills', 'workflow-engine', 'scripts');
const DIAGRAMS = path.join(SCRIPTS, 'domain', 'projections', 'walkthrough-diagrams.cjs');
const WALKTHROUGH = path.join(SCRIPTS, 'domain', 'projections', 'walkthrough.cjs');
const SCREENS_DIR = path.join(ROOT, 'skills', 'workflow-engine', 'content', 'walkthrough', 'screens');

const {
  DIAGRAM_KINDS, SAMPLE_SURFACES, FIXTURES_DIR,
  isDiagramKind, renderDiagram, flowDiagram, tableDiagram, barsDiagram, sampleDiagram,
} = require(DIAGRAMS);
const { parseContent, loadScreen, walkthroughScreen } = require(WALKTHROUGH);
const { MIN, CAP, FALLBACK } = require(path.join(SCRIPTS, 'kernel', 'terminal.cjs'));
const schema = require(path.join(SCRIPTS, 'kernel', 'manifest-schema.cjs'));
const derivations = require(path.join(SCRIPTS, 'domain', 'derivations.cjs'));
const { roadmapState } = require(path.join(SCRIPTS, 'domain', 'roadmap.cjs'));

/** The notation each screen's fence carries, verbatim from the approved content. */
const SOURCE = {
  flow: [
    'a piece of work, described in your own words',
    '↓',
    'DISCOVERY | research · experiment · discussion',
    '  → what was explored, what you decided, and why',
    '↓',
    'DEFINITION | specification · planning',
    '  → the contract you approve, and the plan built from it',
    '↓',
    'DELIVERY | implementation · review',
    '  → the code, built test-first by agents and held to your specification',
    '↓',
    'the knowledge base keeps every finished document, so the next piece of work starts from what this one decided',
  ].join('\n'),
  kinds: [
    ' | DISCOVERY | DEFINITION | DELIVERY',
    'feature | discussion | spec · plan | build · review',
    'epic | per topic | per topic | per topic',
    'bugfix | investigation | spec · plan | build · review',
    'quick-fix |  | scoping | build · review',
    'cross-cutting | discussion | spec |',
  ].join('\n'),
  phases: [
    '── DISCOVERY',
    'research | what is known and what is feasible, per topic',
    'experiment | a number measured, when a decision rests on one',
    'discussion | the design argued through to conclusions',
    '',
    '── DEFINITION',
    'specification | the contract everything after it is built from',
    'planning | phases and tasks, each with acceptance criteria',
    '',
    '── DELIVERY',
    'implementation | the code, built test-first, one task at a time',
    'review | the finished work held to the specification',
  ].join('\n'),
  effort: [
    'discovery | 1 | you lead',
    'discussion | 0.8 | you shape',
    'specification | 0.5 | you approve',
    'planning | 0.3 | you check',
    'implementation | 0.18 | gates, or auto',
    'review | 0.1 | agent-led',
  ].join('\n'),
  situations: [
    'a stray thought | log it as an idea, a bug or a quick-fix; it waits in the inbox',
    'a later-release idea | park it on the roadmap in one line',
    'a feature grows | pivot it into an epic, in place',
    'a stray feature | absorb it into an epic as a topic',
    'a topic not worth it | cancel it; reactivate it later if it is',
    'a decision was wrong | reopen the phase; what was built on it reads "input moved" until reconciled',
    'something is unclear | h/help on the start menu, or just ask',
  ].join('\n'),
};

/** Every tagged fence in the walk, in screen order — the notation as the screens actually carry it. */
function screenFences() {
  return fs.readdirSync(SCREENS_DIR).filter((f) => f.endsWith('.md')).sort()
    .flatMap((name) => parseContent(path.join(SCREENS_DIR, name)).chunks
      .filter((c) => c.kind === 'diagram')
      .map((c) => ({ screen: name, tag: c.tag, text: c.text })));
}

// Characters, not bytes: the diagrams are drawn with arrows and blocks, each
// of which is several bytes wide.
/** @param {string} label @param {string} text @param {number} width */
function fits(label, text, width) {
  const over = text.split('\n').filter((l) => [...l].length > width);
  assert.deepStrictEqual(over, [], `${label} at ${width}: ${over.length} line(s) overflow\n${text}`);
}

describe('walkthrough diagram layouts', () => {
  it('the notation driven here is the notation the screens carry, one diagram to a screen', () => {
    assert.deepStrictEqual(screenFences(), [
      { screen: '01-the-idea.md', tag: 'flow', text: SOURCE.flow },
      { screen: '02-where-everything-starts.md', tag: 'sample start-menu', text: '' },
      { screen: '03-what-the-work-is.md', tag: 'table', text: SOURCE.kinds },
      { screen: '04-the-product-takes-shape.md', tag: 'sample roadmap', text: '' },
      { screen: '05-an-epic-and-its-topics.md', tag: 'sample epic-dashboard', text: '' },
      { screen: '06-the-journey-of-one-piece-of-work.md', tag: 'table', text: SOURCE.phases },
      { screen: '07-how-much-of-you-it-needs.md', tag: 'bars', text: SOURCE.effort },
      { screen: '08-living-with-it.md', tag: 'table', text: SOURCE.situations },
    ]);
  });

  it('flow: the spine hangs off the gutter, labels share a column, text wraps under itself', () => {
    assert.strictEqual(flowDiagram(SOURCE.flow, FALLBACK), [
      '   a piece of work, described in your own words',
      '     ↓',
      '   DISCOVERY     research · experiment · discussion',
      '     → what was explored, what you decided, and why',
      '     ↓',
      '   DEFINITION    specification · planning',
      '     → the contract you approve, and the plan built from it',
      '     ↓',
      '   DELIVERY      implementation · review',
      '     → the code, built test-first by agents and held to your',
      '       specification',
      '     ↓',
      '   the knowledge base keeps every finished document, so the next',
      '   piece of work starts from what this one decided',
    ].join('\n'));
  });

  it('table: fixed columns take the longest cell plus a gap, the last takes the rest', () => {
    assert.strictEqual(tableDiagram(SOURCE.kinds, FALLBACK), [
      '                  DISCOVERY      DEFINITION   DELIVERY',
      '   feature        discussion     spec · plan  build · review',
      '   epic           per topic      per topic    per topic',
      '   bugfix         investigation  spec · plan  build · review',
      '   quick-fix                     scoping      build · review',
      '   cross-cutting  discussion     spec',
    ].join('\n'));
  });

  it('table: a band divider fills the width and its rows indent two beneath it', () => {
    assert.strictEqual(tableDiagram(SOURCE.phases, FALLBACK), [
      '── DISCOVERY ────────────────────────────────────────────────────',
      '  research        what is known and what is feasible, per topic',
      '  experiment      a number measured, when a decision rests on one',
      '  discussion      the design argued through to conclusions',
      '',
      '── DEFINITION ───────────────────────────────────────────────────',
      '  specification   the contract everything after it is built from',
      '  planning        phases and tasks, each with acceptance criteria',
      '',
      '── DELIVERY ─────────────────────────────────────────────────────',
      '  implementation  the code, built test-first, one task at a time',
      '  review          the finished work held to the specification',
    ].join('\n'));
  });

  it('table: the last column wraps under itself', () => {
    assert.strictEqual(tableDiagram(SOURCE.situations, FALLBACK), [
      '   a stray thought       log it as an idea, a bug or a quick-fix;',
      '                         it waits in the inbox',
      '   a later-release idea  park it on the roadmap in one line',
      '   a feature grows       pivot it into an epic, in place',
      '   a stray feature       absorb it into an epic as a topic',
      '   a topic not worth it  cancel it; reactivate it later if it is',
      '   a decision was wrong  reopen the phase; what was built on it',
      '                         reads "input moved" until reconciled',
      '   something is unclear  h/help on the start menu, or just ask',
    ].join('\n'));
  });

  it('bars: the bar takes what is left between the label column and the note column', () => {
    assert.strictEqual(barsDiagram(SOURCE.effort, FALLBACK), [
      '   discovery        ████████████████████████████   you lead',
      '   discussion       ██████████████████████         you shape',
      '   specification    ██████████████                 you approve',
      '   planning         ████████                       you check',
      '   implementation   █████                          gates, or auto',
      '   review           ███                            agent-led',
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
    assert.match(kinds, /^ {3}feature\n {5}DISCOVERY: discussion\n {5}DEFINITION: spec · plan\n {5}DELIVERY: build · review$/m);
    // The header row is the source of those labels, so it never renders as a row of its own.
    assert.ok(!kinds.split('\n')[0].includes('DEFINITION      DELIVERY'), kinds);
    // A row whose cell is empty contributes no line.
    assert.match(kinds, /^ {3}quick-fix\n {5}DEFINITION: scoping$/m);
    // A headerless table's cells stand alone beneath the first.
    assert.match(tableDiagram(SOURCE.situations, MIN), /^ {3}a feature grows\n {5}pivot it into an epic, in place$/m);
    // A row short of the table's columns keeps its cells in their own
    // columns rather than throwing its last one into the wrapping column.
    assert.strictEqual(tableDiagram('alpha | one | two\nbeta | three', FALLBACK), [
      '   alpha  one    two',
      '   beta   three',
    ].join('\n'));
    // Two columns still fit at the floor — the fallback engages on need, never on width alone.
    assert.match(tableDiagram(SOURCE.phases, MIN), /^ {2}research {8}what is known and what$/m);
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
      /`sample` names one of start-menu, roadmap, epic-dashboard — got "nowhere"/);
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
  it('start-menu: the overview, then the menu as plain text, h/help last', () => {
    const out = sampleDiagram('start-menu');
    assert.strictEqual(out, [
      'Features',
      '  └─ 1. Saved Filters',
      '',
      'Bugfixes',
      '  └─ 2. Export Timeout',
      '',
      'Epics',
      '  └─ 3. Payments Overhaul',
      '',
      '◆ What would you like to do?',
      '',
      '1               → Continue "Saved Filters" — feature, ready for',
      '                  discussion',
      '2               → Continue "Export Timeout" — bugfix,',
      '                  investigation (in-progress)',
      '3               → Continue "Payments Overhaul" — epic',
      's/start         → Start something new (not sure what kind yet)',
      'f/feature       → Start new feature',
      'e/epic          → Start new epic',
      'b/bugfix        → Start new bugfix',
      'q/quick-fix     → Start new quick-fix',
      'c/cross-cutting → Start new cross-cutting concern',
      'm/manage        → Manage a work unit\'s lifecycle',
      'h/help          → How the workflows work',
    ].join('\n'));
    // A sample is an illustration inside a code block: no markdown, no
    // opening dot rule, and no non-breaking spaces a fence has no use for.
    assert.ok(!/[*`\u00a0]|· · ·/.test(out), out);
    assert.strictEqual(out.split('\n').pop(), 'h/help          → How the workflows work');
  });

  it('roadmap: two launch items in flight as one epic, the rest waiting', () => {
    assert.strictEqual(sampleDiagram('roadmap'), [
      'Roadmap (5 items — 2 in flight · 3 waiting)',
      'launch',
      '  ├─ ◐ Sign In',
      '  │     ↳ In flight: launch-core',
      '  │',
      '  ├─ ◐ Billing',
      '  │     ↳ In flight: launch-core',
      '  │',
      '  └─ ○ The Basic Reports',
      '        the numbers a customer checks every day',
      '        ↳ Waiting',
      '',
      'v1',
      '  └─ ○ Exports',
      '        csv and pdf of any report',
      '        ↳ Waiting',
      '',
      'someday',
      '  └─ ○ Marketplace',
      '        third-party integrations, listed and billed',
      '        ↳ Waiting',
    ].join('\n'));
  });

  it('epic-dashboard: topics in every band, no key and no callout', () => {
    const out = sampleDiagram('epic-dashboard');
    assert.strictEqual(out, [
      '── DISCOVERY ────────────────────────────────────────────────────',
      '',
      'RESEARCH & DISCUSSION (3 topics · 1 decided · 1 in flight · 1',
      'fresh)',
      '  ├─ ✓ Sign In',
      '  │     Accounts, sessions and the sign-in surface.',
      '  │     ↳ Decided',
      '  │',
      '  ├─ ◐ Billing',
      '  │     Plans, invoices and the payment provider.',
      '  │     ↳ Discussing',
      '  │',
      '  └─ ○ Usage Limits',
      '        What a plan allows, and what happens at the edge.',
      '        ↳ Fresh · routed to research',
      '',
      '── DEFINITION ───────────────────────────────────────────────────',
      '',
      'SPECIFICATION (1 completed)',
      '  └─ Sign In       [completed]',
      '     └─ Sign In    [incorporated]',
      '',
      'PLANNING (1 completed)',
      '  └─ Sign In    [completed · local-markdown]',
      '',
      '── DELIVERY ─────────────────────────────────────────────────────',
      '',
      'IMPLEMENTATION (1 in-progress)',
      '  └─ Sign In    [in-progress]',
    ].join('\n'));
    assert.ok(!out.includes('⚑'), 'a sample carries no callout');
    assert.ok(!/Key:|Status:/.test(out), 'a sample carries no legend');
  });

  it('every sample re-flows with the surface it depicts', () => {
    // The tree width is resolved once per process, so a second width is a
    // second process — the subject here IS the resolution.
    const at = (width) => {
      const script = `const d=require(${JSON.stringify(DIAGRAMS)});`
        + `for(const s of ${JSON.stringify(SAMPLE_SURFACES)})process.stdout.write(d.sampleDiagram(s)+"\\n");`;
      return execFileSync(process.execPath, ['-e', script], {
        encoding: 'utf8',
        env: { ...process.env, ...HERMETIC, WORKFLOWS_DISPLAY_WIDTH: String(width) },
      });
    };
    fits('samples', at(CAP), CAP);
    // At the floor the epic dashboard's planning row runs one column over,
    // and it is the live surface doing it: the kernel tightens a tag column
    // it cannot fit to a single space and lets the remainder soft-wrap
    // (render.cjs columniseTags), exactly as it would for this epic on a
    // 40-column pane. Pinned rather than relaxed — a sample that starts
    // overflowing somewhere new should say so here.
    assert.deepStrictEqual(
      at(MIN).split('\n').filter((l) => [...l].length > MIN),
      ['  └─ Sign In [completed · local-markdown]'],
    );
  });

  it('every fixture is a schema-valid .workflows tree', () => {
    assert.deepStrictEqual(fs.readdirSync(FIXTURES_DIR).sort(), [...SAMPLE_SURFACES].sort());
    for (const surface of SAMPLE_SURFACES) {
      const dir = path.join(FIXTURES_DIR, surface);
      const wf = path.join(dir, '.workflows');
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
      "=== TITLE (emit verbatim as markdown — the view's chrome heading) ===",
      "# **`■ How the workflows work · 1 of 8 · The idea`**",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "This is a short guide to how the workflows work. Over the next eight screens it explains what happens when you start a piece of work, what gets written down along the way, and how much of it needs you. It's worth reading once before you begin, because everything you meet afterwards makes more sense with the shape already in your head. It takes about five minutes, you can leave at any point, and if you skip it now it's waiting under help on the start menu whenever you'd rather come back.",
      "",
      "Claude Code is a capable engineer with two gaps. It forgets everything between sessions, and it has no process for how a piece of work should unfold, so every session starts cold and improvises from there. The workflows fill both. Every piece of work goes through a phased process in which each phase produces a document the next phase is built from, and a knowledge base keeps those documents once the work is done, so nothing decided is decided twice.",
      "",
      "=== DISPLAY: walkthrough diagram (emit verbatim as a code block) ===",
      "   a piece of work, described in your own words",
      "     ↓",
      "   DISCOVERY     research · experiment · discussion",
      "     → what was explored, what you decided, and why",
      "     ↓",
      "   DEFINITION    specification · planning",
      "     → the contract you approve, and the plan built from it",
      "     ↓",
      "   DELIVERY      implementation · review",
      "     → the code, built test-first by agents and held to your",
      "       specification",
      "     ↓",
      "   the knowledge base keeps every finished document, so the next",
      "   piece of work starts from what this one decided",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "You are the engineer throughout. What to build, why, and what it must do are your decisions, made in the early phases where a wrong turn costs a sentence to correct, and everything downstream is built from them rather than from memory. The system's part is to argue back where it should, keep the record straight, build from the record, and check its own work against it.",
      "",
      "=== MENU: walkthrough screen (emit verbatim as markdown, then STOP for the user's response) ===",
      "· · · · · · · · · · · ·",
      "**`◆ What next?`**",
      "",
      "**`n/next`** → Where everything starts",
      "**`s/skip`** → Skip this for now — it's under h/help whenever you want",
      "         it",
      "**Ask**    → Ask anything about what's on this screen",
      "",
    ].join('\n'),
    [
      "=== TITLE (emit verbatim as markdown — the view's chrome heading) ===",
      "# **`■ How the workflows work · 2 of 8 · Where everything starts`**",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Everything begins at `/workflow-start`, and everything resumes there. It opens on an overview of every piece of work in flight, grouped by kind, with where each one has got to and what it is waiting on. The reason it is one command rather than several is that the system keeps track of where each piece of work is, not you: there is no phase to remember and no separate command to continue anything. The menu beneath the overview offers a key for each piece of work and says what it recommends.",
      "",
      "=== DISPLAY: walkthrough diagram (emit verbatim as a code block) ===",
      "Features",
      "  └─ 1. Saved Filters",
      "",
      "Bugfixes",
      "  └─ 2. Export Timeout",
      "",
      "Epics",
      "  └─ 3. Payments Overhaul",
      "",
      "◆ What would you like to do?",
      "",
      "1               → Continue \"Saved Filters\" — feature, ready for",
      "                  discussion",
      "2               → Continue \"Export Timeout\" — bugfix,",
      "                  investigation (in-progress)",
      "3               → Continue \"Payments Overhaul\" — epic",
      "s/start         → Start something new (not sure what kind yet)",
      "f/feature       → Start new feature",
      "e/epic          → Start new epic",
      "b/bugfix        → Start new bugfix",
      "q/quick-fix     → Start new quick-fix",
      "c/cross-cutting → Start new cross-cutting concern",
      "m/manage        → Manage a work unit's lifecycle",
      "h/help          → How the workflows work",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Starting something new is one row. If you already know what it is, say so: `f` for a feature, `b` for a bugfix, and so on. If you don't, `s` takes a description in your own words and the discovery phase settles the kind of work from it. Either way, what happens next is a short exchange about what the work actually is, which is the subject of the next screen.",
      "",
      "Inside a piece of work the rhythm is the same everywhere. The system carries on with the work until it reaches a decision that is genuinely yours, then it stops at a gate, shows a menu, and waits. The menu beneath this screen is one. You can answer with a key, in plain words, go back, or close the terminal. Everything a session produces is committed to git as it goes, which is why leaving part-way costs nothing: the next `/workflow-start` shows the overview again, with that piece of work exactly where you left it.",
      "",
      "=== MENU: walkthrough screen (emit verbatim as markdown, then STOP for the user's response) ===",
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
      "=== TITLE (emit verbatim as markdown — the view's chrome heading) ===",
      "# **`■ How the workflows work · 3 of 8 · What the work is`**",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Whatever you start with, the first phase is discovery, and its only job is to settle what the work is. It never starts solving the problem. The reason it comes first is that the kind of work decides the route through the three stages, and settling the kind is what puts the work on the right one.",
      "",
      "There are five kinds. A feature is one coherent thing to build. An epic is several distinct things wearing one name, which becomes topics that each travel on their own. A bugfix is something that used to work and now doesn't. A quick-fix is small and mechanical, with nothing to debate. A cross-cutting concern is a standard for the codebase to follow rather than something to ship. Sometimes what you describe is none of these but the product as a whole, with no single thing to build yet. Discovery notices that and carries on at that level instead, which the next screen covers.",
      "",
      "=== DISPLAY: walkthrough diagram (emit verbatim as a code block) ===",
      "                  DISCOVERY      DEFINITION   DELIVERY",
      "   feature        discussion     spec · plan  build · review",
      "   epic           per topic      per topic    per topic",
      "   bugfix         investigation  spec · plan  build · review",
      "   quick-fix                     scoping      build · review",
      "   cross-cutting  discussion     spec",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Discovery works by asking one question at a time and saying back what it is hearing, so a wrong reading is corrected the moment it appears rather than three phases later. If you have notes, a design document or an error report, hand them over here and they travel with the work. When the picture holds steady it says what it thinks the work is and why, and asks whether that's right. Nothing is written to the repository until you say yes. At that point the work is saved, together with what you told it, and routed into its first real phase.",
      "",
      "=== MENU: walkthrough screen (emit verbatim as markdown, then STOP for the user's response) ===",
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
      "=== TITLE (emit verbatim as markdown — the view's chrome heading) ===",
      "# **`■ How the workflows work · 4 of 8 · The product takes shape`**",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Not everything you describe is a piece of work. Sometimes it is the product: what it is, what has to exist before launch, what can wait until there is revenue. Turning that into a work unit straight away would force a shape onto it too early, so the workflows keep a layer above the pieces of work for exactly this, the roadmap. Discovery carries on at that altitude, listening for how you stage things, and when you ask for it laid out it proposes the roadmap as items, at the grain you would move around a real roadmap, grouped into horizons you name yourself, in the order you mean them.",
      "",
      "The roadmap is also where a thought goes when it belongs to a later release. In the middle of any session, saying where something belongs (\"that's a v2 thing\") parks it there in one line and you carry on. Work begins when you choose items to start. Several usually become an epic, one becomes a feature, and the new piece of work is fenced to exactly those items while the rest stay on the roadmap, visibly waiting. Each started item records which piece of work took it, so the roadmap stays true as things ship.",
      "",
      "=== DISPLAY: walkthrough diagram (emit verbatim as a code block) ===",
      "Roadmap (5 items — 2 in flight · 3 waiting)",
      "launch",
      "  ├─ ◐ Sign In",
      "  │     ↳ In flight: launch-core",
      "  │",
      "  ├─ ◐ Billing",
      "  │     ↳ In flight: launch-core",
      "  │",
      "  └─ ○ The Basic Reports",
      "        the numbers a customer checks every day",
      "        ↳ Waiting",
      "",
      "v1",
      "  └─ ○ Exports",
      "        csv and pdf of any report",
      "        ↳ Waiting",
      "",
      "someday",
      "  └─ ○ Marketplace",
      "        third-party integrations, listed and billed",
      "        ↳ Waiting",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Here two of the launch items have been started together as one epic, and the rest wait their turn.",
      "",
      "=== MENU: walkthrough screen (emit verbatim as markdown, then STOP for the user's response) ===",
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
      "=== TITLE (emit verbatim as markdown — the view's chrome heading) ===",
      "# **`■ How the workflows work · 5 of 8 · An epic and its topics`**",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "An epic is what a piece of work becomes when it turns out to be several things wearing one name. Confirming one doesn't end discovery. It opens into a design session across the whole of it, with the system as a second senior engineer who is willing to disagree, and who writes down not only what was decided but what was considered and dropped. The reason the whole is designed before any part is that the parts share decisions: a choice about accounts constrains billing, and a decision made twice is a decision made differently. Only when you say the ground is covered are the topics drawn out, and each leaves with a brief carrying the decisions, the rejected paths and the open questions that concern it.",
      "",
      "From then on the epic is lived through its dashboard: the three stages as bands, each topic beneath them at wherever it has got to, and a menu that recommends the next move. Topics travel at their own pace, so one can be under construction while another is still being decided, and the dashboard is where that is visible at a glance.",
      "",
      "=== DISPLAY: walkthrough diagram (emit verbatim as a code block) ===",
      "── DISCOVERY ────────────────────────────────────────────────────",
      "",
      "RESEARCH & DISCUSSION (3 topics · 1 decided · 1 in flight · 1",
      "fresh)",
      "  ├─ ✓ Sign In",
      "  │     Accounts, sessions and the sign-in surface.",
      "  │     ↳ Decided",
      "  │",
      "  ├─ ◐ Billing",
      "  │     Plans, invoices and the payment provider.",
      "  │     ↳ Discussing",
      "  │",
      "  └─ ○ Usage Limits",
      "        What a plan allows, and what happens at the edge.",
      "        ↳ Fresh · routed to research",
      "",
      "── DEFINITION ───────────────────────────────────────────────────",
      "",
      "SPECIFICATION (1 completed)",
      "  └─ Sign In       [completed]",
      "     └─ Sign In    [incorporated]",
      "",
      "PLANNING (1 completed)",
      "  └─ Sign In    [completed · local-markdown]",
      "",
      "── DELIVERY ─────────────────────────────────────────────────────",
      "",
      "IMPLEMENTATION (1 in-progress)",
      "  └─ Sign In    [in-progress]",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Here Sign In is being built while Billing is still being decided and Usage Limits hasn't started.",
      "",
      "=== MENU: walkthrough screen (emit verbatim as markdown, then STOP for the user's response) ===",
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
      "=== TITLE (emit verbatim as markdown — the view's chrome heading) ===",
      "# **`■ How the workflows work · 6 of 8 · The journey of one piece of work`**",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Whether it is a topic inside an epic or a feature on its own, a piece of work travels the same phases, and each phase ends by writing a document the next one is built from. That chain is the reason the system can pick up cold: nothing downstream depends on remembering a session, only on reading what it left.",
      "",
      "Discovery is where the thinking happens. Research surveys the ground when there is ground to survey. A discussion argues the design through to conclusions, guided by a live map of what is settled and what is still open, and if a decision turns out to rest on a number nobody has measured, an experiment is designed, run and reported before the decision is taken. Definition turns those conclusions into a specification, the contract everything after it is built from, and breaks it into a plan of phases and tasks with acceptance criteria. Delivery is where agents take the tasks one at a time, writing the tests before the code, and a review at the end holds the finished work to the specification and says plainly whether the two match.",
      "",
      "=== DISPLAY: walkthrough diagram (emit verbatim as a code block) ===",
      "── DISCOVERY ────────────────────────────────────────────────────",
      "  research        what is known and what is feasible, per topic",
      "  experiment      a number measured, when a decision rests on one",
      "  discussion      the design argued through to conclusions",
      "",
      "── DEFINITION ───────────────────────────────────────────────────",
      "  specification   the contract everything after it is built from",
      "  planning        phases and tasks, each with acceptance criteria",
      "",
      "── DELIVERY ─────────────────────────────────────────────────────",
      "  implementation  the code, built test-first, one task at a time",
      "  review          the finished work held to the specification",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "A bugfix replaces the discussion with an investigation into why things broke, a quick-fix does the whole of Definition in one scoping pass, and a cross-cutting concern, being a standard rather than something to ship, ends at its specification. When a phase concludes, its document is indexed into the knowledge base, so later work can find what this one decided.",
      "",
      "=== MENU: walkthrough screen (emit verbatim as markdown, then STOP for the user's response) ===",
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
      "=== TITLE (emit verbatim as markdown — the view's chrome heading) ===",
      "# **`■ How the workflows work · 7 of 8 · How much of you it needs`**",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "The amount of you each phase needs falls as the work goes on, and that is by design. At the start nearly every stop is a decision that is yours: discovery and discussion stop often, because a wrong turn caught there costs a sentence to put right and the same wrong turn caught in review costs a rebuild. By the time the specification is being written the decisions are already on record, so your part shifts to reading and approving. Planning and implementation run almost entirely on their own, pausing at gates, and review is agent-led from beginning to end.",
      "",
      "=== DISPLAY: walkthrough diagram (emit verbatim as a code block) ===",
      "   discovery        ████████████████████████████   you lead",
      "   discussion       ██████████████████████         you shape",
      "   specification    ██████████████                 you approve",
      "   planning         ████████                       you check",
      "   implementation   █████                          gates, or auto",
      "   review           ███                            agent-led",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "A gate is never answered on your behalf, however reasonable the answer might look. If you would rather not be asked at a particular gate, you say so, and `auto` hands that one gate over for the rest of the sitting. It is scoped that narrowly on purpose: a standing preference would turn into a way of skipping decisions without noticing. A few gates never yield at all, because what they guard would otherwise be quietly overwritten.",
      "",
      "=== MENU: walkthrough screen (emit verbatim as markdown, then STOP for the user's response) ===",
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
      "=== TITLE (emit verbatim as markdown — the view's chrome heading) ===",
      "# **`■ How the workflows work · 8 of 8 · Living with it`**",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Once the product exists, the everyday rhythm is the same command and the same habit: `/workflow-start`, describe the feature or the bug or the small fix, and the work takes the route its kind calls for. Thoughts that arrive at the wrong moment don't have to derail anything. Say \"log that as an idea\", or as a bug, or as a quick-fix, and it lands in the inbox to be picked up from the start menu whenever you are ready. Say where a thought belongs on the roadmap and it is parked there instead.",
      "",
      "Nor is work locked to the shape it began with, because that shape was a reading made early, before the work had shown its size. A feature that outgrows itself becomes an epic in place, a stray feature can be absorbed into one as a topic, topics can be cancelled and brought back, and any finished phase can be reopened. When one is, everything built on it is marked as having its input moved, and nothing downstream is recommended again until that phase has taken the change into account, so nothing stale is trusted by mistake.",
      "",
      "=== DISPLAY: walkthrough diagram (emit verbatim as a code block) ===",
      "   a stray thought       log it as an idea, a bug or a quick-fix;",
      "                         it waits in the inbox",
      "   a later-release idea  park it on the roadmap in one line",
      "   a feature grows       pivot it into an epic, in place",
      "   a stray feature       absorb it into an epic as a topic",
      "   a topic not worth it  cancel it; reactivate it later if it is",
      "   a decision was wrong  reopen the phase; what was built on it",
      "                         reads \"input moved\" until reconciled",
      "   something is unclear  h/help on the start menu, or just ask",
      "",
      "=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===",
      "Whenever something on screen is unclear, `h` from the start menu brings you back here, and any session will answer a question about how the workflows work and then put you back where you were.",
      "",
      "=== MENU: walkthrough screen (emit verbatim as markdown, then STOP for the user's response) ===",
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

  it('no diagram on any screen overflows the floor, the fallback or the cap', () => {
    // The width is resolved once per process, so a second width is a second
    // process. Prose is markdown and re-flows in the reader's client; only
    // what emits as a code block has columns to hold.
    const at = (width) => {
      const script = `const w=require(${JSON.stringify(WALKTHROUGH)});`
        + 'const n=Number(process.env.WORKFLOWS_DISPLAY_WIDTH),o=[];'
        + "for(let i=1;i<=w.loadScreen('1').total;i+=1){let d=false;"
        + "for(const l of w.walkthroughScreen(w.loadScreen(String(i)),'first-run',false).split('\\n')){"
        + "if(l.startsWith('=== ')){d=l.startsWith('=== DISPLAY: walkthrough diagram');continue;}"
        + 'if(d&&[...l].length>n)o.push({screen:i,line:l});}}'
        + 'process.stdout.write(JSON.stringify(o));';
      return JSON.parse(execFileSync(process.execPath, ['-e', script], {
        encoding: 'utf8',
        env: { ...process.env, ...HERMETIC, WORKFLOWS_DISPLAY_WIDTH: String(width) },
      }));
    };
    assert.deepStrictEqual(at(CAP), []);
    assert.deepStrictEqual(at(FALLBACK), []);
    // At the floor one row of the epic sample runs a single column over, and
    // it is the live surface doing it — the kernel tightens a tag column it
    // cannot fit and lets the remainder soft-wrap, exactly as it would for
    // this epic on a 40-column pane. Pinned to that one row rather than
    // allowed in general: a diagram that starts overflowing anywhere else
    // has to say so here.
    assert.deepStrictEqual(at(MIN), [{ screen: 5, line: '  └─ Sign In [completed · local-markdown]' }]);
  });
});

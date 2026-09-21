'use strict';

// The walkthrough's diagram layouts and its sample surfaces.
//
// The layouts are pinned byte-for-byte at the hermetic width, then driven at
// the kernel's floor and cap: a diagram that re-flows is only worth the
// notation if it re-flows without overflowing. The samples are pinned as
// goldens too — a sample renders through the live surface's own derivation
// and projection, so a golden here moves when that surface moves, which is
// the whole point of rendering it rather than drawing it.

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

const {
  DIAGRAM_KINDS, SAMPLE_SURFACES, FIXTURES_DIR,
  isDiagramKind, renderDiagram, flowDiagram, tableDiagram, barsDiagram, sampleDiagram,
} = require(DIAGRAMS);
const { parseContent } = require(path.join(SCRIPTS, 'domain', 'projections', 'walkthrough.cjs'));
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
    'a feature fits an epic | absorb it as one of the epic\'s topics',
    'a topic isn\'t worth it | cancel it; reactivate it later if it is',
    'a decision was wrong | reopen the phase; what was built on it reads "input moved" until reconciled',
    'something is unclear | h/help on the start menu, or just ask',
  ].join('\n'),
};

// Characters, not bytes: the diagrams are drawn with arrows and blocks, each
// of which is several bytes wide.
/** @param {string} label @param {string} text @param {number} width */
function fits(label, text, width) {
  const over = text.split('\n').filter((l) => [...l].length > width);
  assert.deepStrictEqual(over, [], `${label} at ${width}: ${over.length} line(s) overflow\n${text}`);
}

describe('walkthrough diagram layouts', () => {
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
      '   a stray thought         log it as an idea, a bug or a',
      '                           quick-fix; it waits in the inbox',
      '   a later-release idea    park it on the roadmap in one line',
      '   a feature grows         pivot it into an epic, in place',
      '   a feature fits an epic  absorb it as one of the epic\'s topics',
      '   a topic isn\'t worth it  cancel it; reactivate it later if it',
      '                           is',
      '   a decision was wrong    reopen the phase; what was built on it',
      '                           reads "input moved" until reconciled',
      '   something is unclear    h/help on the start menu, or just ask',
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

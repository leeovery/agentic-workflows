'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the walkthrough's diagram layouts. A content file's fence may
// carry a language tag naming the shape its body is written in, and this
// module turns that notation into laid-out text at the pane's width.
//
// Four kinds. `flow` is a spine of nodes and arrows — the one strict
// sequence in the walk. `table` is rows against columns, optionally split
// into bands. `bars` is a share of a budget against a note. `sample` is not
// drawn here at all: it renders a live surface from a fixture through that
// surface's own derivation and projection, so the picture cannot drift from
// the thing it depicts.
//
// Pure over (source, width) — nothing here knows a screen — and every layout
// is left-anchored on the gutter: the arrow spine, the label column and the
// tree glyphs only line up when everything hangs off one column.
// ---------------------------------------------------------------------------

const path = require('path');
const { wrap, wrapWithPrefix, signpost } = require('../../kernel/render.cjs');
const { loadActiveManifests } = require('../reads.cjs');
const { startDetail } = require('../start.cjs');
const { roadmapState } = require('../roadmap.cjs');
const { epicDetail } = require('../epic-detail.cjs');
const { startOverview, startMenu } = require('./start.cjs');
const { roadmapMapView } = require('./roadmap.cjs');
const { epicDashboard } = require('./epic.cjs');

// The column every diagram hangs off. Three columns reads as a figure inset
// from the prose around it without costing the narrowest pane a wrap.
const GUTTER = 3;

// Flow: the arrow spine sits two columns in from the gutter, a detail line
// starts there too and its continuation hangs two columns past its marker.
const SPINE_INDENT = GUTTER + 2;
const DETAIL_TEXT = SPINE_INDENT + 2;
const FLOW_LABEL_GAP = 4;
const ARROW = '↓';

// Table: blank columns between the longest cell of a column and the next.
const CELL_GAP = 2;
// Rows indent three under a plain table and two beneath band dividers,
// matching the dashboard's stage blocks.
const TABLE_INDENT = GUTTER;
const BAND_ROW_INDENT = 2;
// Below this the last column stops being a column and the table renders one
// block per row instead.
const MIN_LAST_COLUMN = 16;

// Bars: the gap after the longest label, and the gap before the note column.
const BAR_LABEL_GAP = 3;
const BAR_NOTE_GAP = 3;
const BAR_GLYPH = '█';

/** The fence tags a content file may carry. An untagged fence stays verbatim. */
const DIAGRAM_KINDS = ['flow', 'table', 'bars', 'sample'];

/** The live surfaces a `sample` fence may name. */
const SAMPLE_SURFACES = ['start-menu', 'roadmap', 'epic-dashboard'];

const FIXTURES_DIR = path.join(__dirname, '..', '..', '..', 'content', 'walkthrough', 'fixtures');

/** @param {number} n */
function pad(n) {
  return ' '.repeat(Math.max(0, n));
}

/** Source lines with trailing blanks trimmed off each. @param {string} source @returns {string[]} */
function sourceLines(source) {
  return source.split('\n').map((l) => l.replace(/\s+$/, ''));
}

// ---------------------------------------------------------------------------
// flow
// ---------------------------------------------------------------------------

/**
 * @typedef {object} FlowElement
 * @property {'arrow'|'detail'|'node'} kind
 * @property {string} [label]
 * @property {string} [text]
 */

/** @param {string} line @returns {FlowElement} */
function flowElement(line) {
  const t = line.trim();
  if (t === ARROW) return { kind: 'arrow' };
  if (t.startsWith('→')) return { kind: 'detail', text: t.slice(1).trim() };
  const at = t.indexOf(' | ');
  if (at === -1) return { kind: 'node', text: t };
  return { kind: 'node', label: t.slice(0, at).trim(), text: t.slice(at + 3).trim() };
}

/**
 * One element per line, hung off the gutter: a node (optionally `label |
 * text`, labels aligned into one column across the whole flow), `↓` for an
 * arrow on the spine, `→ ` for a detail beneath the node above. Text wraps
 * under itself.
 * @param {string} source @param {number} width
 * @returns {string}
 */
function flowDiagram(source, width) {
  const elements = sourceLines(source).filter((l) => l.trim() !== '').map(flowElement);
  const labelWidth = Math.max(0, ...elements.map((e) => (e.label ? e.label.length : 0)));
  const textColumn = labelWidth ? GUTTER + labelWidth + FLOW_LABEL_GAP : GUTTER;
  /** @type {string[]} */
  const out = [];
  for (const e of elements) {
    if (e.kind === 'arrow') {
      out.push(pad(SPINE_INDENT) + ARROW);
      continue;
    }
    if (e.kind === 'detail') {
      const segs = wrap(String(e.text), Math.max(1, width - DETAIL_TEXT));
      out.push(pad(SPINE_INDENT) + '→ ' + segs[0]);
      for (const seg of segs.slice(1)) out.push(pad(DETAIL_TEXT) + seg);
      continue;
    }
    if (!e.label) {
      out.push(...wrapWithPrefix(String(e.text), { width, prefix: pad(GUTTER) }));
      continue;
    }
    const segs = wrap(String(e.text), Math.max(1, width - textColumn));
    out.push(pad(GUTTER) + e.label.padEnd(textColumn - GUTTER) + segs[0]);
    for (const seg of segs.slice(1)) out.push(pad(textColumn) + seg);
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// table
// ---------------------------------------------------------------------------

/**
 * @typedef {object} TableLine
 * @property {'band'|'blank'|'row'} kind
 * @property {string} [name]
 * @property {string[]} [cells]
 */

/** @param {string} line @returns {TableLine} */
function tableLine(line) {
  const t = line.trim();
  if (t === '') return { kind: 'blank' };
  if (t.startsWith('── ')) return { kind: 'band', name: t.slice(3).trim() };
  return { kind: 'row', cells: t.split('|').map((c) => c.trim()) };
}

/**
 * Rows of ` | `-separated cells. A `── NAME` line is a band divider filled to
 * the width; a row whose first cell is empty is the header, rendered in
 * place; a blank source line is a blank output line. Fixed columns take the
 * longest cell plus a gap and the last column takes the rest, wrapping under
 * itself. When the fixed columns leave the last one no room, the table falls
 * back to one block per row.
 * @param {string} source @param {number} width
 * @returns {string}
 */
function tableDiagram(source, width) {
  const lines = sourceLines(source).map(tableLine);
  const rows = /** @type {string[][]} */ (lines.filter((l) => l.kind === 'row').map((l) => l.cells));
  if (rows.length === 0) return '';
  const columns = Math.max(...rows.map((r) => r.length));
  const banded = lines.some((l) => l.kind === 'band');
  const indent = banded ? BAND_ROW_INDENT : TABLE_INDENT;
  const header = rows[0][0] === '' ? rows[0] : null;

  /** @type {number[]} the left column of each cell */
  const at = [indent];
  for (let c = 0; c < columns - 1; c += 1) {
    const widest = Math.max(0, ...rows.map((r) => (r[c] || '').length));
    at.push(at[c] + widest + CELL_GAP);
  }
  const blocks = width - at[columns - 1] < MIN_LAST_COLUMN;

  /** @type {string[]} */
  const out = [];
  for (const line of lines) {
    if (line.kind === 'blank') { out.push(''); continue; }
    if (line.kind === 'band') { out.push(signpost(String(line.name), { width })); continue; }
    const cells = /** @type {string[]} */ (line.cells);
    if (cells === header && blocks) continue;
    out.push(...(blocks ? rowBlock(cells, header, width, indent) : rowLine(cells, at, width, columns)));
  }
  return out.join('\n');
}

/** One gridded row: fixed cells in their columns, the last wrapping under itself. A row short of the table's columns simply has no last-column cell. @param {string[]} cells @param {number[]} at @param {number} width @param {number} columns @returns {string[]} */
function rowLine(cells, at, width, columns) {
  const last = at[columns - 1];
  let line = '';
  for (let c = 0; c < Math.min(cells.length, columns - 1); c += 1) {
    if (cells[c] === '') continue;
    line = line.padEnd(at[c]) + cells[c];
  }
  const tail = cells.length >= columns ? cells[columns - 1] : '';
  if (tail === '') return [line.replace(/\s+$/, '')];
  const segs = wrap(tail, Math.max(1, width - last));
  return [
    (line.padEnd(last) + segs[0]).replace(/\s+$/, ''),
    ...segs.slice(1).map((seg) => pad(last) + seg),
  ];
}

/** One row as a block: the first cell at the gutter, the rest beneath it under their header labels. @param {string[]} cells @param {string[]|null} header @param {number} width @param {number} indent @returns {string[]} */
function rowBlock(cells, header, width, indent) {
  const prefix = pad(indent + CELL_GAP);
  const out = wrapWithPrefix(cells[0], { width, prefix: pad(indent), hang: CELL_GAP });
  for (let c = 1; c < cells.length; c += 1) {
    if (cells[c] === '') continue;
    const label = header && header[c] ? `${header[c]}: ` : '';
    out.push(...wrapWithPrefix(label + cells[c], { width, prefix, hang: CELL_GAP }));
  }
  return out;
}

// ---------------------------------------------------------------------------
// bars
// ---------------------------------------------------------------------------

/**
 * Rows of `label | share | note`. The label column takes the longest label,
 * the note column sits against the right edge, and the bar takes what is
 * between them — so the bars scale with the pane rather than the page they
 * were drawn on. A non-zero share always draws at least one block.
 * @param {string} source @param {number} width
 * @returns {string}
 */
function barsDiagram(source, width) {
  const rows = sourceLines(source)
    .filter((l) => l.trim() !== '')
    .map((l) => {
      const [label, share, note] = l.split('|').map((c) => c.trim());
      const fraction = Number(share);
      if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
        throw new Error(`walkthrough diagram: \`bars\` row "${label}" takes a share between 0 and 1 — got "${share ?? ''}"`);
      }
      return { label: label || '', share: fraction, note: note || '' };
    });
  if (rows.length === 0) return '';
  const labelColumn = GUTTER + Math.max(...rows.map((r) => r.label.length)) + BAR_LABEL_GAP;
  const widestNote = Math.max(...rows.map((r) => r.note.length));
  const budget = Math.max(1, width - widestNote - BAR_NOTE_GAP - labelColumn);
  const noteColumn = labelColumn + budget + BAR_NOTE_GAP;
  const noteBudget = Math.max(1, width - noteColumn);
  /** @type {string[]} */
  const out = [];
  for (const r of rows) {
    const filled = r.share > 0 ? Math.max(1, Math.round(r.share * budget)) : 0;
    const head = pad(GUTTER) + r.label.padEnd(labelColumn - GUTTER) + BAR_GLYPH.repeat(filled);
    if (r.note === '') { out.push(head.replace(/\s+$/, '')); continue; }
    const segs = wrap(r.note, noteBudget);
    out.push(head.padEnd(noteColumn) + segs[0]);
    for (const seg of segs.slice(1)) out.push(pad(noteColumn) + seg);
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// sample
// ---------------------------------------------------------------------------

const NBSP = '\u00a0';

// A menu is markdown on the live surface and plain text in a sample: the
// sample is an illustration inside a code block, never a menu to answer.
// Padding sits outside the markup on the live surface, so dropping the
// markers keeps the arrow column exactly where the projection put it; the
// non-breaking spaces a wrapped label indents with are only there to survive
// a markdown renderer, which a fence has no need of.
/** @param {string} text */
function asPlainText(text) {
  return text
    .replace(/\*\*|\*|`/g, '')
    .split(NBSP).join(' ')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n');
}

/** The fixture tree one sample derives from. @param {string} surface */
function fixtureDir(surface) {
  return path.join(FIXTURES_DIR, surface);
}

/** The start overview and the menu beneath it, as a first `/workflow-start` of the day shows them. @returns {string} */
function startSample() {
  const dir = fixtureDir('start-menu');
  const detail = startDetail(dir);
  // The menu's opening dot rule frames a live gate; a sample has nothing to
  // frame, so the rows arrive under the overview directly.
  const rows = startMenu(detail).rendered.split('\n').slice(1).join('\n');
  return asPlainText(`${startOverview(detail).replace(/\n+$/, '')}\n\n${rows}`);
}

/** The roadmap after two of its launch items have been started as one epic. @returns {string} */
function roadmapSample() {
  return roadmapMapView(roadmapState(fixtureDir('roadmap'))).replace(/\n+$/, '');
}

/** The epic dashboard with topics in every band. The key and the ⚑ callouts stay behind: a sample teaches the shape, not the legend. @returns {string} */
function epicSample() {
  const dir = fixtureDir('epic-dashboard');
  const manifest = loadActiveManifests(dir).find((m) => m.work_type === 'epic');
  if (!manifest) throw new Error('walkthrough sample epic-dashboard: the fixture holds no active epic');
  return epicDashboard(manifest.name, epicDetail(dir, manifest), { newArrivals: {}, presence: [] })
    .replace(/\n+$/, '');
}

/** @type {Record<string, () => string>} */
const SAMPLES = {
  'start-menu': startSample,
  roadmap: roadmapSample,
  'epic-dashboard': epicSample,
};

/**
 * The named live surface, rendered from its fixture through its own
 * derivation and projection.
 * @param {string} surface
 * @returns {string}
 */
function sampleDiagram(surface) {
  const render = SAMPLES[surface];
  if (!render) {
    throw new Error(`walkthrough diagram: \`sample\` names one of ${SAMPLE_SURFACES.join(', ')} — got "${surface}"`);
  }
  return render();
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Lay out one tagged fence. The tag is the kind, optionally followed by its
 * argument (`sample start-menu`).
 * @param {string} tag @param {string} source @param {number} width
 * @returns {string}
 */
function renderDiagram(tag, source, width) {
  const [kind, ...rest] = String(tag).trim().split(/\s+/);
  if (kind === 'flow') return flowDiagram(source, width);
  if (kind === 'table') return tableDiagram(source, width);
  if (kind === 'bars') return barsDiagram(source, width);
  if (kind === 'sample') return sampleDiagram(rest.join(' '));
  throw new Error(`walkthrough diagram: unknown fence tag "${tag}" (tags: ${DIAGRAM_KINDS.join(', ')})`);
}

/** Whether a fence tag names a layout this module draws. @param {string} tag @returns {boolean} */
function isDiagramKind(tag) {
  return DIAGRAM_KINDS.includes(String(tag).trim().split(/\s+/)[0]);
}

module.exports = {
  DIAGRAM_KINDS,
  SAMPLE_SURFACES,
  FIXTURES_DIR,
  isDiagramKind,
  renderDiagram,
  flowDiagram,
  tableDiagram,
  barsDiagram,
  sampleDiagram,
};

'use strict';

// ---------------------------------------------------------------------------
// Domain ring: composition conventions for workflow renders.
//
// These know what workflow content should LOOK like — the glyph vocabulary,
// the `[tag]` suffix format, the `↳` derived-from line — and produce the plain
// strings that the kernel renderer (../kernel/render.cjs) lays out. Keeping
// conventions here, separate from layout, means the format is normalised in
// one place while the renderer stays domain-free.
//
// This layer grows as call sites are wired; only add what a real consumer needs.
// ---------------------------------------------------------------------------

const { wrapWithPrefix } = require('../kernel/render.cjs');

// Tree content width: total rendered width INCLUDING the gutter — the
// deliberate narrow-wrap choice (narrow reads well on mobile / split panes,
// and pre-empts terminal soft-wrap orphaning the │ gutter). Dividers, boxes,
// and markers stay at the kernel's canonical 49; trees wrap to this.
const TREE_WIDTH = 65;

// Composed sub-header (`  LABEL (count summary)`) clamped to the tree width
// budget: 2-space indent on every line, wrapped like tree body so a long
// breakdown can never overflow the rows hanging beneath it. Returns the
// wrapped lines joined, no trailing newline.
/** @param {string} text */
function treeHeader(text) {
  return wrapWithPrefix(text, { width: TREE_WIDTH, prefix: '  ' }).join('\n');
}

// Upper-case the first character (the rest is left untouched).
/** @param {string} s */
function capitalise(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Human-readable display name (the `(titlecase)` casing hint): split on
// hyphens and underscores, capitalise the first letter of each word, join
// with spaces. `auth-flow` → `Auth Flow`.
/** @param {string} s */
// Titlecase a phase label without disturbing its punctuation: every
// alphabetic run is capitalised in place, so parentheses and hyphens
// survive. `discussion (in-progress)` → `Discussion (In-Progress)`.
/** @param {string} s */
function titlecaseLabel(s) {
  return String(s).replace(/[a-z]+/gi, (w) => capitalise(w));
}

function titlecase(s) {
  return String(s).split(/[-_\s]+/).filter(Boolean).map(capitalise).join(' ');
}

// Slug form (the `(kebabcase)` casing hint): lower-case, non-alphanumeric runs
// collapse to single hyphens. `Auth Flow` → `auth-flow`.
/** @param {string} s */
function kebabcase(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// `[term]` — the item status / lifecycle suffix.
/** @param {string} term */
function tag(term) {
  return `[${term}]`;
}

// `↳ Derived-from` line — provenance, capitalised. Feeds a tree node's body[].
/** @param {string} text */
function derivedFrom(text) {
  return '↳ ' + capitalise(String(text).trim());
}

// Compose a tree node's title from its parts: `glyph label [tag]`. Any part may
// be omitted. Single space between segments; the tag is bracketed.
// Labels are user-authored names with no length limit; clamp them here so a
// pathological name cannot overflow the tree row — the glyph and tag always
// survive the clamp.
const LABEL_MAX = 40;

/** @param {{glyph?: string, label?: string, tag?: string}} [parts] */
function title({ glyph, label, tag: term } = {}) {
  const parts = [];
  if (glyph) parts.push(glyph);
  if (label) parts.push(label.length > LABEL_MAX ? label.slice(0, LABEL_MAX - 1) + '…' : label);
  let line = parts.join(' ');
  if (term) line += (line ? ' ' : '') + tag(term);
  return line;
}

// Discovery-tier glyph vocabulary — the single source of the tier symbol set.
const DISCOVERY_GLYPH = {
  ready_for_discussion: '→',
  researching: '◐',
  discussing: '◐',
  decided: '✓',
  fresh: '○',
  handled: '⊙',
  cancelled: '⊘',
};

/** @param {string} tier */
function discoveryGlyph(tier) {
  return DISCOVERY_GLYPH[/** @type {keyof typeof DISCOVERY_GLYPH} */ (tier)] || '';
}

// Discovery-map row `[tag]` vocabulary — the lifecycle label each map row
// carries. One phrasing, every map render (epic dashboard, discovery session
// map view). `researchState` is the topic's actual research-item status (null
// when none exists — see computeTopicLifecycle's research_state): a handled
// topic claims a research fan-out only when research completed or was
// superseded (in-flight or cancelled research fanned nothing out), and
// superseded research is named as such, never as complete.
/** @param {string} lifecycle @param {string|null} [routing] @param {string|null} [researchState] */
function discoveryLifecycleLabel(lifecycle, routing, researchState) {
  switch (lifecycle) {
    case 'ready_for_discussion':
      return researchState === 'superseded'
        ? 'research superseded · ready for discussion'
        : 'research complete · ready for discussion';
    case 'researching': return 'researching';
    case 'discussing': return 'discussing';
    case 'decided': return 'decided';
    case 'handled':
      return researchState === 'completed' || researchState === 'superseded'
        ? 'handled · research fanned out'
        : 'handled';
    case 'cancelled': return 'cancelled';
    default: return routing ? `fresh · routed to ${routing}` : 'fresh';
  }
}

// Discussion-map glyph vocabulary — subtopic states. Distinct from the
// discovery tiers: the symbol sets evolve independently.
const DISCUSSION_GLYPH = {
  pending: '○',
  exploring: '◐',
  converging: '→',
  decided: '✓',
  deferred: '⊙',
};

/** @param {string} state */
function discussionGlyph(state) {
  return DISCUSSION_GLYPH[/** @type {keyof typeof DISCUSSION_GLYPH} */ (state)] || '';
}

// Specification legend vocabulary — the Key block's term descriptions, by
// category. Projections compose a Key from whichever terms the display shows.
const SPEC_LEGEND = {
  discussion: {
    extracted: 'content has been incorporated into the specification',
    pending: 'listed as source but content not yet extracted',
    ready: 'completed and available to be specified',
    reopened: 'was extracted but discussion has regressed to in-progress',
  },
  consult: {
    pending: 'sibling correction not yet read in and reconciled',
    addressed: 'correction applied or cited; reconciliation recorded',
  },
  spec: {
    'in-progress': 'specification work is ongoing',
    completed: 'specification is done',
  },
};

module.exports = {
  titlecaseLabel,
  TREE_WIDTH, treeHeader, capitalise, titlecase, kebabcase, tag, derivedFrom, title,
  discoveryGlyph, DISCOVERY_GLYPH, discoveryLifecycleLabel,
  discussionGlyph, DISCUSSION_GLYPH, SPEC_LEGEND,
};

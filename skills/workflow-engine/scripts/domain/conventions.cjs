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

// Tree content width: total rendered width INCLUDING the gutter — the
// deliberate narrow-wrap choice (narrow reads well on mobile / split panes,
// and pre-empts terminal soft-wrap orphaning the │ gutter). Dividers, boxes,
// and markers stay at the kernel's canonical 49; trees wrap to this.
const TREE_WIDTH = 65;

// Upper-case the first character (the rest is left untouched).
/** @param {string} s */
function capitalise(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Human-readable display name (the `(titlecase)` casing hint): split on
// hyphens and underscores, capitalise the first letter of each word, join
// with spaces. `auth-flow` → `Auth Flow`.
/** @param {string} s */
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
/** @param {{glyph?: string, label?: string, tag?: string}} [parts] */
function title({ glyph, label, tag: term } = {}) {
  const parts = [];
  if (glyph) parts.push(glyph);
  if (label) parts.push(label);
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
// map view).
/** @param {string} lifecycle @param {string|null} [routing] */
function discoveryLifecycleLabel(lifecycle, routing) {
  switch (lifecycle) {
    case 'ready_for_discussion': return 'research complete · ready for discussion';
    case 'researching': return 'researching';
    case 'discussing': return 'discussing';
    case 'decided': return 'decided';
    case 'handled': return 'handled · research fanned out';
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
  TREE_WIDTH, capitalise, titlecase, kebabcase, tag, derivedFrom, title,
  discoveryGlyph, DISCOVERY_GLYPH, discoveryLifecycleLabel,
  discussionGlyph, DISCUSSION_GLYPH, SPEC_LEGEND,
};

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

module.exports = {
  TREE_WIDTH, capitalise, titlecase, tag, derivedFrom, title,
  discoveryGlyph, DISCOVERY_GLYPH, discussionGlyph, DISCUSSION_GLYPH,
};

#!/usr/bin/env node
'use strict';

// ---------------------------------------------------------------------------
// Domain-aware composition helpers for workflow renders.
//
// These know what workflow content should LOOK like — the glyph vocabulary,
// the `[tag]` suffix format, the `↳` derived-from line — and produce the plain
// strings that the generic renderer (render.cjs) lays out. Keeping conventions
// here, separate from layout, means the format is normalised in one place while
// the renderer stays domain-free.
//
// This layer grows as call sites are wired; only add what a real consumer needs.
// ---------------------------------------------------------------------------

// Upper-case the first character (the rest is left untouched).
function capitalise(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// `[term]` — the item status / lifecycle suffix.
function tag(term) {
  return `[${term}]`;
}

// `↳ Derived-from` line — provenance, capitalised. Feeds a tree node's body[].
function derivedFrom(text) {
  return '↳ ' + capitalise(String(text).trim());
}

// Compose a tree node's title from its parts: `glyph label [tag]`. Any part may
// be omitted. Single space between segments; the tag is bracketed.
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

function discoveryGlyph(tier) {
  return DISCOVERY_GLYPH[tier] || '';
}

module.exports = { capitalise, tag, derivedFrom, title, discoveryGlyph, DISCOVERY_GLYPH };

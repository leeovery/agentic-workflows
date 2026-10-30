'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the entry's answer (enter.cjs) — any question first, each in
// the section it is drawn in, then the DATA naming what to read and the log
// the conversation keeps, one `key: value` line each: the question comes
// before the reading (2.10.3).
// ---------------------------------------------------------------------------

const { dataSection } = require('./surfaces.cjs');

/**
 * @param {string[]} questions each a section, drawn whole
 * @param {[string, string][]} lines
 * @returns {string}
 */
function entrySections(questions, lines) {
  return [...questions, dataSection(lines.map(([key, value]) => `${key}: ${value}`))].join('');
}

module.exports = { entrySections };

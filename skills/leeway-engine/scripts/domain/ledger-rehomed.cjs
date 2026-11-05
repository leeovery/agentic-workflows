'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the lines a unit gave up, read where they were carried
// (5.8.18, 18.3.5). A `rehomed` line (ledger-events.cjs) lists, by id, the
// lines made at the places a unit gives up — an absorbed feature's — and
// each file they name that the move took elsewhere. Every read takes a line
// a carry lists as made in the unit and on the topic the carry is made at,
// its phase its own, and each file it names — a citation's, an asset link's
// — at the path it moved to. A carry sits after the lines it carries, so a
// read gathers the carries before it reads any line: the fold
// (ledger-fold.cjs), and the files every ledger commit takes (ledger.cjs).
// ---------------------------------------------------------------------------

/**
 * Where a carried line is read: its unit and topic, and where each file the
 * carry moved went.
 * @typedef {{unit: string, topic: string|null, files: Map<string, string>}} Rehomed
 */

/**
 * The place each carried line is read at, by its id.
 * @param {Iterable<Record<string, unknown>>} carries the ledger's `rehomed` lines
 * @returns {Map<string, Rehomed>}
 */
function rehomedPlaces(carries) {
  /** @type {Map<string, Rehomed>} */
  const places = new Map();
  for (const carry of carries) {
    const at = {
      unit: /** @type {string} */ (carry.unit),
      topic: typeof carry.topic === 'string' ? carry.topic : null,
      files: new Map(/** @type {[string, string][]} */ (carry.files)),
    };
    for (const id of /** @type {string[]} */ (carry.lines)) places.set(id, at);
  }
  return places;
}

/**
 * `event` as every read takes it: where `places` carried it, if anywhere,
 * each file it names where the carry moved it.
 * @param {Map<string, Rehomed>} places @param {Record<string, unknown>} event
 * @returns {Record<string, unknown>}
 */
function asRehomed(places, event) {
  const at = places.get(/** @type {string} */ (event.id));
  if (at === undefined) return event;
  const moved = (/** @type {string} */ file) => at.files.get(file) ?? file;
  /** @type {Record<string, unknown>} */
  const read = { ...event, unit: at.unit, topic: at.topic };
  if (Array.isArray(event.cites)) read.cites = event.cites.map((/** @type {{path: string, section: string}} */ cite) => ({ ...cite, path: moved(cite.path) }));
  if (event.event === 'asset') read.path = moved(/** @type {string} */ (event.path));
  return read;
}

module.exports = { rehomedPlaces, asRehomed };

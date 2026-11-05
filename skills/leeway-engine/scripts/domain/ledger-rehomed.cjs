'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the lines a unit gave up, read where they were carried
// (5.8.18, 18.3.5). A `rehomed` line (ledger-events.cjs) lists, by id, the
// lines made at the places a unit gives up — an absorbed feature's, a moved
// quick-fix's (workunit-move.cjs) — and each file they name that the move
// took elsewhere. Every read takes a line a carry lists as made in the unit
// and on the topic the carry is made at, its phase its own, and each file
// it names — a citation's, an asset link's — at the path it moved to. A
// line carried twice — a quick-fix moved to a feature, then absorbed — is
// read where the latest carry took it, each file it names followed through
// every carry's moves in the ledger's order, a later carry's `from` being
// where an earlier one took the file. A carry sits after the lines it
// carries, so a read gathers the carries before it reads any line: the fold
// (ledger-fold.cjs), and the files every ledger commit takes (ledger.cjs).
// ---------------------------------------------------------------------------

/**
 * Where a carried line is read: its unit and topic, and each carry's moves
 * of the files it names, in the ledger's order.
 * @typedef {{unit: string, topic: string|null, files: Map<string, string>[]}} Rehomed
 */

/**
 * The place each carried line is read at, by its id.
 * @param {Iterable<Record<string, unknown>>} carries the ledger's `rehomed` lines, in its order
 * @returns {Map<string, Rehomed>}
 */
function rehomedPlaces(carries) {
  /** @type {Map<string, Rehomed>} */
  const places = new Map();
  for (const carry of carries) {
    const unit = /** @type {string} */ (carry.unit);
    const topic = typeof carry.topic === 'string' ? carry.topic : null;
    const moves = new Map(/** @type {[string, string][]} */ (carry.files));
    for (const id of /** @type {string[]} */ (carry.lines)) {
      places.set(id, { unit, topic, files: [...(places.get(id)?.files ?? []), moves] });
    }
  }
  return places;
}

/**
 * `event` as every read takes it: where `places` carried it, if anywhere,
 * each file it names where the carries moved it.
 * @param {Map<string, Rehomed>} places @param {Record<string, unknown>} event
 * @returns {Record<string, unknown>}
 */
function asRehomed(places, event) {
  const at = places.get(/** @type {string} */ (event.id));
  if (at === undefined) return event;
  const moved = (/** @type {string} */ file) => at.files.reduce((path, moves) => moves.get(path) ?? path, file);
  /** @type {Record<string, unknown>} */
  const read = { ...event, unit: at.unit, topic: at.topic };
  if (Array.isArray(event.cites)) read.cites = event.cites.map((/** @type {{path: string, section: string}} */ cite) => ({ ...cite, path: moved(cite.path) }));
  if (event.event === 'asset') read.path = moved(/** @type {string} */ (event.path));
  return read;
}

module.exports = { rehomedPlaces, asRehomed };

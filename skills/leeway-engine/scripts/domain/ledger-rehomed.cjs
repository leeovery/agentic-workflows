'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the lines a unit gave up, read where they were carried
// (5.8.18, 18.3.5). A `rehomed` line (ledger-events.cjs) lists, by id, the
// lines made at the places a unit gives up — an absorbed feature's, a moved
// quick-fix's or bugfix's (workunit-move.cjs) — and each file they name
// that the move took elsewhere. Every read takes a line a carry lists as
// made in the unit and on the topic the carry is made at, and each file it
// names — a citation's, an asset link's — at the path it moved to. Its
// phase is the carry's where the carry is made in the unit the line stands
// in — a move, which re-types the unit, so the phases the line was made in
// are the old type's — and its own where the carry takes it into another
// unit — an absorb, the feature's phases being the epic topic's. A line
// carried twice — a quick-fix moved to a feature, then absorbed — is read
// where the latest carry took it, each carry taking it from where the one
// before left it, and each file it names followed through every carry's
// moves in the ledger's order, a later carry's `from` being where an
// earlier one took the file. A carry sits after the lines it carries, so a
// read gathers the carries before it reads any line: the fold
// (ledger-fold.cjs), and the files every ledger commit takes (ledger.cjs).
// ---------------------------------------------------------------------------

/**
 * One carry of a line: the place it is made at, and its moves of the files
 * the lines name.
 * @typedef {{unit: string, topic: string|null, phase: string, files: Map<string, string>}} Carry
 */

/**
 * The carries of each carried line, by its id, in the ledger's order.
 * @param {Iterable<Record<string, unknown>>} carries the ledger's `rehomed` lines, in its order
 * @returns {Map<string, Carry[]>}
 */
function rehomedPlaces(carries) {
  /** @type {Map<string, Carry[]>} */
  const places = new Map();
  for (const carry of carries) {
    /** @type {Carry} */
    const made = {
      unit: /** @type {string} */ (carry.unit),
      topic: typeof carry.topic === 'string' ? carry.topic : null,
      phase: /** @type {string} */ (carry.phase),
      files: new Map(/** @type {[string, string][]} */ (carry.files)),
    };
    for (const id of /** @type {string[]} */ (carry.lines)) places.set(id, [...(places.get(id) ?? []), made]);
  }
  return places;
}

/**
 * `event` as every read takes it: where `places` carried it, if anywhere,
 * each file it names where the carries moved it.
 * @param {Map<string, Carry[]>} places @param {Record<string, unknown>} event
 * @returns {Record<string, unknown>}
 */
function asRehomed(places, event) {
  const carried = places.get(/** @type {string} */ (event.id));
  if (carried === undefined) return event;
  const moved = (/** @type {string} */ file) => carried.reduce((path, { files }) => files.get(path) ?? path, file);
  const at = carried.reduce(
    (from, { unit, topic, phase }) => ({ unit, topic, phase: unit === from.unit ? phase : from.phase }),
    { unit: /** @type {string} */ (event.unit), topic: event.topic, phase: /** @type {string} */ (event.phase) },
  );
  /** @type {Record<string, unknown>} */
  const read = { ...event, ...at };
  if (Array.isArray(event.cites)) read.cites = event.cites.map((/** @type {{path: string, section: string}} */ cite) => ({ ...cite, path: moved(cite.path) }));
  if (event.event === 'asset') read.path = moved(/** @type {string} */ (event.path));
  return read;
}

module.exports = { rehomedPlaces, asRehomed };

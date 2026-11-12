'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a learned gate's showing held (learned-gates.cjs) — the
// showing's own record, one for a gate at its place: the showing it is and
// when it opened. It is kept with the place's state, in its cache —
// `.cache/{unit}/{phase}/{topic}/.showings/{gate}.json`, and for a gate that
// comes at no place, the import reprompt, `.cache/.showings/{gate}.json` —
// so it outlives the conversation, and goes with the unit's cache at its
// close (cache.cjs).
//
// A surface's draw opens it (decision-point.cjs); a verb's check of the
// gate's step reads it and opens none. While it stands the gate shows on it
// and is never drawn again, and every answer to it is logged under it
// (gate.cjs). Only three things end it: the gate's own pick of a row that
// leaves the gate (gate.cjs); a step, which never comes while it stands; and
// the gate's surface finding the gate no longer due (decided.cjs). Nothing
// else touches it: not another gate, a raise, or the conversation's end.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { writeJsonAtomic } = require('../kernel/manifest-io.cjs');

/** @typedef {import('./learned-gates.cjs').Place} Place */
/** A showing held: its digest and when it opened. @typedef {{showing: string, opened: string}} Held */

/**
 * Where the gate `gate`'s showing at `place` is held, in the state at `root`.
 * @param {string} root @param {string} gate @param {Place} place
 */
function holdFile(root, gate, { unit, phase, topic }) {
  const at = [unit, phase, topic].filter((part) => part !== null);
  return path.join(root, '.cache', ...at, '.showings', `${gate.replace(/[^a-z0-9]+/g, '-')}.json`);
}

/**
 * The showing of the gate `gate` held at `place`; null where none is.
 * @param {string} root @param {string} gate @param {Place} place @returns {Held|null}
 */
function heldShowing(root, gate, place) {
  try {
    const held = JSON.parse(fs.readFileSync(holdFile(root, gate, place), 'utf8'));
    return typeof held?.showing === 'string' && typeof held.opened === 'string' ? { showing: held.showing, opened: held.opened } : null;
  } catch {
    return null;
  }
}

/**
 * Hold the gate `gate`'s showing `showing` at `place`, opened now.
 * @param {string} root @param {string} gate @param {Place} place @param {string} showing @returns {Held}
 */
function holdShowing(root, gate, place, showing) {
  const held = { showing, opened: new Date().toISOString() };
  const file = holdFile(root, gate, place);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeJsonAtomic(file, { gate, ...held });
  return held;
}

/**
 * End the gate `gate`'s showing held at `place` — where `own` is given, only
 * that showing, the one it is and that opened then.
 * @param {string} root @param {string} gate @param {Place} place @param {Held|null} [own]
 */
function endShowing(root, gate, place, own = null) {
  const held = heldShowing(root, gate, place);
  if (own !== null && (held?.showing !== own.showing || held.opened !== own.opened)) return;
  fs.rmSync(holdFile(root, gate, place), { force: true });
}

module.exports = { heldShowing, holdShowing, endShowing };

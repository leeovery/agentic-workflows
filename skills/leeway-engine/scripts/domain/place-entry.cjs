'use strict';

// ---------------------------------------------------------------------------
// Domain ring: when a place was last entered — the time `enter` stamps on
// the place it enters (enter.cjs), kept beside the place's presence in its
// cache, `.cache/{unit}/{phase}/{topic}/entered.json`, `{"at": "<ISO>"}`;
// the product's conversation's at `product/discovery/product`, as its
// presence is. Each entry writes it afresh, a level move's among them, and
// nothing else writes it: it outlives the conversation and goes with the
// unit's cache at its close. Gitignored, in no commit.
//
// It tells one stay at a place from the next: a learned gate's showing is
// drawn from it (decision-point.cjs). A gate at no place reads the place
// the conversation sits at, as its position names it (`sittingPlace`): the
// product's conversation for the project place `product`, a unit's place
// for any other; none for a project place discovery never enters, the
// roadmap, nor a conversation with no position.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { PRODUCT } = require('../kernel/manifest-schema.cjs');
const { writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { readPosition } = require('./conversation.cjs');

/** @typedef {import('./learned-gates.cjs').Place} Place */

/** Where the place `unit`/`phase`/`topic` keeps when it was last entered. @param {string} cwd @param {string} unit @param {string} phase @param {string} topic */
const entryFile = (cwd, unit, phase, topic) => statePath(cwd, '.cache', unit, phase, topic, 'entered.json');

/**
 * Stamp the place `unit`/`phase`/`topic` entered now.
 * @param {string} cwd @param {string} unit @param {string} phase @param {string} topic
 */
function recordEntry(cwd, unit, phase, topic) {
  const file = entryFile(cwd, unit, phase, topic);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeJsonAtomic(file, { at: new Date().toISOString() });
}

/**
 * When `place` was last entered; null where it names no place whole or no
 * entry is recorded there.
 * @param {string} cwd @param {Place|null} place @returns {string|null}
 */
function enteredAt(cwd, place) {
  if (place === null || place.unit === null || place.phase === null || place.topic === null) return null;
  try {
    const { at } = JSON.parse(fs.readFileSync(entryFile(cwd, place.unit, place.phase, place.topic), 'utf8'));
    return typeof at === 'string' ? at : null;
  } catch {
    return null;
  }
}

/** The place the calling conversation sits at, as its position names it (the header's); null where it names none. @returns {Place|null} */
function sittingPlace() {
  const sessionId = handedSession();
  const position = sessionId === null ? null : readPosition(sessionId);
  if (position === null) return null;
  if (position.name === PRODUCT && position.phase === undefined) return { unit: PRODUCT, phase: 'discovery', topic: PRODUCT };
  return position.phase === undefined || position.topic === undefined ? null : { unit: position.name, phase: position.phase, topic: position.topic };
}

module.exports = { recordEntry, enteredAt, sittingPlace };

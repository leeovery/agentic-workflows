'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the Portal labeller (session-label.cjs). Inside a Portal
// session `$ZMX_SESSION` holds the session's name, which never changes;
// what Portal shows beside it is a free-text label: `portal current` prints
// it, `portal rename -- <text>` sets it, and `portal rename` with no text
// resets it to the name. The label applied is `{base} · {place}`, the base
// the label up to its first ` · `, so a label of the person's own made the
// same way never stacks with Ledger's.
//
// The original label is stashed in the store (session-label-store.cjs),
// keyed by the session's name, under `portal/`. Since the name is stable, a
// label still worn is found by its record alone: a re-label keeps the
// stashed original, and a label the person set since is adopted as the new
// one. Restore puts the original back only while the label is exactly the
// one applied. `portal rename` acts on the session it runs in, so only this
// terminal's session is ever labelled, restored or repaired.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { execFileSync } = require('../kernel/spawn.cjs');
const { callerIdentity, ownsRow } = require('../kernel/process.cjs');
const { stashDir, stashName, writeRecord, putRecordBack, readStash, ownerDead } = require('./session-label-store.cjs');

const SEPARATOR = ' · ';

/**
 * @typedef {object} PortalSession
 * @property {string} session the session's name (`$ZMX_SESSION`)
 * @property {string} label   what Portal shows for it now
 */

/**
 * @typedef {object} PortalStash
 * @property {string} session     the session's name
 * @property {string} original    the label to restore
 * @property {string} applied     the label we set
 * @property {string|null} session_id owning conversation (CLAUDE_CODE_SESSION_ID)
 * @property {number|null} pid        owning Claude process (CLAUDE_PID at apply)
 * @property {string|null} pid_start  its start time — recycled-pid guard
 */

/** @param {string[]} args @returns {string} */
function portal(args) {
  return execFileSync('portal', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).replace(/\n$/, '');
}

/** Whether the session runs inside Portal. */
function present() {
  return Boolean(process.env.ZMX_SESSION);
}

/**
 * The Portal session this terminal runs in, with its label. Null outside
 * Portal; throws when `portal current` does not answer.
 * @returns {PortalSession|null}
 */
function read() {
  const session = process.env.ZMX_SESSION;
  if (!session) return null;
  return { session, label: portal(['current']) };
}

/** A label up to its first ` · `. @param {string} label */
function baseOf(label) {
  const at = label.indexOf(SEPARATOR);
  return at === -1 ? label : label.slice(0, at);
}

/** @param {string} cwd @param {string} session */
function stashPath(cwd, session) {
  return stashDir(cwd, 'portal', `${stashName(session)}.json`);
}

/**
 * Label the session `label` — reset to its name, by `portal rename` with no
 * text, where the label is the name.
 * @param {PortalSession} ctx @param {string} label
 */
function rename(ctx, label) {
  portal(label === ctx.session ? ['rename'] : ['rename', '--', label]);
}

/**
 * Label the session `{base} · {place}`, the original stashed first: the
 * stashed one while the label is still the one applied, else the label
 * worn now. `stash-error` where the stash cannot be written, `portal-error`
 * where the rename fails, the record put back as it stood — the label left
 * alone either way.
 * @param {string} cwd @param {PortalSession} ctx @param {string} place
 * @returns {import('./session-label.cjs').LabelResult}
 */
function apply(cwd, ctx, place) {
  const file = stashPath(cwd, ctx.session);
  /** @type {PortalStash|null} */
  const stashed = readStash(file);
  const original = stashed && stashed.applied === ctx.label ? stashed.original : ctx.label;
  const applied = `${baseOf(ctx.label)}${SEPARATOR}${place}`;
  /** @type {PortalStash} */
  const record = { session: ctx.session, original, applied, ...callerIdentity() };
  try { writeRecord(file, record); } catch { return { labelled: false, reason: 'stash-error' }; }
  if (applied !== ctx.label) {
    try { rename(ctx, applied); } catch {
      putRecordBack(file, stashed);
      return { labelled: false, reason: 'portal-error' };
    }
  }
  return { labelled: true, name: applied };
}

/**
 * Put the original back on this session where its label is exactly the one
 * applied, and drop the record; a label the person set since is left, its
 * record dropped. A record a live peer owns is left alone, and one whose
 * rename failed is kept for the next pass, as is one `doubt` holds.
 * @param {string} cwd @param {PortalSession} ctx
 * @param {(stash: PortalStash) => boolean} mine whose record this pass may take
 * @param {(stash: PortalStash) => boolean} doubt where the label read may not be the one worn
 * @returns {boolean} the label was put back
 */
function putBack(cwd, ctx, mine, doubt) {
  const file = stashPath(cwd, ctx.session);
  /** @type {PortalStash|null} */
  const stash = readStash(file);
  if (!stash || !mine(stash) || doubt(stash)) return false;
  let restored = false;
  if (stash.applied === ctx.label) {
    try { rename(ctx, stash.original); restored = true; } catch { return false; }
  }
  try { fs.unlinkSync(file); } catch { /* raced away */ }
  return restored;
}

/**
 * The SessionEnd pass: this session's record, where the ending conversation
 * owns it (an ownerless one counts) or its owner is gone. `portal current`
 * answers the session's name when Portal cannot read the session in time,
 * so a name read where a label was applied is kept for boot's repair to
 * settle, never taken for a label the person set.
 * @param {string} cwd @param {string} sessionId
 * @returns {boolean}
 */
function restore(cwd, sessionId) {
  /** @type {PortalSession|null} */
  let ctx = null;
  try { ctx = read(); } catch { return false; }
  if (!ctx) return false;
  const { session, label } = ctx;
  const mine = (/** @type {PortalStash} */ stash) => !stash.session_id || stash.session_id === sessionId || ownerDead(stash);
  return putBack(cwd, ctx, mine, (stash) => label === session && stash.applied !== label);
}

/**
 * Boot's pass: this session's record, where the calling session owns it
 * (`ownsRow`) or its owner is gone.
 * @param {string} cwd @param {PortalSession} ctx
 * @returns {boolean}
 */
function repair(cwd, ctx) {
  return putBack(cwd, ctx, (stash) => ownsRow(stash) || ownerDead(stash), () => false);
}

module.exports = { name: 'portal', title: 'Portal', present, read, apply, restore, repair };

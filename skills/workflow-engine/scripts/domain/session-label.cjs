'use strict';

// ---------------------------------------------------------------------------
// Domain ring: tmux session labels — an opt-in rename of the user's tmux
// session to show where the workflow session is working
// (`{original} · {work-unit} · {phase} · {topic}`). Applied by each process
// skill at Step 0, restored by the `session cleanup` SessionEnd hook. The
// feature is a display courtesy, never state: for the user who has not
// opted in, or outside tmux, or on any tmux error, every path degrades to
// a no-op JSON response and the label never gates a flow. (A bad argument
// from an opted-in call site still fails loudly — that is an authoring
// bug, not an environment condition.)
//
// Opt-in lives in the system config (`~/.config/workflows/config.json`)
// under `session.tmux_labels` — absent means unconfigured, which is what
// workflow-start's one-time prompt keys on (boot reports it via
// `labelConfigStatus`). A `defaults.tmux_labels` boolean in the project
// manifest overrides the system value for that project — the per-project
// off-switch, and what keeps a prose-test world from ever labelling the
// terminal the suite runs in. `WORKFLOWS_CONFIG_DIR` overrides the config
// directory for tests.
//
// The original name is stashed machine-globally (under the config dir's
// `state/session-labels/`, keyed by tmux socket + session id) because the
// resource it protects — the tmux session name — is machine-global: a
// label from any project finds the same stash, so re-labels across phases
// and projects recompose from the true original instead of compounding
// suffixes. A user rename mid-flight is adopted as the new original at the
// next label; restore only ever renames when the current name is exactly
// the one we applied.
// ---------------------------------------------------------------------------

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { VALID_PHASES } = require('../kernel/manifest-schema.cjs');

/** The system config directory — `WORKFLOWS_CONFIG_DIR` overrides for tests. */
function configDir() {
  return process.env.WORKFLOWS_CONFIG_DIR || path.join(os.homedir(), '.config', 'workflows');
}

function configPath() {
  return path.join(configDir(), 'config.json');
}

/**
 * The stored opt-in: true/false when configured, null when unconfigured
 * (absent file, absent key, or unreadable — all mean "never asked").
 * @returns {boolean|null}
 */
function readLabelConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    const s = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed.session : null;
    if (s && typeof s === 'object' && !Array.isArray(s) && typeof s.tmux_labels === 'boolean') return s.tmux_labels;
  } catch { /* absent or unreadable — unconfigured */ }
  return null;
}

/**
 * The project manifest's `defaults.tmux_labels`, when it is a boolean —
 * the per-project override. Null when absent or unreadable.
 * @param {string} cwd @returns {boolean|null}
 */
function readProjectOverride(cwd) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(cwd, '.workflows', 'manifest.json'), 'utf8'));
    const d = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed.defaults : null;
    if (d && typeof d === 'object' && !Array.isArray(d) && typeof d.tmux_labels === 'boolean') return d.tmux_labels;
  } catch { /* no project manifest — no override */ }
  return null;
}

/**
 * The effective opt-in for this project: the project override wins, then
 * the system value. Null means unconfigured everywhere.
 * @param {string} cwd @returns {boolean|null}
 */
function resolveEnabled(cwd) {
  const project = readProjectOverride(cwd);
  if (project !== null) return project;
  return readLabelConfig();
}

/**
 * Record the opt-in under `session.tmux_labels`, preserving every other
 * top-level key (the knowledge subsystem shares this file). An existing
 * file that does not parse is refused loudly — silently replacing it
 * would destroy the sibling subsystem's settings. Atomic pid-tagged
 * tmp-then-rename, matching the store/manifest convention.
 * @param {boolean} value
 */
function setLabelConfig(value) {
  const p = configPath();
  /** @type {Record<string, unknown>} */
  let existing = {};
  if (fs.existsSync(p)) {
    /** @type {unknown} */
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      throw new Error(`config file at ${p} is not valid JSON — fix or remove it before recording the session-label choice`);
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) existing = /** @type {Record<string, unknown>} */ (parsed);
  }
  const session = existing.session && typeof existing.session === 'object' && !Array.isArray(existing.session)
    ? /** @type {Record<string, unknown>} */ (existing.session)
    : {};
  const payload = { ...existing, session: { ...session, tmux_labels: value } };
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2) + '\n');
  fs.renameSync(tmp, p);
  return { tmux_labels: value };
}

/**
 * Boot's report for workflow-start's one-time prompt: `no-tmux` (never
 * prompt, never label), `on`/`off` (settled — by the project override or
 * the system value), `prompt` (in tmux and never asked anywhere).
 * @param {string} cwd
 * @returns {'no-tmux'|'on'|'off'|'prompt'}
 */
function labelConfigStatus(cwd) {
  if (!process.env.TMUX) return 'no-tmux';
  const v = resolveEnabled(cwd);
  if (v === true) return 'on';
  if (v === false) return 'off';
  return 'prompt';
}

/**
 * @param {string[]} args
 * @param {string|null} socket explicit server socket — restore runs from a
 *   SessionEnd hook whose env may lack `$TMUX`
 */
function tmux(args, socket) {
  const full = socket ? ['-S', socket, ...args] : args;
  return execFileSync('tmux', full, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).replace(/\n$/, '');
}

/**
 * The attached tmux session's identity, pinned via `$TMUX_PANE` when
 * present. Null outside tmux; throws when tmux itself errors.
 * @returns {{socket: string|null, id: string, name: string}|null}
 */
function tmuxContext() {
  const env = process.env.TMUX;
  if (!env) return null;
  const socket = env.split(',')[0] || null;
  const args = ['display-message', '-p'];
  if (process.env.TMUX_PANE) args.push('-t', process.env.TMUX_PANE);
  args.push('#{session_id}|#{session_name}');
  const out = tmux(args, socket);
  const sep = out.indexOf('|');
  if (sep === -1) return null;
  return { socket, id: out.slice(0, sep), name: out.slice(sep + 1) };
}

// Machine-global stash home: the tmux session name is machine-global, so
// its restore record must be findable from any project.
function stashDir() {
  return path.join(configDir(), 'state', 'session-labels');
}

/** @param {string|null} socket @param {string} tmuxId */
function stashPath(socket, tmuxId) {
  const server = crypto.createHash('sha256').update(socket || '').digest('hex').slice(0, 8);
  return path.join(stashDir(), `${server}-${tmuxId.replace(/[^A-Za-z0-9_-]/g, '')}.json`);
}

/**
 * @typedef {object} LabelStash
 * @property {string} tmux_id     stable tmux session id (`$N`)
 * @property {string|null} socket server socket at apply time
 * @property {string} original    the name to restore
 * @property {string} applied     the name we set
 * @property {string|null} session_id owning conversation (CLAUDE_CODE_SESSION_ID)
 */

/** Parse a stash file; null for unreadable or non-object content. @param {string} file @returns {LabelStash|null} */
function readStash(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch { /* absent or unreadable */ }
  return null;
}

/**
 * Rename the tmux session to carry the working position. No-op JSON when
 * the feature is off (system or project), the session runs outside tmux,
 * tmux errors, or the stash cannot be written — the label never blocks a
 * flow. Bad arguments from an enabled call site throw: an authoring bug
 * fails loudly.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 */
function applySessionLabel(cwd, workUnit, phase, topic) {
  if (resolveEnabled(cwd) !== true) return { labelled: false, reason: 'disabled' };
  if (!VALID_PHASES.includes(phase)) {
    throw new Error(`unknown phase "${phase}" — one of ${VALID_PHASES.join('|')}`);
  }
  if (!fs.existsSync(path.join(cwd, '.workflows', workUnit))) {
    throw new Error(`no work unit directory: .workflows/${workUnit}`);
  }
  /** @type {ReturnType<typeof tmuxContext>} */
  let ctx = null;
  try { ctx = tmuxContext(); } catch { /* tmux errored */ }
  if (!ctx) return { labelled: false, reason: process.env.TMUX ? 'tmux-error' : 'no-tmux' };

  const file = stashPath(ctx.socket, ctx.id);
  const stash = readStash(file);
  const original = stash && stash.applied === ctx.name && stash.original ? stash.original : ctx.name;
  const position = topic === workUnit ? `${workUnit} · ${phase}` : `${workUnit} · ${phase} · ${topic}`;
  const name = `${original} · ${position}`;
  // Stash before rename: a rename with no restore record strands the label,
  // while a stash whose `applied` never landed is inert (restore skips it,
  // the next label re-adopts the live name).
  /** @type {LabelStash} */
  const record = {
    tmux_id: ctx.id,
    socket: ctx.socket,
    original,
    applied: name,
    session_id: process.env.CLAUDE_CODE_SESSION_ID || null,
  };
  try {
    fs.mkdirSync(stashDir(), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(record) + '\n');
    fs.renameSync(tmp, file);
  } catch {
    return { labelled: false, reason: 'stash-error' };
  }
  if (name !== ctx.name) {
    try { tmux(['rename-session', '-t', ctx.id, name], ctx.socket); }
    catch { return { labelled: false, reason: 'tmux-error' }; }
  }
  return { labelled: true, name };
}

/**
 * Put the original tmux session name back — `session cleanup`, the
 * SessionEnd sweep over the machine-global stash store. Without a session
 * id nothing is touched (an id-less sweep could take a live peer's label —
 * the presence sweep refuses the same way). Restores only stashes the
 * named session owns (an ownerless stash counts) and only when the current
 * name is exactly the one we applied — a manual rename is never clobbered.
 * A restored or inapplicable stash is dropped; one whose rename failed is
 * kept for the next sweep. Never throws: a hook must exit clean.
 * @param {string|null} sessionId
 * @returns {{restored: boolean}}
 */
function restoreSessionLabel(sessionId) {
  if (!sessionId) return { restored: false };
  const dir = stashDir();
  /** @type {string[]} */
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch { return { restored: false }; }
  let restored = false;
  for (const f of files) {
    const p = path.join(dir, f);
    const stash = readStash(p);
    if (stash && stash.session_id && stash.session_id !== sessionId) continue;
    let drop = true;
    if (stash && stash.tmux_id && stash.original) {
      /** @type {string|null} */
      let current = null;
      try { current = tmux(['display-message', '-p', '-t', stash.tmux_id, '#{session_name}'], stash.socket); }
      catch { /* tmux session gone — the stash is dead weight */ }
      if (current !== null && current === stash.applied) {
        try {
          tmux(['rename-session', '-t', stash.tmux_id, stash.original], stash.socket);
          restored = true;
        } catch {
          drop = false; // transient rename failure — keep the record for the next sweep
        }
      }
    }
    if (drop) {
      try { fs.unlinkSync(p); } catch { /* raced away */ }
    }
  }
  return { restored };
}

module.exports = { applySessionLabel, restoreSessionLabel, setLabelConfig, labelConfigStatus, configDir };

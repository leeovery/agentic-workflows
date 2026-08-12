'use strict';

// ---------------------------------------------------------------------------
// Domain ring: tmux session labels — an opt-in rename of the user's tmux
// session to show where the workflow session is working
// (`{original} · {work-unit} · {phase} · {topic}`). Applied by each process
// skill at Step 0, restored by the SessionEnd hook alongside presence
// cleanup. The feature is a display courtesy, never state: every failure
// path degrades to a no-op JSON response, and the label never gates a flow.
//
// Opt-in lives in the system config (`~/.config/workflows/config.json`)
// under `session.tmux_labels` — absent means unconfigured, which is what
// workflow-start's one-time prompt keys on (boot reports it via
// `labelConfigStatus`). `WORKFLOWS_CONFIG_DIR` overrides the config
// directory for tests.
//
// The original name is stashed per tmux session (cache-resident, gitignored,
// keyed by the stable tmux session id) so re-labels across phases and a
// second Claude session in the same tmux session recompose from the true
// original instead of compounding suffixes. A user rename mid-flight is
// adopted as the new original at the next label; restore only ever renames
// when the current name is exactly the one we applied.
// ---------------------------------------------------------------------------

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const LABEL_PHASES = ['discovery', 'research', 'discussion', 'investigation', 'scoping', 'specification', 'planning', 'implementation', 'review'];

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
 * Record the opt-in under `session.tmux_labels`, preserving every other
 * top-level key (the knowledge subsystem shares this file). Atomic
 * tmp-then-rename, matching the store/manifest convention.
 * @param {boolean} value
 */
function setLabelConfig(value) {
  const p = configPath();
  /** @type {Record<string, unknown>} */
  let existing = {};
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) existing = parsed;
  } catch { /* absent or corrupt — write fresh */ }
  const session = existing.session && typeof existing.session === 'object' && !Array.isArray(existing.session)
    ? /** @type {Record<string, unknown>} */ (existing.session)
    : {};
  const payload = { ...existing, session: { ...session, tmux_labels: value } };
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2) + '\n');
  fs.renameSync(tmp, p);
  return { tmux_labels: value };
}

/**
 * Boot's report for workflow-start's one-time prompt: `no-tmux` (never
 * prompt, never label), `on`/`off` (configured), `prompt` (in tmux and
 * never asked).
 * @returns {'no-tmux'|'on'|'off'|'prompt'}
 */
function labelConfigStatus() {
  if (!process.env.TMUX) return 'no-tmux';
  const v = readLabelConfig();
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

/** @param {string} cwd */
function stashDir(cwd) {
  return path.join(cwd, '.workflows', '.cache', '.session-label');
}

/** @param {string} cwd @param {string} tmuxId */
function stashPath(cwd, tmuxId) {
  return path.join(stashDir(cwd), tmuxId.replace(/[^A-Za-z0-9_-]/g, '') + '.json');
}

/**
 * @typedef {object} LabelStash
 * @property {string} tmux_id     stable tmux session id (`$N`)
 * @property {string|null} socket server socket at apply time
 * @property {string} original    the name to restore
 * @property {string} applied     the name we set
 * @property {string|null} session_id owning conversation (CLAUDE_CODE_SESSION_ID)
 */

/**
 * Rename the tmux session to carry the working position. No-op JSON when
 * the user hasn't opted in, the session runs outside tmux, or tmux errors —
 * the label never blocks a flow.
 * @param {string} cwd @param {string} workUnit @param {string} phase @param {string} topic
 */
function applySessionLabel(cwd, workUnit, phase, topic) {
  if (!LABEL_PHASES.includes(phase)) {
    throw new Error(`unknown phase "${phase}" — one of ${LABEL_PHASES.join('|')}`);
  }
  if (!fs.existsSync(path.join(cwd, '.workflows', workUnit))) {
    throw new Error(`no work unit directory: .workflows/${workUnit}`);
  }
  if (readLabelConfig() !== true) return { labelled: false, reason: 'disabled' };
  /** @type {ReturnType<typeof tmuxContext>} */
  let ctx = null;
  try { ctx = tmuxContext(); } catch { /* tmux errored */ }
  if (!ctx) return { labelled: false, reason: process.env.TMUX ? 'tmux-error' : 'no-tmux' };

  const file = stashPath(cwd, ctx.id);
  /** @type {LabelStash|null} */
  let stash = null;
  try { stash = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* none yet */ }
  const original = stash && stash.applied === ctx.name ? stash.original : ctx.name;
  const position = topic === workUnit ? `${workUnit} · ${phase}` : `${workUnit} · ${phase} · ${topic}`;
  const name = `${original} · ${position}`;
  if (name !== ctx.name) {
    try { tmux(['rename-session', '-t', ctx.id, name], ctx.socket); }
    catch { return { labelled: false, reason: 'tmux-error' }; }
  }
  fs.mkdirSync(stashDir(cwd), { recursive: true });
  /** @type {LabelStash} */
  const record = {
    tmux_id: ctx.id,
    socket: ctx.socket,
    original,
    applied: name,
    session_id: process.env.CLAUDE_CODE_SESSION_ID || null,
  };
  fs.writeFileSync(file, JSON.stringify(record) + '\n');
  return { labelled: true, name };
}

/**
 * Put the original tmux session name back — the SessionEnd sweep, riding
 * `presence cleanup`. Restores only stashes the named session owns (an
 * ownerless stash counts) and only when the current name is exactly the one
 * we applied — a manual rename is never clobbered. The stash is dropped
 * either way. Never throws: a hook must exit clean.
 * @param {string} cwd @param {string|null} sessionId
 * @returns {{restored: boolean}}
 */
function restoreSessionLabel(cwd, sessionId) {
  const dir = stashDir(cwd);
  /** @type {string[]} */
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch { return { restored: false }; }
  let restored = false;
  for (const f of files) {
    const p = path.join(dir, f);
    /** @type {LabelStash|null} */
    let stash = null;
    try { stash = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { /* unreadable — drop below */ }
    if (stash && stash.session_id && sessionId && stash.session_id !== sessionId) continue;
    if (stash && stash.tmux_id && stash.original) {
      /** @type {string|null} */
      let current = null;
      try { current = tmux(['display-message', '-p', '-t', stash.tmux_id, '#{session_name}'], stash.socket); }
      catch { /* tmux session gone */ }
      if (current !== null && current === stash.applied) {
        try {
          tmux(['rename-session', '-t', stash.tmux_id, stash.original], stash.socket);
          restored = true;
        } catch { /* leave the name */ }
      }
    }
    try { fs.unlinkSync(p); } catch { /* raced away */ }
  }
  return { restored };
}

module.exports = { applySessionLabel, restoreSessionLabel, setLabelConfig, readLabelConfig, labelConfigStatus, configDir, LABEL_PHASES };

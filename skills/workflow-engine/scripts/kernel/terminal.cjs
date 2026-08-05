'use strict';

// ---------------------------------------------------------------------------
// Kernel: display width — how many columns the reader can actually see.
//
// Nothing here can see the terminal directly. Our stdout is a socket
// (`isTTY` undefined), COLUMNS arrives as `0`, `/dev/tty` is not configured,
// and `tput cols` answers 80 from terminfo without consulting anything. What
// IS reachable is the tty that the Claude Code process itself is attached to:
// CLAUDE_PID names the process, `ps` maps it to a device, and the device
// knows its own size. The read is live — a mid-session resize lands with no
// restart, because the resize updates the tty's winsize.
//
// Resolution runs most-explicit-first and degrades to the width that shipped
// before detection existed, so the worst case is current behaviour.
//
// Mechanism only: this knows nothing about trees, menus, or workflow content.
// Callers ask for a number.
// ---------------------------------------------------------------------------

const fs = require('fs');
const tty = require('tty');
const { spawnSync } = require('child_process');

// The width that shipped before detection existed — every no-answer path
// lands here, so an undetectable environment renders exactly as it used to.
const FALLBACK = 65;

// Legibility ceiling. Line length stops being comfortable somewhere around
// 90–110 columns; an unbounded tree on a maximised display is worse than a
// capped one, so detection is allowed to make the display wider only so far.
const CAP = 120;

// Below this the gutters and branch glyphs leave no usable budget, so a
// pathologically narrow pane is treated as a floor rather than obeyed.
const MIN = 40;

// Claude Code renders its own 2-column left gutter; content gets the rest.
const GUTTER = 2;

// Slack against a miscount. Overflow soft-wraps, which orphans a tree's `│`
// onto the next line — ugly and hard to read. Under-shooting only wastes
// space. The asymmetry is why we sit two columns short of the edge rather
// than flush against it.
const HEADROOM = 2;

/** @param {number} n */
function clamp(n) {
  return Math.min(CAP, Math.max(MIN, n));
}

// Column count of a tty device, read without spawning anything: a
// tty.WriteStream over the opened device exposes the kernel's winsize.
// Returns null when the device cannot be opened or reports nothing useful.
/** @param {string} dev @returns {number|null} */
function columnsOfDevice(dev) {
  let fd = null;
  let stream = null;
  try {
    fd = fs.openSync(dev, 'r+');
    stream = new tty.WriteStream(fd);
    const cols = stream.columns;
    return Number.isInteger(cols) && cols > 0 ? cols : null;
  } catch {
    return null;
  } finally {
    // Destroying the stream closes the fd it owns; only close by hand when
    // the stream never took ownership.
    if (stream) { try { stream.destroy(); } catch { /* already gone */ } }
    else if (fd !== null) { try { fs.closeSync(fd); } catch { /* already gone */ } }
  }
}

// `ps` fields for one pid: its controlling tty and its parent. A process
// with no controlling tty reports `??` (macOS) or `?` (Linux).
/** @param {number} pid @returns {{tty: string|null, ppid: number|null}} */
function psInfo(pid) {
  const res = spawnSync('ps', ['-o', 'ppid=,tty=', '-p', String(pid)], { encoding: 'utf8' });
  if (res.status !== 0 || !res.stdout) return { tty: null, ppid: null };
  const parts = res.stdout.trim().split(/\s+/);
  if (parts.length < 2) return { tty: null, ppid: null };
  const ppid = Number(parts[0]);
  const raw = parts[1];
  const device = !raw || raw === '??' || raw === '?' ? null : (raw.startsWith('/') ? raw : `/dev/${raw}`);
  return { tty: device, ppid: Number.isInteger(ppid) ? ppid : null };
}

// The Claude Code process names itself in the environment; its tty is the
// one the reader is looking at.
/** @returns {number|null} */
function fromClaudePid() {
  const pid = Number(process.env.CLAUDE_PID);
  if (!Number.isInteger(pid) || pid <= 0) return null;
  const { tty: device } = psInfo(pid);
  return device ? columnsOfDevice(device) : null;
}

// Walk our own ancestry until a process with a controlling tty appears.
// Covers the case where CLAUDE_PID is absent but we are still descended
// from something attached to a terminal.
/** @param {number} [maxHops] @returns {number|null} */
function fromProcessTree(maxHops = 8) {
  let pid = process.ppid;
  for (let hop = 0; hop < maxHops; hop += 1) {
    if (!Number.isInteger(pid) || pid <= 1) return null;
    const { tty: device, ppid } = psInfo(pid);
    if (device) {
      const cols = columnsOfDevice(device);
      if (cols) return cols;
    }
    if (ppid === null || ppid === pid) return null;
    pid = ppid;
  }
  return null;
}

// tmux knows its pane geometry even when the pane's tty is awkward to reach.
// Scoped to TMUX_PANE so a multi-client session reports the pane in front of
// the reader rather than whichever client answers first.
/** @returns {number|null} */
function fromTmux() {
  if (!process.env.TMUX || !process.env.TMUX_PANE) return null;
  const res = spawnSync('tmux', ['display', '-pt', process.env.TMUX_PANE, '#{pane_width}'], {
    encoding: 'utf8',
  });
  if (res.status !== 0 || !res.stdout) return null;
  const cols = Number(res.stdout.trim());
  return Number.isInteger(cols) && cols > 0 ? cols : null;
}

// Raw pane columns, before any gutter or headroom is taken off.
/** @returns {number|null} */
function detectColumns() {
  return fromClaudePid() ?? fromProcessTree() ?? fromTmux();
}

// Resolve the content width, uncached. Exported for tests, which need to
// drive the resolution order without fighting the memo.
/** @returns {number} */
function resolveDisplayWidth() {
  // Floor rather than reject a fractional override — an explicit ask, even a
  // sloppy one, should never lose to detection.
  const override = Math.floor(Number(process.env.WORKFLOWS_DISPLAY_WIDTH));
  if (Number.isFinite(override) && override > 0) return clamp(override);
  const cols = detectColumns();
  if (cols) return clamp(cols - GUTTER - HEADROOM);
  return FALLBACK;
}

/** @type {number|null} */
let memo = null;

// The engine is a short-lived process per command, so resolving once at first
// use is the same thing as resolving at render time — and it keeps detection
// to a single `ps` spawn per invocation rather than one per rendered surface.
/** @returns {number} */
function displayWidth() {
  if (memo === null) memo = resolveDisplayWidth();
  return memo;
}

// Test hook: drop the memo so a suite can re-resolve under a changed
// environment within one process.
function resetDisplayWidth() {
  memo = null;
}

module.exports = {
  displayWidth,
  resolveDisplayWidth,
  resetDisplayWidth,
  detectColumns,
  columnsOfDevice,
  FALLBACK,
  CAP,
  MIN,
  GUTTER,
  HEADROOM,
};

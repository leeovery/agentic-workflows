'use strict';

// The suite's CPU meter (tests/README.md §12). Where LEEWAY_TEST_CPU_LOG
// names a file, a suite's process runs the suite again under
// `/usr/bin/time` and, as that run ends, appends one line to the file: the
// suite's path from the repository and the CPU the run and every child it
// waited for spent, user and sys, in seconds. Node reads only its own
// process's CPU, and a suite's is mostly git's; time(1) reads both.
//
// hermetic-env.cjs requires this first, before it pins anything, so the run
// under time(1) is the suite's whole run, and `node --test` sees its output
// and its exit, or the signal that ended it. The inner run never sees the
// log's variable, so neither it nor anything it starts is metered again.
// The outer process waits on the inner without running JavaScript, so it
// cannot pass on a signal; the inner run watches it instead and ends as the
// unmetered suite would when the runner cancels the outer one. Unarmed, or
// where time(1) cannot start, the suite runs as it always does.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SUITE = /(^|\/)tests\/(.+\/)?test-[^/]+\.cjs$/;
const LOG = 'LEEWAY_TEST_CPU_LOG';
const OUTER = 'LEEWAY_TEST_CPU_OUTER';
const WATCH_MS = 500;

/**
 * User and sys seconds from time(1)'s portable report (`-p`).
 * @param {string} text
 * @returns {{ user: number, sys: number } | null}
 */
function parseTimes(text) {
  const user = /^user\s+([\d.]+)$/m.exec(text);
  const sys = /^sys\s+([\d.]+)$/m.exec(text);
  return user && sys ? { user: Number(user[1]), sys: Number(sys[1]) } : null;
}

/** Whether the process `pid` has ended. @param {number} pid */
function ended(pid) {
  try {
    process.kill(pid, 0);
    return false;
  } catch {
    return true;
  }
}

/**
 * Runs the suite this process was started for under time(1) and ends this
 * process as that run ended; returns only where time(1) could not start.
 * @param {string} log  the file the run's line is appended to
 * @param {string} suite  the suite's absolute path
 */
function meter(log, suite) {
  const report = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'leeway-cpu-')), 'time.txt');
  const env = { ...process.env, [OUTER]: String(process.pid) };
  delete env[LOG];
  const run = spawnSync('/usr/bin/time', ['-p', '-o', report, process.execPath, ...process.execArgv, ...process.argv.slice(1)], { stdio: 'inherit', env });
  const times = fs.existsSync(report) ? parseTimes(fs.readFileSync(report, 'utf8')) : null;
  fs.rmSync(path.dirname(report), { recursive: true, force: true });
  if (run.error) return;
  if (times) {
    const line = { suite: path.relative(ROOT, suite), cpu: Number((times.user + times.sys).toFixed(2)), ...times, status: run.status ?? run.signal };
    fs.appendFileSync(log, `${JSON.stringify(line)}\n`);
  }
  if (run.signal) process.kill(process.pid, run.signal);
  process.exit(run.status ?? 1);
}

/** Ends this run once the metered process that started it has ended. @param {number} outer */
function watch(outer) {
  setInterval(() => {
    if (ended(outer)) process.kill(process.pid, 'SIGTERM');
  }, WATCH_MS).unref();
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (process.env[OUTER] !== undefined) {
  const outer = Number(process.env[OUTER]);
  delete process.env[OUTER];
  watch(outer);
} else if (process.env[LOG] && SUITE.test(entry)) {
  meter(process.env[LOG], entry);
}

module.exports = { parseTimes };

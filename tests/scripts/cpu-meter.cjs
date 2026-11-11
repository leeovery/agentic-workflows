'use strict';

// The suite's CPU meter (tests/README.md §12). Where LEEWAY_TEST_CPU_LOG
// names a file, a suite's process runs the suite again under
// `/usr/bin/time` and, as that run ends, appends one line to the file: the
// suite's path from the repository and the CPU the run and every child it
// waited for spent, user and sys, in seconds. Node reads only its own
// process's CPU, and a suite's is mostly git's; time(1) reads both. time(1)
// writes its report beside the log, under the outer process's id, and the
// meter removes it once read.
//
// hermetic-env.cjs requires this first, before it pins anything, so the run
// under time(1) is the suite's whole run, and `node --test` sees its output
// and its exit code, or the signal that ended it — but SIGKILL, which
// time(1) cannot raise again, and which arrives as exit 1. The inner run
// never sees the log's variable, so neither it nor anything it starts is
// metered again. The outer process waits on the inner without running
// JavaScript, so it cannot pass on a signal; the inner run watches it
// instead and ends as the unmetered suite would when the runner cancels the
// outer one. The meter never changes a suite's outcome: unarmed, where the
// log's folder cannot be written or time(1) cannot start, the suite runs as
// it always does, and a line that cannot be appended is lost, not a failure.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SUITE = /(^|\/)tests\/(.+\/)?test-[^/]+\.cjs$/;
const LOG = 'LEEWAY_TEST_CPU_LOG';
const OUTER = 'LEEWAY_TEST_CPU_OUTER';
const WATCH_MS = 500;

/**
 * User and sys seconds from time(1)'s portable report (`-p`), the report
 * removed; null where there is none.
 * @param {string} file
 * @returns {{ user: number, sys: number } | null}
 */
function takeTimes(file) {
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  fs.rmSync(file, { force: true });
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
 * process as that run ended; returns where the suite cannot be metered.
 * @param {string} log  the file the run's line is appended to
 * @param {string} suite  the suite's absolute path
 */
function meter(log, suite) {
  const folder = path.dirname(path.resolve(log));
  try {
    fs.accessSync(folder, fs.constants.W_OK);
  } catch {
    return;
  }
  const report = path.join(folder, `.${path.basename(log)}.${process.pid}.time`);
  const env = { ...process.env, [OUTER]: String(process.pid) };
  delete env[LOG];
  const run = spawnSync('/usr/bin/time', ['-p', '-o', report, process.execPath, ...process.execArgv, ...process.argv.slice(1)], { stdio: 'inherit', env });
  const times = takeTimes(report);
  if (run.error) return;
  if (times) {
    const line = { suite: path.relative(ROOT, suite), cpu: Number((times.user + times.sys).toFixed(2)), ...times, status: run.status ?? run.signal };
    try {
      fs.appendFileSync(log, `${JSON.stringify(line)}\n`);
    } catch { /* the run's outcome stands */ }
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

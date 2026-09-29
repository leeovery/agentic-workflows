'use strict';

// The verdict store: each case's latest verdict, as its orchestrator
// recorded it. SubagentHandback delivers once per agent, and a runtime that
// forces a hand-back while the orchestrator waits on a walker spends it on
// a placeholder — the recorded verdict is the channel that outlives a spent
// one. Local and gitignored beside the hash cache: it records a run made
// here, never what a case tests.

const fs = require('fs');
const path = require('path');
const cases = require('./cases.cjs');

const VERDICTS_DIR = path.join(cases.PROSE_DIR, '.cache', 'verdicts');
const NONE = 'NO VERDICT RECORDED — the orchestrator died or never recorded one.';

function verdictFile(caseId) {
  return path.join(VERDICTS_DIR, `${caseId}.md`);
}

/**
 * Record a case's verdict over any earlier one. The text is written beside
 * its path and renamed onto it, so a reader meets the old verdict or the
 * new one, never part of either.
 */
function recordVerdict(caseId, text) {
  const file = verdictFile(caseId);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.mkdirSync(VERDICTS_DIR, { recursive: true });
  try {
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, file);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  return file;
}

/** A case's recorded verdict, or null when none is recorded. */
function readVerdict(caseId) {
  const file = verdictFile(caseId);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

function clearVerdicts(caseIds) {
  for (const id of caseIds) fs.rmSync(verdictFile(id), { force: true });
}

/** Each case's recorded verdict in the order named, under a marker of its own. */
function reportVerdicts(caseIds) {
  return caseIds.map((id) => {
    const text = readVerdict(id);
    return `=== ${id} ===\n${text === null ? NONE : text.trimEnd()}\n`;
  }).join('\n');
}

module.exports = {
  VERDICTS_DIR, verdictFile, recordVerdict, readVerdict, clearVerdicts, reportVerdicts,
};

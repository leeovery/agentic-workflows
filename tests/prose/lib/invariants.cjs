'use strict';

// Deterministic checks over the recorded actions.
//
// The world delta proves the outcome. It cannot prove the outcome was
// reached by following the prose: a walker that ignored every instruction
// and wrote the expected files directly lands the same delta. Only the
// order of what it actually did separates the two, and that is recorded.
//
// These checks read that record in code and decide before any agent sees
// the case. A judgement an agent never makes is a judgement that cannot
// drift — which is the whole reason they exist, and why they are worth
// having even though they can only ever cover the coarse shape of a walk.
//
// Declared per case in case.json, hand-written like every other part of a
// case:
//
//   "invariants": {
//     "engine_before_write": true,      // no .workflows write out of nowhere
//     "calls_include": ["task init"],   // these commands must have run
//     "calls_exclude": ["task start"],  // these must not have
//     "calls_in_order": ["a", "b"]      // and these in this sequence
//   }
//
// A check that could not have failed reports N/A rather than PASS. A
// green tick for "there was nothing to examine" is how a corpus comes to
// look covered while enforcing nothing.
//
// Deliberately not a pinned call sequence. A recorded-and-replayed
// sequence would freeze whatever the walker happened to do, which is how
// a test starts certifying broken prose instead of catching it.

const ENGINE_CALL = /\/(engine|gateway)\.cjs\b/;
const WRITE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit']);
const WORKFLOWS = '.workflows/';
// A file is not only written through the write tools. A walker reaches
// for the shell as readily — `printf … > .workflows/…` creates state
// just as surely, and an Opus walk was observed doing exactly that while
// a tool-only check reported that nothing had been written at all.
// Segment separators bound the match so a redirect elsewhere in a
// compound command is not mistaken for one into the workflow directory.
const SHELL_WRITE = /(>>?|\btee\b|\bcp\b|\bmv\b|\binstall\b)[^|;&]*\.workflows\//;

function isWrite(row) {
  if (WRITE_TOOLS.has(row.tool)) return row.detail.includes(WORKFLOWS);
  return row.tool === 'Bash' && SHELL_WRITE.test(row.detail);
}

const NAMES = ['engine_before_write', 'calls_include', 'calls_exclude', 'calls_in_order'];

/**
 * Prose the walk actually opened, as repo-relative paths.
 *
 * A world holds the skills at `.claude/skills/`; the corpus names them at
 * `skills/`. Same file, two addresses, so one is translated to the other.
 */
function proseRead(rows) {
  const seen = new Set();
  for (const row of rows) {
    if (row.tool !== 'Read') continue;
    const m = row.detail.match(/\.claude\/skills\/(.+\.md)$/);
    if (m) seen.add(`skills/${m[1]}`);
  }
  return seen;
}

/**
 * Prose a walk went through but the case never declared.
 *
 * `files` is not documentation: it decides whether a change to a file
 * selects this case for a run. A file the walk traverses and the case
 * omits is prose that can be edited without ever re-running the test that
 * covers it. Reported, never corrected — which files belong is an
 * authoring judgement, and the reachable set is far wider than the walked
 * one, so a list assembled by following every link would select this case
 * for branches it deliberately stops before.
 */
function undeclaredProse(rows, declared) {
  const listed = new Set(declared || []);
  return [...proseRead(rows)].filter((f) => !listed.has(f)).sort();
}

/** The commands the walk ran, in order. */
function commands(rows) {
  return rows.filter((r) => r.tool === 'Bash' && r.event === 'PreToolUse').map((r) => r.detail);
}

/**
 * A write the prose could only have reached by consulting state first.
 * Reading a file is not enough — the engine is how a workflow skill
 * learns anything, so a walk that writes workflow state having never
 * called it did not get there by following the prose.
 */
function engineBeforeWrite(rows) {
  const firstEngine = rows.findIndex(
    (r) => r.tool === 'Bash' && ENGINE_CALL.test(r.detail),
  );
  const firstWrite = rows.findIndex(isWrite);
  if (firstWrite === -1) {
    // Nothing was written, so there was nothing for this check to catch.
    // Reporting that as a pass would dress absence of coverage up as
    // coverage — which is exactly how a corpus of read-only cases came to
    // look green while enforcing nothing at all.
    return { ok: true, vacuous: true, detail: 'no workflow state was written' };
  }
  if (firstEngine === -1) {
    return { ok: false, detail: `wrote ${rows[firstWrite].detail} having never called the engine` };
  }
  if (firstEngine > firstWrite) {
    return {
      ok: false,
      detail: `wrote ${rows[firstWrite].detail} before any engine call`,
    };
  }
  return { ok: true, detail: 'every workflow write followed an engine call' };
}

function callsInclude(rows, wanted) {
  const ran = commands(rows);
  const missing = wanted.filter((w) => !ran.some((c) => c.includes(w)));
  return missing.length
    ? { ok: false, detail: `never ran: ${missing.join(', ')}` }
    : { ok: true, detail: `ran all of: ${wanted.join(', ')}` };
}

function callsExclude(rows, forbidden) {
  const ran = commands(rows);
  const found = forbidden.filter((f) => ran.some((c) => c.includes(f)));
  return found.length
    ? { ok: false, detail: `ran what it should not have: ${found.join(', ')}` }
    : { ok: true, detail: `ran none of: ${forbidden.join(', ')}` };
}

/**
 * Order carries meaning a presence check cannot: a gate read after the arm
 * it was supposed to select proves the arm was chosen some other way. The
 * declared commands must appear as a subsequence — other calls may fall
 * between them, but never out of sequence.
 */
function callsInOrder(rows, sequence) {
  const ran = commands(rows);
  let at = 0;
  for (const wanted of sequence) {
    const found = ran.findIndex((c, i) => i >= at && c.includes(wanted));
    if (found === -1) {
      const seen = sequence.slice(0, sequence.indexOf(wanted));
      return {
        ok: false,
        detail: seen.length
          ? `"${wanted}" never ran after ${seen.map((s) => `"${s}"`).join(' → ')}`
          : `"${wanted}" never ran`,
      };
    }
    at = found + 1;
  }
  return { ok: true, detail: `ran in order: ${sequence.join(' → ')}` };
}

/**
 * Run a case's declared invariants against its recorded actions.
 * Returns one result per declared check, in declaration order.
 */
function check(rows, declared) {
  if (!declared) return [];
  const results = [];
  if (declared.engine_before_write) {
    results.push({ name: 'engine_before_write', ...engineBeforeWrite(rows) });
  }
  if (declared.calls_include && declared.calls_include.length) {
    results.push({ name: 'calls_include', ...callsInclude(rows, declared.calls_include) });
  }
  if (declared.calls_exclude && declared.calls_exclude.length) {
    results.push({ name: 'calls_exclude', ...callsExclude(rows, declared.calls_exclude) });
  }
  if (declared.calls_in_order && declared.calls_in_order.length) {
    results.push({ name: 'calls_in_order', ...callsInOrder(rows, declared.calls_in_order) });
  }
  return results;
}

/** The checks as the asserter reads them — verdict first, computed by code. */
function format(results) {
  if (!results.length) return null;
  return results
    .map((r) => {
      const verdict = r.ok ? (r.vacuous ? 'N/A ' : 'PASS') : 'FAIL';
      return `${verdict}  ${r.name} — ${r.detail}`;
    })
    .join('\n');
}

/** Shape errors in a case's declaration, for corpus validation. */
function declarationErrors(declared) {
  if (declared === undefined || declared === null) return [];
  const errors = [];
  if (typeof declared !== 'object' || Array.isArray(declared)) {
    return ['invariants must be an object'];
  }
  for (const key of Object.keys(declared)) {
    if (!NAMES.includes(key)) errors.push(`unknown invariant "${key}" (known: ${NAMES.join(', ')})`);
  }
  if ('engine_before_write' in declared && typeof declared.engine_before_write !== 'boolean') {
    errors.push('engine_before_write must be true or false');
  }
  for (const key of ['calls_include', 'calls_exclude', 'calls_in_order']) {
    if (!(key in declared)) continue;
    const value = declared[key];
    if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !v.trim())) {
      errors.push(`${key} must be an array of non-empty strings`);
      continue;
    }
    if (key === 'calls_in_order' && value.length < 2) {
      errors.push('calls_in_order needs at least two commands — one has no order');
    }
  }
  return errors;
}

module.exports = { check, format, declarationErrors, undeclaredProse, NAMES };

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
//     "calls_in_order": ["a", "b"],     // and these in this sequence
//     "dispatches": [                   // what the walker's dispatches carried
//       { "agent": "x", "nth": 2, "count": 2, "carries": ["p"], "lacks": ["q"] },
//       { "agent": "x", "send": true, "count": 1 }    // and the sends continuing x
//     ]
//   }
//
// A dispatches entry names an agent by its subagent_type and claims what
// its dispatches carried in their prompts, read from the hold's whole
// record (lib/hold-dispatch.cjs) — never the capped action log. `count`
// pins how many dispatches of that agent the walk made; `carries` and
// `lacks` hold for every one of them, or for the `nth` (1-based) alone
// when it is given. A declared dispatch that never happened fails: the
// claim is about the dispatch, so there is always something to examine.
//
// With `"send": true` the entry claims the sends that continued the agent
// instead, and `carries`/`lacks` read each send's message. A send is the
// agent's when it went to the id a held dispatch of that agent was given
// (its tool_use_id, which the hold's refusal names) — a send to any other
// id continues nobody, so it satisfies no claim.
//
// A calls_in_order entry starting `write:` is a token, not a command: it
// stands for the path's FIRST recorded write, which must sit at this
// point in the sequence. First, not next — a file created too early and
// edited again later would satisfy a lenient match, and that early
// creation is exactly what the token exists to catch (a topic registered
// before its artifact exists, and the inverse). Tokens are
// calls_in_order-only; in the presence checks a `write:` entry could
// only mislead, so declaration validation rejects it there.
//
// A calls_in_order entry starting `dispatch:` stands for the NEXT held
// dispatch of the agent it names — a dispatch ordered against the calls
// around it. Next, not first: an agent dispatched once per review cycle
// takes one token per cycle. Its presence is claimed through
// `dispatches`, so it too is rejected outside calls_in_order. A `send:`
// token is its twin for the NEXT held send continuing the agent it names,
// attributed as a dispatches send claim is — a dispatch never satisfies a
// send: token, nor a send a dispatch: token.
//
// A check that could not have failed reports N/A rather than PASS. A
// green tick for "there was nothing to examine" is how a corpus comes to
// look covered while enforcing nothing.
//
// Deliberately not a pinned call sequence. A recorded-and-replayed
// sequence would freeze whatever the walker happened to do, which is how
// a test starts certifying broken prose instead of catching it.

const { SEND } = require('./transcripts.cjs');

const ENGINE_CALL = /\/(engine|gateway)\.cjs\b/;
const WRITE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit']);
const WORKFLOWS = '.workflows/';
// A file is not only written through the write tools. A walker reaches
// for the shell as readily — `printf … > .workflows/…` creates state
// just as surely, and an Opus walk was observed doing exactly that while
// a tool-only check reported that nothing had been written at all.
//
// What counts is the write's target — the operand a redirect, tee, cp,
// mv or install lands on — never the rest of the command. The recorder
// flattens a heredoc onto its command's line, so a findings file written
// with `cat > … << 'EOF'` carries its whole body in the one record, and
// a body that named a path (a FILES line naming the spec) once satisfied
// that path's write: token and failed a walk whose real edit sat exactly
// where the case declared it.
const REDIRECT_TARGET = /(?:>>?|\btee\b(?:\s+-\S+)*)\s*(\S*\.workflows\/\S+)/g;
// cp, mv and install take their operands in the next few tokens, bounded
// at the segment's end; the bound keeps a heredoc body that happens to
// contain one of the words from reaching a path further along.
const MOVE_OPERANDS = /\b(?:cp|mv|install)\b((?:\s+[^\s|;&<>]+){1,4})/g;
const WORKFLOWS_PATH = /\S*\.workflows\/\S+/g;

function shellWriteTargets(detail) {
  const targets = [];
  for (const m of detail.matchAll(REDIRECT_TARGET)) targets.push(m[1]);
  for (const m of detail.matchAll(MOVE_OPERANDS)) {
    targets.push(...(m[1].match(WORKFLOWS_PATH) || []));
  }
  return targets;
}

/** The workflow paths a recorded action writes — empty when it writes none. */
function writeTargets(row) {
  if (WRITE_TOOLS.has(row.tool)) return row.detail.includes(WORKFLOWS) ? [row.detail] : [];
  if (row.tool !== 'Bash') return [];
  return shellWriteTargets(row.detail);
}

function isWrite(row) {
  return writeTargets(row).length > 0;
}

const NAMES = ['engine_before_write', 'calls_include', 'calls_exclude', 'calls_in_order', 'dispatches'];

/**
 * Prose the walk actually opened, as repo-relative paths.
 *
 * A world holds the skills at `.claude/skills/`; the corpus names them at
 * `skills/`. Same file, two addresses, so one is translated to the other.
 *
 * Only a read that returned counts. A walker guessing at a path leaves a
 * PreToolUse row and a FAILED row for a file that does not exist; the
 * PostToolUse row is the one a file it actually opened leaves.
 */
function proseRead(rows) {
  const seen = new Set();
  for (const row of rows) {
    if (row.tool !== 'Read' || row.event !== 'PostToolUse') continue;
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
// Searching for a string is not running it. A walker greps the repo to
// orient itself — `grep -rl "topic triage" .claude/skills` — and because
// both sides of a match drop quotes, that search argument is
// indistinguishable from the call it names. A case failed `calls_exclude`
// on a command no walk ran, and the asserter could see the string was
// only ever a grep argument while being unable to overturn a computed
// check. So a statement that is a search leaves the substrate.
//
// Only whole statements go — a pipeline like `engine … | grep foo` still
// ran the engine call at its head, and dropping the row would trade this
// false positive for a false negative.
const SEARCH_HEAD = /^(grep|egrep|fgrep|rg|ag|find)\b/;

// Where one shell statement ends and the next begins.
const SEGMENT = /\s*(?:&&|;)\s*/;

function withoutSearches(detail) {
  return detail
    .split(SEGMENT)
    .filter((segment) => !SEARCH_HEAD.test(segment.trim()))
    .join(' && ');
}

function commands(rows) {
  return rows
    .filter((r) => r.tool === 'Bash' && r.event === 'PreToolUse')
    .map((r) => withoutSearches(r.detail));
}

/**
 * Quotes are shell syntax, not command identity. The repo's own
 * conventions tell a walker to quote dotpath arguments, so
 * `manifest get 'wu.phase.topic' field` and the unquoted form are the
 * same call — but a needle written from the prose's literal text spans
 * the spot where the quote lands, and a whole case failed on exactly
 * that. Both sides of every match drop quote characters first, so
 * quoting style can never decide a verdict.
 */
function bare(s) {
  return s.replace(/['"]/g, '');
}

/**
 * `manifest set` takes a field and its value positionally or as
 * `field=value`, and both are one write. Walkers reach for either, so a
 * needle spelled one way met a walk that ran the other and failed calls
 * the engine treats as the same. Both sides read `=` between a name and
 * its value as the space, so the form can never decide a verdict.
 */
function unformed(s) {
  return bare(s).replace(/([\w.\]-])=(?!=)/g, '$1 ');
}

function ranMatch(command, needle) {
  return unformed(command).includes(unformed(needle));
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

// The recorder caps the detail column to keep the asserter's prompt
// bounded, and marks every cut. A cut falls on the tail — where a
// command's distinguishing flags live — so a needle absent from a clipped
// record is unanswered, not answered "no". Saying "never ran" there
// reports a walk's failure for a recorder's limit, on the one check that
// is supposed to rest on no judgement.
const CLIPPED = '…[truncated]';

function callsInclude(rows, wanted) {
  const ran = commands(rows);
  const missing = wanted.filter((w) => !ran.some((c) => ranMatch(c, w)));
  if (!missing.length) return { ok: true, detail: `ran all of: ${wanted.join(', ')}` };
  const clipped = ran.filter((c) => c.includes(CLIPPED));
  return clipped.length
    ? {
      ok: false,
      detail: `unproven — the record is clipped, so these are unfindable rather than absent: ${missing.join(', ')}`
        + ` (${clipped.length} clipped row${clipped.length === 1 ? '' : 's'})`,
    }
    : { ok: false, detail: `never ran: ${missing.join(', ')}` };
}

function callsExclude(rows, forbidden) {
  const ran = commands(rows);
  const found = forbidden.filter((f) => ran.some((c) => ranMatch(c, f)));
  return found.length
    ? { ok: false, detail: `ran what it should not have: ${found.join(', ')}` }
    : { ok: true, detail: `ran none of: ${forbidden.join(', ')}` };
}

const WRITE_TOKEN = 'write:';
const DISPATCH_TOKEN = 'dispatch:';
const SEND_TOKEN = 'send:';

/**
 * The agent a held dispatch row names. The hold writes its detail as
 * `<subagent_type> — <description>`, and it is the only thing that
 * writes an Agent row at PreToolUse.
 */
function heldAgent(row) {
  return row.tool === 'Agent' ? row.detail.split(' — ')[0] : null;
}

/** The agent each held dispatch's id was given to, by that id. */
function agentsById(records) {
  return new Map(records
    .filter((r) => r.tool_name !== SEND)
    .map((r) => [r.tool_use_id, (r.tool_input || {}).subagent_type]));
}

/**
 * The agent a held send row continues. The hold writes a send's detail as
 * `<to> — <summary>`, and the id it went to was given to one dispatch.
 */
function sentAgent(row, agents) {
  return row.tool === SEND ? agents.get(row.detail.split(' — ')[0]) ?? null : null;
}

/**
 * The walk's actions as an ordered list of statements. A walker joins two
 * calls the prose prescribes separately with `&&` readily enough, and they
 * still ran in that order — so a Bash row is one event per statement,
 * letting a compound row satisfy consecutive entries and never satisfy
 * them reversed. Declared entries carry no separator (validated), so a
 * needle can never straddle the split.
 */
function statements(rows) {
  const out = [];
  for (const r of rows) {
    if (r.event !== 'PreToolUse') continue;
    if (r.tool !== 'Bash') { out.push(r); continue; }
    for (const detail of r.detail.split(SEGMENT)) out.push({ ...r, detail });
  }
  return out;
}

/**
 * Order carries meaning a presence check cannot: a gate read after the arm
 * it was supposed to select proves the arm was chosen some other way. The
 * declared entries must appear as a subsequence — other actions may fall
 * between them, but never out of sequence. A command entry matches a Bash
 * call. A `write:<path>` token stands for the path's first recorded write:
 * later edits to the same file never satisfy it, so a file created out of
 * order fails however many times it is touched afterwards. A
 * `dispatch:<agent>` token stands for the agent's next held dispatch, and
 * a `send:<agent>` token for the next held send continuing it.
 */
function callsInOrder(rows, sequence, records) {
  const events = statements(rows);
  const agents = agentsById(records);
  let at = 0;
  for (const wanted of sequence) {
    let found;
    if (wanted.startsWith(WRITE_TOKEN)) {
      const path = bare(wanted.slice(WRITE_TOKEN.length));
      found = events.findIndex((r) => writeTargets(r).some((t) => bare(t).includes(path)));
      if (found !== -1 && found < at) {
        const prefix = sequence.slice(0, sequence.indexOf(wanted));
        return {
          ok: false,
          detail: `"${wanted}" — the path's first write landed before ${prefix.map((s) => `"${s}"`).join(' → ')}`,
        };
      }
    } else if (wanted.startsWith(DISPATCH_TOKEN)) {
      const agent = wanted.slice(DISPATCH_TOKEN.length).trim();
      found = events.findIndex((r, i) => i >= at && heldAgent(r) === agent);
    } else if (wanted.startsWith(SEND_TOKEN)) {
      const agent = wanted.slice(SEND_TOKEN.length).trim();
      found = events.findIndex((r, i) => i >= at && sentAgent(r, agents) === agent);
    } else {
      found = events.findIndex((r, i) => i >= at && r.tool === 'Bash' && ranMatch(r.detail, wanted));
    }
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

const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

// What a dispatches claim reads, by its kind: the agent's dispatches and
// their prompts, or the sends continuing it and their messages.
const KINDS = {
  dispatch: { verb: 'dispatched', one: 'dispatch', many: 'dispatches', body: 'prompt' },
  send: { verb: 'sent to', one: 'send', many: 'sends', body: 'message' },
};

/** A claimed call as the check's detail names it — `x #2`, `send #2 to x`, `sends to x`. */
function claimed(w, n) {
  if (w.send) return `send${n ? ` #${n}` : 's'} to ${w.agent}`;
  return `${w.agent}${n ? ` #${n}` : ''}`;
}

/**
 * What the walker's dispatches and sends carried, against what the case
 * declares. `records` are the hold's own — each call whole, the prompt or
 * message uncapped — so a needle absent from one is absent from what the
 * agent was given.
 */
function dispatchesCheck(records, wanted) {
  const agents = agentsById(records);
  const failures = [];
  const held = [];
  for (const w of wanted) {
    const kind = w.send ? KINDS.send : KINDS.dispatch;
    const mine = records.filter((r) => {
      const input = r.tool_input || {};
      return w.send ? r.tool_name === SEND && agents.get(input.to) === w.agent : input.subagent_type === w.agent;
    });
    if (w.count !== undefined && mine.length !== w.count) {
      failures.push(`${w.agent} was ${kind.verb} ${plural(mine.length, 'time')}, not ${w.count}`);
      continue;
    }
    if (w.count === 0) {
      held.push(`${w.agent} never ${kind.verb}`);
      continue;
    }
    if (!mine.length) {
      failures.push(`${w.agent} was never ${kind.verb}`);
      continue;
    }
    if (w.nth && mine.length < w.nth) {
      failures.push(`${w.agent} was ${kind.verb} ${plural(mine.length, 'time')} — there is no ${kind.one} #${w.nth}`);
      continue;
    }
    const targets = w.nth ? [[w.nth, mine[w.nth - 1]]] : mine.map((r, i) => [i + 1, r]);
    const before = failures.length;
    for (const [n, r] of targets) {
      const body = String((r.tool_input || {})[kind.body] || '');
      const missing = (w.carries || []).filter((s) => !body.includes(s));
      const present = (w.lacks || []).filter((s) => body.includes(s));
      if (missing.length) failures.push(`${claimed(w, n)} does not carry: ${missing.join(', ')}`);
      if (present.length) failures.push(`${claimed(w, n)} carries what it must not: ${present.join(', ')}`);
    }
    if (failures.length === before) {
      held.push(`${claimed(w, w.nth)} (${plural(mine.length, kind.one, kind.many)})`);
    }
  }
  return failures.length
    ? { ok: false, detail: failures.join('; ') }
    : { ok: true, detail: `every declared dispatch held as declared: ${held.join(', ')}` };
}

/**
 * Run a case's declared invariants against its recorded actions and the
 * dispatches the hold recorded. Returns one result per declared check, in
 * declaration order.
 */
function check(rows, declared, dispatches = []) {
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
    results.push({ name: 'calls_in_order', ...callsInOrder(rows, declared.calls_in_order, dispatches) });
  }
  if (declared.dispatches && declared.dispatches.length) {
    results.push({ name: 'dispatches', ...dispatchesCheck(dispatches, declared.dispatches) });
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
    if (key === 'calls_in_order' && value.some((v) => SEGMENT.test(v))) {
      errors.push('a calls_in_order entry cannot span a statement separator (&& or ;) — the walk is ordered one statement at a time');
    }
    if (key !== 'calls_in_order' && value.some((v) => v.startsWith(WRITE_TOKEN))) {
      errors.push(`${key} cannot carry write: tokens — a write is ordered, never merely present; use calls_in_order`);
    }
    if (key === 'calls_in_order' && value.some((v) => v.startsWith(WRITE_TOKEN) && !v.slice(WRITE_TOKEN.length).trim())) {
      errors.push('a write: token needs a path');
    }
    for (const token of [DISPATCH_TOKEN, SEND_TOKEN]) {
      const call = token.slice(0, -1);
      if (key !== 'calls_in_order' && value.some((v) => v.startsWith(token))) {
        errors.push(`${key} cannot carry ${token} tokens — a ${call} is claimed through dispatches and ordered through calls_in_order`);
      }
      if (key === 'calls_in_order' && value.some((v) => v.startsWith(token) && !v.slice(token.length).trim())) {
        errors.push(`a ${token} token needs an agent`);
      }
    }
  }
  if ('dispatches' in declared) errors.push(...dispatchesErrors(declared.dispatches));
  return errors;
}

const DISPATCH_KEYS = ['agent', 'send', 'nth', 'count', 'carries', 'lacks'];
const isCount = (v, min) => Number.isInteger(v) && v >= min;
const isNeedles = (v) => Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === 'string' && s.trim());

function dispatchesErrors(value) {
  if (!Array.isArray(value) || !value.length) return ['dispatches must be a non-empty array of dispatch claims'];
  const errors = [];
  value.forEach((d, i) => {
    const at = `dispatches[${i}]`;
    if (!d || typeof d !== 'object' || Array.isArray(d)) {
      errors.push(`${at} must be an object`);
      return;
    }
    for (const key of Object.keys(d)) {
      if (!DISPATCH_KEYS.includes(key)) errors.push(`${at} has unknown key "${key}" (known: ${DISPATCH_KEYS.join(', ')})`);
    }
    if (typeof d.agent !== 'string' || !d.agent.trim()) errors.push(`${at} needs an agent — the subagent_type the prose dispatches`);
    if ('send' in d && typeof d.send !== 'boolean') errors.push(`${at} send must be true or false`);
    if ('nth' in d && !isCount(d.nth, 1)) errors.push(`${at} nth must be a whole number from 1`);
    if ('count' in d && !isCount(d.count, 0)) errors.push(`${at} count must be a whole number from 0`);
    for (const key of ['carries', 'lacks']) {
      if (key in d && !isNeedles(d[key])) errors.push(`${at} ${key} must be a non-empty array of non-empty strings`);
    }
    if (d.count === 0 && ['nth', 'carries', 'lacks'].some((k) => k in d)) {
      errors.push(`${at} claims no dispatch (count 0), so it can claim nothing a dispatch carried`);
    }
    if (isCount(d.nth, 1) && isCount(d.count, 1) && d.nth > d.count) {
      errors.push(`${at} nth ${d.nth} is past its own count ${d.count}`);
    }
  });
  return errors;
}

module.exports = { check, format, declarationErrors, undeclaredProse, NAMES };

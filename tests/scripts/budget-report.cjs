'use strict';

// The test budget report (tests/README.md §12): a run's CPU, read from the
// meter's log (cpu-meter.cjs), against the run's guide and each suite's
// budget. It prints four parts — the run against its guide; the suites over
// their budget, worst first, and those held to a budget their header names
// in place of their layer's, its reason beside it; the suites whose header
// names no layer; and, given the previous run's log, the suites new or grown
// since — and exits 0 whatever it finds. A report that forces a look, never
// a failure.
//
// A suite's budget is its layer's (tests/README.md §2), read as CPU
// seconds: the layer its header names (`Layer: verb.`, or `Verb layer:`),
// else the one a migration's or a simulation's file name gives it. A
// `Budget: <n> s — <why>.` line in the header replaces the layer's.
//
// usage: node tests/scripts/budget-report.cjs <cpu.jsonl> [--prev <cpu.jsonl>] [--all]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

/** CPU seconds a suite of each layer may spend. */
const BUDGETS = Object.freeze({
  unit: 1, verb: 15, git: 30, process: 15, conformance: 30, simulation: 30, migration: 5, prose: 5,
});

/** The whole run's guide on an idle machine, and what the machine runs at once: 8.5 performance cores' worth. */
const GUIDE_MIN = 6;
const CORES = 8.5;

/** A suite has grown when it costs this share and these seconds more than in the previous run. */
const GROWN = Object.freeze({ share: 0.2, seconds: 2 });

/** Lines a list shows unless `--all`. */
const SHOWN = 10;

const LAYER_NAMES = Object.keys(BUDGETS).join('|');
const NAMED = new RegExp(`\\bLayer: (${LAYER_NAMES})\\b`);
const PHRASED = new RegExp(`\\b(${LAYER_NAMES}) layer\\b`, 'i');
const OWN = /\bBudget: (\d+(?:\.\d+)?) s — (.+?)\.(?=\s|$)/;

/**
 * The layer and any budget of its own a suite's header names: its leading
 * comment block, read as one line.
 * @param {string} suite  the suite's path from the repository
 * @param {string} source
 * @returns {{ layer: string | null, own: { s: number, why: string } | null }}
 */
function headerOf(suite, source) {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => line.startsWith('//'));
  const block = [];
  for (let i = start; i >= 0 && i < lines.length && lines[i].startsWith('//'); i += 1) block.push(lines[i].replace(/^\/\/+-*\s?/, ''));
  const head = block.join(' ').replace(/\s+/g, ' ');
  const named = NAMED.exec(head) ?? PHRASED.exec(head);
  const byName = /(^|\/)test-migration-\d+/.test(suite) ? 'migration' : /(^|\/)test-pipeline-simulation/.test(suite) ? 'simulation' : null;
  const own = OWN.exec(head);
  return {
    layer: named ? named[1].toLowerCase() : byName,
    own: own ? { s: Number(own[1]), why: own[2] } : null,
  };
}

/**
 * Each suite's CPU in a meter log; a suite logged twice keeps its last line,
 * and a torn line is passed over.
 * @param {string} text
 * @returns {Map<string, number>}
 */
function readLog(text) {
  const cpu = new Map();
  for (const line of text.split('\n').filter(Boolean)) {
    try {
      const { suite, cpu: s } = JSON.parse(line);
      if (typeof suite === 'string' && typeof s === 'number') cpu.set(suite, s);
    } catch { /* torn */ }
  }
  return cpu;
}

/**
 * @typedef {{ suite: string, s: number, layer: string | null, budget: number | null, own: { s: number, why: string } | null }} Row
 */

/**
 * The report's lines for a run.
 * @param {Map<string, number>} cpu  each suite's CPU in the run
 * @param {(suite: string) => ReturnType<typeof headerOf>} header  each suite's header
 * @param {{ prev?: Map<string, number> | null, all?: boolean }} [options]
 * @returns {string[]}
 */
function report(cpu, header, { prev = null, all = false } = {}) {
  /** @type {Row[]} */
  const rows = [...cpu].map(([suite, s]) => {
    const { layer, own } = header(suite);
    return { suite, s, layer, own, budget: own ? own.s : layer ? BUDGETS[layer] : null };
  });
  const shown = (/** @type {Row[]} */ list) => (all ? list : list.slice(0, SHOWN));
  const more = (/** @type {Row[]} */ list) => (!all && list.length > SHOWN ? [`  and ${list.length - SHOWN} more (--all lists them)`] : []);
  const total = sum(rows.map((r) => r.s));
  const idle = Math.max(total / CORES, ...rows.map((r) => r.s));
  const out = [`test budget (CPU, user + sys): ${rows.length} suites, ${total.toFixed(0)} s in all — about ${(idle / 60).toFixed(1)} min on an idle machine against ${GUIDE_MIN} min (${(GUIDE_MIN * 60 * CORES).toFixed(0)} s of CPU at ${CORES} cores' worth)`];

  const over = rows.filter((r) => r.budget !== null && r.s > r.budget).sort(byExcess);
  out.push(`over their budget: ${over.length}`);
  for (const r of shown(over)) out.push(`  ${secs(r.s)}  ${budgetCell(r)}  ${r.suite}${r.own ? ` — ${r.own.why}` : ''}`);
  out.push(...more(over));

  const held = rows.filter((r) => r.own && r.layer && r.s > BUDGETS[r.layer] && r.s <= r.own.s)
    .sort((a, b) => (b.s - BUDGETS[b.layer]) - (a.s - BUDGETS[a.layer]));
  if (held.length > 0) {
    out.push(`over their layer's budget, within their own: ${held.length}`);
    for (const r of shown(held)) out.push(`  ${secs(r.s)}  ${budgetCell(r)}  ${r.suite} — ${r.own?.why}`);
    out.push(...more(held));
  }

  const unnamed = rows.filter((r) => r.budget === null).sort((a, b) => b.s - a.s);
  if (unnamed.length > 0) {
    out.push(`no layer named in the header, so no budget: ${unnamed.length} suites, ${sum(unnamed.map((r) => r.s)).toFixed(0)} s`);
    for (const r of shown(unnamed)) out.push(`  ${secs(r.s)}  ${r.suite}`);
    out.push(...more(unnamed));
  }

  if (prev) {
    const was = (/** @type {Row} */ r) => prev.get(r.suite);
    const grown = rows.filter((r) => {
      const before = was(r);
      return before === undefined || (r.s - before > GROWN.seconds && r.s > before * (1 + GROWN.share));
    }).sort((a, b) => (b.s - (was(b) ?? 0)) - (a.s - (was(a) ?? 0)));
    out.push(`since the previous run: ${sum([...prev.values()]).toFixed(0)} s -> ${total.toFixed(0)} s; new or grown: ${grown.length}`);
    for (const r of grown) {
      const before = was(r);
      out.push(`  ${secs(r.s)}  ${(before === undefined ? 'new' : `was ${before.toFixed(1)} s`).padEnd(12)}  ${r.suite}`);
    }
  }
  return out;
}

/** @param {number[]} values */
function sum(values) {
  return values.reduce((a, b) => a + b, 0);
}

/** @param {number} s */
function secs(s) {
  return `${s.toFixed(1).padStart(7)} s`;
}

/** @param {Row} r */
function budgetCell(r) {
  return `${String(r.budget).padStart(4)} s ${(r.own ? 'own' : r.layer ?? '').padEnd(12)}`;
}

/** @param {Row} a @param {Row} b */
function byExcess(a, b) {
  return (b.s - (b.budget ?? 0)) - (a.s - (a.budget ?? 0));
}

/** A suite's header, read from the repository; none where the file is gone. @param {string} suite */
function headerInRepo(suite) {
  try {
    return headerOf(suite, fs.readFileSync(path.join(ROOT, suite), 'utf8'));
  } catch {
    return { layer: null, own: null };
  }
}

/** @param {string} file */
function logAt(file) {
  return fs.existsSync(file) ? readLog(fs.readFileSync(file, 'utf8')) : null;
}

/**
 * The report for the command line's arguments; never throws.
 * @param {string[]} args  `<cpu.jsonl> [--prev <cpu.jsonl>] [--all]`
 * @returns {string[]}
 */
function main(args) {
  try {
    const at = args.indexOf('--prev');
    const prevFile = at >= 0 ? args[at + 1] : null;
    const file = args.find((a, i) => !a.startsWith('--') && (at < 0 || i !== at + 1));
    const cpu = file ? logAt(file) : null;
    if (cpu === null) return [`test budget: no CPU log${file ? ` at ${file}` : ''}`];
    return report(cpu, headerInRepo, { prev: prevFile ? logAt(prevFile) : null, all: args.includes('--all') });
  } catch (err) {
    return [`test budget: no report — ${/** @type {Error} */ (err).message}`];
  }
}

if (require.main === module) console.log(main(process.argv.slice(2)).join('\n'));

module.exports = { BUDGETS, GUIDE_MIN, CORES, headerOf, readLog, report, main };

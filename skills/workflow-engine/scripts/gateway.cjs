'use strict';

// ---------------------------------------------------------------------------
// Gateway harness — the uniform CLI surface for every skill's adapter.
//
// Each skill's adapter script (its read gateway) registers handlers for the
// shared verb vocabulary and calls runGateway(). The .md's prescribed call
// names the verb, so the script never guesses what a call is for:
//
//   gateway.cjs                → index()        head-of-skill `!` insert
//   gateway.cjs data <wu>      → data(wu)       reasoning-only flags
//   gateway.cjs view <wu>      → view(wu)       DATA + DISPLAY + MENU snapshot
//   gateway.cjs <verb> <args…> → handlers[verb] skill-specific sub-views
//
// Output sections are demarcated so the two surfaces can't be confused:
// DATA is for reasoning (never displayed); DISPLAY and MENU are emitted to
// the user verbatim (never parsed for decisions).
// ---------------------------------------------------------------------------

/**
 * @typedef {Record<string, (...args: string[]) => string>} GatewayHandlers
 *   Verb → handler. Each handler returns the full stdout for that call.
 *   Reserved verbs: `index` (no-args call), `fallback` (unmatched argv,
 *   for back-compat positional forms during migration).
 */

const SECTION = {
  data:    '=== DATA (reason from this — never display or parse the sections below) ===',
  display: '=== DISPLAY (emit verbatim as a code block) ===',
  menu:    '=== MENU (emit verbatim as markdown) ===',
};

/** Render a DATA section. Objects become stable `key: value` lines. @param {object|string} body */
function dataBlock(body) {
  return SECTION.data + '\n' + (typeof body === 'string' ? body : dataLines(body)) + '\n';
}

/** @param {string} body display block, pre-rendered */
function displayBlock(body) {
  return SECTION.display + '\n' + String(body).replace(/\n+$/, '') + '\n';
}

/** @param {string} body menu block, pre-rendered */
function menuBlock(body) {
  return SECTION.menu + '\n' + String(body).replace(/\n+$/, '') + '\n';
}

// `key: value` lines for flat values; nested objects/arrays render as compact
// JSON on the same line. Deterministic: insertion order, no reflow.
/** @param {object} obj */
function dataLines(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${k}: ${typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}`)
    .join('\n');
}

/**
 * Dispatch argv against the registered handlers and write the result to
 * stdout. Exits non-zero with a usage line on an unknown verb.
 * @param {GatewayHandlers} handlers
 * @param {string[]} [argv] defaults to process.argv.slice(2)
 */
function runGateway(handlers, argv = process.argv.slice(2)) {
  const [first, ...rest] = argv;

  let out;
  if (first === undefined) {
    if (typeof handlers.index !== 'function') {
      throw new Error('gateway: no `index` handler registered for the no-args call');
    }
    out = handlers.index();
  } else if (typeof handlers[first] === 'function' && first !== 'fallback') {
    out = handlers[first](...rest);
  } else if (typeof handlers.fallback === 'function') {
    out = handlers.fallback(...argv);
  } else {
    const verbs = Object.keys(handlers).filter((v) => v !== 'fallback').join(' | ');
    process.stderr.write(`gateway: unknown verb "${first}"\nUsage: <script> [${verbs}] [args…]\n`);
    process.exit(1);
    return; // unreachable; keeps control flow explicit for the type checker
  }

  process.stdout.write(String(out).replace(/\n+$/, '') + '\n');
}

module.exports = { runGateway, dataBlock, displayBlock, menuBlock, SECTION };

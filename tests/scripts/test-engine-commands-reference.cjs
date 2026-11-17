'use strict';

// ---------------------------------------------------------------------------
// The command reference is held to the engine: it has one entry per family
// the engine dispatches and no other, in the families' `### ` headings; each
// entry's signature block is the engine's own usage for that family, line
// for line, so the usage has one source; each entry says something beside
// its signatures, a family with no verb among them; and each entry names
// every verb its usage says in bold — `knowledge`'s as its own door names
// them — and no bold name that is neither one of its family's verbs nor a
// family.
//
// Layer: unit. World: none; reads the reference, the engine's usage as the
// engine says it to a command it does not dispatch, and the knowledge
// door's as it says it to a verb it does not know.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { run, COMMANDS } = require('../../skills/ledger-engine/scripts/engine.cjs');

const REFERENCE = path.join(__dirname, '../../docs/engine/commands.md');

/** The usage's lines below `Commands:`, each without the two spaces it is said under. */
const usage = String(run(['nope'], { cwd: os.tmpdir() }).stderr).split('\n');
const said = usage.slice(usage.indexOf('Commands:') + 1).filter((line) => line.trim() !== '').map((line) => line.slice(2));

/** Each family's usage lines, a continuation or placeholder line under the family whose line it follows. */
/** @type {Record<string, string[]>} */
const blocks = {};
let current = '';
for (const line of said) {
  const family = /^([a-z][a-z-]*)(?: |$)/.exec(line);
  if (family) current = family[1];
  (blocks[current] ??= []).push(line);
}

/** Each family's verbs: a form's second word, its alternatives apart, a line's later forms of its own family among them. */
/** @type {Record<string, Set<string>>} */
const verbs = {};
for (const line of said.filter((one) => /^[a-z]/.test(one))) {
  for (const form of line.split(' | ').filter((one, i, all) => i === 0 || one.split(' ')[0] === all[0].split(' ')[0])) {
    const [family, second = ''] = form.split(/\s+/);
    const alternatives = /^([a-z][a-z-]*(?:\|[a-z][a-z-]*)*)$/.exec(second);
    verbs[family] ??= new Set();
    for (const verb of alternatives ? alternatives[1].split('|') : []) verbs[family].add(verb);
  }
}

/** `knowledge`'s verbs, which its usage line leaves to its own door: as that door names them, refusing a verb it does not know. */
const knowledgeRefusal = JSON.parse(String(run(['knowledge', '__unknown__'], { cwd: os.tmpdir() }).stderr)).error;
verbs.knowledge = new Set(/^Usage: engine knowledge <([a-z|-]+)>/.exec(knowledgeRefusal)?.[1].split('|') ?? []);

/** The reference's entries by family: the signature block and the prose beside it. */
function entries(/** @type {string} */ doc) {
  const parts = doc.split(/^### `([a-z][a-z-]*)`$/m);
  /** @type {Record<string, {block: string, prose: string}>} */
  const found = {};
  for (let i = 1; i < parts.length; i += 2) {
    const body = parts[i + 1].split(/^## /m)[0];
    const fence = /```text\n([\s\S]*?)\n```/.exec(body);
    found[parts[i]] = { block: fence ? fence[1] : '', prose: fence ? body.replace(fence[0], '') : body };
  }
  return { names: parts.filter((_, i) => i % 2 === 1), found };
}

/** What the reference says against the engine, each fault named. @param {string} doc */
function faults(doc) {
  const { names, found } = entries(doc);
  const families = Object.keys(COMMANDS);
  const out = [];
  if (names.join(' ') !== [...new Set(names)].join(' ')) out.push('a family has two entries');
  for (const family of families.filter((one) => !names.includes(one))) out.push(`${family}: no entry`);
  for (const family of names.filter((one) => !families.includes(one))) out.push(`${family}: no such family`);
  for (const family of names.filter((one) => families.includes(one))) {
    const { block, prose } = found[family];
    if (block !== blocks[family].join('\n')) out.push(`${family}: the signature block is not the engine's usage`);
    if (prose.trim() === '') out.push(`${family}: says nothing beside its signatures`);
    const bold = new Set([...prose.matchAll(/\*\*`([a-z][a-z-]*)`\*\*/g)].map((m) => m[1]));
    for (const verb of verbs[family]) if (!bold.has(verb)) out.push(`${family} ${verb}: not said`);
    for (const name of bold) if (!verbs[family].has(name) && !families.includes(name)) out.push(`${family} ${name}: no such verb`);
  }
  return out;
}

describe('the command reference', () => {
  const doc = fs.readFileSync(REFERENCE, 'utf8');

  it('reads the verbs of each family, `knowledge`\'s from its own door', () => {
    assert.ok(Object.values(verbs).reduce((sum, set) => sum + set.size, 0) > 300);
    assert.ok(verbs.knowledge.has('query') && verbs.knowledge.has('setup'), knowledgeRefusal);
  });

  it('has one entry per family the engine dispatches, its signatures the usage, every verb said and none it lacks', () => {
    assert.deepStrictEqual(faults(doc), []);
  });

  it('names what is missing where an entry drops a verb, a signature line, its prose or a family', () => {
    const verb = doc.replace(/^- \*\*`late-check`\*\* — .*\n/m, '');
    assert.deepStrictEqual(faults(verb), ['ledger late-check: not said']);
    const line = doc.replace(/^ledger late-check .*\n/m, '');
    assert.deepStrictEqual(faults(line), ['ledger: the signature block is not the engine\'s usage']);
    const family = doc.replace(/^### `measures`$/m, '### `measured`');
    assert.deepStrictEqual(faults(family), ['measures: no entry', 'measured: no such family']);
    const prose = doc.replace(/(^### `boot`\n\n```text\n[\s\S]*?\n```\n)[\s\S]*?(?=\n### )/m, '$1');
    assert.deepStrictEqual(faults(prose), ['boot: says nothing beside its signatures']);
    const knowledge = doc.replace(/^- \*\*`fill`\*\* — .*\n/m, '');
    assert.deepStrictEqual(faults(knowledge), ['knowledge fill: not said']);
  });

  it('names a verb the engine lacks', () => {
    assert.deepStrictEqual(faults(doc.replace('- **`late-check`**', '- **`late-check`**, **`early-check`**')), ['ledger early-check: no such verb']);
  });
});

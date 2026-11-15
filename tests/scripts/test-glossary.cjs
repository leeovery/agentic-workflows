'use strict';

// The glossary (23.3): its entries read as a lint over their terms, with the
// lists here. The retired terms have no entry, and the words naming what the
// release retired appear nowhere in it (23.S8); every term 23.3.2 adds has an
// entry, with the trust machinery's own; review is three terms, never one
// (23.S9); the inbox is the place and triage the act, and messages between
// topics are mail (23.S10). The answering rule's half of 23.S16: the rule
// loads the glossary from where it lives, answers in the screens' words,
// says where the glossary stops and points at the docs, invents nothing and
// puts the gate back; and no entry speaks in an engine verb, a path or a
// skill name.
//
// Layer: unit. World: the repository's own files, read.

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const REFERENCES = path.join(__dirname, '..', '..', 'skills', 'leeway-shared', 'references');
const GLOSSARY = path.join(REFERENCES, 'glossary.md');
const RULE = path.join(REFERENCES, 'answering-how-it-works.md');

/** Each entry: its term, its definition, and the aliases it says to avoid. @param {string} text */
function entriesOf(text) {
  /** @type {{term: string, definition: string, avoid: string}[]} */
  const entries = [];
  for (const block of text.split(/\n{2,}/)) {
    const [head, ...rest] = block.split('\n');
    const term = /^\*\*(.+)\*\*:$/.exec(head)?.[1];
    if (!term) continue;
    const avoid = rest.filter((line) => line.startsWith('_Avoid_:')).join(' ');
    entries.push({ term, definition: rest.filter((line) => !line.startsWith('_Avoid_:')).join(' '), avoid });
  }
  return entries;
}

const text = fs.readFileSync(GLOSSARY, 'utf8');
const entries = entriesOf(text);
const terms = entries.map(({ term }) => term);
/** @param {string} term */
const entry = (term) => {
  const found = entries.find((e) => e.term === term);
  assert.ok(found, `the glossary has an entry for "${term}"`);
  return found;
};

const RETIRED = ['research', 'scoping', 'planning', 'plan', 'cross-cutting', 'build order', 'dead end', 'document', 'baseline', 'dashboard', 'working set', 'review'];
const RETIRED_WORDS = /\b(?:scoping|cross-cutting|build order|dead end|baseline|dashboard|working set)\b/i;
const ADDED = [
  'discussion', 'record', 'log', 'ledger', 'entry', 'map', 'product record', 'phase cut', 'builder', 'task loop',
  'reviewer pair', 'notes for later', 'stack', 'the ask rule', 'kind', 'verdict', 'blind question', 'auto and step',
  'proven and not proven', 'verify setup', 'feature map', 'driver', 'state branch',
  'convergence', 'care entry', 'the matrix', 'the verdict queue', 'the record of the person',
];

describe('the glossary (23.3)', () => {
  it('reads as entries, each term once', () => {
    assert.ok(entries.length > ADDED.length);
    assert.deepStrictEqual(terms.filter((term, i) => terms.indexOf(term) !== i), []);
  });

  it('23.S8: has no entry for a retired term, and names nothing the release retired', () => {
    assert.deepStrictEqual(terms.filter((term) => RETIRED.includes(term.toLowerCase())), []);
    assert.deepStrictEqual(text.split('\n').filter((line) => RETIRED_WORDS.test(line)), []);
  });

  it('23.S8: has an entry for every term 23.3.2 adds, and the trust machinery\'s', () => {
    assert.deepStrictEqual(ADDED.filter((term) => !terms.includes(term)), []);
  });

  it('23.S8: discussion is the one deciding phase, research one of its tools', () => {
    const { definition, avoid } = entry('discussion');
    assert.match(definition, /\bResearch\b[^.:]*\btools\b/);
    assert.match(avoid, /\bresearch \(as a phase\)/);
  });

  it('23.S9: the review phase, the phase review and the closing pass are each a term of their own', () => {
    assert.deepStrictEqual(['review phase', 'phase review', 'closing pass'].filter((term) => !terms.includes(term)), []);
    assert.match(entry('review phase').avoid, /\breview \(alone\b/);
  });

  it('23.S10: the inbox is the place and triage the act on it', () => {
    assert.match(entry('inbox').definition, /^The place\b/);
    assert.match(entry('inbox').avoid, /\btriage \(that is the act\b/);
    assert.match(entry('triage').definition, /^The act of deciding on what waits in the inbox\b/);
    assert.match(entry('triage').avoid, /\bthe inbox \(that is the place\)/);
  });

  it('23.S10: messages between topics are mail, shown as mail waiting, never triage waiting', () => {
    const { definition, avoid } = entry('mail');
    assert.match(definition, /^The messages waiting for\b/);
    assert.match(definition, /\bmail waiting\b/);
    assert.match(avoid, /\btriage waiting\b/);
    assert.match(entry('message').definition, /\bsent to that topic's mail\b/);
    assert.deepStrictEqual(entries.filter(({ term, definition }) => term !== 'mail' && /triage waiting/i.test(definition)), []);
  });

  it('23.S16: no entry speaks in an engine verb, a path or a skill name', () => {
    const spoken = entries.flatMap(({ term, definition }) => [
      ...[...definition.matchAll(/`([^`]+)`/g)].map((m) => m[1]).filter((code) => !/^(?:[a-z#]\/[a-z]+|\/leeway)$/.test(code)),
      ...(definition.match(/\bleeway-[a-z]|\.leeway\/|\bengine\.cjs\b|[\w-]+\.(?:md|json|jsonl|cjs)\b/g) ?? []),
    ].map((said) => `${term}: ${said}`));
    assert.deepStrictEqual(spoken, []);
  });
});

describe('the answering rule (23.3.5)', () => {
  const rule = fs.readFileSync(RULE, 'utf8');

  it('23.S16: loads the glossary from where it lives, at the question', () => {
    const link = /^1\. Load \*\*\[glossary\.md\]\(([^)]+)\)\*\*/m.exec(rule)?.[1];
    assert.strictEqual(link && path.join(REFERENCES, link), GLOSSARY);
  });

  it('23.S16: answers in the screens\' words, never engine verbs, paths or skill names', () => {
    assert.match(rule, /\bthe words the person meets on screen — never engine verbs, file paths, or skill names\b/);
  });

  it('23.S16: says where the glossary stops, points at the docs and invents nothing', () => {
    assert.match(rule, /\bWhere the glossary does not cover it, say so plainly and point at the book: https:\/\/github\.com\/[\w-]+\/[\w-]+\/tree\/main\/docs\. Never invent an answer\./);
  });

  it('23.S16: puts back the gate the question set aside', () => {
    assert.match(rule, /\bWhere the person was at a gate, the question set it aside, and it comes back\b/);
  });
});

'use strict';

// ---------------------------------------------------------------------------
// The render catalogue's surfaces (domain/render.cjs) for the baseline. They
// go with the discovery phase (29.12), with the baseline skill, which removes
// their callers.
//
// Layer: verb. World: the project world (setupFixture), a copied git project,
// its manifests and payloads written per test; the domain's renderSurface is
// called in process, every gate payload audited against its menu
// (gate-audit.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { DOTS } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');
const { renderSurface, unwrap, setup, teardown, writePayload } = require('./render-surfaces-world.cjs');

describe('baseline surfaces', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  function writeBaseline(baseline) {
    const wf = path.join(dir, '.leeway');
    fs.mkdirSync(wf, { recursive: true });
    fs.writeFileSync(path.join(wf, 'manifest.json'), JSON.stringify({ work_units: {}, baseline }, null, 2));
  }

  it('baseline-progress: in-progress shows statuses and the remaining count', () => {
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed', glossary: 'researched', dispatcher: 'pending' } });
    const out = renderSurface(dir, 'baseline-progress', {});
    assert.strictEqual(out, [
      '=== DISPLAY: baseline progress (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Baseline in progress:',
      '',
      '  overview    [completed]',
      '  glossary    [researched]',
      '  dispatcher  [pending]',
      '',
      '2 area(s) remain.',
      '',
    ].join('\n'));
  });

  it('baseline-progress: completed lists the landed docs', () => {
    writeBaseline({ status: 'completed', areas: { overview: 'completed', glossary: 'completed' } });
    const out = renderSurface(dir, 'baseline-progress', {});
    assert.match(out, /Baseline — 2 area\(s\) documented:/);
    assert.match(out, /  • overview\.md\n  • glossary\.md/);
  });

  it('baseline-progress: refuses a missing baseline and an empty area map', () => {
    assert.throws(() => renderSurface(dir, 'baseline-progress', {}), /the baseline is "none" — no assessment has been started/);
    writeBaseline({ status: 'in-progress', areas: {} });
    assert.throws(() => renderSurface(dir, 'baseline-progress', {}), /no areas/);
  });

  it('baseline-area-gate: statement, glyphed question, and both options', () => {
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed', glossary: 'researched' } });
    const out = renderSurface(dir, 'baseline-area-gate', { area: 'overview' });
    assert.match(out, /^=== MENU: baseline area gate \(emit verbatim as markdown \(not a code block\), then STOP for the user's response\) ===/);
    assert.match(out, /\*\*Overview\*\* is documented\. 1 area\(s\) remain\./);
    assert.match(out, /\*\*`◆ Keep going\?`\*\*/);
    assert.match(out, /\*\*`y\/yes`\*\*\s+→ Interview the next area/);
    assert.match(out, /\*\*`p\/pause`\*\*\s+→ Stop here — resume any time from workflow-start/);
  });

  it('baseline-area-gate: refuses a missing --area, an unknown area, an unlanded area, and a drained map', () => {
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed', glossary: 'researched' } });
    assert.throws(() => renderSurface(dir, 'baseline-area-gate', {}), /--area is required/);
    assert.throws(() => renderSurface(dir, 'baseline-area-gate', { area: 'ghost' }), /unknown area/);
    assert.throws(() => renderSurface(dir, 'baseline-area-gate', { area: 'glossary' }), /not completed/);
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed' } });
    assert.throws(() => renderSurface(dir, 'baseline-area-gate', { area: 'overview' }), /no areas remain/);
  });

  it('baseline-paused: counts the documented areas and points back at workflow-start', () => {
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed', glossary: 'researched', dispatcher: 'researched' } });
    const out = renderSurface(dir, 'baseline-paused', {});
    assert.match(out, /Paused — 1 of 3 area\(s\) documented\./);
    assert.match(out, /Resume from the workflow-start menu\./);
    writeBaseline({ status: 'completed', areas: { overview: 'completed' } });
    assert.throws(() => renderSurface(dir, 'baseline-paused', {}), /not in-progress/);
  });

  it('baseline-receipt: lists the docs and requires the completion write first', () => {
    writeBaseline({ status: 'completed', areas: { overview: 'completed', glossary: 'completed' } });
    const out = renderSurface(dir, 'baseline-receipt', {});
    assert.match(out, /Baseline complete — 2 area\(s\) documented and indexed\./);
    assert.match(out, /  • overview\.md\n  • glossary\.md/);
    assert.match(out, /\[baseline \| …\] context/);
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed' } });
    assert.throws(() => renderSurface(dir, 'baseline-receipt', {}), /not completed/);
  });

  it('baseline-receipt: refuses to name a doc that was never landed', () => {
    writeBaseline({ status: 'completed', areas: { overview: 'completed', dispatcher: 'pending' } });
    assert.throws(() => renderSurface(dir, 'baseline-receipt', {}), /"dispatcher" is "pending", not completed/);
  });

  it('baseline-scope-gate: renders the proposed list as markdown above the gate, stateless', () => {
    const file = writePayload(dir, 'payload.json', {
      mode: 'fresh',
      areas: [{ name: 'overview', detail: 'What the product is' }, { name: 'dispatcher', detail: 'The downstream push pipeline' }],
    });
    const out = renderSurface(dir, 'baseline-scope-gate', { file });
    assert.match(out, /=== DISPLAY: baseline scope \(emit verbatim as markdown \(not a code block\)\) ===/);
    assert.match(out, /\*\*overview\*\* — What the product is\n\*\*dispatcher\*\* — The downstream push pipeline/);
    assert.match(out, /\*\*`◆ Assess these areas\?`\*\*/);
    assert.match(out, /\*\*`y\/yes`\*\*\s+→ Lock the list and start the research/);
    assert.match(out, /\*\*`b\/back`\*\*\s+→ Leave without changing anything/);
    assert.match(out, /\*\*Adjust\*\*\s+→ Tell me what to add, drop, rename, or merge/);
  });

  it('baseline-scope-gate: refuses illegal names, bad modes, and empty payloads', () => {
    const bad = (payload) => writePayload(dir, 'payload.json', payload);
    assert.throws(() => renderSurface(dir, 'baseline-scope-gate', {}), /--file <payload\.json> is required/);
    assert.throws(() => renderSurface(dir, 'baseline-scope-gate', { file: bad({ mode: 'weird', areas: [{ name: 'a', detail: 'x' }] }) }), /"mode" must be/);
    assert.throws(() => renderSurface(dir, 'baseline-scope-gate', { file: bad({ mode: 'fresh', areas: [] }) }), /non-empty array/);
    assert.throws(() => renderSurface(dir, 'baseline-scope-gate', { file: bad({ mode: 'fresh', areas: [{ name: 'api.v2', detail: 'x' }] }) }), /kebab-case/);
    assert.throws(() => renderSurface(dir, 'baseline-scope-gate', { file: bad({ mode: 'fresh', areas: [{ name: 'ok-area', detail: ' ' }] }) }), /missing "detail"/);
  });

  it('baseline-area: the area\'s step marker counted across every area, the documented ones first, then the session\'s line and the answer guidance', () => {
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed', boundaries: 'completed', 'job-dispatcher': 'researched', glossary: 'researched' } });
    const file = writePayload(dir, '.leeway/.cache/baseline/area.json', { area: 'job-dispatcher', summary: 'How work reaches the workers, and why it polls.' });
    assert.strictEqual(renderSurface(dir, 'baseline-area', { file }), [
      '=== DISPLAY: baseline area (emit verbatim as markdown (not a code block) — do not stop; continue as the workflow instructs) ===',
      '**`□ Interviewing Job Dispatcher (3 of 4)`**',
      '',
      '> How work reaches the workers, and why it polls. Answer in your own words, pick a candidate, or say "don\'t know" — an unanswered question is recorded as open, never guessed at.',
      '',
    ].join('\n'));
  });

  it('baseline-area: refuses no payload, an unknown or unresearched area, and a summary missing or past one line', () => {
    writeBaseline({ status: 'in-progress', areas: { overview: 'completed', dispatcher: 'researched' } });
    const area = (obj) => writePayload(dir, '.leeway/.cache/baseline/area.json', obj);
    assert.throws(() => renderSurface(dir, 'baseline-area', {}), /render baseline-area: --file <payload\.json> is required/);
    assert.throws(() => renderSurface(dir, 'baseline-area', { file: area({ area: 'ghost', summary: 'x' }) }), /unknown area "ghost"/);
    assert.throws(() => renderSurface(dir, 'baseline-area', { file: area({ area: 'overview', summary: 'x' }) }),
      /area "overview" is "completed", not researched — the interview opens on a researched area/);
    for (const summary of [undefined, ' ', 'one\ntwo']) {
      assert.throws(() => renderSurface(dir, 'baseline-area', { file: area({ area: 'dispatcher', summary }) }),
        /"summary" must be one non-empty line — what the area covers and what the questions are after/);
    }
  });

  it('baseline-round: numbers questions, letters candidates, closes on the any-mix line', () => {
    writeBaseline({ status: 'in-progress', areas: { dispatcher: 'researched' } });
    const file = writePayload(dir, 'payload.json', {
      area: 'dispatcher',
      questions: [
        { text: 'The dispatcher polls behind four guards — what is the story?', candidates: ['Incident accretion', 'Partner rate agreement'] },
        { text: 'Why does Closed exist as a state?' },
      ],
    });
    const out = renderSurface(dir, 'baseline-round', { file });
    assert.match(out, /=== DISPLAY: baseline round \(emit verbatim as a text code block \(```text fence\), then STOP for the user's response\) ===/);
    assert.match(out, /1\. The dispatcher polls behind four guards/);
    assert.match(out, /   a\. Incident accretion\n   b\. Partner rate agreement/);
    assert.match(out, /2\. Why does Closed exist as a state\?/);
    assert.match(out, /Answer in your own words, pick letters, or say "don't know" —/);
  });

  it('baseline-round: refuses an unresearched area and malformed questions', () => {
    writeBaseline({ status: 'in-progress', areas: { dispatcher: 'completed' } });
    const file = writePayload(dir, 'payload.json', { area: 'dispatcher', questions: [{ text: 'x' }] });
    assert.throws(() => renderSurface(dir, 'baseline-round', { file }), /not researched/);
    writeBaseline({ status: 'in-progress', areas: { dispatcher: 'researched' } });
    const many = writePayload(dir, 'payload.json', { area: 'dispatcher', questions: [1, 2, 3, 4, 5].map((n) => ({ text: `q${n}` })) });
    assert.throws(() => renderSurface(dir, 'baseline-round', { file: many }), /1-4/);
  });

  it('baseline-offer-gate: renders only while nothing is recorded', () => {
    const out = renderSurface(dir, 'baseline-offer-gate', {});
    assert.match(out, /\*\*`◆ Run a baseline assessment\?`\*\*/);
    assert.match(out, /\*\*`y\/yes`\*\* → Start the assessment now/);
    assert.match(unwrap(out), /\*\*`n\/no`\*\*\s+→ Skip — you can start it later from the workflow-start menus/);
    writeBaseline({ status: 'skipped' });
    assert.throws(() => renderSurface(dir, 'baseline-offer-gate', {}), /the offer fires once/);
    // A native verdict is recorded state too — the offer never fires over it,
    // and the mid-flight surfaces read it as never started.
    writeBaseline({ status: 'native' });
    assert.throws(() => renderSurface(dir, 'baseline-offer-gate', {}), /the offer fires once/);
    assert.throws(() => renderSurface(dir, 'baseline-progress', {}), /the baseline is "native" — no assessment has been started/);
  });

  it('the static baseline gates render their menus; the completed-only pair refuse mid-flight', () => {
    assert.match(renderSurface(dir, 'baseline-doc-gate', {}), /\*\*`◆ Land it\?`\*\*[\s\S]*\*\*`y\/yes`\*\*\s+→ Index and commit the doc/);
    writeBaseline({ status: 'in-progress', areas: { overview: 'researched' } });
    assert.throws(() => renderSurface(dir, 'baseline-manage-gate', {}), /not completed/);
    assert.throws(() => renderSurface(dir, 'baseline-doc-pick', {}), /not completed/);
    writeBaseline({ status: 'completed', areas: { overview: 'completed' } });
    assert.match(renderSurface(dir, 'baseline-manage-gate', {}), /\*\*`◆ What would you like to do\?`\*\*[\s\S]*\*\*`e\/expand`\*\* → Add a new area, or deepen an existing one/);
    // The way out of the baseline is the surface it was entered from.
    assert.match(renderSurface(dir, 'baseline-manage-gate', {}), /\*\*`b\/back`\*\*\s+→ Return to the start menu/);
  });

  it('the doc pick numbers every area doc beneath its question, back last, each number\'s area on its DATA row', () => {
    writeBaseline({ status: 'completed', areas: { overview: 'completed', payments: 'completed' } });
    assert.strictEqual(renderSurface(dir, 'baseline-doc-pick', {}), [
      '=== DATA (reason from this — never display or parse the sections below) ===',
      'DOCS (key  area):',
      '  1  overview',
      '  2  payments',
      '',
      "=== MENU: baseline doc pick (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Which doc?`**',
      '',
      '**`1`**      → overview.md',
      '**`2`**      → payments.md',
      '**`b/back`** → Return to the baseline menu',
      '',
    ].join('\n'));
  });
});

'use strict';

// ---------------------------------------------------------------------------
// The render catalogue's surfaces (domain/render.cjs) for the walkthrough.
// They go with setup and help (29.18), which removes their callers.
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

const { DOTS } = require('../../skills/leeway-engine/scripts/domain/projections/surfaces.cjs');
const { renderSurface, NB, setup, teardown } = require('./render-surfaces-world.cjs');

describe('walkthrough surfaces', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { teardown(dir); });

  const SCREENS = path.join(__dirname, '..', '..', 'skills', 'leeway-engine', 'content', 'walkthrough', 'screens');
  const screenFiles = () => fs.readdirSync(SCREENS).filter((f) => f.endsWith('.md')).sort();
  const screenText = (n) => fs.readFileSync(path.join(SCREENS, screenFiles()[n - 1]), 'utf8');
  const titleOf = (n) => screenText(n).split('\n').find((l) => l.startsWith('# ')).slice(2).trim();

  const TOPICS = path.join(__dirname, '..', '..', 'skills', 'leeway-engine', 'content', 'walkthrough', 'topics');
  const cardFiles = () => fs.readdirSync(TOPICS).filter((f) => f.endsWith('.md')).sort();
  const cardText = (n) => fs.readFileSync(path.join(TOPICS, cardFiles()[n - 1]), 'utf8');
  const cardTitle = (n) => cardText(n).split('\n').find((l) => l.startsWith('# ')).slice(2).trim();
  // The addresses `walkthrough-topic` takes. Pinned rather than re-derived
  // from the filenames the projection reads: a slug is what a session routes
  // on, and a card renamed out from under one has to fail here.
  const SLUGS = [
    'kinds-of-work', 'the-phases', 'epics-the-map-and-the-dashboard', 'the-roadmap', 'gates-and-auto',
    'the-knowledge-base-and-the-baseline', 'the-inbox', 'reshaping-work', 'working-in-parallel',
  ];
  /** The section markers of a render, in order — the shape the emitting prose walks. */
  const markers = (out) => out.split('\n').filter((l) => l.startsWith('=== ')).map((l) => l.slice(4, l.indexOf(' (')));
  /** A content file's chunks in order, each carrying its fence tag ('' when untagged, null for prose). */
  const fenceChunks = (text) => {
    const chunks = [];
    let tag = null;
    let buffer = [];
    const flush = () => {
      const body = buffer.join('\n').replace(/^\n+|\n+$/g, '');
      if (body !== '' || tag) chunks.push({ tag, text: body });
      buffer = [];
    };
    for (const line of text.split('\n').slice(1)) {
      if (line.startsWith('```')) { const open = line.slice(3).trim(); flush(); tag = tag === null ? open : null; continue; }
      buffer.push(line);
    }
    flush();
    return chunks;
  };
  const menuOf = (out) => out.slice(out.indexOf('=== MENU:'));

  it('a screen is its heading, its content in file order, then its menu', () => {
    const out = renderSurface(dir, 'walkthrough-screen', { screen: '1', from: 'first-run' });
    assert.deepStrictEqual(markers(out), ['TITLE', 'DISPLAY: walkthrough prose', 'DISPLAY: walkthrough diagram', 'DISPLAY: walkthrough prose', 'MENU: walkthrough screen']);
    assert.ok(out.startsWith([
      "=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===",
      `# **\`■ How the workflows work · 1 of ${screenFiles().length} · ${titleOf(1)}\`**`,
      '',
      '=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===',
    ].join('\n')), out.slice(0, 400));

    // Every chunk the file marks off reaches the render in file order: the
    // prose as written, an untagged diagram as drawn. A tagged fence is
    // notation the engine lays out, so what reaches the render is the
    // layout's output, not the source — its own suite pins that.
    const chunks = fenceChunks(screenText(1));
    assert.strictEqual(chunks.length, 3, 'screen 1 is prose, diagram, prose');
    let cursor = 0;
    for (const chunk of chunks) {
      if (chunk.tag) continue;
      const at = out.indexOf(chunk.text, cursor);
      assert.ok(at > cursor, `chunk missing or out of order:\n${chunk.text.slice(0, 60)}…`);
      cursor = at;
    }
  });

  it('the first screen: a first run goes on or stops, the offer before it already answered; from help it goes on or back', () => {
    assert.strictEqual(menuOf(renderSurface(dir, 'walkthrough-screen', { screen: '1', from: 'first-run' })), [
      "=== MENU: walkthrough screen (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ What next?`**',
      '',
      `**\`n/next\`** → ${titleOf(2)}`,
      "**`s/skip`** → Stop here — it's under h/help whenever you want it",
      "**Ask**    → Ask anything about what's on this screen",
      '',
    ].join('\n'));

    assert.strictEqual(menuOf(renderSurface(dir, 'walkthrough-screen', { screen: '1', from: 'help' })), [
      "=== MENU: walkthrough screen (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ What next?`**',
      '',
      `**\`n/next\`** → ${titleOf(2)}`,
      '**`b/back`** → Back to help',
      "**Ask**    → Ask anything about what's on this screen",
      '',
    ].join('\n'));
  });

  it('a middle screen: next, back, and a stop that names where stopping lands', () => {
    assert.strictEqual(menuOf(renderSurface(dir, 'walkthrough-screen', { screen: '2', from: 'first-run' })), [
      "=== MENU: walkthrough screen (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ What next?`**',
      '',
      `**\`n/next\`** → ${titleOf(3)}`,
      '**`b/back`** → Go back a screen',
      "**`s/skip`** → Stop here — it's under h/help whenever you want it",
      "**Ask**    → Ask anything about what's on this screen",
      '',
    ].join('\n'));

    assert.strictEqual(menuOf(renderSurface(dir, 'walkthrough-screen', { screen: '2', from: 'help' })), [
      "=== MENU: walkthrough screen (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ What next?`**',
      '',
      `**\`n/next\`** → ${titleOf(3)}`,
      '**`b/back`** → Go back a screen',
      '**`s/stop`** → Stop here and go back to help',
      "**Ask**    → Ask anything about what's on this screen",
      '',
    ].join('\n'));
  });

  it('the last screen: one way out, and the closing invitation beside the standing one', () => {
    const last = screenFiles().length;
    assert.strictEqual(menuOf(renderSurface(dir, 'walkthrough-screen', { screen: String(last), from: 'first-run' })), [
      "=== MENU: walkthrough screen (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ What next?`**',
      '',
      '**`d/done`**  → Go to the start menu',
      "**Ask**     → Ask anything about what's on this screen",
      "**Tell me** → Tell me what you're likely to start with, and I'll say",
      `${NB(10)}what path it will take`,
      '',
    ].join('\n'));

    assert.match(renderSurface(dir, 'walkthrough-screen', { screen: String(last), from: 'help' }), /\*\*`d\/done`\*\*\s+→ Back to help/);
  });

  it('--menu-only is the menu alone — the return from a question, not the screen again', () => {
    for (const from of ['first-run', 'help']) {
      const full = renderSurface(dir, 'walkthrough-screen', { screen: '2', from });
      const menuOnly = renderSurface(dir, 'walkthrough-screen', { screen: '2', from, 'menu-only': '1' });
      assert.deepStrictEqual(markers(menuOnly), ['MENU: walkthrough screen']);
      assert.strictEqual(menuOnly, menuOf(full), `${from}: the keys come back exactly as they stood`);
    }
  });

  it('refuses a screen outside the walk, a missing or unknown origin', () => {
    const total = screenFiles().length;
    for (const screen of [undefined, '', '0', String(total + 1), 'two', '1.5']) {
      assert.throws(
        () => renderSurface(dir, 'walkthrough-screen', { screen, from: 'help' }),
        new RegExp(`--screen is 1–${total} — got "${screen ?? ''}"`),
        JSON.stringify(screen),
      );
    }
    assert.throws(() => renderSurface(dir, 'walkthrough-screen', { screen: '1' }), /--from must be one of first-run, help, got ""/);
    assert.throws(() => renderSurface(dir, 'walkthrough-screen', { screen: '1', from: 'menu' }), /--from must be one of first-run, help, got "menu"/);
  });

  it('walkthrough-offer: the heading with no position, the offer\'s prose, and a yes/skip menu with a question', () => {
    const out = renderSurface(dir, 'walkthrough-offer', {});
    assert.deepStrictEqual(markers(out), ['TITLE', 'DISPLAY: walkthrough prose', 'MENU: walkthrough offer']);
    assert.ok(out.startsWith([
      "=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===",
      '# **`■ How the workflows work`**',
    ].join('\n')), out.slice(0, 200));
    assert.strictEqual(menuOf(out), [
      "=== MENU: walkthrough offer (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Take the walkthrough?`**',
      '',
      "**`y/yes`**  → Let's do it",
      "**`s/skip`** → Skip for now — it's under h/help whenever you want it",
      '**Ask**    → Ask anything about how the workflows work',
      '',
    ].join('\n'));
  });

  it('walkthrough-offer --menu-only is the menu alone — the return from a question', () => {
    const menuOnly = renderSurface(dir, 'walkthrough-offer', { 'menu-only': '1' });
    assert.deepStrictEqual(markers(menuOnly), ['MENU: walkthrough offer']);
    assert.strictEqual(menuOnly, menuOf(renderSurface(dir, 'walkthrough-offer', {})));
  });

  it('the offer stands outside the walk — no screen of it, and the walk\'s length is the screens alone', () => {
    const total = screenFiles().length;
    assert.ok(!screenFiles().some((f) => f.includes('offer')), 'the offer is not a screen file');
    assert.match(renderSurface(dir, 'walkthrough-screen', { screen: '1', from: 'first-run' }), new RegExp(`· 1 of ${total} · ${titleOf(1)}`));
    assert.match(renderSurface(dir, 'walkthrough-home', {}), new RegExp(`\\(${total} short screens\\)`));
  });

  it('walkthrough-home: the walk, the cards, a question, and the way back', () => {
    assert.strictEqual(renderSurface(dir, 'walkthrough-home', {}), [
      "=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===",
      '# **`■ Help`**',
      '',
      "=== MENU: walkthrough home (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ What would you like to do?`**',
      '',
      `**\`w/walk\`**   → Walk through how the workflows work (${screenFiles().length} short screens)`,
      '**`t/topics`** → Read about one area in more depth',
      '**`b/back`**   → Back to the start menu',
      '**Ask**      → Ask anything about how the workflows work',
      '',
    ].join('\n'));
  });

  it('walkthrough-topics: every card numbered in file order, its slug on the DATA row', () => {
    assert.strictEqual(renderSurface(dir, 'walkthrough-topics', {}), [
      "=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===",
      '# **`■ Help · Topics`**',
      '',
      '=== DATA (reason from this — never display or parse the sections below) ===',
      'CARDS (key  name):',
      ...SLUGS.map((slug, i) => `  ${i + 1}  ${slug}`),
      '',
      "=== MENU: walkthrough topics (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ Which area?`**',
      '',
      ...SLUGS.map((_slug, i) => `**\`${i + 1}\`**      → ${cardTitle(i + 1)}`),
      '**`b/back`** → Back to help',
      '**Ask**    → Ask anything about how the workflows work',
      '',
    ].join('\n'));
  });

  it('a card is its heading, then its content in file order — no gate; --menu-only is the menu every card wears', () => {
    const out = renderSurface(dir, 'walkthrough-topic', { name: SLUGS[0] });
    assert.deepStrictEqual(markers(out), ['TITLE', 'DISPLAY: walkthrough prose', 'DISPLAY: walkthrough diagram', 'DISPLAY: walkthrough prose']);
    assert.ok(out.startsWith([
      "=== TITLE (emit verbatim as markdown (not a code block) — the view's chrome heading) ===",
      `# **\`■ Help · ${cardTitle(1)}\`**`,
      '',
      '=== DISPLAY: walkthrough prose (emit verbatim as markdown (not a code block)) ===',
    ].join('\n')), out.slice(0, 400));

    const body = cardText(1).split('\n').slice(1).join('\n');
    const chunks = body.split(/^```$/m).map((c) => c.replace(/^\n+|\n+$/g, '')).filter(Boolean);
    assert.strictEqual(chunks.length, 3, 'the first card is prose, diagram, prose');
    let cursor = 0;
    for (const chunk of chunks) {
      const at = out.indexOf(chunk, cursor);
      assert.ok(at > cursor, `chunk missing or out of order:\n${chunk.slice(0, 60)}…`);
      cursor = at;
    }

    assert.strictEqual(renderSurface(dir, 'walkthrough-topic', { name: SLUGS[0], 'menu-only': '1' }), [
      "=== MENU: walkthrough card (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**`◆ What next?`**',
      '',
      '**`t/topics`** → Back to the topics',
      '**`b/back`**   → Back to help',
      "**Ask**      → Ask anything about what's on this card",
      '',
    ].join('\n'));
  });

  it('every card renders without a gate, and every card wears the same menu', () => {
    const menus = new Set();
    for (const slug of SLUGS) {
      assert.ok(!markers(renderSurface(dir, 'walkthrough-topic', { name: slug })).some((m) => m.startsWith('MENU')), slug);
      const menuOnly = renderSurface(dir, 'walkthrough-topic', { name: slug, 'menu-only': '1' });
      assert.deepStrictEqual(markers(menuOnly), ['MENU: walkthrough card'], slug);
      menus.add(menuOnly);
    }
    assert.strictEqual(menus.size, 1);
  });

  it('refuses a missing or unknown card, naming the ones there are', () => {
    const named = new RegExp(`--name is one of ${SLUGS.join(', ')} — got`);
    for (const name of [undefined, '', 'the-map', '01-kinds-of-work', 'Kinds-Of-Work']) {
      assert.throws(() => renderSurface(dir, 'walkthrough-topic', { name }), named, JSON.stringify(name));
      // The return from a question is addressed the same way: a menu never
      // comes back for a card that does not exist.
      assert.throws(() => renderSurface(dir, 'walkthrough-topic', { name, 'menu-only': '1' }), named, JSON.stringify(name));
    }
  });
});

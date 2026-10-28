'use strict';

// ---------------------------------------------------------------------------
// The render catalogue's surfaces (domain/render.cjs) for research and the
// discussion map. They go with the discussion phase (29.11), which replaces
// them.
//
// Layer: unit, the domain's renderSurface called in process, every gate
// payload audited against its menu (gate-audit.cjs). World: the project world
// (setupFixture), its manifests and payloads written per test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { DOTS } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');
const { renderSurface, setup, teardown, writeManifest, writePayload } = require('./render-surfaces-world.cjs');

describe('render research-conclude-gate', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      phases: {
        research: { items: { checkout: { status: 'in-progress' } } },
        discussion: { items: { checkout: { status: 'in-progress' } } },
      },
    });
  });
  afterEach(() => teardown(dir));

  it('pins the research address — the gate concludes research and nothing else', () => {
    assert.throws(() => renderSurface(dir, 'research-conclude-gate', { dotpath: 'pay.discussion.checkout' }),
      /render research-conclude-gate: address must be <work_unit>\.research\.<topic>, got phase "discussion"/);
  });

  it('renders yes/keep without the flag — no dead-end row', () => {
    const out = renderSurface(dir, 'research-conclude-gate', { dotpath: 'pay.research.checkout' });
    assert.match(out, /=== MENU: research conclude gate/);
    assert.match(out, /This topic looks ready to conclude\.\n\n\*\*`◆ Conclude it\?`\*\*/);
    assert.match(out, /\*\*`y\/yes`\*\*\s+→ Mark this topic as complete, ready for discussion/);
    assert.match(out, /\*\*`k\/keep`\*\*\s+→ Keep digging, there's more to understand/);
    assert.ok(!out.includes('dead end'), 'no dead-end row without the flag');
  });

  it('adds the dead-end row under --dead-end, consequences stated', () => {
    const out = renderSurface(dir, 'research-conclude-gate', { dotpath: 'pay.research.checkout', 'dead-end': '1' });
    assert.match(out, /\*\*`d\/dead-end`\*\*\s+→ Close it as a dead end — completed/);
    assert.match(out, /no discussion owed/);
    assert.match(out, /reversible from the map/);
  });

  it('the menu stands alone while the register is empty', () => {
    const out = renderSurface(dir, 'research-conclude-gate', { dotpath: 'pay.research.checkout' });
    assert.ok(out.startsWith('=== MENU: research conclude gate'), 'no display precedes the menu');
    assert.ok(!out.includes('DISPLAY: research threads'));
  });

  it('prepends the register above the menu whenever the topic holds a thread — with and without the dead-end row', () => {
    writeManifest(dir, 'pay', {
      phases: {
        research: { items: { checkout: { status: 'in-progress', threads: {
          'cart-persistence': { question: 'Does the cart survive a session?', status: 'learned', origin: 'seed', parent: null },
          'guest-checkout': { question: 'Can a guest check out at all?', status: 'open', origin: 'brief', parent: null },
        } } } },
      },
    });
    for (const args of [{ dotpath: 'pay.research.checkout' }, { dotpath: 'pay.research.checkout', 'dead-end': '1' }]) {
      const out = renderSurface(dir, 'research-conclude-gate', args);
      assert.ok(out.startsWith('=== DISPLAY: research threads (emit verbatim as a text code block (```text fence)) ===\n'), 'the display opens the response — a menu follows, so it carries no continue instruction');
      assert.ok(out.indexOf('DISPLAY: research threads') < out.indexOf('=== MENU: research conclude gate'), 'display above the menu');
      assert.match(out, /Research Threads — Checkout \(2 threads — 1 open · 1 learned\)/);
      assert.match(out, /├─ ○ Can a guest check out at all\?\s+\[brief\]\n {2}└─ ● Does the cart survive a session\?\s+\[seed\]/);
      assert.match(out, /\*\*`y\/yes`\*\*\s+→ Mark this topic as complete, ready for discussion/);
      assert.strictEqual(out.includes('dead end'), 'dead-end' in args, 'the dead-end row still follows the flag alone');
    }
  });
});

describe('render defer-gate', () => {
  let dir;
  const withSubtopics = (subtopics) => writeManifest(dir, 'pay', {
    phases: {
      research: { items: { checkout: { status: 'completed' } } },
      discussion: { items: { checkout: { status: 'in-progress', subtopics } } },
    },
  });
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  it('draws the map, then the consent over what it holds undecided', () => {
    withSubtopics({
      'token-refresh': { status: 'exploring', parent: null },
      'session-storage': { status: 'decided', parent: null },
    });
    assert.strictEqual(renderSurface(dir, 'defer-gate', { dotpath: 'pay.discussion.checkout' }), [
      '=== DISPLAY: discussion map (emit verbatim as a text code block (```text fence)) ===',
      'Discussion Map — Checkout (2 subtopics — 1 decided · 1 exploring)',
      '  ├─ ✓ Session Storage    [decided]',
      '  └─ ◐ Token Refresh      [exploring]',
      "=== MENU: defer gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      'There is still 1 subtopic not yet decided — shown on the map above.',
      '',
      '**`◆ Defer and conclude?`**',
      '',
      '**`y/yes`** → Defer it and move toward concluding',
      '**`n/no`**  → Continue discussing',
      '',
    ].join('\n'));
  });

  it('counts every subtopic still open', () => {
    withSubtopics({ a: { status: 'pending', parent: null }, b: { status: 'converging', parent: null } });
    const out = renderSurface(dir, 'defer-gate', { dotpath: 'pay.discussion.checkout' });
    assert.match(out, /There are still 2 subtopics not yet decided — shown on the map above\./);
    assert.match(out, /Defer them and move toward concluding/);
  });

  it('refuses a settled map, another phase, and a topic with no discussion', () => {
    withSubtopics({ a: { status: 'decided', parent: null }, b: { status: 'deferred', parent: null } });
    assert.throws(() => renderSurface(dir, 'defer-gate', { dotpath: 'pay.discussion.checkout' }),
      /render defer-gate: nothing on "checkout"'s map is undecided — there is nothing to defer/);
    assert.throws(() => renderSurface(dir, 'defer-gate', { dotpath: 'pay.research.checkout' }),
      /render defer-gate: address must be <wu>\.discussion\.<topic> — the map is the discussion's; got phase "research"/);
    assert.throws(() => renderSurface(dir, 'defer-gate', { dotpath: 'pay.discussion.ghost' }),
      /render defer-gate: no discussion item "ghost" — no map to defer from/);
  });
});

describe('render research-threads', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', {
      phases: {
        research: { items: {
          checkout: { status: 'in-progress', threads: {
            'cart-persistence': { question: 'Does the cart survive a session?', status: 'parked', origin: 'seed', parent: null, note: 'needs a device cycle' },
          } },
          shipping: { status: 'in-progress' },
        } },
        discussion: { items: { checkout: { status: 'in-progress' } } },
      },
    });
  });
  afterEach(() => teardown(dir));

  it('renders the register as one DISPLAY section — the whole response, so it carries the continue instruction', () => {
    const out = renderSurface(dir, 'research-threads', { dotpath: 'pay.research.checkout' });
    assert.strictEqual(out, [
      '=== DISPLAY: research threads (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===',
      'Research Threads — Checkout (1 thread)',
      '  └─ ◌ Does the cart survive a session?    [seed]',
      '       ↳ Needs a device cycle',
      '',
    ].join('\n'));
  });

  it('answers empty over an empty register — nothing to emit, no header over nothing', () => {
    assert.strictEqual(renderSurface(dir, 'research-threads', { dotpath: 'pay.research.shipping' }), '');
  });

  it('pins the research address and refuses a topic with no research item', () => {
    assert.throws(() => renderSurface(dir, 'research-threads', { dotpath: 'pay.discussion.checkout' }),
      /render research-threads: address must be <work_unit>\.research\.<topic>, got phase "discussion"/);
    assert.throws(() => renderSurface(dir, 'research-threads', { dotpath: 'pay.research.ghost' }),
      /no research item "ghost" in the manifest/);
  });
});

describe('render send-offer', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { discussion: { items: { checkout: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the clear-home offer byte-exactly — destination named, override in hand', () => {
    const file = writePayload(dir, 'o.json', {
      title: 'Whether the pipeline can expose click windows',
      target: 'behavioural-ranking',
      landing_phase: 'research',
    });
    const out = renderSurface(dir, 'send-offer', { dotpath: 'pay.discussion.checkout', file });
    assert.strictEqual(out, [
      '=== MENU: send offer (emit verbatim as markdown (not a code block), then STOP for the user\'s response) ===',
      '· · · · · · · · · · · ·',
      '**Whether the pipeline can expose click windows** belongs to a different topic, not this one.',
      'It reads as **behavioural-ranking**\'s ground, landing research-side — append a phase to override (e.g. `s discussion`).',
      '',
      '**`◆ Where should it live?`**',
      '',
      '**`s/send`** → Send it to the topic it belongs to; it picks it up later',
      '**`k/keep`** → Keep it here as part of this topic',
      '',
    ].join('\n'));
  });

  it('renders the bare offer when no home is resolved', () => {
    const file = writePayload(dir, 'b.json', { title: 'A stray worry' });
    const out = renderSurface(dir, 'send-offer', { dotpath: 'pay.discussion.checkout', file });
    assert.match(out, /\*\*A stray worry\*\* belongs to a different topic, not this one\.\n\n\*\*/);
    assert.ok(!out.includes('ground, landing'), 'no destination line without a resolved home');
  });

  it('a new target adds the creation line byte-exactly — the two existing lines are untouched', () => {
    const file = writePayload(dir, 'n.json', {
      title: 'Whether the pipeline can expose click windows',
      target: 'behavioural-ranking',
      landing_phase: 'research',
      new_target: true,
    });
    const out = renderSurface(dir, 'send-offer', { dotpath: 'pay.discussion.checkout', file });
    assert.strictEqual(out, [
      "=== MENU: send offer (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**Whether the pipeline can expose click windows** belongs to a different topic, not this one.',
      "It reads as **behavioural-ranking**'s ground, landing research-side — append a phase to override (e.g. `s discussion`).",
      "**behavioural-ranking** isn't on the map yet — sending it creates it.",
      '',
      '**`◆ Where should it live?`**',
      '',
      '**`s/send`** → Send it to the topic it belongs to; it picks it up later',
      '**`k/keep`** → Keep it here as part of this topic',
      '',
    ].join('\n'));
  });

  it('a grown thread reframes both lines byte-exactly — creation, not relocation', () => {
    const file = writePayload(dir, 'g.json', {
      title: 'Whether the pipeline can expose click windows',
      target: 'behavioural-ranking',
      landing_phase: 'research',
      grown: true,
    });
    const out = renderSurface(dir, 'send-offer', { dotpath: 'pay.discussion.checkout', file });
    assert.strictEqual(out, [
      "=== MENU: send offer (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      '**Whether the pipeline can expose click windows** has grown into its own topic here.',
      'Sending it creates **behavioural-ranking** on the map, landing research-side — the material stays in this file and feeds the new topic through the message and the provenance read at its discussion. Append a phase to override (e.g. `s discussion`).',
      '',
      '**`◆ Where should it live?`**',
      '',
      '**`s/send`** → Send it to the topic it belongs to; it picks it up later',
      '**`k/keep`** → Keep it here as part of this topic',
      '',
    ].join('\n'));
    assert.ok(!out.includes('belongs to a different topic'), 'a grown thread never reads as relocation');
    assert.ok(!out.includes("isn't on the map yet"), 'the creation line is folded into the grown wording');
  });

  it('validates loudly — title required, target and phase together, phase constrained, flags need a name', () => {
    const bad = (name, obj) => renderSurface(dir, 'send-offer', { dotpath: 'pay.discussion.checkout', file: writePayload(dir, name, obj) });
    assert.throws(() => bad('c.json', { target: 't', landing_phase: 'research' }), /"title" must be a non-empty string/);
    assert.throws(() => bad('t.json', { title: 'x', target: 't' }), /come together/);
    assert.throws(() => bad('p.json', { title: 'x', landing_phase: 'research' }), /come together/);
    assert.throws(() => bad('l.json', { title: 'x', target: 't', landing_phase: 'planning' }), /"landing_phase" must be "research" or "discussion"/);
    assert.throws(() => bad('g1.json', { title: 'x', grown: true }),
      /"grown" needs "target" and "landing_phase" — a thread that grew into its own topic carries the name it grew into/);
    assert.throws(() => bad('n1.json', { title: 'x', new_target: true }),
      /"new_target" needs "target" — there is no new topic without a name/);
    assert.throws(() => bad('ft.json', { title: 'x', target: 't', landing_phase: 'research', grown: 'yes' }), /"grown" must be true or false/);
    assert.throws(() => bad('fn.json', { title: 'x', target: 't', landing_phase: 'research', new_target: 1 }), /"new_target" must be true or false/);
    assert.throws(() => renderSurface(dir, 'send-offer', { dotpath: 'pay.discussion.checkout' }), /--file <payload\.json> is required/);
  });
});

describe('render send-candidates', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { discussion: { items: { checkout: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('states the title and the research recommendation above the question, the numbered candidates and the new option beneath it, byte-exactly', () => {
    const file = writePayload(dir, 'c.json', {
      title: 'Click-window feasibility',
      landing_phase: 'research',
      candidates: [
        { name: 'behavioural-ranking', lifecycle: 'decided' },
        { name: 'relevance-measurement', lifecycle: 'fresh' },
      ],
    });
    const out = renderSurface(dir, 'send-candidates', { dotpath: 'pay.discussion.checkout', file });
    assert.strictEqual(out, [
      "=== MENU: send candidates (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      "**Click-window feasibility** belongs to a different topic, not this one. It reads as an open question — I'd land it research-side. Reply with an option, appending a phase to override (e.g. `1 discussion`).",
      '',
      '**`◆ Where should it land?`**',
      '',
      '**`1`**     → behavioural-ranking [decided]',
      '**`2`**     → relevance-measurement [fresh]',
      '**`n/new`** → Create a new topic for it',
      '',
    ].join('\n'));
  });

  it('a candidate wears the map\'s own words, never the raw manifest token', () => {
    const file = writePayload(dir, 'l.json', {
      title: 'x', landing_phase: 'research',
      candidates: [
        { name: 'behavioural-ranking', lifecycle: 'handled' },
        { name: 'relevance-measurement', lifecycle: 'ready_for_discussion' },
        { name: 'signal-freshness', lifecycle: 'ready_for_discussion', research_state: 'superseded' },
        { name: 'query-parsing', lifecycle: 'fresh', routing: 'discussion' },
      ],
    });
    const out = renderSurface(dir, 'send-candidates', { dotpath: 'pay.discussion.checkout', file });
    assert.match(out, /→ behavioural-ranking \[dead end\]/);
    assert.match(out, /→ relevance-measurement \[research complete · ready for/);
    assert.match(out, /→ signal-freshness \[research superseded · ready for/);
    assert.match(out, /→ query-parsing \[fresh · routed to discussion\]/);
    assert.ok(!out.includes('[handled]'), 'the raw token never reaches the reader');
    assert.ok(!out.includes('[ready_for_discussion]'), 'the raw token never reaches the reader');
  });

  it('refuses a lifecycle outside the map vocabulary — a mislabel is worse than an echo', () => {
    const file = writePayload(dir, 'u.json', {
      title: 'x', landing_phase: 'research',
      candidates: [{ name: 'a', lifecycle: 'in-progress' }],
    });
    assert.throws(() => renderSurface(dir, 'send-candidates', { dotpath: 'pay.discussion.checkout', file }),
      /candidate 1 carries unknown lifecycle "in-progress" \(expected ready_for_discussion\/researching\/discussing\/decided\/fresh\/handled\/cancelled\/postponed\)/);
  });

  it('the discussion recommendation flips the wording and the override example', () => {
    const file = writePayload(dir, 'd.json', {
      title: 'x', landing_phase: 'discussion',
      candidates: [{ name: 'a', lifecycle: 'fresh' }],
    });
    const out = renderSurface(dir, 'send-candidates', { dotpath: 'pay.discussion.checkout', file });
    assert.match(out, /a decision to make — I'd land it discussion-side/);
    assert.match(out, /e\.g\. `1 research`/);
  });

  it('validates loudly — phase constrained, candidates non-empty and complete', () => {
    const bad = (name, obj) => renderSurface(dir, 'send-candidates', { dotpath: 'pay.discussion.checkout', file: writePayload(dir, name, obj) });
    assert.throws(() => bad('p.json', { title: 'x', landing_phase: 'scoping', candidates: [{ name: 'a', lifecycle: 'f' }] }), /"landing_phase" must be "research" or "discussion"/);
    assert.throws(() => bad('e.json', { title: 'x', landing_phase: 'research', candidates: [] }), /"candidates" must be a non-empty array/);
    assert.throws(() => bad('m.json', { title: 'x', landing_phase: 'research', candidates: [{ name: 'a' }] }), /candidate 1 is missing "lifecycle"/);
  });
});

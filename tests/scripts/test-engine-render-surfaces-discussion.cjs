'use strict';

// ---------------------------------------------------------------------------
// The render catalogue's surfaces (domain/render.cjs) for research and
// discussion. They go with the discussion phase (29.11), which removes their
// callers.
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

const { DOTS } = require('../../skills/workflow-engine/scripts/domain/projections/surfaces.cjs');
const { renderSurface, NB, setup, teardown, writeManifest, writePayload } = require('./render-surfaces-world.cjs');

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

describe('render finding-announce', () => {
  let dir;
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { discussion: { items: { checkout: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  const agents = require('../../skills/workflow-engine/scripts/domain/agent-state.cjs');
  const announce = (id, file) => renderSurface(dir, 'finding-announce', { dotpath: 'pay.discussion.checkout', id, file });
  // A dispatched agent's report lands and the scan promotes it; the ack, when
  // given its findings, reads it.
  const landed = (opts, findings) => {
    const row = agents.dispatchAgent(dir, 'pay', 'discussion', 'checkout', opts);
    fs.writeFileSync(row.file, '# Report\n');
    agents.scanAgents(dir, 'pay', 'discussion', 'checkout');
    if (findings) agents.ackAgent(dir, 'pay', 'discussion', 'checkout', row.id, { findings });
    return row.id;
  };
  const shape = () => writePayload(dir, 'ann.json', { shape: '3 need nothing from you, 5 need a scan, 6 need a call, 2 belong elsewhere' });

  it('renders the opt-in gate — the row\'s kind and finding count, the payload\'s lane split, glyphed question, y/l options', () => {
    const id = landed({ kind: 'review' }, Array.from({ length: 16 }, (_, i) => `F${i + 1}`));
    assert.strictEqual(announce(id, shape()), [
      '=== MENU: finding announce (emit verbatim as markdown (not a code block)) ===',
      DOTS,
      'Background review returned — 16 finding(s): 3 need nothing from you, 5 need a scan, 6 need a call, 2 belong elsewhere.',
      '',
      '**`◆ Work through them now?`**',
      '',
      '**`y/yes`**   → Start on them',
      "**`l/later`** → Keep pulling on the current thread, I'll raise them at",
      `${NB(10)}the next pause`,
      '',
    ].join('\n'));
  });

  it('names a synthesis by its kind', () => {
    const { agents: pair } = agents.dispatchAgent(dir, 'pay', 'discussion', 'checkout', { kind: 'perspective', labels: ['ship-now', 'strategic-timing'] });
    for (const lens of pair) fs.writeFileSync(lens.file, '# Case\n');
    agents.scanAgents(dir, 'pay', 'discussion', 'checkout');
    const id = landed({ kind: 'synthesis', set: '001' }, ['T1', 'T2']);
    assert.match(announce(id, shape()), /^Background synthesis returned — 2 finding\(s\): /m);
  });

  it('refuses a row not yet read, one with findings already surfaced, and an id the store does not hold', () => {
    const unread = landed({ kind: 'review' });
    assert.throws(() => announce(unread, shape()),
      /render finding-announce: "review-001" is pending — the announce follows the first read, before any finding surfaces/);
    agents.ackAgent(dir, 'pay', 'discussion', 'checkout', unread, { findings: ['F1', 'F2'] });
    agents.surfaceFinding(dir, 'pay', 'discussion', 'checkout', unread, 'F1');
    assert.throws(() => announce(unread, shape()),
      /"review-001" is acknowledged with findings already surfaced — the announce follows the first read/);
    assert.throws(() => announce('review-009', shape()), /render finding-announce: no agent "review-009" for discussion\/checkout/);
  });

  it('refuses a missing id, a missing payload, and an empty shape by name', () => {
    const id = landed({ kind: 'review' }, ['F1']);
    assert.throws(() => announce(undefined, shape()), /render finding-announce: --id <agent id> is required/);
    assert.throws(() => announce(id, undefined), /render finding-announce: --file <payload\.json> is required/);
    assert.throws(() => announce(id, writePayload(dir, 'n1.json', {})), /"shape" must be a non-empty string/);
  });
});

describe('render carry-note-gate', () => {
  let dir;
  const payload = { note: ['→ search-cache: the eviction rule this session settled invalidates its TTL note.'], target: 'search-cache', landing_phase: 'discussion' };
  beforeEach(() => {
    dir = setup();
    writeManifest(dir, 'pay', { phases: { research: { items: { portal: { status: 'in-progress' } } } } });
  });
  afterEach(() => teardown(dir));

  it('renders the note, the addressed-to line, and the landing menu', () => {
    const file = writePayload(dir, 'n.json', payload);
    const out = renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.research.portal', file });
    assert.ok(out.includes('=== DISPLAY: carry note'));
    assert.ok(out.includes(payload.note[0]));
    assert.ok(out.includes('*Addressed to: search-cache — lands in its discussion mailbox*'));
    assert.ok(out.includes('=== MENU: carry note gate'));
    assert.ok(out.includes('This note lands in "search-cache"\'s mailbox; if "search-cache" is completed, landing reopens it.'));
    assert.ok(out.includes('**`◆ Land it there?`**'), 'a consent gate carries its glyphed question');
    assert.ok(/\*\*`y\/yes`\*\* +→ Land it there; this document keeps a record of the send/.test(out));
    assert.ok(/\*\*`s\/skip`\*\* +→ Leave it as prose in this document/.test(out));
    assert.ok(/\*\*Comment\*\* +→ Tell me what to change \(target, phase, or content\)/.test(out));
  });

  it('validates the payload and the address', () => {
    assert.throws(() => renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.research.portal' }), /--file <payload\.json> is required/);
    const bad = writePayload(dir, 'bad.json', { ...payload, note: [] });
    assert.throws(() => renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.research.portal', file: bad }), /"note" must be non-empty/);
    const noTarget = writePayload(dir, 'bad2.json', { ...payload, target: ' ' });
    assert.throws(() => renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.research.portal', file: noTarget }), /"target" must be a non-empty string/);
    const badPhase = writePayload(dir, 'bad3.json', { ...payload, landing_phase: 'specification' });
    assert.throws(() => renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.research.portal', file: badPhase }), /"landing_phase" must be "research" or "discussion", got "specification"/);
    writeManifest(dir, 'pay', { phases: { discussion: { items: { portal: { status: 'in-progress' } } } } });
    const file = writePayload(dir, 'n.json', payload);
    assert.throws(() => renderSurface(dir, 'carry-note-gate', { dotpath: 'pay.discussion.portal', file }), /address must be <work_unit>\.research\.<topic>/);
  });
});

describe('render review-findings-gate', () => {
  let dir;
  const store = (phase, row) => writePayload(dir, `.leeway/.cache/pay/${phase}/checkout/state.json`, { agents: { 'review-001': {
    id: 'review-001', kind: 'review', phase, topic: 'checkout', set: 1, announced: false, created: '2026-09-11T10:00:00.000Z', ...row,
  } } });
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

  it('counts the acknowledged row\'s unsurfaced findings and names no pass — byte-exact', () => {
    store('discussion', { status: 'acknowledged', findings: ['F1', 'F2', 'F3'], surfaced: ['F2'] });
    const out = renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' });
    assert.strictEqual(out, [
      "=== MENU: review findings gate (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      DOTS,
      'The review left 2 findings still to walk.',
      '',
      '**`◆ Walk them now?`**',
      '',
      '**`y/yes`**  → Work through them now',
      '**`s/skip`** → Acknowledge and conclude the topic',
      '',
    ].join('\n'));
    assert.doesNotMatch(out, /final review/i);
  });

  it('a lone finding takes the singular', () => {
    store('discussion', { status: 'acknowledged', findings: ['F1'], surfaced: [] });
    assert.match(renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' }),
      /The review left 1 finding still to walk\.\n\n\*\*`◆ Walk them now\?`\*\*/);
  });

  it('a research address is refused whatever its store holds — the gate is the discussion close\'s', () => {
    store('research', { status: 'acknowledged', findings: ['F1'], surfaced: [] });
    assert.throws(() => renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.research.checkout' }),
      /render review-findings-gate: address must be <wu>\.discussion\.<topic> — the discussion close is the flow that runs this gate; got phase "research"/);
  });

  it('refuses every state the calling prose never renders it from', () => {
    assert.throws(() => renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' }),
      /render review-findings-gate: no review has been dispatched on this topic/);
    store('discussion', { status: 'pending', findings: [], surfaced: [] });
    assert.throws(() => renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' }),
      /the latest review row "review-001" is pending — the gate follows an acknowledged report/);
    store('discussion', { status: 'incorporated', findings: ['F1'], surfaced: ['F1'] });
    assert.throws(() => renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' }),
      /"review-001" is incorporated/);
    assert.throws(() => renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.planning.checkout' }),
      /address must be <wu>\.discussion\.<topic> — the discussion close is the flow that runs this gate; got phase "planning"/);
  });

  it('anchors on the latest review row, not an earlier drained one', () => {
    writePayload(dir, '.leeway/.cache/pay/discussion/checkout/state.json', { agents: {
      'review-001': { id: 'review-001', kind: 'review', phase: 'discussion', topic: 'checkout', set: 1, status: 'incorporated', announced: true, findings: ['F1'], surfaced: ['F1'], created: '2026-09-11T09:00:00.000Z' },
      'review-002': { id: 'review-002', kind: 'review', phase: 'discussion', topic: 'checkout', set: 2, status: 'acknowledged', announced: false, findings: ['F1', 'F2'], surfaced: [], created: '2026-09-11T10:00:00.000Z' },
    } });
    assert.match(renderSurface(dir, 'review-findings-gate', { dotpath: 'pay.discussion.checkout' }),
      /The review left 2 findings still to walk\./);
  });
});

describe('render off-topic-offer', () => {
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => teardown(dir));

  const feature = () => writeManifest(dir, 'pay', {
    work_type: 'feature',
    phases: { research: { items: { pay: { status: 'in-progress' } } } },
  });

  it('offers the pivot for a feature, aligned across three rows', () => {
    feature();
    const file = writePayload(dir, 'o.json', { title: 'Rate limiting on the public API' });
    const out = renderSurface(dir, 'off-topic-offer', { dotpath: 'pay.research.pay', file });
    assert.strictEqual(out, [
      "=== MENU: off-topic offer (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      "**Rate limiting on the public API** is beyond this topic's scope.",
      '',
      '**`◆ Where should it go?`**',
      '',
      '**`l/log`**    → Capture it as an idea in the inbox for later',
      '**`p/pivot`**  → Convert this work to an epic so it can hold it as its',
      `${NB(11)}own topic`,
      '**`i/ignore`** → Note it in the research file and move on',
      '',
    ].join('\n'));
  });

  it('drops the pivot for a non-feature and re-aligns the pair', () => {
    writeManifest(dir, 'xc', {
      work_type: 'cross-cutting',
      phases: { research: { items: { xc: { status: 'in-progress' } } } },
    });
    const file = writePayload(dir, 'o.json', { title: 'Audit logging' });
    const out = renderSurface(dir, 'off-topic-offer', { dotpath: 'xc.research.xc', file });
    assert.strictEqual(out, [
      "=== MENU: off-topic offer (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      "**Audit logging** is beyond this topic's scope.",
      '',
      '**`◆ Where should it go?`**',
      '',
      '**`l/log`**    → Capture it as an idea in the inbox for later',
      '**`i/ignore`** → Note it in the research file and move on',
      '',
    ].join('\n'));
  });

  it('refuses a missing payload and an empty title', () => {
    feature();
    assert.throws(() => renderSurface(dir, 'off-topic-offer', { dotpath: 'pay.research.pay' }), /--file <payload\.json> is required/);
    const blank = writePayload(dir, 'b.json', { title: '  ' });
    assert.throws(
      () => renderSurface(dir, 'off-topic-offer', { dotpath: 'pay.research.pay', file: blank }),
      /"title" must be a non-empty string/,
    );
  });

  it('the discussion variant adds the roadmap park and speaks the Summary register', () => {
    writeManifest(dir, 'pay', {
      work_type: 'feature',
      phases: { discussion: { items: { pay: { status: 'in-progress' } } } },
    });
    const file = writePayload(dir, 'o.json', { title: 'Gift cards' });
    const out = renderSurface(dir, 'off-topic-offer', { dotpath: 'pay.discussion.pay', file, variant: 'discussion' });
    assert.strictEqual(out, [
      "=== MENU: off-topic offer (emit verbatim as markdown (not a code block), then STOP for the user's response) ===",
      '· · · · · · · · · · · ·',
      "**Gift cards** is beyond this topic's scope.",
      '',
      '**`◆ Where should it go?`**',
      '',
      '**`l/log`**     → Capture it as an idea in the inbox for later',
      '**`r/roadmap`** → Put it on the product roadmap for a later release',
      '**`p/pivot`**   → Convert this work to an epic so it can hold it as its',
      `${NB(12)}own topic`,
      '**`i/ignore`**  → Note it in the Summary and move on',
      '',
    ].join('\n'));
  });

  it('refuses an unknown variant', () => {
    feature();
    const file = writePayload(dir, 'o.json', { title: 'X' });
    assert.throws(
      () => renderSurface(dir, 'off-topic-offer', { dotpath: 'pay.research.pay', file, variant: 'nope' }),
      /--variant takes "discussion"/,
    );
  });
});

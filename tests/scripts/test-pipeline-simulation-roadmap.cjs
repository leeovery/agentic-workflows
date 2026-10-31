'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation's roadmap scenarios: the inbox onto the roadmap;
// just-in-time birth, harvest, horizons and lifecycle by join; an open
// session's first edit conjuring its log; backlogging from a live
// implementation item; a unit's cancel or absorb re-aiming its joins; an
// epic pulled with an idea and a bug; and quick-fixes pulled alone.
//
// Layer: simulation. World: the project every scenario starts from
// (pipeline-world.cjs), a copy per scenario; each replays the engine calls
// the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const START_GATEWAY = require(path.join(ROOT, 'skills/leeway/scripts/gateway.cjs'));
const LIB = require(path.join(ROOT, 'skills/leeway-engine/scripts/lib.cjs'));
const { stateGit } = require('./engine-harness.cjs');
const {
  Sim, sessionLog, carryOn, arrive, handoffEntry, enterEntry, discussed, bridgeTo, pickRoute, startKeys, walkToLiveImplementation, literal,
} = require('./pipeline-world.cjs');

describe('pipeline simulation: roadmap', () => {
  let sim;
  beforeEach(() => { sim = new Sim(); });
  afterEach(() => { sim.destroy(); });

  it('inbox onto the roadmap: the notes travel with their items, a bug pulled alone is a bugfix, an idea and a bug a feature, a removed item\'s note is declined', () => {
    const inbox = {
      idea: sim.write('.leeway/.inbox/ideas/2026-02-01--saved-views.md', '# Saved Views\n'),
      timeout: sim.write('.leeway/.inbox/bugs/2026-02-02--export-timeout.md', '# Export Timeout\n'),
      chart: sim.write('.leeway/.inbox/bugs/2026-02-03--blank-chart.md', '# Blank Chart\n'),
      typo: sim.write('.leeway/.inbox/quickfixes/2026-02-04--footer-typo.md', '# Footer Typo\n'),
    };
    sim.run(['commit', '--inbox', '-m', 'inbox: capture']);

    // The working set takes any mix — work or the roadmap, never a blocker.
    const set = LIB.detail.workingSetDetail(sim.dir, Object.values(inbox));
    assert.strictEqual(set.set_type, 'none', 'an idea in the set leaves the type to discovery');
    assert.match(LIB.project.workingSetView(set).menu, /`o\/roadmap`/);

    // The roadmap row: the horizon once, one confirm over the very file the
    // move takes — every item and its kind from its note's folder — then one
    // transaction moving each note off the inbox.
    const notes = [inbox.idea, inbox.timeout, inbox.chart, inbox.typo];
    const entries = [
      { name: 'saved-views', horizon: 'next', summary: 'operators save a filtered view', note: inbox.idea },
      { name: 'export-timeout', horizon: 'next', summary: 'large exports time out', note: inbox.timeout },
      { name: 'blank-chart', horizon: 'next', summary: 'the chart renders blank on an empty range', note: inbox.chart },
      { name: 'footer-typo', horizon: 'next', summary: 'the footer misspells the product', note: inbox.typo },
    ];
    const batch = sim.write('.leeway/.cache/inbox-roadmap.json', entries);
    const gate = sim.render(['inbox-roadmap-gate', '--file', batch], { expect: 'content' });
    assert.match(gate, /MENU: inbox roadmap gate[\s\S]*\*\*Export Timeout\*\* \[bug\][\s\S]*The roadmap is created with them\./);
    const added = sim.run(['roadmap', 'add-batch', '--file', batch]);
    assert.deepStrictEqual(added.added.map((a) => a.kind), ['idea', 'bug', 'bug', 'quick-fix']);
    for (const note of notes) {
      assert.strictEqual(fs.existsSync(path.join(sim.dir, note)), false, `${note} left the inbox`);
    }
    let state = sim.run(['roadmap', 'state']);
    assert.deepStrictEqual(state.items.find((i) => i.name === 'export-timeout').sources, ['.roadmap/notes/bugs/2026-02-02--export-timeout.md']);
    assert.strictEqual(state.items.find((i) => i.name === 'export-timeout').origin, 'inbox:2026-02-02--export-timeout');
    assert.match(sim.render(['roadmap-view'], { expect: 'content' }), /Export Timeout\n.*large exports time out\n.*↳ Bug · waiting/);
    // The gate refuses where the move would: the same file again names notes
    // that have left the inbox and names already on the roadmap.
    sim.refuses(['render', 'inbox-roadmap-gate', '--file', batch], /"saved-views" is already on the roadmap/);
    sim.refuses(['roadmap', 'add-batch', '--file', batch], /"saved-views" is already on the roadmap/);

    // An epic grows by topics: a bug is never pulled forward into one.
    sim.run(['workunit', 'create', 'reports', 'epic', '--description', 'Reporting', '--session-log-file', sessionLog(sim, 'reports')]);
    sim.refuses(['roadmap', 'pull-forward', 'blank-chart', '--into', 'reports', '--routing', 'discussion'], /pull-forward takes ideas only; start it with the pull/);

    // A bug pulled alone is a bugfix — its note stays on the roadmap, read as a source.
    sim.run(['workunit', 'create', 'export-timeout', 'bugfix', '--description', 'Large exports time out',
      '--session-log-file', sessionLog(sim, 'export-timeout')]);
    const bugPull = sim.run(['roadmap', 'pull', 'export-timeout', '--into', 'export-timeout']);
    assert.deepStrictEqual(bugPull.remainder, { next: 3 });
    assert.strictEqual(sim.manifest('export-timeout').work_type, 'bugfix');
    assert.ok(fs.existsSync(path.join(sim.dir, '.leeway/.roadmap/notes/bugs/2026-02-02--export-timeout.md')));

    // An idea and a bug pulled together are a feature — the bug rides along.
    sim.run(['workunit', 'create', 'saved-views', 'feature', '--description', 'Saved views, and the blank chart they expose',
      '--session-log-file', sessionLog(sim, 'saved-views')]);
    sim.run(['roadmap', 'pull', 'saved-views', 'blank-chart', '--into', 'saved-views']);
    state = sim.run(['roadmap', 'state']);
    assert.deepStrictEqual(state.items.filter((i) => i.state === 'in-flight').map((i) => [i.name, i.work_unit]),
      [['saved-views', 'saved-views'], ['export-timeout', 'export-timeout'], ['blank-chart', 'saved-views']]);
    sim.refuses(['roadmap', 'remove', 'blank-chart'], /joined to work unit "saved-views"/);

    // Removing a waiting item declines it: its note goes to the inbox archive,
    // restorable from there.
    const removed = sim.run(['roadmap', 'remove', 'footer-typo']);
    const archived = path.join(sim.dir, '.leeway/.inbox/.archived/quickfixes/2026-02-04--footer-typo.md');
    assert.deepStrictEqual(removed.notes_moved, [{ from: path.join(sim.dir, '.leeway/.roadmap/notes/quickfixes/2026-02-04--footer-typo.md'), to: archived }]);
    const restored = sim.run(['inbox', 'restore', archived]);
    assert.ok(fs.existsSync(path.join(sim.dir, inbox.typo)), 'the declined note is back in the inbox');
    assert.match(sim.render(['inbox-restore-receipt', '--path', restored.restored[0]], { expect: 'content' }), /^Restored ".+" to the inbox\.$/m);
  });

  it('roadmap: JIT birth, harvest batch, horizon restructuring, lifecycle by join, pulled-item guards', () => {
    // The genesis conversation: the product's conversation opens before any
    // item or work unit exists, its cadence commit is --roadmap, and imports
    // land in the product's assets. The roadmap is reached from the start menu,
    // whose boot repairs the label and marks the conversation; the skill
    // labels the terminal `roadmap` before its mode dispatch, every mode.
    sim.run(['session', 'repair']);
    arrive(sim, 'roadmap');
    const roadmapDraft = sim.write('.leeway/.cache/roadmap-draft.md', '# Roadmap Session 001\n\nExploration.\n');
    sim.run(['discovery-session', 'open', 'product', '--session-log-file', roadmapDraft]);
    const session = carryOn(sim);
    assert.strictEqual(session.skill, path.join(sim.dir, '.claude/skills/leeway-roadmap/SKILL.md'));
    assert.deepStrictEqual(session.files, [path.join(sim.dir, '.leeway/.product/sessions/session-001.md')],
      'the roadmap carries on from its open session\'s log');
    const bridgeDoc = sim.write('app-idea.md', '# The idea, shaped outside\n');
    assert.deepStrictEqual(sim.run(['asset', 'import', 'product', bridgeDoc]).imports, ['.product/assets/app-idea.md']);
    sim.run(['commit', '--roadmap', '-m', 'roadmap: exploration notes — session-001']);

    // Born lazily: the first park creates the node and its horizon — no
    // genesis ceremony, no prior state.
    sim.run(['roadmap', 'add', 'loyalty', '--horizon', 'v1',
      '--summary', 'repeat-customer rewards', '--origin', 'park:mvp',
      '--source', '.product/sessions/session-001.md']);

    // The harvest's batch form: one transaction, horizons JIT in entry order.
    const items = sim.write('.leeway/.cache/roadmap-items.json', [
      { name: 'ordering', horizon: 'mvp', summary: 'customers order from a menu' },
      { name: 'menu-management', horizon: 'mvp', summary: 'operators maintain the menu' },
      { name: 'white-label', horizon: 'someday', summary: 'resell the platform' },
    ]);
    sim.run(['roadmap', 'add-batch', '--file', items]);
    let state = sim.run(['roadmap', 'state']);
    assert.deepStrictEqual(state.horizons, ['v1', 'mvp', 'someday']);
    assert.strictEqual(state.totals.waiting, 4);

    // The map is loose left of the pull: reorder, re-bucket, split, remove.
    sim.run(['roadmap', 'horizon', 'reorder', 'mvp', 'v1', 'someday']);
    sim.run(['roadmap', 'move', 'white-label', '--horizon', 'v2']);
    sim.run(['roadmap', 'horizon', 'split', 'mvp', '--new', 'mvp-2', '--items', 'menu-management']);
    sim.run(['roadmap', 'horizon', 'merge', 'mvp-2', '--into', 'mvp']);
    sim.refuses(['roadmap', 'horizon', 'remove', 'v2'], /holds 1 item/);
    sim.run(['roadmap', 'remove', 'white-label']);
    sim.run(['roadmap', 'horizon', 'remove', 'v2']);
    // A positional insert lands the horizon where the release order says.
    sim.run(['roadmap', 'horizon', 'add', 'next', '--position', '2']);
    state = sim.run(['roadmap', 'state']);
    assert.deepStrictEqual(state.horizons, ['mvp', 'next', 'v1', 'someday']);
    sim.run(['roadmap', 'horizon', 'remove', 'next']);

    // The harvest closes the session: marker cleared, nothing indexed, one
    // commit covering the session's dirt.
    const closed = sim.run(['discovery-session', 'close', 'product', '-m', 'roadmap: session 001 — horizons sorted']);
    assert.strictEqual(closed.session, '001');
    state = sim.run(['roadmap', 'state']);
    assert.strictEqual(state.active_session, null);
    assert.strictEqual(state.next_session_number, 2);

    // The pull is the commitment point: the join flips the derived state,
    // and the remainder is named at the moment of choice.
    const log = sessionLog(sim, 'mvp');
    sim.run(['workunit', 'create', 'mvp', 'epic', '--description', 'The MVP slice', '--session-log-file', log]);
    const pulled = sim.run(['roadmap', 'pull', 'ordering', '--into', 'mvp']);
    assert.deepStrictEqual(pulled.remainder, { mvp: 1 }, 'the remainder names what stays waiting');
    state = sim.run(['roadmap', 'state']);
    assert.strictEqual(state.items.find((i) => i.name === 'ordering').state, 'in-flight');

    // Right of the pull the work unit is authoritative: re-bucket and remove
    // refuse; cosmetic edits and renames stay open, the join carried across.
    sim.refuses(['roadmap', 'move', 'ordering', '--horizon', 'v1'], /delivery decision/);
    sim.refuses(['roadmap', 'remove', 'ordering'], /joined to work unit "mvp"/);
    sim.run(['roadmap', 'edit', 'ordering', '--summary', 'guests order from a menu']);
    sim.run(['roadmap', 'rename', 'ordering', 'guest-ordering']);
    // Horizon restructuring is presentational for joins — rename cascades.
    sim.run(['roadmap', 'horizon', 'rename', 'mvp', 'launch']);
    state = sim.run(['roadmap', 'state']);
    const joined = state.items.find((i) => i.name === 'guest-ordering');
    assert.strictEqual(joined.horizon, 'launch');
    assert.strictEqual(joined.state, 'in-flight');

    // The epic harvest binds the item to the topic it crystallised as.
    sim.run(['discovery-map', 'add', 'mvp', 'guest-ordering', 'discussion', '--summary', 'guests order', '--source', 'roadmap']);
    sim.run(['roadmap', 'bind', 'guest-ordering', '--topic', 'guest-ordering']);

    // Pull-forward: a waiting item joins the in-flight epic as a map topic
    // in one composed transaction.
    sim.run(['roadmap', 'pull-forward', 'menu-management', '--into', 'mvp', '--routing', 'discussion']);
    assert.strictEqual(sim.manifest('mvp').phases.discovery.items['menu-management'].source, 'roadmap');

    enterEntry(sim, 'mvp', 'discussion', 'guest-ordering');

    // The cancel-revert hop: cancelling the joined topic hands the item back
    // to waiting; reactivation does NOT re-join (the revert is one-way — a
    // re-pull re-binds deliberately).
    enterEntry(sim, 'mvp', 'discussion', 'menu-management');
    const cancelled = sim.run(['topic', 'cancel', 'mvp', 'discovery', 'menu-management']);
    assert.deepStrictEqual(cancelled.roadmap_reverted, ['menu-management']);
    state = sim.run(['roadmap', 'state']);
    assert.strictEqual(state.items.find((i) => i.name === 'menu-management').state, 'waiting');
    sim.run(['topic', 'reactivate', 'mvp', 'discovery', 'menu-management']);
    state = sim.run(['roadmap', 'state']);
    assert.strictEqual(state.items.find((i) => i.name === 'menu-management').state, 'waiting',
      'reactivation never silently re-joins');

    // The discovery session's show-dismissed door over a map nothing has
    // left: the display alone, no menu to stop at.
    const noneDismissed = sim.render(['dismissed-topics', 'mvp'], { expect: 'content' });
    assert.match(noneDismissed, /Dismissed Topics\n\n {2}\(none\)/);
    assert.doesNotMatch(noneDismissed, /MENU/);

    // The un-pull for a never-started topic: removing the fresh map topic
    // hands the item back — and the dismissed name then needs the user's
    // confirmed re-add to pull forward again.
    sim.run(['roadmap', 'add', 'reporting', '--horizon', 'v1', '--summary', 'owners see the numbers']);
    sim.run(['roadmap', 'pull-forward', 'reporting', '--into', 'mvp', '--routing', 'discussion']);
    const removed = sim.run(['discovery-map', 'remove', 'mvp', 'reporting']);
    assert.deepStrictEqual(removed.roadmap_reverted, ['reporting']);
    state = sim.run(['roadmap', 'state']);
    assert.strictEqual(state.items.find((i) => i.name === 'reporting').state, 'waiting');
    sim.refuses(['roadmap', 'pull-forward', 'reporting', '--into', 'mvp', '--routing', 'discussion'], /previously dismissed/);
    sim.run(['roadmap', 'pull-forward', 'reporting', '--into', 'mvp', '--routing', 'discussion', '--force-dismissed']);
    sim.run(['discovery-map', 'remove', 'mvp', 'reporting']);
    // The same door reads the list the re-add is refused against, and offers
    // the re-add over it.
    assert.match(sim.render(['dismissed-topics', 'mvp'], { expect: 'content' }),
      /• reporting[\s\S]*MENU: dismissed topics/);

    // The render surfaces hold over the live state: the map view and the
    // add-to-joined-horizon gate, whose DATA names the unit its delivery row
    // pulls into — the `--into` a `d/delivery` answer takes.
    assert.match(sim.render(['roadmap-view'], { expect: 'content' }), /DISPLAY: roadmap/);
    const addGate = sim.render(['roadmap-add-gate', '--horizon', 'launch'], { expect: 'content' });
    assert.match(addGate, /^=== DATA [^\n]*\nwork_units: mvp\n\n=== MENU: roadmap add gate[\s\S]*\*\*`d\/delivery`\*\*/);
    // An Ask sets the gate aside; once the person is ready it renders again.
    assert.strictEqual(sim.render(['roadmap-add-gate', '--horizon', 'launch'], { expect: 'content' }), addGate);
    // The static gate menus render like every menu — engine-served.
    assert.match(sim.render(['roadmap-harvest-gate'], { expect: 'content' }), /MENU: roadmap harvest gate/);
    assert.match(sim.render(['roadmap-parks-gate'], { expect: 'content' }), /MENU: roadmap parks gate/);
    assert.match(sim.render(['roadmap-shape-gate'], { expect: 'content' }), /MENU: roadmap shape gate/);
    assert.match(sim.render(['shape-gate'], { expect: 'content' }), /MENU: shape gate/);
    assert.match(sim.render(['synthesis-gate'], { expect: 'content' }), /MENU: synthesis gate/);
    // A failed query's error output rides the failure gate's payload,
    // verbatim, written to the roadmap session's own cache.
    const queryFailure = sim.write('.leeway/.cache/roadmap/query-failure.json',
      { error: 'Error: loadStore: corrupted store file at .leeway/.knowledge/store.bin\n' });
    const failureGate = sim.render(['query-failure-gate', '--file', queryFailure], { expect: 'content' });
    assert.match(failureGate, /⚑ Knowledge query failed\n {2}Error: loadStore: corrupted store file/);
    assert.match(failureGate, /MENU: query failure gate/);

    // The home's `b/back`: the start menu records that the session is working
    // nowhere first, then is re-rendered over the state the roadmap was
    // entered from.
    assert.strictEqual(sim.run(['session', 'repair']).repaired, false, 'the sim has no tmux label to put back');
    assert.strictEqual(carryOn(sim).position, null, 'the start menu is no position');
    assert.match(START_GATEWAY.format(START_GATEWAY.discover(sim.dir)), /has_any_work: true/);

    // Shipping the unit flips the derived state to shipped — nothing stored.
    sim.run(['workunit', 'complete', 'mvp', '-m', 'workflow(mvp): pipeline complete']);
    state = sim.run(['roadmap', 'state']);
    assert.strictEqual(state.items.find((i) => i.name === 'guest-ordering').state, 'shipped');
    assert.deepStrictEqual(state.totals, { items: 4, waiting: 3, in_flight: 0, shipped: 1, orphaned: 0 });
    // The view renders the shipped row from the join, after the completion.
    assert.match(sim.render(['roadmap-view'], { expect: 'content' }), /✓ Guest Ordering/);

    // The reserved identities hold: no work unit may take the layer's name,
    // or the product's.
    const draft = sim.write('.leeway/.cache/roadmap-probe/discovery/session-001.md', '# Discovery Session 001\n');
    sim.refuses(['workunit', 'create', 'roadmap', 'epic', '--description', 'x', '--session-log-file', draft], /is reserved/);
    sim.refuses(['workunit', 'create', 'product', 'epic', '--description', 'x', '--session-log-file', draft], /is reserved/);
  });

  it('roadmap: an open session\'s first Edits op conjures the log before it runs — the source names the allocated log', () => {
    sim.run(['session', 'repair']);
    arrive(sim, 'roadmap');
    const genesis = sim.write('.leeway/.cache/roadmap/session-draft.md', '# Roadmap Session {NNN}\n\nExploration.\n');
    sim.run(['discovery-session', 'open', 'product', '--session-log-file', genesis]);
    sim.run(['commit', '--roadmap', '-m', 'roadmap: exploration notes — session-001']);
    sim.run(['discovery-session', 'close', 'product', '-m', 'roadmap: close session 001']);
    // The start menu's roadmap row hands off to the home, which labels itself.
    assert.strictEqual(pickRoute(sim, startKeys(sim), 'open_roadmap').args, 'open');
    arrive(sim, 'roadmap');

    // A roadmap session over no open log: nothing is predicted. The
    // user places an item themselves — a direct add, an op recorded under
    // Edits — so the log opens first and the open's response numbers it.
    assert.strictEqual(sim.run(['roadmap', 'state']).active_session, null);
    // The wrong order is impossible: an add naming the log before its open refuses.
    sim.refuses(['roadmap', 'add', 'gift-cards', '--horizon', 'mvp', '--summary', 'restaurants sell gift cards',
      '--source', '.product/sessions/session-002.md'], new RegExp(`source "\\.product\\/sessions\\/session-002\\.md" does not exist under ${literal(path.join(sim.dir, '.leeway'))}\\/ — a source must exist before an item records it`));
    const draft = sim.write('.leeway/.cache/roadmap/session-draft.md', '# Roadmap Session {NNN}\n\n## Edits\n\n(none)\n');
    const opened = sim.run(['discovery-session', 'open', 'product', '--session-log-file', draft]);
    assert.strictEqual(opened.session, '002');
    const source = `.product/sessions/session-${opened.session}.md`;
    sim.refuses(['roadmap', 'add', 'gift-cards', '--horizon', 'mvp', '--summary', 'restaurants sell gift cards',
      '--source', `.leeway/${source}`], /drop the leading "\.leeway\/"/);
    sim.run(['roadmap', 'add', 'gift-cards', '--horizon', 'mvp', '--summary', 'restaurants sell gift cards', '--source', source]);
    const item = sim.run(['roadmap', 'state']).items.find((i) => i.name === 'gift-cards');
    assert.strictEqual(item.origin, 'harvest', 'a direct add takes the engine\'s default origin');
    assert.ok(fs.existsSync(path.join(sim.dir, '.leeway', item.sources[0])), 'the source resolves under .leeway/ to the open log');

    // The Edits entry lands in the installed log; the cadence commit takes
    // the log the self-committing add left behind.
    fs.appendFileSync(path.join(sim.dir, '.leeway', source), '- Added: gift-cards → mvp — placed by the user\n');
    sim.run(['commit', '--roadmap', '-m', `roadmap: add gift-cards — session-${opened.session}`]);
    assert.strictEqual(stateGit(sim.dir, ['status', '--porcelain', '--', '.product', 'manifest.json']), '',
      'the log and the marker are committed');
  });

  it('backlogging: the ambiguity gate, the horizon pick, and the park confirm from a live implementation item', () => {
    const wu = 'orders';
    sim.run(['workunit', 'create', wu, 'feature', '--description', 'Orders', '--session-log-file', sessionLog(sim, wu)]);
    discussed(sim, wu, wu);
    walkToLiveImplementation(sim, wu, wu);
    // The park's source is the record the session is writing, relative to
    // `.leeway/` — backlogging's table — and on disk, as the specification
    // phase left it.
    const spec = `${wu}/specification/${wu}/specification.md`;
    sim.write(`.leeway/${spec}`, '# Specification: Orders\n');

    // The words left the home open, so the door stops at the gate rather
    // than deciding for the person.
    const payload = sim.write(`.leeway/.cache/${wu}/implementation/${wu}/backlog.json`,
      { title: "a CSV export of the day's orders" });
    assert.match(sim.render(['backlog-gate', `${wu}.implementation.${wu}`, '--file', payload], { expect: 'content' }),
      /Setting \*\*a CSV export of the day's orders\*\* aside\.[\s\S]*`r\/roadmap`[\s\S]*`i\/inbox`/);

    // Roadmap chosen, but nothing to pick from: a name is content, not a
    // choice, so the pick refuses and the park confirms the first item.
    sim.refuses(['render', 'horizon-pick'], /no roadmap on the project manifest/);
    assert.match(sim.render(['park-gate', '--name', 'csv-export', '--horizon', 'next',
      '--summary', "operators export a day's orders as CSV", '--source', spec], { expect: 'content' }),
    /under "next", waiting until it is pulled into work\. The roadmap is created with it\./);

    // The verb behind the gate: the map, its horizon and the item are born
    // in one transaction, and the park's provenance rides the row.
    sim.run(['roadmap', 'add', 'csv-export', '--horizon', 'next',
      '--summary', "operators export a day's orders as CSV", '--origin', `park:${wu}`, '--source', spec]);
    const parked = sim.run(['roadmap', 'state']).items.find((i) => i.name === 'csv-export');
    assert.strictEqual(parked.origin, `park:${wu}`);
    assert.deepStrictEqual(parked.sources, [spec]);

    // With a map, the pick renders — one horizon, what waits in it, the new
    // row — and the same name refuses at the confirm rather than after it.
    assert.match(sim.render(['horizon-pick'], { expect: 'content' }), /\*\*`1`\*\*\s+→ next — \*1 waiting\*/);
    sim.refuses(['render', 'park-gate', '--name', 'csv-export', '--horizon', 'next', '--summary', 's'],
      /"csv-export" is already on the roadmap — edit it, or pick a different name/);

    // A second park under a horizon the map does not hold flags it new,
    // while the horizon it does hold renders plain.
    assert.match(sim.render(['park-gate', '--name', 'bulk-refunds', '--horizon', 'someday',
      '--summary', 'operators refund a batch of orders'], { expect: 'content' }),
    /under "someday" \(new\), waiting until it is pulled into work\./);
    const second = sim.render(['park-gate', '--name', 'bulk-refunds', '--horizon', 'next',
      '--summary', 'operators refund a batch of orders'], { expect: 'content' });
    assert.ok(!second.includes('(new)'), 'a horizon the map holds is not flagged new');
    assert.ok(!second.includes('The roadmap is created with it.'), 'the map exists by now');

    // The pick numbers the horizons in the order `roadmap state` answers
    // them — the order a numbered answer resolves against.
    sim.run(['roadmap', 'add', 'bulk-refunds', '--horizon', 'someday',
      '--summary', 'operators refund a batch of orders', '--origin', `park:${wu}`]);
    const { horizons } = sim.run(['roadmap', 'state']);
    assert.deepStrictEqual(horizons, ['next', 'someday']);
    const pick = sim.render(['horizon-pick'], { expect: 'content' });
    horizons.forEach((h, i) => assert.match(pick, new RegExp(`\\*\\*\`${i + 1}\`\\*\\*\\s+→ ${h} — \\*1 waiting\\*`)));
  });

  it('roadmap: work-unit cancel reverts every join into the unit', () => {
    sim.run(['roadmap', 'add', 'ordering', '--horizon', 'mvp', '--summary', 's']);
    sim.run(['roadmap', 'add', 'menus', '--horizon', 'mvp', '--summary', 's']);
    const log = sessionLog(sim, 'mvp');
    sim.run(['workunit', 'create', 'mvp', 'epic', '--description', 'MVP', '--session-log-file', log]);
    sim.run(['roadmap', 'pull', 'ordering', 'menus', '--into', 'mvp']);
    const res = sim.run(['workunit', 'cancel', 'mvp']);
    assert.deepStrictEqual([...res.roadmap_reverted].sort(), ['menus', 'ordering']);
    const state = sim.run(['roadmap', 'state']);
    assert.deepStrictEqual(state.totals, { items: 2, waiting: 2, in_flight: 0, shipped: 0, orphaned: 0 });
    // Pulling into the cancelled unit refuses; reactivation reopens the road.
    sim.refuses(['roadmap', 'pull', 'ordering', '--into', 'mvp'], /active work only/);
    sim.run(['workunit', 'reactivate', 'mvp']);
    sim.run(['roadmap', 'pull', 'ordering', '--into', 'mvp']);
  });

  it('roadmap: absorb re-aims a feature\'s joins at the epic — its idea at the topic, its bug riding with the unit — never an orphan, and its sources follow the files', () => {
    sim.run(['roadmap', 'add', 'loyalty', '--horizon', 'v1', '--summary', 'repeat-customer rewards']);
    sim.run(['roadmap', 'add', 'points-lost', '--horizon', 'v1', '--summary', 'points vanish on a refund', '--kind', 'bug']);
    const flog = sessionLog(sim, 'loyalty-feat');
    sim.run(['workunit', 'create', 'loyalty-feat', 'feature', '--description', 'Loyalty, and the points a refund loses', '--session-log-file', flog]);
    sim.run(['roadmap', 'pull', 'loyalty', 'points-lost', '--into', 'loyalty-feat']);
    enterEntry(sim, 'loyalty-feat', 'discussion', 'loyalty-feat');
    sim.write('.leeway/loyalty-feat/topics/loyalty-feat/log.md', '# Loyalty discussion\n');
    // The feature discussion parks a tangent for later, its source the
    // topic's log.
    sim.run(['roadmap', 'add', 'gift-cards', '--horizon', 'v2', '--summary', 'shoppers gift store credit',
      '--origin', 'park:loyalty-feat', '--source', 'loyalty-feat/topics/loyalty-feat/log.md']);
    const elog = sessionLog(sim, 'platform');
    sim.run(['workunit', 'create', 'platform', 'epic', '--description', 'Platform', '--session-log-file', elog]);

    const res = sim.run(['workunit', 'absorb', 'loyalty-feat', '--into', 'platform', '--topic', 'loyalty']);
    assert.deepStrictEqual(res.roadmap_reaimed, ['loyalty', 'points-lost']);
    assert.deepStrictEqual(res.roadmap_sources_rewritten, [
      { item: 'gift-cards', from: 'loyalty-feat/topics/loyalty-feat/log.md', to: 'platform/topics/loyalty/log.md' },
    ]);
    let state = sim.run(['roadmap', 'state']);
    assert.deepStrictEqual(state.items.find((i) => i.name === 'gift-cards').sources, ['platform/topics/loyalty/log.md']);
    const row = state.items.find((i) => i.name === 'loyalty');
    assert.strictEqual(row.state, 'in-flight');
    assert.strictEqual(row.work_unit, 'platform');
    assert.strictEqual(row.topic, 'loyalty');
    // Only an idea becomes a topic: the bug rode with the feature, and rides
    // with the epic now — joined to the unit, never to the topic.
    const bug = state.items.find((i) => i.name === 'points-lost');
    assert.deepStrictEqual([bug.state, bug.work_unit, bug.topic], ['in-flight', 'platform', undefined]);
    assert.strictEqual(sim.manifest('platform').phases.discovery.items['points-lost'], undefined, 'no topic of its own');

    // The re-aimed join keeps the cancel-revert hop live at its new home;
    // the topic's cancel leaves the riding bug with the epic.
    const cancelled = sim.run(['topic', 'cancel', 'platform', 'discovery', 'loyalty']);
    assert.deepStrictEqual(cancelled.roadmap_reverted, ['loyalty']);
    state = sim.run(['roadmap', 'state']);
    assert.strictEqual(state.items.find((i) => i.name === 'loyalty').state, 'waiting');
    assert.strictEqual(state.items.find((i) => i.name === 'points-lost').state, 'in-flight');
    sim.refuses(['roadmap', 'remove', 'points-lost'],
      /it rides with "platform", and it goes back to waiting only if that work is cancelled/);
  });

  it('roadmap: an epic pulled with an idea and a bug — the harvest binds the idea alone, and the bug rides with the epic until the whole of it is cancelled', () => {
    sim.run(['session', 'repair']);
    arrive(sim, 'roadmap');
    sim.run(['roadmap', 'add', 'guest-checkout', '--horizon', 'launch', '--summary', 'guests buy without an account']);
    sim.run(['roadmap', 'add', 'cart-drops-items', '--horizon', 'launch', '--summary', 'the cart drops items on a refresh', '--kind', 'bug']);

    // The pull: the shape confirmed, the unit created over its backfilled
    // first session, the items joined, the roadmap shown with the joins.
    sim.render(['roadmap-shape-gate'], { expect: 'content' });
    const backfill = sim.write('.leeway/.cache/launch/discovery/session-001.md', '# Discovery Session 001\n\n## Conclusion\n\n(none)\n');
    sim.run(['workunit', 'create', 'launch', 'epic', '--description', 'Guest checkout, and the cart bug it exposes', '--session-log-file', backfill]);
    assert.deepStrictEqual(sim.run(['roadmap', 'pull', 'guest-checkout', 'cart-drops-items', '--into', 'launch']).remainder, { launch: 0 });
    assert.match(sim.render(['roadmap-view'], { expect: 'content' }), /Cart Drops Items\n.*↳ Bug · in flight: launch/);

    // The epic's discovery carries the conversation on, and its harvest
    // lands the idea as a topic — the bug is material for it, never a topic.
    assert.strictEqual(sim.run(['session', 'label', 'launch', 'discovery', 'launch']).labelled, false);
    sim.run(['discovery-map', 'add-batch', 'launch', '--file', sim.write('.leeway/.cache/launch/discovery/topics.json', [
      { name: 'guest-checkout', routing: 'discussion', summary: 'Guests buy without an account' },
    ])]);
    // The binds: every idea joined to the unit with no topic. The bug, joined
    // the same way, is never one of them — and the verb refuses it.
    const unbound = sim.run(['roadmap', 'state']).items.filter((i) => i.work_unit === 'launch' && i.topic === undefined);
    assert.deepStrictEqual(unbound.map((i) => [i.name, i.kind]), [['guest-checkout', 'idea'], ['cart-drops-items', 'bug']]);
    sim.run(['roadmap', 'bind', 'guest-checkout', '--topic', 'guest-checkout']);
    sim.refuses(['roadmap', 'bind', 'cart-drops-items', '--topic', 'guest-checkout'], /only an idea binds to a topic/);
    sim.run(['discovery-session', 'close', 'launch', '-m', 'discovery(launch): shape the map']);

    let state = sim.run(['roadmap', 'state']);
    const row = (/** @type {string} */ name) => state.items.find((i) => i.name === name);
    assert.deepStrictEqual([row('guest-checkout').work_unit, row('guest-checkout').topic], ['launch', 'guest-checkout']);
    assert.deepStrictEqual([row('cart-drops-items').work_unit, row('cart-drops-items').topic], ['launch', undefined]);

    // The bug stays with the epic: the topic's cancel returns the idea alone,
    // and only the whole epic's cancel returns the bug.
    assert.deepStrictEqual(sim.run(['topic', 'cancel', 'launch', 'discovery', 'guest-checkout']).roadmap_reverted, ['guest-checkout']);
    sim.refuses(['roadmap', 'remove', 'cart-drops-items'],
      /it rides with "launch", and it goes back to waiting only if that work is cancelled/);
    assert.deepStrictEqual(sim.run(['workunit', 'cancel', 'launch']).roadmap_reverted, ['cart-drops-items']);
    state = sim.run(['roadmap', 'state']);
    assert.strictEqual(row('cart-drops-items').state, 'waiting');
  });

  it('roadmap: quick-fixes pulled alone start a quick-fix, which the bridge hands to its scoping', () => {
    sim.run(['roadmap', 'add', 'footer-typo', '--horizon', 'polish', '--summary', 'the footer misspells the product', '--kind', 'quick-fix']);
    sim.run(['roadmap', 'add', 'stale-copyright', '--horizon', 'polish', '--summary', 'the copyright year is stale', '--kind', 'quick-fix']);
    sim.run(['roadmap', 'add', 'dark-mode', '--horizon', 'polish', '--summary', 'a dark theme']);

    sim.render(['roadmap-shape-gate'], { expect: 'content' });
    const backfill = sim.write('.leeway/.cache/footer-fixes/discovery/session-001.md', '# Discovery Session 001\n\n## Conclusion\n\n(none)\n');
    sim.run(['workunit', 'create', 'footer-fixes', 'quick-fix', '--description', 'The footer\'s copy fixes', '--session-log-file', backfill]);
    assert.deepStrictEqual(sim.run(['roadmap', 'pull', 'footer-typo', 'stale-copyright', '--into', 'footer-fixes']).remainder,
      { polish: 1 }, 'the idea stays waiting');
    sim.render(['roadmap-view'], { expect: 'content' });
    assert.strictEqual(sim.manifest('footer-fixes').work_type, 'quick-fix');

    // The bridge, invoked in place, labels the unit and hands it to scoping.
    arrive(sim, 'footer-fixes');
    bridgeTo(sim, 'footer-fixes', 'scoping');
    handoffEntry(sim, 'footer-fixes', 'scoping', 'footer-fixes');
    const state = sim.run(['roadmap', 'state']);
    assert.deepStrictEqual(state.items.filter((i) => i.state === 'in-flight').map((i) => [i.name, i.kind, i.work_unit]),
      [['footer-typo', 'quick-fix', 'footer-fixes'], ['stale-copyright', 'quick-fix', 'footer-fixes']]);
    sim.refuses(['roadmap', 'remove', 'footer-typo'],
      /it is part of "footer-fixes", and it goes back to waiting only if that work is cancelled/);
  });
});

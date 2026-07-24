'use strict';

//
// Tests for migration 052: phantom-triage-stubs (.cjs)
//
// Flip of in-progress research/discussion items that are really triage stubs
// (parked `## Triage` entries, no session work) to the `triaged` status.
// Discussion keys on the manifest signal — no non-empty subtopics — so
// improvised stub bodies flip too; research keeps the strict template-bare
// artefact test. Covers both phase happy paths, the improvised-body split,
// every defensive skip, idempotency, and artefact byte-preservation.
//

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/workflow-migrate/scripts/migrations/052-phantom-triage-stubs.cjs');

const TRIAGE_ENTRY = [
  '## Triage',
  '',
  '### Parked concern',
  '*From: other-topic · discussion · 2026-07-24*',
  '',
  'Everything discussed about this concern.',
  '',
].join('\n');

const RESEARCH_STUB = [
  '# Research: Topic X',
  '',
  'Brief description of what this research covers and what prompted it.',
  '',
  '## Starting Point',
  '',
  'What we know so far:',
  '- {Initial thoughts or context from the user}',
  '- {Any constraints or existing knowledge}',
  "- {Where we're starting: technical, market, business, etc.}",
  '',
  '---',
  '',
  '{Content follows - freeform, managed by the skill}',
  '',
  TRIAGE_ENTRY,
].join('\n');

const DISCUSSION_STUB = [
  '# Discussion: Topic Y',
  '',
  '## Context',
  '',
  "What this is about, why we're discussing it, the problem or opportunity, current state.",
  '',
  '### References',
  '',
  '- [Related spec or doc](link)',
  '- [Prior discussion](link)',
  '',
  '---',
  '',
  TRIAGE_ENTRY,
].join('\n');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-052-'));
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  return dir;
}
function teardown(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}
function runMigration(dir) {
  let updates = 0;
  let skips = 0;
  MIGRATION.run({
    projectDir: dir,
    reportUpdate: () => { updates += 1; },
    reportSkip: () => { skips += 1; },
  });
  return { updates, skips };
}
function writeManifest(dir, wu, obj) {
  fs.mkdirSync(path.join(dir, '.workflows', wu), { recursive: true });
  fs.writeFileSync(path.join(dir, '.workflows', wu, 'manifest.json'), JSON.stringify(obj, null, 2) + '\n');
}
function writeArtefact(dir, wu, phase, topic, text) {
  fs.mkdirSync(path.join(dir, '.workflows', wu, phase), { recursive: true });
  fs.writeFileSync(path.join(dir, '.workflows', wu, phase, `${topic}.md`), text);
}
function readManifest(dir, wu) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', wu, 'manifest.json'), 'utf8'));
}
function epicManifest(phase, topic, item) {
  return {
    name: 'epic-a',
    work_type: 'epic',
    phases: { [phase]: { items: { [topic]: item } } },
  };
}

describe('migration 052: phantom triage stubs', () => {
  it('research happy path — template-bare stub with a parked entry flips to triaged', () => {
    const dir = setup();
    writeManifest(dir, 'epic-a', epicManifest('research', 'topic-x', { status: 'in-progress' }));
    writeArtefact(dir, 'epic-a', 'research', 'topic-x', RESEARCH_STUB);

    const { updates, skips } = runMigration(dir);

    assert.strictEqual(readManifest(dir, 'epic-a').phases.research.items['topic-x'].status, 'triaged');
    assert.strictEqual(updates, 1);
    assert.strictEqual(skips, 0);
    teardown(dir);
  });

  it('discussion happy path — flips to triaged', () => {
    const dir = setup();
    writeManifest(dir, 'epic-a', epicManifest('discussion', 'topic-y', { status: 'in-progress' }));
    writeArtefact(dir, 'epic-a', 'discussion', 'topic-y', DISCUSSION_STUB);

    const { updates } = runMigration(dir);

    assert.strictEqual(readManifest(dir, 'epic-a').phases.discussion.items['topic-y'].status, 'triaged');
    assert.strictEqual(updates, 1);
    teardown(dir);
  });

  it('discussion with an improvised stub body flips — the manifest signal decides, not the artefact shape', () => {
    const dir = setup();
    // Real-world stub shape: substituted Context prose, a stub marker, brief
    // links, trimmed sections — nothing template-bare about it.
    const improvised = [
      '# Discussion: Management Window',
      '',
      '## Context',
      '',
      'The main app window as an organiser: browse / search / filter / sort, Recently Deleted.',
      '',
      '*(Stub — this topic has not had its own discussion session yet. The concerns under `## Triage` were rerouted from other topics.)*',
      '',
      '### References',
      '',
      '- [Discovery brief — management-window](../discovery/briefs/management-window.md)',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Current State',
      '',
      '- Not yet started — carries rerouted concerns in Triage.',
      '',
      TRIAGE_ENTRY,
    ].join('\n');
    writeManifest(dir, 'epic-a', epicManifest('discussion', 'management-window', { status: 'in-progress' }));
    writeArtefact(dir, 'epic-a', 'discussion', 'management-window', improvised);

    const { updates } = runMigration(dir);

    assert.strictEqual(readManifest(dir, 'epic-a').phases.discussion.items['management-window'].status, 'triaged');
    assert.strictEqual(updates, 1);
    const after = fs.readFileSync(path.join(dir, '.workflows', 'epic-a', 'discussion', 'management-window.md'), 'utf8');
    assert.strictEqual(after, improvised, 'artefact untouched');
    teardown(dir);
  });

  it('research with an improvised stub body skips — no manifest signal, strict test holds', () => {
    const dir = setup();
    const improvised = RESEARCH_STUB.replace(
      'Brief description of what this research covers and what prompted it.',
      '*(Stub — rerouted concerns parked; research has not started.)*',
    );
    writeManifest(dir, 'epic-a', epicManifest('research', 'topic-x', { status: 'in-progress' }));
    writeArtefact(dir, 'epic-a', 'research', 'topic-x', improvised);

    const { updates } = runMigration(dir);

    assert.strictEqual(readManifest(dir, 'epic-a').phases.research.items['topic-x'].status, 'in-progress');
    assert.strictEqual(updates, 0);
    teardown(dir);
  });

  it('artefact byte-identical — only the manifest is written', () => {
    const dir = setup();
    writeManifest(dir, 'epic-a', epicManifest('research', 'topic-x', { status: 'in-progress' }));
    writeArtefact(dir, 'epic-a', 'research', 'topic-x', RESEARCH_STUB);

    runMigration(dir);

    const after = fs.readFileSync(path.join(dir, '.workflows', 'epic-a', 'research', 'topic-x.md'), 'utf8');
    assert.strictEqual(after, RESEARCH_STUB);
    teardown(dir);
  });

  it('skip — real session content above Triage disqualifies', () => {
    const dir = setup();
    const worked = RESEARCH_STUB.replace(
      '{Content follows - freeform, managed by the skill}',
      'We found the vendor API caps at 100 req/s, which rules out polling.',
    );
    writeManifest(dir, 'epic-a', epicManifest('research', 'topic-x', { status: 'in-progress' }));
    writeArtefact(dir, 'epic-a', 'research', 'topic-x', worked);

    const { updates, skips } = runMigration(dir);

    assert.strictEqual(readManifest(dir, 'epic-a').phases.research.items['topic-x'].status, 'in-progress');
    assert.strictEqual(updates, 0);
    assert.strictEqual(skips, 1);
    teardown(dir);
  });

  it('skip — Triage section still (none)', () => {
    const dir = setup();
    const bare = RESEARCH_STUB.slice(0, RESEARCH_STUB.indexOf('## Triage')) + '## Triage\n\n(none)\n';
    writeManifest(dir, 'epic-a', epicManifest('research', 'topic-x', { status: 'in-progress' }));
    writeArtefact(dir, 'epic-a', 'research', 'topic-x', bare);

    const { updates } = runMigration(dir);

    assert.strictEqual(readManifest(dir, 'epic-a').phases.research.items['topic-x'].status, 'in-progress');
    assert.strictEqual(updates, 0);
    teardown(dir);
  });

  it('skip — no ## Triage heading at all', () => {
    const dir = setup();
    const noTriage = RESEARCH_STUB.slice(0, RESEARCH_STUB.indexOf('## Triage'));
    writeManifest(dir, 'epic-a', epicManifest('research', 'topic-x', { status: 'in-progress' }));
    writeArtefact(dir, 'epic-a', 'research', 'topic-x', noTriage);

    const { updates } = runMigration(dir);

    assert.strictEqual(readManifest(dir, 'epic-a').phases.research.items['topic-x'].status, 'in-progress');
    assert.strictEqual(updates, 0);
    teardown(dir);
  });

  it('skip — discussion item with non-empty subtopics has been worked', () => {
    const dir = setup();
    writeManifest(dir, 'epic-a', epicManifest('discussion', 'topic-y', {
      status: 'in-progress',
      subtopics: { 'first-concern': { state: 'pending' } },
    }));
    writeArtefact(dir, 'epic-a', 'discussion', 'topic-y', DISCUSSION_STUB);

    const { updates } = runMigration(dir);

    assert.strictEqual(readManifest(dir, 'epic-a').phases.discussion.items['topic-y'].status, 'in-progress');
    assert.strictEqual(updates, 0);
    teardown(dir);
  });

  it('skip — completed item is never touched', () => {
    const dir = setup();
    writeManifest(dir, 'epic-a', epicManifest('research', 'topic-x', { status: 'completed' }));
    writeArtefact(dir, 'epic-a', 'research', 'topic-x', RESEARCH_STUB);

    const { updates } = runMigration(dir);

    assert.strictEqual(readManifest(dir, 'epic-a').phases.research.items['topic-x'].status, 'completed');
    assert.strictEqual(updates, 0);
    teardown(dir);
  });

  it('skip — artefact file missing', () => {
    const dir = setup();
    writeManifest(dir, 'epic-a', epicManifest('research', 'topic-x', { status: 'in-progress' }));

    const { updates } = runMigration(dir);

    assert.strictEqual(readManifest(dir, 'epic-a').phases.research.items['topic-x'].status, 'in-progress');
    assert.strictEqual(updates, 0);
    teardown(dir);
  });

  it('skip — non-epic work unit is out of scope', () => {
    const dir = setup();
    const m = epicManifest('discussion', 'feat-z', { status: 'in-progress' });
    m.work_type = 'feature';
    writeManifest(dir, 'feat-z', m);
    writeArtefact(dir, 'feat-z', 'discussion', 'feat-z', DISCUSSION_STUB);

    const { updates } = runMigration(dir);

    assert.strictEqual(readManifest(dir, 'feat-z').phases.discussion.items['feat-z'].status, 'in-progress');
    assert.strictEqual(updates, 0);
    teardown(dir);
  });

  it('defensive — an unparseable manifest is left untouched', () => {
    const dir = setup();
    fs.mkdirSync(path.join(dir, '.workflows', 'broken'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.workflows', 'broken', 'manifest.json'), 'not json{');

    runMigration(dir);

    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'broken', 'manifest.json'), 'utf8'), 'not json{');
    teardown(dir);
  });

  it('idempotency — a second run changes nothing and reports skip', () => {
    const dir = setup();
    writeManifest(dir, 'epic-a', epicManifest('research', 'topic-x', { status: 'in-progress' }));
    writeArtefact(dir, 'epic-a', 'research', 'topic-x', RESEARCH_STUB);

    runMigration(dir);
    const first = fs.readFileSync(path.join(dir, '.workflows', 'epic-a', 'manifest.json'), 'utf8');
    const second = runMigration(dir);

    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows', 'epic-a', 'manifest.json'), 'utf8'), first);
    assert.strictEqual(second.updates, 0);
    assert.strictEqual(second.skips, 1);
    teardown(dir);
  });

  it('content preservation — sibling items and fields survive the flip', () => {
    const dir = setup();
    writeManifest(dir, 'epic-a', {
      name: 'epic-a',
      work_type: 'epic',
      phases: {
        discovery: { items: { 'topic-x': { routing: 'research', source: 'discovery,reroute:origin' } } },
        research: { items: { 'topic-x': { status: 'in-progress' }, 'topic-w': { status: 'completed' } } },
      },
    });
    writeArtefact(dir, 'epic-a', 'research', 'topic-x', RESEARCH_STUB);

    runMigration(dir);
    const m = readManifest(dir, 'epic-a');

    assert.strictEqual(m.phases.research.items['topic-x'].status, 'triaged');
    assert.strictEqual(m.phases.research.items['topic-w'].status, 'completed', 'sibling untouched');
    assert.strictEqual(m.phases.discovery.items['topic-x'].source, 'discovery,reroute:origin', 'map item untouched');
    teardown(dir);
  });
});

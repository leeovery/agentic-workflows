'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the person's review page (11.11) — the page itself, and the
// writes that bring its store up to the spec. The page is one fixed page in
// every project (11.11.13), `content/spec-page/page.html`, the page this
// release's own spec was reviewed on (11.11.2): it carries the spec as data
// and draws it in the browser, then follows its store's collections. Every
// line, its flags and Claude's tick come from the page's model
// (spec-page-model.cjs), never from a second reading of `spec.md`.
//
// The store is the private artifact's, which the engine cannot read: Claude
// publishes the page, sends the batches of writes the engine plans, and
// hands the engine what the store holds as ArtifactData's list saves it with
// `out_dir`, `<dir>/<collection>/<doc>.json`. Its collections, beside the
// page's own `marks` (spec-review.cjs):
// - `spec`: `index`, `{title, h1, intro, sections: [{num, title, count}],
//   total, c, f}`, `c` the last change the spec holds; and `s<N>` an area,
//   `{items, f}`, its items as the model draws them, with each line the spec
//   no longer holds kept where it stood, `{k: 'removed', id, num, kind,
//   parts, src?, c}`;
// - `history`: `s<N>`, `{lines: {<id>: [{h, at, parts, c}]}}`, each line's
//   earlier wordings, oldest first, `c` the change that replaced each;
// - `changes`: `c<n>`, `{n, at, why, from, added, reworded, removed}`;
// - `assess`: `s<N>`, `{lines: {<id>: {v, why, h, at}}}`, Claude's tick on
//   each line (11.11.15), `h` the wording it holds for;
// - `live`: `status`, `{x, at}`, what Claude is doing now.
// A document's `f` is the first 12 hex digits of the SHA-256 of its JSON
// without `f`, keys sorted.
//
// `spec page <unit>` writes the page and the store's first writes to
// `.cache/{unit}/specification/page/`. `spec published <unit> <url>` records
// that Claude published it, which opens the page (spec-review.cjs: its
// numbers held, its marks read back, from then on), and answers the file
// Claude reads its marks back to; a page built and never published is not
// open. `spec push <unit> --store <dir> [--reason <line>]
// [--from <ids>]`, after a re-land, plans the writes that bring the change
// to the open page without republishing (11.11.17), into the page's next
// `push-<k>/`, and answers the page's address: one numbered change, its
// reason, the lines whose conversations led to it, and the lines it added,
// reworded and removed; each reworded line's last wording appended to its
// history; each removed line kept where it stood, an area that loses every
// line kept with its removed lines alone, counted 0 in the index; and
// Claude's ticks redrawn. It writes only the documents that differ from the
// store's, the history first, then the change, the areas, and the index
// last, so a push that stops part way is planned again from the same listing
// and finishes the change it started: until the index lands, the store's
// newest change is numbered past the index's `c`. A write to a document the
// store already holds takes the version its listing gave, `if_version`: the
// answer names each.
//
// Each refuses, its refusal opening `spec page: `, `spec published: ` or
// `spec push: `, writing nothing: a unit the project lacks; one with no
// spec; a concluded spec, whose review ended when the build began. `spec
// page` and `spec push` refuse a spec its grammar cannot read, and a
// document over the store's limit. `spec published` and `spec push` refuse a
// unit with no page built, and `spec published` an address that is no URL.
// `spec push` refuses too: a page not published; a store listing that is not
// a folder; a line in `--from` neither the spec nor the store holds; and a
// push changing lines with no reason given.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { messageOf } = require('../kernel/call.cjs');
const { isObject, writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { fingerprint } = require('../kernel/fingerprint.cjs');
const { specPage } = require('./spec-page-model.cjs');
const { pageDir, pageRefusal, publishedFile, publishedPage, readBackFile } = require('./spec-review.cjs');

const PAGE_USAGE = 'spec page <work-unit>';
const PUBLISHED_USAGE = 'spec published <work-unit> <url>';
const PUSH_USAGE = 'spec push <work-unit> --store <dir> [--reason <line>] [--from <ids>]';

const TEMPLATE = path.join(__dirname, '..', '..', 'content', 'spec-page', 'page.html');

/** The store's collections the engine writes; the person's page writes `marks`. */
const COLLECTIONS = /** @type {const} */ (['spec', 'history', 'changes', 'assess', 'live']);

/** Only the person and their editors write the store's collections; the page declares nothing that brings another Claude in (11.11.5). */
const CAPABILITIES = Object.freeze({ db: { rules: COLLECTIONS.map((collection) => ({ path: collection, read: 'view', write: 'admin' })) } });

/** The store takes a document of at most 256 KiB serialized; the margin covers its own framing. */
const DOC_LIMIT = 240 * 1024;
const BATCH_WRITES = 40;
const BATCH_BYTES = 900 * 1024;

const KINDS = /** @type {const} */ (['added', 'reworded', 'removed']);

/** @typedef {import('./spec-page-model.cjs').SpecPage} SpecPage */
/** @typedef {import('./spec-page-model.cjs').Item} Item */
/** A line of an area. @typedef {Extract<Item, {k: 'line'}>} LineItem */
/** @typedef {(typeof COLLECTIONS)[number]} Collection */
/** A line the spec no longer holds, kept where it stood. @typedef {{k: 'removed', id: string, num: string, kind: string, parts: [string, string][], src?: string, c: number}} Removed */
/** An item of an area as the store holds it. @typedef {Item | Removed} Stored */
/** An area's document. @typedef {{items: Stored[], f: string}} AreaDoc */
/** An earlier wording of a line. @typedef {{h: string, at: string, parts: [string, string][], c: number}} Previous */
/** A history document. @typedef {{lines: Record<string, Previous[]>}} HistoryDoc */
/** A change. @typedef {{n: number, at: string, why: string, from: string[], added: string[], reworded: string[], removed: string[]}} Change */
/** Claude's tick on a line, as the store holds it. @typedef {{v: 'soft'|'open', why: string, h: string, at: string}} Assessment */
/** What the store holds, by collection, each document by id. @typedef {Record<Collection, Record<string, any>>} Listing */
/** A planned write. @typedef {{collection: Collection, doc: string, body: Record<string, unknown>}} Write */
/** The batches written: their files, in the order they go, and the documents already in the store. @typedef {{batches: string[], existing: string[]}} Planned */

/** Now, to the second, as the store's times read. */
const now = () => new Date().toISOString().replace(/\.[0-9]{3}Z$/, 'Z');

/** A value's JSON, its keys sorted at every depth. @param {unknown} value @returns {string} */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) {
    const object = /** @type {Record<string, unknown>} */ (value);
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** The document with its fingerprint `f`, taken over everything else in it. @template {Record<string, unknown>} T @param {T} doc @returns {T & {f: string}} */
function withF(doc) {
  const { f: _f, ...rest } = doc;
  return /** @type {T & {f: string}} */ ({ ...rest, f: fingerprint(canonical(rest)) });
}

/** A document's size as the store counts it: its JSON, every character past ASCII escaped. @param {unknown} doc */
function docSize(doc) {
  const text = JSON.stringify(doc);
  let size = 0;
  for (let i = 0; i < text.length; i++) size += text.charCodeAt(i) < 0x7f ? 1 : 6;
  return size;
}

/** Whether two documents hold the same. @param {unknown} a @param {unknown} b */
const same = (a, b) => canonical(a) === canonical(b);

/**
 * The `spec` collection a page draws: its index, without the last change it
 * holds, and an area's document by `s<N>`.
 * @param {SpecPage} page @returns {{index: Record<string, unknown> & {f: string}, areas: Record<string, AreaDoc>}}
 */
function specDocs(page) {
  const index = withF({
    title: page.h1,
    h1: page.h1,
    intro: page.intro,
    sections: page.sections.map(({ num, title, items }) => ({ num, title, count: items.filter(({ k }) => k === 'line').length })),
    total: page.lines.length,
  });
  return { index, areas: Object.fromEntries(page.sections.map(({ num, items }) => [`s${num}`, withF({ items: /** @type {Stored[]} */ (items) })])) };
}

/**
 * The `assess` collection a page's ticks draw, by area: each tick the time
 * the store's own assessment of it was made, where it holds the same.
 * @param {SpecPage} page @param {Record<string, any>} held the store's `assess` @param {string} at
 * @returns {Record<string, {lines: Record<string, Assessment>}>}
 */
function assessDocs(page, held, at) {
  /** @type {Record<string, {lines: Record<string, Assessment>}>} */
  const docs = {};
  for (const { id, section, h } of page.lines) {
    const tick = page.ticks.get(id);
    if (tick === undefined) continue;
    const doc = `s${section}`;
    const before = held[doc]?.lines?.[id];
    const kept = isObject(before) && before.v === tick.v && before.why === tick.why && before.h === h;
    (docs[doc] ??= { lines: {} }).lines[id] = { v: tick.v, why: tick.why, h, at: kept ? before.at : at };
  }
  return docs;
}

/** An item's key among its area's items. @param {Stored} item */
const keyOf = (item) => `${item.k}:${'id' in item ? item.id : item.t}`;

/** Whether an item is a line. @param {Stored} item @returns {item is LineItem} */
const isLine = (item) => item.k === 'line';

/** Whether an item is a line the spec no longer holds. @param {Stored} item @returns {item is Removed} */
const isRemoved = (item) => item.k === 'removed';

/** Whether an item is a line or a removed line. @param {Stored} item @returns {item is LineItem | Removed} */
const isNumbered = (item) => isLine(item) || isRemoved(item);

/**
 * The new items, with each removed item of `keep` after whatever preceded it
 * in the old items.
 * @param {Stored[]} old @param {Stored[]} items @param {Map<string, Removed>} keep
 */
function placed(old, items, keep) {
  const merged = [...items];
  const keys = merged.map(keyOf);
  let cursor = -1;
  for (const item of old) {
    const kept = isNumbered(item) ? keep.get(item.id) : undefined;
    if (kept !== undefined) {
      cursor += 1;
      merged.splice(cursor, 0, kept);
      keys.splice(cursor, 0, keyOf(kept));
      continue;
    }
    const key = keyOf(item);
    const after = keys.indexOf(key, cursor + 1);
    if (after !== -1) cursor = after;
    else if (keys.includes(key)) cursor = keys.indexOf(key);
  }
  return merged;
}

/** What stays of a line change `c` removed, where it stood. @param {LineItem} line @param {number} c @returns {Removed} */
function removedItem({ id, num, kind, parts, src }, c) {
  return { k: 'removed', id, num, kind, parts, ...(src ? { src } : {}), c };
}

/** The wording a removed line held, as a line's fingerprint takes it. @param {[string, string][]} parts */
const wordingOf = (parts) => parts.map(([kind, text]) => (kind === 'text' ? text.split(/\s+/).filter(Boolean).join(' ') : text)).join('\n');

/**
 * One change, from the store's areas `prev` (null for a store not yet seeded)
 * to the page's: the areas to store, the history with each wording the
 * change replaced, and the change, or null where no line changed. A line
 * whose id comes back takes its removed item's place, the wording removed
 * joining its history with the change that removed it, at that change's
 * time.
 * @param {Record<string, AreaDoc>|null} prev @param {Record<string, AreaDoc>} areas @param {Record<string, HistoryDoc>} history
 * @param {{n: number, at: string, why: string, from: string[], when: (c: number) => string}} change
 * @returns {{merged: Record<string, AreaDoc>, history: Record<string, HistoryDoc>, change: Change|null}}
 */
function step(prev, areas, history, { n, at, why, from, when }) {
  /** @type {Record<string, HistoryDoc>} */
  const kept = Object.fromEntries(Object.entries(history).map(([doc, { lines }]) => [doc, { lines: Object.fromEntries(Object.entries(lines).map(([id, was]) => [id, [...was]])) }]));
  const oldItems = Object.values(prev ?? {}).flatMap(({ items }) => items);
  const oldLines = new Map(oldItems.filter(isLine).map((item) => [item.id, item]));
  const oldRemoved = new Map(oldItems.filter(isRemoved).map((item) => [item.id, item]));
  const newIds = new Set(Object.values(areas).flatMap(({ items }) => items).filter(isLine).map(({ id }) => id));
  /** @type {Record<(typeof KINDS)[number], string[]>} */
  const changed = { added: [], reworded: [], removed: [] };
  const previous = (/** @type {string} */ doc, /** @type {string} */ id, /** @type {Previous} */ was) => {
    const lines = (kept[doc] ??= { lines: {} }).lines;
    const before = lines[id] ?? [];
    lines[id] = before.at(-1)?.h === was.h ? before : [...before, was];
  };
  /** @type {Record<string, AreaDoc>} */
  const merged = {};
  const docs = [...new Set([...Object.keys(areas), ...Object.keys(prev ?? {})])].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  for (const doc of docs) {
    const old = prev?.[doc]?.items ?? [];
    const keep = new Map(old.filter(isRemoved).filter(({ id }) => !newIds.has(id)).map((item) => [item.id, item]));
    for (const item of old) {
      if (!isLine(item) || newIds.has(item.id)) continue;
      changed.removed.push(item.id);
      keep.set(item.id, removedItem(item, n));
    }
    if (!(doc in areas)) {
      if (keep.size > 0) merged[doc] = withF({ items: placed(old, [], keep) });
      continue;
    }
    for (const item of areas[doc].items) {
      if (!isLine(item) || prev === null) continue;
      const was = oldLines.get(item.id);
      if (was === undefined) {
        changed.added.push(item.id);
        const gone = oldRemoved.get(item.id);
        if (gone !== undefined) previous(doc, item.id, { h: fingerprint(wordingOf(gone.parts)), at: when(gone.c), parts: gone.parts, c: gone.c });
      } else if (was.h !== item.h) {
        changed.reworded.push(item.id);
        previous(doc, item.id, { h: was.h, at, parts: was.parts, c: n });
      }
    }
    merged[doc] = withF({ items: placed(old, areas[doc].items, keep) });
  }
  const any = KINDS.some((kind) => changed[kind].length > 0);
  return { merged, history: kept, change: any ? { n, at, why, from, ...changed } : null };
}

/** The documents a collection's listing holds, by id. @param {string|null} root @param {Collection} collection */
function listed(root, collection) {
  const dir = root === null ? '' : path.join(root, collection);
  if (dir === '' || !fs.existsSync(dir)) return {};
  return Object.fromEntries(fs.readdirSync(dir).filter((file) => file.endsWith('.json')).map((file) => [file.slice(0, -5), JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))]));
}

/** What a store listing holds; nothing for a store not yet published. @param {string|null} root @returns {Listing} */
const listingOf = (root) => /** @type {Listing} */ (Object.fromEntries(COLLECTIONS.map((collection) => [collection, listed(root, collection)])));

/** A line's id as given, a number or an id. @param {string} given */
const asId = (given) => given.trim().replaceAll('.', '-');

/**
 * The writes that bring the store up to the page, recording what changed as
 * one change: the history first, then the change, the areas, the index last,
 * then Claude's ticks; each only where the store holds otherwise.
 * @param {SpecPage} page @param {Listing} store @param {{at: string, why: string, from: string[]}} given
 * @returns {{writes: Write[], change: Change|null, resumed: boolean}}
 */
function planned(page, store, { at, why, from }) {
  const { index, areas } = specDocs(page);
  const seeded = 'index' in store.spec;
  const prev = seeded ? Object.fromEntries(Object.entries(store.spec).filter(([doc]) => doc !== 'index')) : null;
  const changes = new Map(Object.values(seeded ? store.changes : {}).map((change) => [change.n, /** @type {Change} */ (change)]));
  const last = Math.max(0, ...changes.keys());
  const pending = seeded && last > (store.spec.index.c ?? 0) ? changes.get(last) : undefined;
  const known = new Set([...Object.values(areas), ...Object.values(prev ?? {})].flatMap(({ items }) => items).filter(isNumbered).map(({ id }) => id));
  const unknown = from.filter((id) => !known.has(id));
  if (unknown.length > 0) throw new Error(`--from names lines the spec does not have: ${unknown.join(', ')}`);
  const stepped = step(prev, areas, seeded ? store.history : {}, {
    n: pending?.n ?? last + 1, at, why, from, when: (c) => changes.get(c)?.at ?? at,
  });
  let { change } = stepped;
  if (pending !== undefined) {
    const more = change;
    change = /** @type {Change} */ ({ ...pending, ...Object.fromEntries(KINDS.map((kind) => [kind, [...pending[kind], ...(more?.[kind] ?? []).filter((id) => !pending[kind].includes(id))]])) });
  } else if (change !== null && why === '') {
    const counts = KINDS.filter((kind) => change?.[kind].length).map((kind) => `${change?.[kind].length} ${kind}`).join(', ');
    throw new Error(`this push changes lines (${counts}): say why with --reason "<one line>"`);
  }
  if (change !== null) changes.set(change.n, change);
  const lastC = change?.n ?? (seeded ? store.spec.index.c ?? 0 : 0);
  const titled = new Map((store.spec.index?.sections ?? []).map((/** @type {{num: number, title: string}} */ { num, title }) => [num, title]));
  const emptied = Object.keys(stepped.merged).filter((doc) => !(doc in areas)).map((doc) => ({ num: Number(doc.slice(1)), title: titled.get(Number(doc.slice(1))) ?? '', count: 0 }));
  const sections = [.../** @type {{num: number, title: string, count: number}[]} */ (index.sections), ...emptied].sort((a, b) => a.num - b.num);
  const storedIndex = withF({ ...index, sections, c: lastC });
  const write = (/** @type {Collection} */ collection, /** @type {string} */ doc, /** @type {Record<string, unknown>} */ body) => ({ collection, doc, body });
  const ticks = assessDocs(page, store.assess, at);
  return {
    writes: [
      ...Object.keys(stepped.history).sort().filter((doc) => !same(stepped.history[doc], store.history[doc])).map((doc) => write('history', doc, stepped.history[doc])),
      ...[...changes].sort(([a], [b]) => a - b).filter(([n, body]) => !same(body, store.changes[`c${n}`])).map(([n, body]) => write('changes', `c${n}`, body)),
      ...Object.entries(stepped.merged).filter(([doc, body]) => store.spec[doc]?.f !== body.f).map(([doc, body]) => write('spec', doc, body)),
      ...(store.spec.index?.f === storedIndex.f ? [] : [write('spec', 'index', storedIndex)]),
      ...Object.entries(ticks).filter(([doc, body]) => !same(body, store.assess[doc])).map(([doc, body]) => write('assess', doc, body)),
    ],
    change,
    resumed: pending !== undefined,
  };
}

/** Refuse a write over the store's limit, planning nothing. @param {Write[]} writes */
function checkSizes(writes) {
  const over = writes.filter(({ body }) => docSize(body) > DOC_LIMIT).map(({ collection, doc, body }) => `${collection}/${doc} (${docSize(body).toLocaleString('en')} bytes)`);
  if (over.length > 0) throw new Error(`documents over the store's limit of ${DOC_LIMIT.toLocaleString('en')} bytes, nothing planned: ${over.join(', ')} — split the section`);
}

/**
 * Each document under `<out>/<collection>/`, and batch files of at most 40
 * writes and 900 KiB, in the writes' order.
 * @param {string} out @param {Write[]} writes @param {Listing} store @returns {Planned}
 */
function writeBatches(out, writes, store) {
  /** @type {{op: 'set', collection: string, doc_id: string, file_path: string}[][]} */
  const batches = [[]];
  let size = 0;
  for (const { collection, doc, body } of writes) {
    const file = path.join(out, collection, `${doc}.json`);
    const text = JSON.stringify(body);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    const bytes = Buffer.byteLength(text);
    const batch = /** @type {typeof batches[number]} */ (batches.at(-1));
    if (batch.length === BATCH_WRITES || (batch.length > 0 && size + bytes > BATCH_BYTES)) {
      batches.push([]);
      size = 0;
    }
    /** @type {typeof batches[number]} */ (batches.at(-1)).push({ op: 'set', collection, doc_id: doc, file_path: file });
    size += bytes;
  }
  const files = batches.map((batch, k) => {
    const file = path.join(out, `batch-${k + 1}.json`);
    fs.writeFileSync(file, JSON.stringify(batch, null, 1));
    return file;
  });
  return { batches: files, existing: writes.filter(({ collection, doc }) => doc in store[collection]).map(({ collection, doc }) => `${collection}/${doc}`) };
}

/** The unit's spec as its page draws it, after every check. @param {string} cwd @param {string} unit */
function pageFor(cwd, unit) {
  const refused = pageRefusal(cwd, unit);
  if (refused !== null) throw new Error(refused);
  return specPage(cwd, unit);
}

/** The page's HTML: the template, its title and its data filled in. @param {string} title @param {Record<string, unknown>} data */
function pageHtml(title, data) {
  const escaped = title.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[c] ?? c));
  const blob = JSON.stringify(data).replaceAll('<', '\\u003c');
  return fs.readFileSync(TEMPLATE, 'utf8').replaceAll('%%TITLE%%', () => escaped).replaceAll('%%DATA%%', () => blob);
}

/**
 * Write the unit's review page and the store's first writes, answering what
 * Claude publishes: the page, its title, its icon and capabilities, and the
 * batches to send once it is published, in order.
 * @param {string} cwd @param {string} unit
 */
function buildPage(cwd, unit) {
  try {
    const page = pageFor(cwd, unit);
    const at = now();
    const { writes } = planned(page, listingOf(null), { at, why: '', from: [] });
    const seed = [...writes, { collection: /** @type {Collection} */ ('live'), doc: 'status', body: { x: '', at } }];
    checkSizes(seed);
    const dir = pageDir(cwd, unit);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const { index, areas } = specDocs(page);
    const file = path.join(dir, 'page.html');
    fs.writeFileSync(file, pageHtml(page.h1, { index, ...areas }));
    const { batches } = writeBatches(path.join(dir, 'seed'), seed, listingOf(null));
    return { unit, page: file, title: page.h1, icon: 'checklist', capabilities: CAPABILITIES, lines: page.lines.length, batches };
  } catch (err) {
    throw new Error(`spec page: ${messageOf(err)}`);
  }
}

/**
 * Record that Claude published the unit's page, which opens it: its address
 * and when, beside the page and outside it. Answers them, with the file
 * Claude reads the page's marks back to.
 * @param {string} cwd @param {string} unit @param {string} url
 */
function recordPublished(cwd, unit, url) {
  try {
    const refused = pageRefusal(cwd, unit);
    if (refused !== null) throw new Error(refused);
    if (!fs.existsSync(pageDir(cwd, unit))) throw new Error(`${unit} has no review page built — build it with spec page ${unit}`);
    if (!/^https?:\/\/\S+$/.test(url)) throw new Error(`${url} is no page's address — give the artifact's URL`);
    const published = { url, at: now() };
    writeJsonAtomic(publishedFile(cwd, unit), published);
    return { unit, ...published, read_back: readBackFile(cwd, unit) };
  } catch (err) {
    throw new Error(`spec published: ${messageOf(err)}`);
  }
}

/** The page's next push folder. @param {string} dir */
function nextPush(dir) {
  const taken = fs.readdirSync(dir).map((name) => /^push-([0-9]+)$/.exec(name)).filter((m) => m !== null).map((m) => Number(/** @type {RegExpExecArray} */ (m)[1]));
  return path.join(dir, `push-${Math.max(0, ...taken) + 1}`);
}

/**
 * Plan the writes that bring a re-landed spec to the unit's open page,
 * recording what changed as one change.
 * @param {string} cwd @param {string} unit
 * @param {{store: string, reason?: string, from?: string}} given the store's listing, absolute or from cwd
 */
function pushPage(cwd, unit, { store, reason = '', from = '' }) {
  try {
    const page = pageFor(cwd, unit);
    const dir = pageDir(cwd, unit);
    if (!fs.existsSync(dir)) throw new Error(`${unit} has no review page built — build it with spec page ${unit}`);
    const published = publishedPage(cwd, unit);
    if (published === null) throw new Error(`${unit}'s review page is not published — publish it, then record it with spec published ${unit} <url>`);
    const root = path.resolve(cwd, store);
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`${store} is no folder — save the store's spec, history, changes and assess collections into it with ArtifactData's list and out_dir`);
    const listing = listingOf(root);
    const why = reason.split(/\s+/).filter(Boolean).join(' ');
    const { writes, change, resumed } = planned(page, listing, { at: now(), why, from: from.split(',').filter((id) => id.trim() !== '').map(asId) });
    checkSizes(writes);
    const { url } = published;
    if (writes.length === 0) return { unit, url, change, resumed, batches: [], existing: [], note: 'the store already holds this spec: nothing to write' };
    return { unit, url, change, resumed, ...writeBatches(nextPush(dir), writes, listing) };
  } catch (err) {
    throw new Error(`spec push: ${messageOf(err)}`);
  }
}

module.exports = { PAGE_USAGE, PUBLISHED_USAGE, PUSH_USAGE, CAPABILITIES, buildPage, recordPublished, pushPage };

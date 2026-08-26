// Replay — spec 4 semantics, Phase 0 form. Restore a world, point the watcher
// at it (real code paths, not mocks), stream the transcript with compressed
// pacing, pause at user-record boundaries (ask-marker pauses arrive with
// Phase 2). Offline mode answers from answers.json with match assertions; the
// FINAL user-record boundary always stays paused — continuing past it would
// need a live session (Phase 2 adopt).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { restoreWorld } from './convert.js';
import { logger } from './log.js';

export type ReplayState = 'streaming' | 'paused' | 'ended';

export type ReplayStatus = {
  state: ReplayState;
  fixture: string;
  atTurn: number;
  recordsStreamed: number;
  worldDir: string | null;
};

type Answers = Record<string, { answer: string; matchMode: 'exact' | 'key' }>;

export class Replayer extends EventEmitter {
  private records: any[] = [];
  private idx = 0;
  private turn = 0;
  private state: ReplayState = 'streaming';
  private worldDir: string | null = null;
  readonly meta: any;
  private answers: Answers = {};

  constructor(
    readonly fixtureDir: string,
    private opts: { paceMs?: number; offline?: boolean } = {},
  ) {
    super();
    this.meta = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'meta.json'), 'utf8'));
    this.records = fs
      .readFileSync(path.join(fixtureDir, 'transcript.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    const answersPath = path.join(fixtureDir, 'answers.json');
    if (fs.existsSync(answersPath)) this.answers = JSON.parse(fs.readFileSync(answersPath, 'utf8'));
  }

  /** Restore the first captured world into a tmpdir; the watcher points here. */
  restoreFirstWorld(): string | null {
    const worldsRoot = path.join(this.fixtureDir, 'worlds');
    if (!fs.existsSync(worldsRoot)) return null;
    const worlds = fs.readdirSync(worldsRoot).sort();
    if (worlds.length === 0) return null;
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-replay-'));
    this.worldDir = restoreWorld(path.join(worldsRoot, worlds[0]!), path.join(dest, 'world'));
    logger.info('replay world restored', { world: worlds[0], dir: this.worldDir });
    return this.worldDir;
  }

  private lastUserIdx(): number {
    for (let i = this.records.length - 1; i >= 0; i--) {
      if (this.records[i].record === 'user') return i;
    }
    return -1;
  }

  status(): ReplayStatus {
    return {
      state: this.state,
      fixture: path.basename(this.fixtureDir),
      atTurn: this.turn,
      recordsStreamed: this.idx,
      worldDir: this.worldDir,
    };
  }

  async run(): Promise<void> {
    const pace = this.opts.paceMs ?? 30;
    const finalUser = this.lastUserIdx();
    while (this.idx < this.records.length) {
      const rec = this.records[this.idx];
      // A user-turn boundary is the point where a human ANSWER came — the
      // first user record is the entry prompt and starts the stream instead.
      if (rec.record === 'user' && this.turn > 0) {
        // A user-turn boundary: the point where a human input came.
        if (this.idx === finalUser) {
          this.state = 'paused';
          this.emit('paused', { atTurn: this.turn + 1, final: true });
          logger.info('replay paused at final recorded user-turn boundary', { turn: this.turn + 1 });
          return; // stays paused; Phase 2 adopt continues from here
        }
        if (this.opts.offline) {
          // Scripted answer with match assertion (spec 4 offline mode).
          this.assertAnswer(rec);
        } else {
          this.state = 'paused';
          // Register the waiter before announcing the pause — a listener may
          // call step() synchronously from the 'paused' handler.
          const stepped = new Promise<void>((resolve) => this.once('step', resolve));
          this.emit('paused', { atTurn: this.turn + 1, final: false });
          await stepped;
          this.state = 'streaming';
        }
      }
      if (rec.record === 'user') this.turn += 1;
      this.emit('record', rec);
      this.idx += 1;
      if (pace > 0) await new Promise((r) => setTimeout(r, pace));
    }
    this.state = 'ended';
    this.emit('ended');
  }

  private assertAnswer(rec: any): void {
    // Phase 0: gate ids do not exist yet (no ask markers) — answers are keyed
    // by turn ordinal as a stopgap the Phase 2 re-parse replaces.
    const key = `turn:${this.turn + 1}`;
    const scripted = this.answers[key];
    if (!scripted) return;
    const recorded = String(rec.text ?? '').trim();
    const want = scripted.answer.trim();
    const ok =
      scripted.matchMode === 'exact'
        ? recorded === want
        : recorded === want || recorded.startsWith(want) || recorded.split(/[\s/]/)[0] === want;
    if (!ok) {
      throw new Error(`replay answer mismatch at ${key}: scripted ${JSON.stringify(want)}, recorded ${JSON.stringify(recorded)}`);
    }
  }

  step(): void {
    this.emit('step');
  }
}

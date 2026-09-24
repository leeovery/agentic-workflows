// The session journal (spec 2): an append-only per-session tee of every SDK
// event, UI-native state and the SINGLE source for re-derivation — ask
// ordinals, gate identity, restart recovery, and answer-while-dead all read
// the journal (SDK resume does not re-stream history). Fixture transcripts
// are journals with a world attached.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  detectAsk,
  computeGateId,
  type Detection,
} from '@workflow-ui/shared';

export type JournalLine = Record<string, unknown>;

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export class Journal {
  readonly path: string;

  constructor(dir: string, readonly bridgeSessionId: string) {
    fs.mkdirSync(dir, { recursive: true });
    this.path = path.join(dir, `${bridgeSessionId}.jsonl`);
  }

  // Synchronous append: the journal is the re-derivation source — a projection
  // computed right after a write must see it (and a crash must not lose the
  // tail a buffered stream was still holding).
  append(rec: JournalLine): void {
    fs.appendFileSync(this.path, JSON.stringify(rec) + '\n');
  }

  read(): JournalLine[] {
    try {
      return fs
        .readFileSync(this.path, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l));
    } catch {
      return [];
    }
  }
}

export type DerivedAsk = {
  ordinal: number;
  gateId: string;
  detection: Exclude<Detection, null>;
  turn: number;
  answered: boolean;
};

/**
 * Re-run ask detection over a journal: group records into turns (a turn ends
 * at `turn-end`; the answer that resolves an ask is the next `user` record),
 * detect per-turn, assign ordinals, and mark answered asks. The LAST
 * unanswered ask is the session's open gate; identity is invariant under
 * resume by construction (bridgeSessionId + ordinal + normalized body).
 */
export function deriveAsks(records: JournalLine[], bridgeSessionId: string): DerivedAsk[] {
  const asks: DerivedAsk[] = [];
  let toolResults: string[] = [];
  let finalText = '';
  let turn = 0;
  let ordinal = 0;

  const closeTurn = (ended: boolean) => {
    const detection = detectAsk({ toolResults, finalText, ended });
    if (detection) {
      asks.push({
        ordinal,
        gateId: computeGateId(bridgeSessionId, ordinal, detection.identityBody, sha256),
        detection,
        turn,
        answered: false,
      });
      ordinal += 1;
    }
    toolResults = [];
    finalText = '';
  };

  for (const rec of records) {
    switch (rec.record) {
      case 'user':
        // A user record after an open ask answers it.
        if (asks.length > 0 && !asks[asks.length - 1]!.answered) asks[asks.length - 1]!.answered = true;
        turn += 1;
        toolResults = [];
        finalText = '';
        break;
      case 'tool-result':
        // Only Bash results are gate sources (spec 1) — a Read result quoting
        // section markup in docs must never card.
        if (rec.tool === undefined || rec.tool === 'Bash') toolResults.push(String(rec.text ?? ''));
        break;
      case 'assistant':
        finalText = String(rec.text ?? '');
        break;
      case 'turn-end':
        closeTurn(false);
        break;
      case 'result':
        // A session that ended cleanly has no open ask; an interrupted one
        // keeps whatever the last turn detected.
        if (rec.outcome === 'completed' && asks.length > 0) {
          asks[asks.length - 1]!.answered = true;
        }
        break;
      default:
        break;
    }
  }
  return asks;
}

/** The open (unanswered, last) ask, if any. */
export function openAsk(records: JournalLine[], bridgeSessionId: string): DerivedAsk | null {
  const asks = deriveAsks(records, bridgeSessionId);
  const last = asks.at(-1);
  return last && !last.answered ? last : null;
}

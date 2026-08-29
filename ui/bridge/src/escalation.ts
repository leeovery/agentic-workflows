// Escalation tracking (phase-3 §1) — a session idle at a STOP beyond T_esc
// escalates and pushes ONCE per attendance: it re-arms only after the human is
// next active in the app (so an 11pm escalation doesn't silence a genuinely-
// stuck 9am, and doesn't repeat overnight). Navigation grace: a row the human
// left within T_grace doesn't escalate against them.
export type EscalationState = {
  gateId: string;
  openedAt: number;
  escalatedAt: number | null;
  rearmedAfterActivity: boolean;
};

export class EscalationTracker {
  private states = new Map<string, EscalationState>();
  private lastActivityAt = 0;

  constructor(
    private tEscMs: number,
    private tGraceMs: number,
  ) {}

  /** Record app activity — re-arms escalations that already fired. */
  markActive(now: number): void {
    this.lastActivityAt = now;
    for (const s of this.states.values()) {
      if (s.escalatedAt !== null) s.rearmedAfterActivity = true;
    }
  }

  observeOpen(gateId: string, openedAtMs: number): void {
    if (!this.states.has(gateId)) {
      this.states.set(gateId, { gateId, openedAt: openedAtMs, escalatedAt: null, rearmedAfterActivity: false });
    }
  }

  observeClosed(gateId: string): void {
    this.states.delete(gateId);
  }

  /**
   * Which open gates should escalate right now. A gate escalates when it has
   * been idle past T_esc, is not in navigation grace, and hasn't already
   * escalated this attendance (or was re-armed by later activity).
   */
  dueForEscalation(now: number, leftRowAt: Map<string, number>): string[] {
    const due: string[] = [];
    for (const s of this.states.values()) {
      if (now - s.openedAt < this.tEscMs) continue;
      const left = leftRowAt.get(s.gateId);
      if (left !== undefined && now - left < this.tGraceMs) continue; // navigation grace
      if (s.escalatedAt !== null && !s.rearmedAfterActivity) continue; // once per attendance
      due.push(s.gateId);
    }
    return due;
  }

  markEscalated(gateId: string, now: number): void {
    const s = this.states.get(gateId);
    if (s) {
      s.escalatedAt = now;
      s.rearmedAfterActivity = false;
    }
  }

  isEscalated(gateId: string): boolean {
    return this.states.get(gateId)?.escalatedAt != null;
  }
}

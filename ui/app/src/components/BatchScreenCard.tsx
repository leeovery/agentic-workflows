// BatchScreenCard (catalog: P2, intent 3) — the lanes' batch shape: the
// finding-batch DISPLAY rendered above its approval menu, a stop, never
// auto-advanced. The findings are ALWAYS visible before the approve/veto row
// (the "answered without seeing it" failure this component exists to prevent).
import { GateCard } from './GateCard';
import { EngineEmbed } from './EngineEmbed';
import type { GateCardData } from '../api';

export function BatchScreenCard({
  card,
  onAnswer,
  busy,
}: {
  card: GateCardData;
  onAnswer: (text: string) => void;
  busy?: boolean;
}) {
  return (
    <section data-testid="batch-screen-card" className="my-3 space-y-2">
      {/* The findings, verbatim from the engine (mono truth) — the context
          carries the DISPLAY: finding batch body the parser paired in. */}
      {card.context && <EngineEmbed text={card.context} label="findings — review before deciding" />}
      {/* The approve/veto row reuses the GateCard mechanics but without a
          second copy of the context. */}
      <GateCard card={{ ...card, context: '' }} onAnswer={onAnswer} busy={busy} />
    </section>
  );
}

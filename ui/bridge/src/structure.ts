// Artifact structure extraction (phase-4 §1). Structure comes from wherever
// it ACTUALLY lives (corrected premise): the manifest owns discussion
// subtopics and spec sources; heading-keyed extraction is reliable only for
// investigation, review reports, and briefs; research is Read-only. The
// engine never parses markdown artifacts, and neither do we beyond anchors.
// Hard rule: graceful degradation — unparsed structure yields no Structure
// tab, never an error.

export type StructureNode = { label: string; status?: string; anchor?: string; detail?: string };
export type ClaimChip = { command: string; result?: string; anchor?: string };

export type ArtifactStructure = {
  kind: 'discussion' | 'specification' | 'investigation' | 'review' | 'brief' | 'research' | 'none';
  // The manifest-owned or heading-keyed sections.
  sections: StructureNode[];
  // Spec sources + consult references (manifest-owned).
  sources?: StructureNode[];
  consultReferences?: StructureNode[];
  // Measured claims found by pattern (rendered as chips; misses cost nothing).
  claims: ClaimChip[];
  // True when structure is genuinely available; false → Read-only lens.
  available: boolean;
};

const EMPTY = (kind: ArtifactStructure['kind']): ArtifactStructure => ({ kind, sections: [], claims: [], available: false });

/** Slugify a heading exactly as the Read lens does, so anchors line up. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Measured-claim chips: `` `cmd` `` → result, a prose convention. Best-effort. */
export function findClaims(markdown: string): ClaimChip[] {
  const chips: ClaimChip[] = [];
  const lines = markdown.split('\n');
  for (const line of lines) {
    // `command` → result   (the engine/spec convention for a measured claim)
    const m = line.match(/`([^`]+)`\s*(?:→|->)\s*(.+)$/);
    if (m && /\b(cmd|run|grep|rg|node|npm|git|wc|ls|test|count|find)\b/i.test(m[1]!)) {
      chips.push({ command: m[1]!.trim(), result: m[2]!.trim().replace(/[.*_`]+$/, '').trim() });
    }
  }
  return chips;
}

/** Heading-keyed sections for the stable-template types. */
export function headingSections(markdown: string, minLevel = 2, maxLevel = 3): StructureNode[] {
  const out: StructureNode[] = [];
  for (const line of markdown.split('\n')) {
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (!m) continue;
    const level = m[1]!.length;
    if (level < minLevel || level > maxLevel) continue;
    const label = m[2]!.replace(/[*`]/g, '').trim();
    out.push({ label, anchor: slug(label), detail: level > minLevel ? 'sub' : undefined });
  }
  return out;
}

type Manifest = Record<string, any>;

function normalizeRows(raw: unknown): StructureNode[] {
  if (!raw) return [];
  const entries = Array.isArray(raw)
    ? (raw as any[]).map((r) => [r?.topic ?? r?.name, r] as const)
    : Object.entries<any>(raw as Record<string, any>);
  return entries
    .filter(([name]) => name)
    .map(([name, r]) => ({ label: String(name), status: r?.status ?? r?.incorporated ?? undefined }));
}

/**
 * Build the structure for one artifact. `manifest` is the work unit's parsed
 * manifest; `topic` and `phase` locate the item; `content` is the markdown.
 */
export function buildStructure(
  phase: string,
  topic: string,
  manifest: Manifest | null,
  content: string,
): ArtifactStructure {
  const item = manifest?.phases?.[phase]?.items?.[topic] ?? null;
  const claims = findClaims(content);

  switch (phase) {
    case 'discussion': {
      // Subtopics + lifecycle from the manifest (never session cache).
      const subtopics = item?.subtopics ?? {};
      const sections = Object.entries<any>(subtopics).map(([name, sub]) => ({
        label: name,
        status: sub?.status,
        // Anchor to a matching heading if one exists.
        anchor: headingSections(content).find((h) => h.label.toLowerCase() === name.toLowerCase())?.anchor,
      }));
      return { kind: 'discussion', sections, claims, available: sections.length > 0 };
    }
    case 'specification': {
      const sources = normalizeRows(item?.sources);
      const consultReferences = normalizeRows(item?.consult_references);
      // The spec's own body headings, as navigation.
      const sections = headingSections(content);
      return {
        kind: 'specification',
        sections,
        sources,
        consultReferences,
        claims,
        available: sources.length > 0 || consultReferences.length > 0 || sections.length > 0,
      };
    }
    case 'investigation':
    case 'review': {
      // Heading-keyed — reliable for these stable templates.
      const sections = headingSections(content);
      return { kind: phase === 'review' ? 'review' : 'investigation', sections, claims, available: sections.length > 0 };
    }
    case 'research':
      // Low structure is honest — Read lens with light annotation only.
      return { kind: 'research', sections: [], claims, available: false };
    default:
      // Briefs and anything else: heading-keyed if headings exist, else none.
      if (/brief/i.test(topic) || /brief/i.test(phase)) {
        const sections = headingSections(content);
        return { kind: 'brief', sections, claims, available: sections.length > 0 };
      }
      return { ...EMPTY('none'), claims };
  }
}

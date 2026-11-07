/**
 * MOI Documentation Centre — content model.
 *
 * Documentation pages are authored as structured blocks rather than MDX so that
 * the same source powers rendering, the on-page table of contents, and the
 * client-side search index without introducing additional build dependencies.
 *
 * Inline text supports a minimal markup subset:
 *   `code`            -> inline code
 *   **bold**          -> strong emphasis
 *   [label](/docs/x)  -> internal or external link
 */

export type DocStatus =
  | 'live'
  | 'implemented'
  | 'configured'
  | 'pending'
  | 'planned'
  | 'unavailable';

export type CalloutVariant = 'info' | 'warning' | 'security' | 'note' | 'pending';

export interface DiagramNode {
  name: string;
  detail?: string;
  status?: DocStatus;
}

export interface DiagramLayer {
  label: string;
  nodes: DiagramNode[];
}

export type DocBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string; id?: string }
  | { type: 'h3'; text: string; id?: string }
  | { type: 'list'; items: string[] }
  | { type: 'steps'; items: { title: string; text: string }[] }
  | { type: 'callout'; variant: CalloutVariant; title?: string; text: string }
  | { type: 'code'; lang: string; code: string; title?: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'status'; items: { label: string; status: DocStatus; note?: string }[] }
  | { type: 'diagram'; title: string; layers: DiagramLayer[]; caption?: string }
  | { type: 'flow'; title: string; states: string[]; caption?: string }
  | { type: 'cards'; items: { title: string; text: string; href?: string }[] };

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  blocks: DocBlock[];
}

export interface DocGroup {
  id: string;
  label: string;
  pages: DocPage[];
}


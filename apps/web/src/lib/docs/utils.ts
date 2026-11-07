import type { DocBlock, DocPage } from './types';

export function slugifyHeading(text: string): string {
  return stripInline(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

/** Removes inline markup so text can be indexed or used as an anchor. */
export function stripInline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

export function headingId(block: Extract<DocBlock, { type: 'h2' | 'h3' }>): string {
  return block.id ?? slugifyHeading(block.text);
}

export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

export function buildToc(page: DocPage): TocEntry[] {
  const toc: TocEntry[] = [];
  for (const block of page.blocks) {
    if (block.type === 'h2' || block.type === 'h3') {
      toc.push({
        id: headingId(block),
        text: stripInline(block.text),
        level: block.type === 'h2' ? 2 : 3,
      });
    }
  }
  return toc;
}

/** Flattens a page into plain searchable text. */
export function pageToPlainText(page: DocPage): string {
  const parts: string[] = [page.title, page.description];
  for (const block of page.blocks) {
    switch (block.type) {
      case 'p':
      case 'h2':
      case 'h3':
        parts.push(stripInline(block.text));
        break;
      case 'list':
        parts.push(...block.items.map(stripInline));
        break;
      case 'steps':
        block.items.forEach((s) => parts.push(stripInline(s.title), stripInline(s.text)));
        break;
      case 'callout':
        parts.push(stripInline(block.title ?? ''), stripInline(block.text));
        break;
      case 'code':
        parts.push(block.code);
        break;
      case 'table':
        parts.push(block.headers.join(' '), ...block.rows.map((r) => r.map(stripInline).join(' ')));
        break;
      case 'status':
        block.items.forEach((i) => parts.push(i.label, i.note ?? ''));
        break;
      case 'diagram':
        parts.push(block.title, ...block.layers.flatMap((l) => [l.label, ...l.nodes.map((n) => `${n.name} ${n.detail ?? ''}`)]));
        break;
      case 'flow':
        parts.push(block.title, ...block.states);
        break;
      case 'cards':
        block.items.forEach((c) => parts.push(c.title, stripInline(c.text)));
        break;
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ');
}


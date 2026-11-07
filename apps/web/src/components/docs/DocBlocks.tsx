import React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowDown, ArrowRight, Clock, Info, ShieldCheck, StickyNote } from 'lucide-react';
import type { CalloutVariant, DocBlock, DocStatus } from '@/lib/docs/types';
import { headingId } from '@/lib/docs/utils';
import { DocsCodeBlock } from './DocsCodeBlock';

/* ---------------------------------------------------------------------------
   Inline markup: `code`, **bold**, [label](href)
   --------------------------------------------------------------------------- */
const INLINE_PATTERN = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

export function Inline({ text }: { text: string }) {
  const parts = text.split(INLINE_PATTERN).filter((p) => p !== '');
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={i}
              className="px-1.5 py-0.5 rounded-md bg-[#0B0F14]/[0.06] text-[0.86em] font-mono-num text-[#0B0F14] break-words"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-bold text-[#0B0F14]">
              {part.slice(2, -2)}
            </strong>
          );
        }
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          const [, label, href] = link;
          const external = /^https?:\/\//.test(href);
          const cls = 'font-semibold text-[#087F5B] underline decoration-[#00E676]/50 underline-offset-2 hover:decoration-[#087F5B]';
          return external ? (
            <a key={i} href={href} target="_blank" rel="noreferrer" className={cls}>
              {label}
            </a>
          ) : (
            <Link key={i} href={href} className={cls}>
              {label}
            </Link>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

/* ---------------------------------------------------------------------------
   Status labels
   --------------------------------------------------------------------------- */
const STATUS_META: Record<DocStatus, { label: string; cls: string }> = {
  live: { label: 'Live and verified', cls: 'bg-[#B6F7D2]/70 text-[#065F46] border-[#00E676]/40' },
  implemented: { label: 'Implemented, not live-verified', cls: 'bg-sky-50 text-sky-800 border-sky-200' },
  configured: { label: 'Configured', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  planned: { label: 'Planned', cls: 'bg-violet-50 text-violet-800 border-violet-200' },
  unavailable: { label: 'Unavailable', cls: 'bg-red-50 text-red-700 border-red-200' },
};

export function StatusLabel({ status }: { status: DocStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10.5px] font-bold uppercase tracking-wide whitespace-nowrap ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}

/* ---------------------------------------------------------------------------
   Callouts
   --------------------------------------------------------------------------- */
const CALLOUT_META: Record<CalloutVariant, { icon: React.ElementType; cls: string; iconCls: string; label: string }> = {
  info: { icon: Info, cls: 'border-l-[#087F5B] bg-[#E6FBF0]/60', iconCls: 'text-[#087F5B]', label: 'Important' },
  note: { icon: StickyNote, cls: 'border-l-slate-400 bg-slate-50', iconCls: 'text-slate-500', label: 'Implementation note' },
  warning: { icon: AlertTriangle, cls: 'border-l-amber-500 bg-amber-50/70', iconCls: 'text-amber-600', label: 'Warning' },
  security: { icon: ShieldCheck, cls: 'border-l-[#0B0F14] bg-[#0B0F14]/[0.035]', iconCls: 'text-[#0B0F14]', label: 'Security consideration' },
  pending: { icon: Clock, cls: 'border-l-violet-500 bg-violet-50/60', iconCls: 'text-violet-600', label: 'Not yet available' },
};

function Callout({ variant, title, text }: { variant: CalloutVariant; title?: string; text: string }) {
  const meta = CALLOUT_META[variant];
  const Icon = meta.icon;
  return (
    <aside className={`my-5 rounded-r-xl border border-[#0B0F14]/[0.06] border-l-4 ${meta.cls} px-4 py-3.5`} role="note">
      <div className="flex gap-3">
        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${meta.iconCls}`} aria-hidden />
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[#0B0F14]/80 mb-1">{title ?? meta.label}</p>
          <p className="text-[14px] leading-relaxed text-[#0B0F14]/80">
            <Inline text={text} />
          </p>
        </div>
      </div>
    </aside>
  );
}

/* ---------------------------------------------------------------------------
   Headings with anchor links
   --------------------------------------------------------------------------- */
function Heading({ level, text, id }: { level: 2 | 3; text: string; id: string }) {
  const Tag = level === 2 ? 'h2' : 'h3';
  const cls =
    level === 2
      ? 'mt-12 mb-4 pt-2 text-[22px] font-black tracking-tight text-[#0B0F14] border-t border-[#0B0F14]/[0.07]'
      : 'mt-8 mb-3 text-[17px] font-bold tracking-tight text-[#0B0F14]';
  return (
    <Tag id={id} className={`group scroll-mt-24 ${cls}`}>
      <Inline text={text} />
      <a
        href={`#${id}`}
        aria-label={`Link to section: ${text}`}
        className="ml-2 opacity-0 group-hover:opacity-100 focus:opacity-100 text-[#087F5B] transition"
      >
        #
      </a>
    </Tag>
  );
}

/* ---------------------------------------------------------------------------
   Diagrams (pure CSS, accessible, no external renderer)
   --------------------------------------------------------------------------- */
function LayeredDiagram({ block }: { block: Extract<DocBlock, { type: 'diagram' }> }) {
  return (
    <figure className="my-6 rounded-2xl border border-[#0B0F14]/10 bg-white p-4 sm:p-5" aria-label={block.title}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#087F5B] mb-4">{block.title}</p>
      <ol className="space-y-0">
        {block.layers.map((layer, li) => (
          <li key={li}>
            <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 sm:gap-4 items-start">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#0B0F14]/50 sm:pt-2.5">{layer.label}</p>
              <ul className="flex flex-wrap gap-2">
                {layer.nodes.map((node, ni) => (
                  <li
                    key={ni}
                    className="flex-1 min-w-[150px] rounded-lg border border-[#0B0F14]/12 bg-[#F8FAFC] px-3 py-2"
                  >
                    <p className="text-[13px] font-bold text-[#0B0F14] leading-tight">{node.name}</p>
                    {node.detail && <p className="text-[11.5px] text-[#0B0F14]/60 leading-snug mt-0.5">{node.detail}</p>}
                    {node.status && (
                      <div className="mt-1.5">
                        <StatusLabel status={node.status} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            {li < block.layers.length - 1 && (
              <div className="flex sm:pl-[156px] py-1.5 text-[#087F5B]/70" aria-hidden>
                <ArrowDown className="w-4 h-4 mx-auto sm:mx-0 sm:ml-6" />
              </div>
            )}
          </li>
        ))}
      </ol>
      {block.caption && (
        <figcaption className="mt-4 text-[12px] text-[#0B0F14]/55 leading-relaxed">
          <Inline text={block.caption} />
        </figcaption>
      )}
    </figure>
  );
}

function StateFlow({ block }: { block: Extract<DocBlock, { type: 'flow' }> }) {
  return (
    <figure className="my-6 rounded-2xl border border-[#0B0F14]/10 bg-white p-4 sm:p-5" aria-label={block.title}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#087F5B] mb-3">{block.title}</p>
      <ol className="flex flex-wrap items-center gap-y-2">
        {block.states.map((state, i) => (
          <li key={i} className="flex items-center">
            <span className="px-2.5 py-1 rounded-md bg-[#0B0F14] text-[#B6F7D2] text-[11.5px] font-mono-num font-semibold">
              {state}
            </span>
            {i < block.states.length - 1 && <ArrowRight className="w-3.5 h-3.5 mx-1.5 text-[#0B0F14]/35" aria-hidden />}
          </li>
        ))}
      </ol>
      {block.caption && (
        <figcaption className="mt-3 text-[12px] text-[#0B0F14]/55 leading-relaxed">
          <Inline text={block.caption} />
        </figcaption>
      )}
    </figure>
  );
}

/* ---------------------------------------------------------------------------
   Block renderer
   --------------------------------------------------------------------------- */
export function DocBlocks({ blocks }: { blocks: DocBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'p':
            return (
              <p key={i} className="my-4 text-[15px] leading-[1.75] text-[#0B0F14]/80">
                <Inline text={block.text} />
              </p>
            );
          case 'h2':
            return <Heading key={i} level={2} text={block.text} id={headingId(block)} />;
          case 'h3':
            return <Heading key={i} level={3} text={block.text} id={headingId(block)} />;
          case 'list':
            return (
              <ul key={i} className="my-4 space-y-2 pl-1">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-3 text-[15px] leading-[1.7] text-[#0B0F14]/80">
                    <span className="mt-[11px] w-1.5 h-1.5 rounded-full bg-[#087F5B] shrink-0" aria-hidden />
                    <span className="min-w-0">
                      <Inline text={item} />
                    </span>
                  </li>
                ))}
              </ul>
            );
          case 'steps':
            return (
              <ol key={i} className="my-6 space-y-0 border-l-2 border-[#0B0F14]/10 ml-3">
                {block.items.map((step, j) => (
                  <li key={j} className="relative pl-7 pb-5 last:pb-0">
                    <span className="absolute -left-[13px] top-0 w-6 h-6 rounded-full bg-[#0B0F14] text-[#00E676] text-[11px] font-black flex items-center justify-center font-mono-num">
                      {j + 1}
                    </span>
                    <p className="text-[15px] font-bold text-[#0B0F14] leading-snug">
                      <Inline text={step.title} />
                    </p>
                    <p className="mt-1 text-[14.5px] leading-[1.7] text-[#0B0F14]/75">
                      <Inline text={step.text} />
                    </p>
                  </li>
                ))}
              </ol>
            );
          case 'callout':
            return <Callout key={i} variant={block.variant} title={block.title} text={block.text} />;
          case 'code':
            return <DocsCodeBlock key={i} code={block.code} lang={block.lang} title={block.title} />;
          case 'table':
            return (
              <div key={i} className="my-5 overflow-x-auto rounded-xl border border-[#0B0F14]/10 bg-white">
                <table className="w-full text-left text-[13px] border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC]">
                      {block.headers.map((h, j) => (
                        <th
                          key={j}
                          scope="col"
                          className="px-3.5 py-2.5 font-bold text-[11.5px] uppercase tracking-wide text-[#0B0F14]/60 border-b border-[#0B0F14]/10 whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r} className="border-b border-[#0B0F14]/[0.06] last:border-0 align-top">
                        {row.map((cell, c) => (
                          <td key={c} className="px-3.5 py-2.5 text-[#0B0F14]/80 leading-relaxed">
                            <Inline text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'status':
            return (
              <ul key={i} className="my-5 rounded-xl border border-[#0B0F14]/10 bg-white divide-y divide-[#0B0F14]/[0.06]">
                {block.items.map((item, j) => (
                  <li key={j} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 px-4 py-3">
                    <div className="sm:w-56 shrink-0">
                      <StatusLabel status={item.status} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-[#0B0F14]">{item.label}</p>
                      {item.note && (
                        <p className="text-[13px] text-[#0B0F14]/65 leading-relaxed">
                          <Inline text={item.note} />
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            );
          case 'diagram':
            return <LayeredDiagram key={i} block={block} />;
          case 'flow':
            return <StateFlow key={i} block={block} />;
          case 'cards':
            return (
              <div key={i} className="my-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {block.items.map((card, j) => {
                  const inner = (
                    <>
                      <p className="text-[14px] font-bold text-[#0B0F14] flex items-center gap-1.5">
                        {card.title}
                        {card.href && <ArrowRight className="w-3.5 h-3.5 text-[#087F5B] group-hover:translate-x-0.5 transition" />}
                      </p>
                      <p className="mt-1 text-[13px] text-[#0B0F14]/65 leading-relaxed">
                        <Inline text={card.text} />
                      </p>
                    </>
                  );
                  const cls = 'group block rounded-xl border border-[#0B0F14]/10 bg-white px-4 py-3.5 transition';
                  return card.href ? (
                    <Link key={j} href={card.href} className={`${cls} hover:border-[#087F5B]/40 hover:shadow-sm`}>
                      {inner}
                    </Link>
                  ) : (
                    <div key={j} className={cls}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            );
          default:
            return null;
        }
      })}
    </>
  );
}


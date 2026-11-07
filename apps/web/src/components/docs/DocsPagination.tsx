import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface DocsPaginationProps {
  prev: { title: string; slug: string } | null;
  next: { title: string; slug: string } | null;
}

export function DocsPagination({ prev, next }: DocsPaginationProps) {
  if (!prev && !next) return null;

  return (
    <nav
      aria-label="Previous and Next Documentation Pages"
      className="mt-16 pt-8 border-t border-[#0B0F14]/10 grid grid-cols-1 sm:grid-cols-2 gap-4"
    >
      {prev ? (
        <Link
          href={`/docs/${prev.slug}`}
          className="group p-4 rounded-xl border border-[#0B0F14]/10 bg-white hover:border-[#087F5B]/40 hover:shadow-xs transition text-left"
        >
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0B0F14]/50 mb-1">
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition" />
            Previous
          </span>
          <span className="text-sm font-bold text-[#0B0F14] group-hover:text-[#087F5B] transition block truncate">
            {prev.title}
          </span>
        </Link>
      ) : (
        <div />
      )}

      {next && (
        <Link
          href={`/docs/${next.slug}`}
          className="group p-4 rounded-xl border border-[#0B0F14]/10 bg-white hover:border-[#087F5B]/40 hover:shadow-xs transition text-right sm:col-start-2"
        >
          <span className="flex items-center justify-end gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0B0F14]/50 mb-1">
            Next
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
          </span>
          <span className="text-sm font-bold text-[#0B0F14] group-hover:text-[#087F5B] transition block truncate">
            {next.title}
          </span>
        </Link>
      )}
    </nav>
  );
}

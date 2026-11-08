'use client';

import React, { useEffect, useState } from 'react';
import type { TocEntry } from '@/lib/docs/utils';
import { AlignLeft } from 'lucide-react';

interface DocsTocProps {
  toc: TocEntry[];
}

export function DocsToc({ toc }: DocsTocProps) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (toc.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      {
        rootMargin: '-80px 0px -70% 0px',
        threshold: 0,
      }
    );

    for (const item of toc) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [toc]);

  if (toc.length === 0) return null;

  return (
    <aside className="hidden xl:block w-64 shrink-0 p-6 sticky top-0 h-screen overflow-y-auto border-l border-[#0B0F14]/10 text-xs">
      <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10.5px] text-[#0B0F14]/50 mb-4">
        <AlignLeft className="w-3.5 h-3.5" />
        <span>On This Page</span>
      </div>
      <nav>
        <ul className="space-y-1.5">
          {toc.map((item) => {
            const isActive = activeId === item.id;
            return (
              <li
                key={item.id}
                className={item.level === 3 ? 'pl-3' : 'pl-0'}
              >
                <a
                  href={`#${item.id}`}
                  className={`block py-1 transition leading-relaxed ${
                    isActive
                      ? 'text-[#087F5B] font-bold border-l-2 border-[#00E676] -ml-2 pl-2'
                      : 'text-[#0B0F14]/60 hover:text-[#0B0F14]'
                  }`}
                >
                  {item.text}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}


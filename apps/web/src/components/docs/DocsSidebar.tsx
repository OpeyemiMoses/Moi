'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getAllDocGroups } from '@/lib/docs/data';
import { MoiRibbonMark } from '@/components/MoiLogo';
import { ArrowLeft, ExternalLink, Search } from 'lucide-react';

interface DocsSidebarProps {
  onOpenSearch: () => void;
  onCloseMobile?: () => void;
}

export function DocsSidebar({ onOpenSearch, onCloseMobile }: DocsSidebarProps) {
  const pathname = usePathname();
  const groups = getAllDocGroups();

  return (
    <aside className="w-full lg:w-72 bg-[#0B0F14] text-white flex flex-col justify-between shrink-0 h-full border-r border-white/10 overflow-y-auto">
      <div className="p-4 sm:p-5">
        {/* Logo and Home Links */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
          <Link
            href="/"
            onClick={onCloseMobile}
            className="flex items-center gap-2.5 group"
            title="MOI — Return to App"
          >
            <MoiRibbonMark className="w-7 h-5.5 shrink-0" />
            <div>
              <span className="text-lg font-black tracking-tight text-white block leading-none">
                MOI
              </span>
              <span className="text-[9.5px] font-bold text-[#00E676] uppercase tracking-wider block mt-0.5">
                Documentation Centre
              </span>
            </div>
          </Link>

          <Link
            href="/"
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition"
            title="Return to Main Application"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>

        {/* Search Trigger Button */}
        <button
          onClick={() => {
            onOpenSearch();
            onCloseMobile?.();
          }}
          className="w-full mb-5 flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs transition group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#00E676]" />
            <span>Search docs...</span>
          </div>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/60 group-hover:text-white">
            ⌘K
          </kbd>
        </button>

        {/* Grouped Documentation Navigation */}
        <nav className="space-y-6">
          {groups.map((group) => (
            <div key={group.id} className="space-y-1">
              <h3 className="px-2 text-[10.5px] font-bold uppercase tracking-wider text-[#00E676]/80 mb-1.5">
                {group.label}
              </h3>
              <ul className="space-y-0.5">
                {group.pages.map((page) => {
                  const href = `/docs/${page.slug}`;
                  const isActive = pathname === href;
                  return (
                    <li key={page.slug}>
                      <Link
                        href={href}
                        onClick={onCloseMobile}
                        className={`block px-2.5 py-1.5 rounded-lg text-xs font-medium transition leading-snug ${
                          isActive
                            ? 'bg-[#087F5B]/40 text-[#00E676] font-bold border border-[#00E676]/30'
                            : 'text-white/70 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {page.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-white/10 bg-white/[0.02] text-[11px] text-white/50 space-y-2">
        <div className="flex items-center justify-between">
          <span>Celo Mainnet (42220)</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#00E676]" />
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <a
            href="https://github.com/OpeyemiMoses/Moi"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white transition flex items-center gap-1"
          >
            GitHub Monorepo
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <Link href="/" className="hover:text-white transition">
            Launch OS →
          </Link>
        </div>
      </div>
    </aside>
  );
}


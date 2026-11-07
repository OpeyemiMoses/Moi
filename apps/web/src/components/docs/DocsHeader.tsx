'use client';

import React from 'react';
import Link from 'next/link';
import { Menu, Search, ChevronRight, Home, ArrowLeft } from 'lucide-react';
import { useDocs } from './DocsContext';

interface DocsHeaderProps {
  breadcrumbs?: { label: string; href?: string }[];
  onToggleMobileMenu?: () => void;
  onOpenSearch?: () => void;
}

export function DocsHeader({
  breadcrumbs,
  onToggleMobileMenu,
  onOpenSearch,
}: DocsHeaderProps) {
  const docs = useDocs();
  const handleToggleMobile = onToggleMobileMenu ?? docs.toggleMobileMenu;
  const handleOpenSearch = onOpenSearch ?? docs.openSearch;

  return (
    <header className="sticky top-0 z-30 bg-[#F8FAFC]/90 backdrop-blur-md border-b border-[#0B0F14]/10 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
      {/* Mobile Menu & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={handleToggleMobile}
          className="lg:hidden p-1.5 rounded-lg border border-[#0B0F14]/10 hover:bg-[#0B0F14]/5 text-[#0B0F14]"
          aria-label="Toggle navigation drawer"
        >
          <Menu className="w-4 h-4" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#0B0F14]/60 truncate">
          <Link href="/docs" className="hover:text-[#0B0F14] flex items-center gap-1 shrink-0">
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Docs</span>
          </Link>
          {breadcrumbs?.map((crumb, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight className="w-3.5 h-3.5 text-[#0B0F14]/30 shrink-0" />
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-[#0B0F14] truncate">
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-semibold text-[#0B0F14] truncate">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right Controls: Search button & Return to App */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={handleOpenSearch}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#0B0F14]/12 bg-white hover:bg-[#F8FAFC] text-xs text-[#0B0F14]/70 shadow-xs transition"
          aria-label="Open search dialog"
        >
          <Search className="w-3.5 h-3.5 text-[#087F5B]" />
          <span className="hidden md:inline">Search docs</span>
          <kbd className="hidden md:inline text-[10px] font-mono px-1 rounded bg-[#0B0F14]/5 text-[#0B0F14]/50">
            ⌘K
          </kbd>
        </button>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0B0F14] text-white hover:bg-[#0B0F14]/90 transition shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#00E676]" />
          <span>Exit to App</span>
        </Link>
      </div>
    </header>
  );
}

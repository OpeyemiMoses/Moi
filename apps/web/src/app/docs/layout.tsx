'use client';

import React from 'react';
import { DocsProvider, useDocs } from '@/components/docs/DocsContext';
import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { DocsSearchModal } from '@/components/docs/DocsSearchModal';
import { X } from 'lucide-react';

function DocsLayoutInner({ children }: { children: React.ReactNode }) {
  const { isSearchOpen, openSearch, closeSearch, isMobileMenuOpen, closeMobileMenu } = useDocs();

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0B0F14] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen lg:shrink-0">
        <DocsSidebar onOpenSearch={openSearch} />
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#0B0F14]/70 backdrop-blur-sm"
            onClick={closeMobileMenu}
          />
          <div className="relative w-4/5 max-w-sm bg-[#0B0F14] h-full z-10 flex flex-col shadow-2xl">
            <button
              onClick={closeMobileMenu}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
            <DocsSidebar
              onOpenSearch={openSearch}
              onCloseMobile={closeMobileMenu}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">{children}</div>

      {/* Interactive Global Search Modal */}
      <DocsSearchModal isOpen={isSearchOpen} onClose={closeSearch} />
    </div>
  );
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <DocsProvider>
      <DocsLayoutInner>{children}</DocsLayoutInner>
    </DocsProvider>
  );
}

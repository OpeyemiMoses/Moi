'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, ArrowRight, CornerDownLeft } from 'lucide-react';
import { searchDocs, type SearchResult } from '@/lib/docs/search';

interface DocsSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DocsSearchModal({ isOpen, onClose }: DocsSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const res = searchDocs(query);
    setResults(res);
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        router.push(`/docs/${results[selectedIndex].slug}`);
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, router, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0F14]/70 backdrop-blur-sm flex items-start justify-center p-4 sm:p-6 pt-16 sm:pt-24 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-[#0B0F14]/15 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#0B0F14]/10 gap-3">
          <Search className="w-4 h-4 text-[#0B0F14]/40 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documentation (e.g. policy engine, textile, cNGN, siwe)..."
            className="w-full text-sm text-[#0B0F14] placeholder-[#0B0F14]/40 focus:outline-none bg-transparent"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded text-[#0B0F14]/40 hover:text-[#0B0F14] transition"
              aria-label="Clear query"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#F8FAFC] text-[#0B0F14]/50 border border-[#0B0F14]/10 hover:bg-[#0B0F14]/5"
          >
            Esc
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-[#0B0F14]/5">
          {results.length > 0 ? (
            results.map((result, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={result.slug}
                  onClick={() => {
                    router.push(`/docs/${result.slug}`);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-3 rounded-xl cursor-pointer transition flex items-start justify-between gap-3 ${
                    isSelected ? 'bg-[#0B0F14]/5 text-[#0B0F14]' : 'hover:bg-[#0B0F14]/[0.02]'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#087F5B]/10 text-[#087F5B]">
                        {result.groupLabel}
                      </span>
                      <h4 className="text-xs font-bold text-[#0B0F14] truncate">{result.title}</h4>
                    </div>
                    <p className="text-[11.5px] text-[#0B0F14]/60 line-clamp-2 leading-relaxed">
                      {result.snippet}
                    </p>
                  </div>
                  <div className="shrink-0 pt-1 text-[#087F5B]">
                    {isSelected ? (
                      <CornerDownLeft className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 opacity-40" />
                    )}
                  </div>
                </div>
              );
            })
          ) : query ? (
            <div className="py-12 text-center text-xs text-[#0B0F14]/50">
              No documentation pages found matching &quot;{query}&quot;.
            </div>
          ) : (
            <div className="py-8 px-4 text-xs text-[#0B0F14]/50 space-y-2">
              <p className="font-semibold text-[#0B0F14]/70">Popular searches:</p>
              <div className="flex flex-wrap gap-1.5">
                {['Deterministic Policy Engine', 'cNGN / USDT Corridor', 'Textile FX v2', 'ERC-8004 Identity', 'Wallet Separation', 'SIWE Authentication'].map(
                  (tag) => (
                    <button
                      key={tag}
                      onClick={() => setQuery(tag)}
                      className="px-2 py-1 rounded-md text-[11px] bg-[#F8FAFC] border border-[#0B0F14]/10 hover:border-[#087F5B] hover:text-[#087F5B] transition"
                    >
                      {tag}
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-[#0B0F14]/10 bg-[#F8FAFC] flex items-center justify-between text-[11px] text-[#0B0F14]/45">
          <div className="flex items-center gap-3">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
            <span>esc to close</span>
          </div>
          <span>MOI Documentation Centre</span>
        </div>
      </div>
    </div>
  );
}

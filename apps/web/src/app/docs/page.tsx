'use client';

import React from 'react';
import Link from 'next/link';
import { DocsHeader } from '@/components/docs/DocsHeader';
import { getAllDocGroups } from '@/lib/docs/data';
import {
  ArrowRight,
  Shield,
  Layers,
  Cpu,
  Zap,
  BookOpen,
  Code2,
  FileText,
  TrendingUp,
} from 'lucide-react';

const GROUP_ICONS: Record<string, React.ElementType> = {
  'getting-started': BookOpen,
  product: Layers,
  'how-it-works': Cpu,
  integrations: Zap,
  security: Shield,
  guides: TrendingUp,
  developers: Code2,
  reference: FileText,
};

export default function DocsIndexPage() {
  const groups = getAllDocGroups();

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <DocsHeader breadcrumbs={[{ label: 'Documentation Centre' }]} />

      <main className="flex-1 p-6 sm:p-10 max-w-5xl w-full mx-auto space-y-10">
        {/* Hero Banner */}
        <section className="space-y-4 pb-8 border-b border-[#0B0F14]/10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B6F7D2]/60 border border-[#00E676]/40 text-[11px] font-bold text-[#087F5B]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E676]" />
            Official Documentation · Celo Mainnet (42220)
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[#0B0F14]">
            MOI Documentation Centre
          </h1>
          <p className="text-sm sm:text-base text-[#0B0F14]/70 max-w-2xl leading-relaxed">
            Welcome to the comprehensive architecture, governance, and developer reference for MOI — the autonomous stablecoin treasury operating system built on Celo with Textile FX v2 and buy/x402.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/docs/getting-started/introduction"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#0B0F14] text-white hover:bg-[#0B0F14]/90 transition"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#00E676]" />
            </Link>
            <Link
              href="/docs/how-it-works/system-architecture"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-[#0B0F14]/12 bg-white hover:bg-[#F8FAFC] text-[#0B0F14] transition"
            >
              <span>Architecture & 18 Rules</span>
            </Link>
            <Link
              href="/docs/developers/api-reference"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-[#0B0F14]/12 bg-white hover:bg-[#F8FAFC] text-[#0B0F14] transition"
            >
              <span>API Reference</span>
            </Link>
          </div>
        </section>

        {/* Section Cards Grid */}
        <section className="space-y-6">
          <h2 className="text-lg font-black tracking-tight text-[#0B0F14]">
            Explore by Section
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((group) => {
              const Icon = GROUP_ICONS[group.id] || BookOpen;
              return (
                <div
                  key={group.id}
                  className="rounded-2xl border border-[#0B0F14]/10 bg-white p-5 hover:border-[#087F5B]/30 hover:shadow-xs transition space-y-3"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-[#E6FBF0] text-[#087F5B]">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-[#0B0F14]">
                      {group.label}
                    </h3>
                  </div>

                  <ul className="space-y-1 text-xs text-[#0B0F14]/70">
                    {group.pages.slice(0, 4).map((p) => (
                      <li key={p.slug}>
                        <Link
                          href={`/docs/${p.slug}`}
                          className="hover:text-[#087F5B] transition flex items-center justify-between py-0.5 group"
                        >
                          <span className="truncate">{p.title}</span>
                          <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-[#087F5B] transition shrink-0" />
                        </Link>
                      </li>
                    ))}
                  </ul>

                  {group.pages.length > 4 && (
                    <Link
                      href={`/docs/${group.pages[0].slug}`}
                      className="text-[11px] font-bold text-[#087F5B] hover:underline block pt-1"
                    >
                      View all {group.pages.length} pages →
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

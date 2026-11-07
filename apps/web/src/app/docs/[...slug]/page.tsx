import React from 'react';
import { notFound } from 'next/navigation';
import { getDocPageBySlug, getNextPrevPages, getAllDocSlugs } from '@/lib/docs/data';
import { buildToc } from '@/lib/docs/utils';
import { DocsHeader } from '@/components/docs/DocsHeader';
import { DocBlocks } from '@/components/docs/DocBlocks';
import { DocsToc } from '@/components/docs/DocsToc';
import { DocsPagination } from '@/components/docs/DocsPagination';

interface DocPageProps {
  params: Promise<{ slug: string[] }>;
}

export function generateStaticParams() {
  const slugs = getAllDocSlugs();
  return slugs.map((slug) => ({
    slug: slug.split('/'),
  }));
}

export default async function DynamicDocPage({ params }: DocPageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug.join('/');
  const docData = getDocPageBySlug(slug);

  if (!docData) {
    notFound();
  }

  const { page, group } = docData;
  const toc = buildToc(page);
  const { prev, next } = getNextPrevPages(slug);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <DocsHeader
        breadcrumbs={[
          { label: group.label, href: `/docs/${group.pages[0].slug}` },
          { label: page.title },
        ]}
      />

      <div className="flex-1 flex justify-between min-w-0">
        <main className="flex-1 p-6 sm:p-10 max-w-4xl w-full mx-auto min-w-0">
          {/* Page Header */}
          <header className="mb-8 pb-6 border-b border-[#0B0F14]/10 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#087F5B]">
              {group.label}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0B0F14]">
              {page.title}
            </h1>
            <p className="text-sm sm:text-base text-[#0B0F14]/65 leading-relaxed">
              {page.description}
            </p>
          </header>

          {/* Structured Content Blocks */}
          <article className="prose prose-slate max-w-none">
            <DocBlocks blocks={page.blocks} />
          </article>

          {/* Previous / Next Navigation */}
          <DocsPagination prev={prev} next={next} />
        </main>

        {/* Right Table of Contents (Desktop) */}
        <DocsToc toc={toc} />
      </div>
    </div>
  );
}

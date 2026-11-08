import type { DocGroup, DocPage } from './types';
import { gettingStartedGroup } from './data/getting-started';
import { productGroup } from './data/product';
import { howItWorksGroup } from './data/how-it-works';
import { integrationsGroup } from './data/integrations';
import { securityGroup } from './data/security';
import { guidesGroup } from './data/guides';
import { developersGroup } from './data/developers';
import { referenceGroup } from './data/reference';

export const ALL_DOC_GROUPS: DocGroup[] = [
  gettingStartedGroup,
  productGroup,
  howItWorksGroup,
  integrationsGroup,
  securityGroup,
  guidesGroup,
  developersGroup,
  referenceGroup,
];

export function getAllDocGroups(): DocGroup[] {
  return ALL_DOC_GROUPS;
}

export function getAllDocPages(): DocPage[] {
  return ALL_DOC_GROUPS.flatMap((g) => g.pages);
}

export function getAllDocSlugs(): string[] {
  return getAllDocPages().map((p) => p.slug);
}

export function getDocPageBySlug(slug: string): { page: DocPage; group: DocGroup } | null {
  const normalized = slug.replace(/^\/+|\/+$/g, '');
  for (const group of ALL_DOC_GROUPS) {
    for (const page of group.pages) {
      if (page.slug === normalized) {
        return { page, group };
      }
    }
  }
  return null;
}

export function getNextPrevPages(slug: string): {
  prev: { title: string; slug: string } | null;
  next: { title: string; slug: string } | null;
} {
  const pages = getAllDocPages();
  const normalized = slug.replace(/^\/+|\/+$/g, '');
  const index = pages.findIndex((p) => p.slug === normalized);
  if (index === -1) {
    return { prev: null, next: null };
  }
  return {
    prev: index > 0 ? { title: pages[index - 1].title, slug: pages[index - 1].slug } : null,
    next: index < pages.length - 1 ? { title: pages[index + 1].title, slug: pages[index + 1].slug } : null,
  };
}


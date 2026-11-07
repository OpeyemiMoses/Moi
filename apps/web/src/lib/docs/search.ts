import { getAllDocPages, getAllDocGroups } from './data';
import { pageToPlainText } from './utils';

export interface SearchResult {
  slug: string;
  title: string;
  description: string;
  groupLabel: string;
  snippet: string;
  score: number;
}

interface IndexedDoc {
  slug: string;
  title: string;
  description: string;
  groupLabel: string;
  plainText: string;
}

let searchIndex: IndexedDoc[] | null = null;

function getSearchIndex(): IndexedDoc[] {
  if (searchIndex) return searchIndex;

  const groups = getAllDocGroups();
  const index: IndexedDoc[] = [];

  for (const group of groups) {
    for (const page of group.pages) {
      index.push({
        slug: page.slug,
        title: page.title,
        description: page.description,
        groupLabel: group.label,
        plainText: pageToPlainText(page).toLowerCase(),
      });
    }
  }

  searchIndex = index;
  return searchIndex;
}

export function searchDocs(query: string, limit = 8): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const index = getSearchIndex();
  const terms = q.split(/\s+/).filter(Boolean);
  const results: SearchResult[] = [];

  for (const doc of index) {
    let score = 0;
    const titleLower = doc.title.toLowerCase();
    const descLower = doc.description.toLowerCase();

    // Exact phrase match bonus
    if (titleLower.includes(q)) score += 50;
    if (descLower.includes(q)) score += 25;
    if (doc.plainText.includes(q)) score += 10;

    // Term match scoring
    let allTermsMatch = true;
    for (const term of terms) {
      if (titleLower.includes(term)) {
        score += 15;
      } else if (descLower.includes(term)) {
        score += 8;
      } else if (doc.plainText.includes(term)) {
        score += 3;
      } else {
        allTermsMatch = false;
      }
    }

    if (allTermsMatch || score >= 10) {
      // Generate excerpt snippet around match
      let snippet = doc.description;
      const matchIdx = doc.plainText.indexOf(terms[0]);
      if (matchIdx !== -1) {
        const start = Math.max(0, matchIdx - 40);
        const end = Math.min(doc.plainText.length, matchIdx + 120);
        snippet = (start > 0 ? '...' : '') + doc.plainText.slice(start, end).trim() + '...';
      }

      results.push({
        slug: doc.slug,
        title: doc.title,
        description: doc.description,
        groupLabel: doc.groupLabel,
        snippet,
        score,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

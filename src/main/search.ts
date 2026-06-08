import { DocDatabase } from './db';
import { SearchQuery, SearchResult } from '../shared/types';

export function searchFiles(db: DocDatabase, query: SearchQuery): { results: SearchResult[]; total: number } {
  const { results, total } = db.searchFts(
    query.query,
    query.categoryId,
    query.dateFrom,
    query.dateTo,
    query.page || 1,
    query.pageSize || 20
  );

  const searchResults: SearchResult[] = results.map((r: any) => ({
    fileId: r.file_id,
    name: r.name,
    path: r.path,
    ext: r.ext,
    size: r.size,
    modifiedAt: r.modified_at,
    categoryName: r.category_name,
    snippet: r.snippet_content || '',
    highlights: extractHighlights(r.snippet_content || ''),
  }));

  return { results: searchResults, total };
}

function extractHighlights(snippet: string): string[] {
  const matches = snippet.match(/<mark>(.*?)<\/mark>/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/<\/?mark>/g, '')))];
}

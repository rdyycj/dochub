import React, { useState } from 'react';
import SearchBar from '../components/SearchBar';
import { useSearch } from '../hooks/useIPC';
import { SearchResult } from '../../shared/types';

function highlightHtml(text: string): string {
  return text.replace(/<mark>/g, '<mark class="bg-yellow-200">');
}

const SearchPage: React.FC = () => {
  const { results, total, loading, doSearch } = useSearch();
  const [query, setQuery] = useState('');

  const handleSearch = (q: string) => {
    setQuery(q);
    doSearch({ query: q, page: 1, pageSize: 20 });
  };

  return (
    <div className="flex flex-col h-full">
      <SearchBar onSearch={handleSearch} />
      <div className="flex-1 overflow-y-auto p-4">
        {loading && <div className="text-gray-400 text-center py-8">搜索中…</div>}

        {!loading && total > 0 && (
          <>
            <div className="text-sm text-gray-500 mb-4">找到 {total} 个结果</div>
            {results.map((r: SearchResult) => (
              <div key={r.fileId} className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{r.name}</span>
                  {r.categoryName && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{r.categoryName}</span>
                  )}
                  <span className="text-xs text-gray-400">{r.path}</span>
                </div>
                <div
                  className="text-sm text-gray-600"
                  dangerouslySetInnerHTML={{ __html: highlightHtml(r.snippet) }}
                />
              </div>
            ))}
          </>
        )}

        {!loading && query && total === 0 && (
          <div className="text-center text-gray-400 py-8">未找到匹配「{query}」的文件</div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;

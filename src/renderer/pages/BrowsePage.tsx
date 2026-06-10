import React, { useState } from 'react';
import FileList from '../components/FileList';
import SearchBar from '../components/SearchBar';
import { useFiles, useSearch } from '../hooks/useIPC';
import { SearchResult } from '../../shared/types';

function highlightHtml(text: string): string {
  return text.replace(/<mark>/g, '<mark class="bg-slate-200">');
}

interface Props {
  selectedCategory: number | null | undefined;
  onCategorySelect: (id: number | null) => void;
}

const BrowsePage: React.FC<Props> = ({ selectedCategory, onCategorySelect }) => {
  const [page] = useState(1);
  const { files, total: fileTotal } = useFiles(selectedCategory, page);
  const { results, total: searchTotal, loading, doSearch } = useSearch();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (q: string) => {
    setQuery(q);
    setSelected(null);
    setIsSearching(true);
    doSearch({ query: q, page: 1, pageSize: 20 });
  };

  const handleClear = () => {
    setQuery('');
    setSelected(null);
    setIsSearching(false);
  };

  return (
    <div className="flex flex-col h-full">
      <SearchBar
        onSearch={handleSearch}
        onClear={handleClear}
        placeholder="搜索文件内容…"
      />

      {/* Search mode */}
      {isSearching && (
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="text-slate-400 text-center py-8 text-sm">搜索中…</div>
          )}

          {!loading && searchTotal > 0 && (
            <>
              <div className="text-xs text-slate-400 mb-3">
                找到 {searchTotal.toLocaleString()} 个结果
              </div>
              {results.map((r: SearchResult) => (
                <div
                  key={r.fileId}
                  className={`mb-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selected?.fileId === r.fileId
                      ? 'bg-slate-50 border-slate-300 border-l-2 border-l-slate-600'
                      : 'bg-white border-slate-200 hover:bg-slate-50 border-l-2 border-l-transparent'
                  }`}
                  onClick={() => setSelected(r)}
                  onDoubleClick={async () => {
                    const result: any = await window.docHub.openFile(r.path);
                    if (!result.success) alert('无法打开文件: ' + result.error);
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{r.name}</span>
                    {r.categoryName && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                        {r.categoryName}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400 truncate">{r.path}</span>
                  </div>
                  <div
                    className="text-xs text-slate-500"
                    dangerouslySetInnerHTML={{ __html: highlightHtml(r.snippet) }}
                  />
                </div>
              ))}
            </>
          )}

          {!loading && query && searchTotal === 0 && (
            <div className="text-center text-slate-400 py-8 text-sm">
              未找到匹配「{query}」的文件
            </div>
          )}
        </div>
      )}

      {/* Browse mode */}
      {!isSearching && (
        <FileList files={files} total={fileTotal} />
      )}
    </div>
  );
};

export default BrowsePage;

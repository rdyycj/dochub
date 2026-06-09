import React, { useState } from 'react';
import SearchBar from '../components/SearchBar';
import { useSearch } from '../hooks/useIPC';
import { SearchResult } from '../../shared/types';

function highlightHtml(text: string): string {
  return text.replace(/<mark>/g, '<mark class="bg-yellow-200">');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

const SearchPage: React.FC = () => {
  const { results, total, loading, doSearch } = useSearch();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SearchResult | null>(null);

  const handleSearch = (q: string) => {
    setQuery(q);
    setSelected(null);
    doSearch({ query: q, page: 1, pageSize: 20 });
  };

  const handleOpen = async () => {
    if (!selected) return;
    const r: any = await window.docHub.openFile(selected.path);
    if (!r.success) alert('无法打开文件: ' + r.error);
  };

  const handleExport = async () => {
    if (!selected) return;
    const r: any = await window.docHub.exportFile(selected.path);
    if (r.success) {
      alert('已导出到: ' + r.destPath);
    } else if (!r.canceled) {
      alert('导出失败: ' + r.error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <SearchBar onSearch={handleSearch} />
      <div className="flex-1 flex overflow-hidden">
        {/* Results list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && <div className="text-gray-400 text-center py-8">搜索中…</div>}

          {!loading && total > 0 && (
            <>
              <div className="text-sm text-gray-500 mb-4">找到 {total} 个结果</div>
              {results.map((r: SearchResult) => (
                <div
                  key={r.fileId}
                  className={`mb-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selected?.fileId === r.fileId
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setSelected(r)}
                >
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

        {/* Detail panel */}
        {selected && (
          <div className="w-72 border-l border-gray-200 bg-white p-4 overflow-y-auto shrink-0">
            <h3 className="font-medium text-lg mb-3 truncate" title={selected.name}>
              {selected.name}
            </h3>
            <div className="space-y-2 text-sm text-gray-600 mb-4">
              <div>
                <span className="text-xs text-gray-400">路径</span>
                <p className="text-xs font-mono break-all mt-0.5">{selected.path}</p>
              </div>
              <div>
                <span className="text-xs text-gray-400">大小</span>
                <p>{formatSize(selected.size)}</p>
              </div>
              <div>
                <span className="text-xs text-gray-400">修改时间</span>
                <p>{formatDate(selected.modifiedAt)}</p>
              </div>
              <div>
                <span className="text-xs text-gray-400">类型</span>
                <p>{selected.ext}</p>
              </div>
              {selected.categoryName && (
                <div>
                  <span className="text-xs text-gray-400">分类</span>
                  <p>{selected.categoryName}</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <button
                className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                onClick={handleOpen}
              >
                📂 打开文件
              </button>
              <button
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                onClick={handleExport}
              >
                💾 导出到...
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;

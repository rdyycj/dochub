import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FileInfo } from '../../shared/types';
import { formatSize, formatDate, extIcon } from '../utils/format';
import Icon from './Icon';

interface Props {
  files: FileInfo[];
  total: number;
  loading?: boolean;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
}

const ROW_HEIGHT = 28;
const OVERSCAN = 10;

const FileList: React.FC<Props> = ({ files, total, loading, page = 1, pageSize = 200, onPageChange }) => {
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setContainerHeight(e.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleOpen = async (file: FileInfo) => {
    const result: any = await window.docHub.openFile(file.path);
    if (!result.success) alert(`无法打开文件: ${result.error}`);
  };

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Virtual scroll calculations
  const { visibleFiles, totalHeight, offsetY } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(files.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN);
    return {
      visibleFiles: files.slice(start, end),
      totalHeight: files.length * ROW_HEIGHT,
      offsetY: start * ROW_HEIGHT,
    };
  }, [files, scrollTop, containerHeight]);

  const totalPages = Math.ceil(total / pageSize);

  if (loading && files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        加载中…
      </div>
    );
  }

  if (!loading && files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        暂无文件
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* Header */}
      <div className="flex items-center px-4 py-2 text-[11px] text-slate-400 uppercase tracking-wide border-b border-slate-200 shrink-0 font-semibold select-none">
        <span className="flex-1">文件名</span>
        <span className="w-[70px] text-right">大小</span>
        <span className="w-[90px] text-right">日期</span>
        <span className="w-[80px] pl-2">状态</span>
      </div>

      {/* Virtual scroll container */}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto" onScroll={handleScroll}>
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>
            {visibleFiles.map((file) => (
              <div
                key={file.id}
                style={{ height: ROW_HEIGHT }}
                className={`flex items-center px-4 text-[12px] border-b border-slate-100 cursor-pointer transition-colors duration-150 ${
                  selectedFile?.id === file.id
                    ? 'bg-slate-50 border-l-2 border-l-slate-600'
                    : 'border-l-2 border-l-transparent hover:bg-slate-50'
                }`}
                onClick={() => setSelectedFile(file)}
                onDoubleClick={() => handleOpen(file)}
              >
                <span className="flex-1 flex items-center gap-2 truncate">
                  <Icon name={extIcon(file.ext) as any} size={14} className="text-slate-400 shrink-0" />
                  <span className="truncate">{file.name}</span>
                </span>
                <span className="w-[70px] text-right text-slate-400 shrink-0">{formatSize(file.size)}</span>
                <span className="w-[90px] text-right text-slate-400 shrink-0">{formatDate(file.modifiedAt)}</span>
                <span className="w-[80px] pl-2 shrink-0">
                  {file.status === 'parsed' && (
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">已索引</span>
                  )}
                  {file.status === 'pending' && (
                    <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">待处理</span>
                  )}
                  {file.status === 'error' && (
                    <span className="text-[10px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded-full">失败</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-1.5 text-[11px] text-slate-400 border-t border-slate-100 shrink-0 select-none">
        <span>共 {total.toLocaleString()} 个文件</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button className="px-2 py-0.5 rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer transition-colors" disabled={page <= 1} onClick={() => onPageChange?.(1)}>首页</button>
            <button className="px-2 py-0.5 rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer transition-colors" disabled={page <= 1} onClick={() => onPageChange?.(page - 1)}>上一页</button>
            <span className="px-1">{page} / {totalPages}</span>
            <button className="px-2 py-0.5 rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer transition-colors" disabled={page >= totalPages} onClick={() => onPageChange?.(page + 1)}>下一页</button>
            <button className="px-2 py-0.5 rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer transition-colors" disabled={page >= totalPages} onClick={() => onPageChange?.(totalPages)}>末页</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileList;

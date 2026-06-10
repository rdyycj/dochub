import React, { useState } from 'react';
import { FileInfo } from '../../shared/types';
import Icon from './Icon';

interface Props {
  files: FileInfo[];
  total: number;
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

function extIcon(ext: string): string {
  const map: Record<string, string> = {
    '.docx': 'file-text', '.doc': 'file-text',
    '.pdf': 'clipboard',
    '.xlsx': 'chart', '.xls': 'chart', '.csv': 'chart',
    '.pptx': 'play',
    '.txt': 'file-text',
    '.jpg': 'image', '.png': 'image',
    '.zip': 'archive',
  };
  return map[ext] || 'file';
}

const FileList: React.FC<Props> = ({ files, total }) => {
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);

  const handleDoubleClick = async (file: FileInfo) => {
    const result: any = await window.docHub.openFile(file.path);
    if (!result.success) alert(`无法打开文件: ${result.error}`);
  };

  if (files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        暂无文件
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Table header */}
      <div className="flex items-center px-4 py-2 text-[11px] text-slate-400 uppercase tracking-wide border-b border-slate-200 bg-white shrink-0 font-semibold select-none">
        <span className="flex-1">文件名</span>
        <span className="w-[70px] text-right">大小</span>
        <span className="w-[90px] text-right">日期</span>
        <span className="w-[80px] pl-2">状态</span>
      </div>

      {/* Table body */}
      <div className="flex-1 overflow-y-auto bg-white">
        {files.map((file) => (
          <div
            key={file.id}
            className={`flex items-center px-4 py-1.5 text-[12px] border-b border-slate-100 cursor-pointer transition-colors duration-150 ${
              selectedFile?.id === file.id
                ? 'bg-slate-50 border-l-2 border-l-slate-600 pl-3.5'
                : 'border-l-2 border-l-transparent hover:bg-slate-50'
            }`}
            onClick={() => setSelectedFile(file)}
            onDoubleClick={() => handleDoubleClick(file)}
          >
            <span className="flex-1 flex items-center gap-2 truncate">
              <Icon name={extIcon(file.ext) as any} size={14} className="text-slate-400 shrink-0" />
              <span className="truncate">{file.name}</span>
            </span>
            <span className="w-[70px] text-right text-slate-400 shrink-0">
              {formatSize(file.size)}
            </span>
            <span className="w-[90px] text-right text-slate-400 shrink-0">
              {formatDate(file.modifiedAt)}
            </span>
            <span className="w-[80px] pl-2 shrink-0">
              {file.status === 'parsed' && (
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                  已索引
                </span>
              )}
              {file.status === 'pending' && (
                <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">
                  待处理
                </span>
              )}
              {file.status === 'error' && (
                <span className="text-[10px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded-full">
                  失败
                </span>
              )}
            </span>
          </div>
        ))}
        <div className="px-4 py-2 text-[11px] text-slate-400">
          共 {total.toLocaleString()} 个文件
        </div>
      </div>
    </div>
  );
};

export default FileList;

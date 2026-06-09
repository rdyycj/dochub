import React, { useState } from 'react';
import { FileInfo } from '../../shared/types';

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

const FileList: React.FC<Props> = ({ files, total }) => {
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);

  const handleOpen = async () => {
    if (!selectedFile) return;
    const result: any = await window.docHub.openFile(selectedFile.path);
    if (!result.success) alert(`无法打开文件: ${result.error}`);
  };

  const handleExport = async () => {
    if (!selectedFile) return;
    const result: any = await window.docHub.exportFile(selectedFile.path);
    if (result.success) {
      alert(`已导出到: ${result.destPath}`);
    } else if (!result.canceled) {
      alert(`导出失败: ${result.error}`);
    }
  };

  if (files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        暂无文件
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* File table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500 sticky top-0 bg-white">
              <th className="px-4 py-2 font-normal">文件名</th>
              <th className="px-4 py-2 font-normal w-24">大小</th>
              <th className="px-4 py-2 font-normal w-28">修改时间</th>
              <th className="px-4 py-2 font-normal w-16">状态</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr
                key={file.id}
                className={`border-b border-gray-100 cursor-pointer transition-colors ${
                  selectedFile?.id === file.id
                    ? 'bg-blue-50 hover:bg-blue-100'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedFile(file)}
              >
                <td className="px-4 py-2">{file.name}</td>
                <td className="px-4 py-2 text-gray-500">{formatSize(file.size)}</td>
                <td className="px-4 py-2 text-gray-500">{formatDate(file.modifiedAt)}</td>
                <td className="px-4 py-2">
                  {file.status === 'parsed' && <span className="text-green-600">✓</span>}
                  {file.status === 'pending' && <span className="text-yellow-600">⏳</span>}
                  {file.status === 'error' && <span className="text-red-600">✗</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 text-xs text-gray-400">共 {total} 个文件</div>
      </div>

      {/* Detail panel */}
      {selectedFile && (
        <div className="w-72 border-l border-gray-200 bg-white p-4 overflow-y-auto shrink-0">
          <h3 className="font-medium text-lg mb-3 truncate" title={selectedFile.name}>
            {selectedFile.name}
          </h3>

          <div className="space-y-2 text-sm text-gray-600 mb-4">
            <div>
              <span className="text-xs text-gray-400">路径</span>
              <p className="text-xs font-mono break-all mt-0.5">{selectedFile.path}</p>
            </div>
            <div>
              <span className="text-xs text-gray-400">大小</span>
              <p>{formatSize(selectedFile.size)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-400">修改时间</span>
              <p>{formatDate(selectedFile.modifiedAt)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-400">类型</span>
              <p>{selectedFile.ext}</p>
            </div>
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
  );
};

export default FileList;

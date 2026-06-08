import React from 'react';
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
  if (files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        暂无文件
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-2 font-normal">文件名</th>
            <th className="px-4 py-2 font-normal w-24">大小</th>
            <th className="px-4 py-2 font-normal w-28">修改时间</th>
            <th className="px-4 py-2 font-normal w-16">状态</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.id} className="border-b border-gray-100 hover:bg-gray-50">
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
  );
};

export default FileList;

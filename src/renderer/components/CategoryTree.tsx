import React from 'react';
import { useCategories } from '../hooks/useIPC';
import { Category } from '../../../shared/types';

interface Props {
  selectedId: number | null | undefined;
  onSelect: (id: number | null) => void;
}

const CategoryTree: React.FC<Props> = ({ selectedId, onSelect }) => {
  const { categories } = useCategories();

  const buildTree = (cats: Category[], parentId: number | null): Category[] =>
    cats
      .filter((c) => c.parentId === parentId)
      .map((c) => ({ ...c, children: buildTree(cats, c.id) }));

  const tree = buildTree(categories, null);

  const renderNode = (node: Category, depth: number) => (
    <React.Fragment key={node.id}>
      <div
        className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded text-sm hover:bg-gray-100 ${
          selectedId === node.id ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => onSelect(node.id)}
      >
        <span>{node.icon === 'file-contract' ? '📄' : node.icon === 'receipt' ? '🧾' :
                node.icon === 'chart-bar' ? '📊' : node.icon === 'user' ? '👤' :
                node.icon === 'code' ? '⚙️' : node.icon === 'gavel' ? '📋' : '📁'}</span>
        <span>{node.name}</span>
      </div>
      {node.children?.map((child) => renderNode(child, depth + 1))}
    </React.Fragment>
  );

  return (
    <div className="w-56 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">分类目录</h2>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded text-sm hover:bg-gray-100 ${
            selectedId === undefined ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
          }`}
          onClick={() => onSelect(undefined as any)}
        >
          <span>📂</span>
          <span>全部文件</span>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded text-sm hover:bg-gray-100 ${
            selectedId === null ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
          }`}
          onClick={() => onSelect(null)}
        >
          <span>📭</span>
          <span>未分类</span>
        </div>
        {tree.map((node) => renderNode(node, 0))}
      </div>
    </div>
  );
};

export default CategoryTree;

import React from 'react';
import { useCategories } from '../hooks/useIPC';
import { Category } from '../../shared/types';
import Icon from './Icon';

interface Props {
  selectedId: number | null | undefined;
  onSelect: (id: number | null) => void;
}

const iconMap: Record<string, string> = {
  'file-contract': 'file-text',
  'receipt': 'receipt',
  'chart-bar': 'chart',
  'user': 'users',
  'code': 'code',
  'gavel': 'shield',
};

const CategoryTree: React.FC<Props> = ({ selectedId, onSelect }) => {
  const { categories } = useCategories();

  const buildTree = (cats: Category[], parentId: number | null): Category[] =>
    cats
      .filter((c) => c.parentId === parentId)
      .map((c) => ({ ...c, children: buildTree(cats, c.id) }));

  const tree = buildTree(categories, null);

  const baseClass = (active: boolean) =>
    `flex items-center gap-2 px-2 py-1 rounded text-[12px] cursor-pointer transition-colors duration-200 ${
      active
        ? 'bg-slate-700 text-white'
        : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
    }`;

  const renderNode = (node: Category, depth: number) => (
    <React.Fragment key={node.id}>
      <div
        className={baseClass(selectedId === node.id)}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onSelect(node.id)}
      >
        <Icon name={(iconMap[node.icon] || 'folder') as any} size={14} className="shrink-0" />
        <span className="flex-1 truncate">{node.name}</span>
      </div>
      {node.children?.map((child) => renderNode(child, depth + 1))}
    </React.Fragment>
  );

  return (
    <div className="py-0.5">
      <div
        className={baseClass(selectedId === undefined)}
        onClick={() => onSelect(undefined as any)}
      >
        <Icon name="folder-open" size={14} className="shrink-0" />
        <span className="flex-1">全部文件</span>
      </div>
      <div
        className={baseClass(selectedId === null)}
        onClick={() => onSelect(null)}
      >
        <Icon name="inbox" size={14} className="shrink-0" />
        <span className="flex-1">未分类</span>
      </div>
      {tree.map((node) => renderNode(node, 0))}
    </div>
  );
};

export default CategoryTree;

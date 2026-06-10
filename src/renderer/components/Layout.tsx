import React from 'react';
import CategoryTree from './CategoryTree';
import Icon from './Icon';
import { useStatus } from '../hooks/useIPC';

interface Props {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  selectedCategory: number | null | undefined;
  onCategorySelect: (id: number | null) => void;
}

const tabs = [
  { id: 'browse', label: '文件浏览', icon: 'folder-open' as const },
  { id: 'settings', label: '设置', icon: 'settings' as const },
];

const Layout: React.FC<Props> = ({
  children,
  activeTab,
  onTabChange,
  selectedCategory,
  onCategorySelect,
}) => {
  const status = useStatus();

  return (
    <div className="h-screen flex">
      {/* Dark sidebar */}
      <div className="w-[220px] bg-slate-800 text-slate-300 flex flex-col shrink-0 select-none">
        {/* Logo */}
        <div className="px-4 py-4 flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-slate-600 flex items-center justify-center">
            <Icon name="inbox" size={14} className="text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight">DocHub</span>
        </div>

        {/* Navigation */}
        <div className="px-3 mt-2">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 px-2">
            导航
          </div>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-[13px] rounded-md mb-0.5 transition-colors duration-200 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
              }`}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon name={tab.icon} size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Category tree — only show on browse page */}
        {activeTab !== 'settings' && (
          <div className="mt-4 border-t border-slate-700/50 flex-1 flex flex-col min-h-0">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 px-5 pt-3">
              分类目录
            </div>
            <div className="flex-1 overflow-y-auto px-3">
              <CategoryTree
                selectedId={selectedCategory}
                onSelect={onCategorySelect}
              />
            </div>
          </div>
        )}

        {/* Status footer */}
        <div className="border-t border-slate-700/50 px-4 py-2.5 text-[11px] text-slate-500 space-y-0.5">
          <div>已索引 {status.indexed.toLocaleString()}</div>
          <div>待处理 {status.pending.toLocaleString()}</div>
          {status.error > 0 && (
            <div className="text-red-400">出错 {status.error.toLocaleString()}</div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {children}
      </div>
    </div>
  );
};

export default Layout;

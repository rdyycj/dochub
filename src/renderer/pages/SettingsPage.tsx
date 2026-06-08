import React, { useState } from 'react';
import { useCategories } from '../hooks/useIPC';
import RuleEditor from '../components/RuleEditor';
import { Category } from '../../shared/types';

const SettingsPage: React.FC = () => {
  const { categories, refresh } = useCategories();
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [watchDirs, setWatchDirs] = useState('');

  const handleSaveRule = async (keywords: string[]) => {
    if (!selectedCat) return;
    const rules = keywords.map((kw) => ({
      field: 'both' as const,
      operator: 'contains' as const,
      value: [kw],
      weight: 1,
      enabled: true,
    }));
    await window.docHub.saveRules(selectedCat.id, rules);
    alert('规则已保存');
    refresh();
  };

  const handleWatchDirs = async () => {
    const dirs = watchDirs.split(/[;\n]+/).map((d) => d.trim()).filter(Boolean);
    if (dirs.length > 0) {
      await window.docHub.startWatch(dirs);
      alert(`已开始监控 ${dirs.length} 个目录`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-xl font-bold mb-6">设置</h2>

      {/* Watch directories */}
      <section className="mb-8">
        <h3 className="font-medium mb-2">监控目录</h3>
        <p className="text-xs text-gray-500 mb-2">每个目录一行，或用分号分隔</p>
        <textarea
          className="w-96 h-20 px-3 py-2 border rounded text-sm"
          placeholder="C:\Users\xxx\OneDrive\共享文档"
          value={watchDirs}
          onChange={(e) => setWatchDirs(e.target.value)}
        />
        <br />
        <button
          className="mt-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          onClick={handleWatchDirs}
        >
          开始监控
        </button>
      </section>

      {/* Categories & Rules */}
      <section>
        <h3 className="font-medium mb-2">分类规则管理</h3>
        <div className="flex gap-4">
          <div className="w-48">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={`px-3 py-1.5 cursor-pointer rounded text-sm ${
                  selectedCat?.id === cat.id ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
                }`}
                onClick={() => setSelectedCat(cat)}
              >
                {cat.name}
              </div>
            ))}
          </div>
          <div className="flex-1">
            {selectedCat && (
              <RuleEditor
                categoryId={selectedCat.id}
                categoryName={selectedCat.name}
                initialKeywords={[]}
                onSave={handleSaveRule}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;

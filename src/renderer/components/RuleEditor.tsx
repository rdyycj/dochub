import React, { useState, useEffect } from 'react';

interface Props {
  categoryId: number;
  categoryName: string;
  initialKeywords: string[];
  onSave: (keywords: string[]) => void;
}

const RuleEditor: React.FC<Props> = ({ categoryId, categoryName, initialKeywords, onSave }) => {
  const [keywords, setKeywords] = useState(initialKeywords.join('、'));

  // Sync when switching categories (initialKeywords changes)
  useEffect(() => {
    setKeywords(initialKeywords.join('、'));
  }, [categoryId, initialKeywords]);

  const handleSave = () => {
    const kwList = keywords.split(/[、,\s]+/).filter(Boolean);
    onSave(kwList);
  };

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-lg">
      <h3 className="font-medium mb-2 text-sm">编辑「{categoryName}」规则</h3>
      <p className="text-xs text-slate-400 mb-2">
        关键词用顿号（、）、逗号或空格分隔。命中任一关键词即触发分类。
      </p>
      <textarea
        className="w-full h-24 px-3 py-2 border border-slate-200 rounded text-sm focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:border-transparent focus:outline-none"
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
      />
      <button
        className="mt-2 px-4 py-1.5 bg-slate-600 text-white text-sm rounded hover:bg-slate-700 transition-colors"
        onClick={handleSave}
      >
        保存规则
      </button>
    </div>
  );
};

export default RuleEditor;

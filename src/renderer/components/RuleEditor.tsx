import React, { useState } from 'react';

interface Props {
  categoryId: number;
  categoryName: string;
  initialKeywords: string[];
  onSave: (keywords: string[]) => void;
}

const RuleEditor: React.FC<Props> = ({ categoryId, categoryName, initialKeywords, onSave }) => {
  const [keywords, setKeywords] = useState(initialKeywords.join('、'));

  const handleSave = () => {
    const kwList = keywords.split(/[、,\s]+/).filter(Boolean);
    onSave(kwList);
  };

  return (
    <div className="p-4 bg-white border rounded-lg">
      <h3 className="font-medium mb-2">编辑「{categoryName}」规则</h3>
      <p className="text-xs text-gray-500 mb-2">关键词用顿号（、）、逗号或空格分隔。命中任一关键词即触发分类。</p>
      <textarea
        className="w-full h-24 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
      />
      <button
        className="mt-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        onClick={handleSave}
      >
        保存规则
      </button>
    </div>
  );
};

export default RuleEditor;

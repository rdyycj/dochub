import React, { useState, useRef } from 'react';
import { useCategories } from '../hooks/useIPC';
import RuleEditor from '../components/RuleEditor';
import { Category } from '../../shared/types';

const SettingsPage: React.FC = () => {
  const { categories, refresh } = useCategories();
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [currentKeywords, setCurrentKeywords] = useState<string[]>([]);
  const [watchDirs, setWatchDirs] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleSelectCategory = async (cat: Category) => {
    setSelectedCat(cat);
    // Load existing rules for this category
    try {
      const rules: any[] = await window.docHub.getCategoryRules(cat.id);
      const keywords = rules.flatMap((r: any) => r.value || []);
      setCurrentKeywords(keywords);
    } catch {
      setCurrentKeywords([]);
    }
  };

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

    // Auto reclassify all files with new rules
    const result: any = await window.docHub.reclassifyAll();
    alert(`规则已保存。已将 ${result.changed} 个文件重新分类（共 ${result.total} 个文件）`);
    refresh();
  };

  const handleWatchDirs = async () => {
    const dirs = watchDirs.split(/[;\n]+/).map((d) => d.trim()).filter(Boolean);
    if (dirs.length > 0) {
      const merged: string[] = await window.docHub.startWatch(dirs);
      setWatchDirs(merged.join('\n'));
      alert(`已开始监控 ${merged.length} 个目录`);
    } else {
      alert('请先输入要监控的目录路径');
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setWatchDirs(prev => prev + (prev ? '\n' : '') + text);
    } catch {
      alert('无法读取剪贴板，请手动输入路径');
    }
  };

  const handleClear = () => {
    setWatchDirs('');
  };

  const addDirectory = (dirPath: string) => {
    const existing = watchDirs.split('\n').map(d => d.trim().toLowerCase());
    if (existing.includes(dirPath.toLowerCase())) return;
    setWatchDirs(prev => prev + (prev ? '\n' : '') + dirPath);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const realPath = window.docHub.getPathForFile(file);
        if (realPath) {
          addDirectory(realPath);
        }
      } catch {
        const f = file as any;
        if (f.path) addDirectory(f.path);
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-lg font-bold mb-6 text-slate-800">设置</h2>

      {/* Watch directories */}
      <section className="mb-8">
        <h3 className="font-medium text-sm mb-2 text-slate-700">监控目录</h3>
        <p className="text-xs text-slate-400 mb-2">
          拖拽文件夹到下方区域，或手动输入路径
        </p>

        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-lg transition-colors ${
            isDragging
              ? 'border-slate-400 bg-slate-50'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <textarea
            className="w-full h-32 px-3 py-2 border-0 rounded-lg text-sm font-mono bg-transparent resize-none focus:outline-none"
            placeholder="把文件夹拖到这里，或手动输入路径"
            value={watchDirs}
            onChange={(e) => setWatchDirs(e.target.value)}
          />
          {isDragging && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 rounded-lg pointer-events-none">
              <span className="text-slate-600 font-medium text-lg">
                📂 松开以添加文件夹
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-2">
          <button
            className="px-3 py-1.5 bg-slate-200 text-slate-700 text-sm rounded hover:bg-slate-300 transition-colors"
            onClick={handlePaste}
          >
            📋 粘贴路径
          </button>
          <button
            className="px-3 py-1.5 bg-slate-200 text-slate-700 text-sm rounded hover:bg-slate-300 transition-colors"
            onClick={handleClear}
          >
            ✕ 清空
          </button>
          <button
            className="px-4 py-1.5 bg-slate-600 text-white text-sm rounded hover:bg-slate-700 transition-colors"
            onClick={handleWatchDirs}
          >
            ▶ 开始监控
          </button>
        </div>
      </section>

      {/* Categories & Rules */}
      <section>
        <h3 className="font-medium text-sm mb-2 text-slate-700">分类规则管理</h3>
        <div className="flex gap-4">
          <div className="w-48">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={`px-3 py-1.5 cursor-pointer rounded text-sm transition-colors ${
                  selectedCat?.id === cat.id
                    ? 'bg-slate-100 text-slate-800 font-medium'
                    : 'hover:bg-slate-50 text-slate-600'
                }`}
                onClick={() => handleSelectCategory(cat)}
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
                initialKeywords={currentKeywords}
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

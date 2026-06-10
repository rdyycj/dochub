# DocHub UI 改版实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 DocHub 的 UI 从基础功能界面升级为深色侧栏 + 紧凑表格 + 石墨灰配色的现代专业风桌面应用。

**Architecture:** 重构 Layout 为左侧 220px 深色侧栏 + 右侧弹性内容区。侧栏集成导航、分类目录和状态信息。所有组件从 blue 色系迁移到 slate 色系。FileList 去掉右侧详情面板改为紧凑纯表格。

**Tech Stack:** React 19 + TypeScript + Tailwind CSS 3 (slate 色阶) + Vite 8

---

## 文件结构

```
修改:
  src/renderer/index.css                     — 全局背景 slate-50
  src/renderer/components/Layout.tsx          — 重构为深色侧栏布局（含状态）
  src/renderer/components/CategoryTree.tsx    — 融入侧栏暗色样式
  src/renderer/components/StatusBar.tsx       — 简化为纯数据 hook，UI 移入 Layout
  src/renderer/App.tsx                        — 适配新 Layout 接口
  src/renderer/components/SearchBar.tsx       — slate 色系
  src/renderer/components/FileList.tsx        — 紧凑表格，去详情面板
  src/renderer/components/RuleEditor.tsx      — slate 色系
  src/renderer/pages/BrowsePage.tsx           — 适配新布局
  src/renderer/pages/SearchPage.tsx           — slate 色系
  src/renderer/pages/SettingsPage.tsx         — slate 色系

不变:
  src/main/*, src/shared/*, src/renderer/hooks/*
  tailwind.config.js, vite.config.ts
```

---

### Task 1: 全局背景色

**Files:**
- Modify: `src/renderer/index.css:5-10`

- [ ] **Step 1: 修改全局背景**

将 `body` 背景从 `#f5f5f5` 改为 Tailwind slate-50 色值 `#f8fafc`：

```css
body {
  margin: 0;
  font-family: -apple-system, 'Microsoft YaHei', 'PingFang SC', sans-serif;
  background: #f8fafc;
  color: #1a1a1a;
}
```

- [ ] **Step 2: 验证**

```bash
cd /c/Users/Administrator/Desktop/doc-hub && npm run dev
```

打开 Electron 窗口，确认整体背景变为更浅的 slate-50 灰色。

- [ ] **Step 3: 提交**

```bash
git add src/renderer/index.css
git commit -m "style: 全局背景改为 slate-50"
```

---

### Task 2: 重构 Layout 为深色侧栏

**Files:**
- Modify: `src/renderer/components/Layout.tsx` (完全重写)

这是最大的结构变化。Layout 从"顶部导航栏 + 内容 + 底部状态栏"变为"左侧深色侧栏 + 右侧内容区"。侧栏集成所有导航和状态。

- [ ] **Step 1: 重写 Layout.tsx**

```tsx
import React from 'react';
import CategoryTree from './CategoryTree';
import { useStatus } from '../hooks/useIPC';

interface Props {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'browse', label: '文件浏览', icon: '📂' },
  { id: 'search', label: '全文搜索', icon: '🔍' },
  { id: 'settings', label: '设置', icon: '⚙️' },
];

const Layout: React.FC<Props> = ({ children, activeTab, onTabChange }) => {
  const status = useStatus();

  return (
    <div className="h-screen flex">
      {/* Dark sidebar */}
      <div className="w-[220px] bg-slate-800 text-slate-300 flex flex-col shrink-0 select-none">
        {/* Logo */}
        <div className="px-4 py-4 flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-slate-600 flex items-center justify-center text-xs font-bold text-white">
            D
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
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-[13px] rounded-md mb-0.5 transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
              }`}
              onClick={() => onTabChange(tab.id)}
            >
              <span className="text-xs w-4 text-center">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Category tree */}
        <div className="mt-4 border-t border-slate-700/50 flex-1 flex flex-col min-h-0">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 px-5 pt-3">
            分类目录
          </div>
          <div className="flex-1 overflow-y-auto px-3">
            <CategoryTree
              selectedId={undefined}
              onSelect={() => {}}
            />
          </div>
        </div>

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
```

- [ ] **Step 2: 验证**

重启 dev server，确认侧栏显示正常：Logo、导航三个标签、分类目录区域、底部状态信息。

- [ ] **Step 3: 提交**

```bash
git add src/renderer/components/Layout.tsx
git commit -m "feat: Layout 重构为深色侧栏布局"
```

---

### Task 3: 融入 CategoryTree 到侧栏

**Files:**
- Modify: `src/renderer/components/CategoryTree.tsx`

CategoryTree 从独立白色面板改为暗色侧栏内的列表项样式。

- [ ] **Step 1: 重写 CategoryTree.tsx**

```tsx
import React from 'react';
import { useCategories } from '../hooks/useIPC';
import { Category } from '../../shared/types';

interface Props {
  selectedId: number | null | undefined;
  onSelect: (id: number | null) => void;
}

const CategoryTree: React.FC<Props> = ({ selectedId, onSelect }) => {
  const { categories } = useCategories();

  const iconMap: Record<string, string> = {
    'file-contract': '📄',
    'receipt': '🧾',
    'chart-bar': '📊',
    'user': '👤',
    'code': '⚙️',
    'gavel': '📋',
  };

  const buildTree = (cats: Category[], parentId: number | null): (Category & { children: Category[] })[] =>
    cats
      .filter((c) => c.parentId === parentId)
      .map((c) => ({ ...c, children: buildTree(cats, c.id) }));

  const tree = buildTree(categories, null);

  const baseClass = (active: boolean) =>
    `flex items-center gap-2 px-2 py-1 rounded text-[12px] cursor-pointer transition-colors ${
      active
        ? 'bg-slate-700 text-white'
        : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
    }`;

  const renderNode = (node: Category & { children: Category[] }, depth: number) => (
    <React.Fragment key={node.id}>
      <div
        className={baseClass(selectedId === node.id)}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onSelect(node.id)}
      >
        <span className="text-xs w-4 text-center">
          {iconMap[node.icon] || '📁'}
        </span>
        <span className="flex-1 truncate">{node.name}</span>
      </div>
      {node.children.map((child) => renderNode(child, depth + 1))}
    </React.Fragment>
  );

  return (
    <div className="py-0.5">
      <div
        className={baseClass(selectedId === undefined)}
        onClick={() => onSelect(undefined as any)}
      >
        <span className="text-xs w-4 text-center">📂</span>
        <span className="flex-1">全部文件</span>
      </div>
      <div
        className={baseClass(selectedId === null)}
        onClick={() => onSelect(null)}
      >
        <span className="text-xs w-4 text-center">📭</span>
        <span className="flex-1">未分类</span>
      </div>
      {tree.map((node) => renderNode(node, 0))}
    </div>
  );
};

export default CategoryTree;
```

- [ ] **Step 2: 验证**

重启 dev server，确认分类目录在深色侧栏中显示正常，选中态为 `bg-slate-700`。

- [ ] **Step 3: 提交**

```bash
git add src/renderer/components/CategoryTree.tsx
git commit -m "style: CategoryTree 融入深色侧栏样式"
```

---

### Task 4: 适配 App.tsx

**Files:**
- Modify: `src/renderer/App.tsx`

App 需要将 selectedCategory 状态提升，以便 Layout 侧栏内的 CategoryTree 和 BrowsePage 内容区共享选中分类。Layout 自身现在通过 useStatus 获取状态。

- [ ] **Step 1: 重写 App.tsx**

```tsx
import React, { useState } from 'react';
import Layout from './components/Layout';
import BrowsePage from './pages/BrowsePage';
import SearchPage from './pages/SearchPage';
import SettingsPage from './pages/SettingsPage';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('browse');
  const [selectedCategory, setSelectedCategory] = useState<number | null | undefined>(undefined);

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={(tab) => {
        setActiveTab(tab);
        setSelectedCategory(undefined);
      }}
      selectedCategory={selectedCategory}
      onCategorySelect={setSelectedCategory}
    >
      {activeTab === 'browse' && (
        <BrowsePage
          selectedCategory={selectedCategory}
          onCategorySelect={setSelectedCategory}
        />
      )}
      {activeTab === 'search' && <SearchPage />}
      {activeTab === 'settings' && <SettingsPage />}
    </Layout>
  );
};

export default App;
```

- [ ] **Step 2: 更新 Layout.tsx 接口以接收 category props**

在 Layout.tsx 的 Props 中添加：

```tsx
interface Props {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  selectedCategory: number | null | undefined;
  onCategorySelect: (id: number | null) => void;
}
```

并将侧栏中的 CategoryTree 改为：

```tsx
<CategoryTree
  selectedId={selectedCategory}
  onSelect={onCategorySelect}
/>
```

- [ ] **Step 3: 更新 BrowsePage.tsx 接口**

```tsx
import React from 'react';
import FileList from '../components/FileList';
import SearchBar from '../components/SearchBar';
import { useFiles } from '../hooks/useIPC';

interface Props {
  selectedCategory: number | null | undefined;
  onCategorySelect: (id: number | null) => void;
}

const BrowsePage: React.FC<Props> = ({ selectedCategory, onCategorySelect }) => {
  const [page, setPage] = useState(1);
  const { files, total } = useFiles(selectedCategory, page);

  return (
    <div className="flex flex-col h-full">
      <SearchBar onSearch={(q) => window.docHub.search({ query: q })} />
      <FileList files={files} total={total} />
    </div>
  );
};

export default BrowsePage;
```

别忘了在文件顶部加上 `import React, { useState } from 'react';`

- [ ] **Step 4: 验证**

重启 dev server：
- 点击侧栏导航切换页面
- 点击分类目录过滤文件
- 确认"文件浏览"时分类目录可交互

- [ ] **Step 5: 提交**

```bash
git add src/renderer/App.tsx src/renderer/components/Layout.tsx src/renderer/pages/BrowsePage.tsx
git commit -m "feat: App 适配侧栏布局，分类状态提升"
```

---

### Task 5: SearchBar slate 色系

**Files:**
- Modify: `src/renderer/components/SearchBar.tsx`

将所有 blue-600 → slate-600, blue-400 → slate-400, border-gray-300 → border-slate-200。

- [ ] **Step 1: 修改 SearchBar.tsx 色系**

```tsx
import React, { useState } from 'react';

interface Props {
  onSearch: (query: string) => void;
}

const SearchBar: React.FC<Props> = ({ onSearch }) => {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSearch(value.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-slate-200">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="搜索文件内容…"
        className="flex-1 px-3 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
      />
      <button
        type="submit"
        className="px-4 py-1.5 bg-slate-600 text-white text-sm rounded hover:bg-slate-700 transition-colors"
      >
        搜索
      </button>
    </form>
  );
};

export default SearchBar;
```

- [ ] **Step 2: 验证**

重启 dev server，确认搜索栏输入框和按钮为 slate 色系，focus ring 为 slate-400。

- [ ] **Step 3: 提交**

```bash
git add src/renderer/components/SearchBar.tsx
git commit -m "style: SearchBar 迁移到 slate 色系"
```

---

### Task 6: FileList 紧凑表格

**Files:**
- Modify: `src/renderer/components/FileList.tsx`

去掉右侧详情面板，表格紧凑化，选中行左侧指示条，分类 pill badge。

- [ ] **Step 1: 重写 FileList.tsx**

```tsx
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

function extIcon(ext: string): string {
  const map: Record<string, string> = {
    '.docx': '📄', '.doc': '📄', '.pdf': '📋', '.xlsx': '📊',
    '.xls': '📊', '.csv': '📊', '.pptx': '📽️', '.txt': '📝',
    '.jpg': '🖼️', '.png': '🖼️', '.zip': '📦',
  };
  return map[ext] || '📄';
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
      <div className="flex items-center px-4 py-2 text-[11px] text-slate-400 uppercase tracking-wide border-b border-slate-200 bg-white shrink-0 font-semibold">
        <span className="flex-1">文件名</span>
        <span className="w-[70px] text-right">大小</span>
        <span className="w-[90px] text-right">日期</span>
        <span className="w-[80px] pl-2">分类</span>
      </div>

      {/* Table body */}
      <div className="flex-1 overflow-y-auto bg-white">
        {files.map((file) => (
          <div
            key={file.id}
            className={`flex items-center px-4 py-1.5 text-[12px] border-b border-slate-100 cursor-pointer transition-colors ${
              selectedFile?.id === file.id
                ? 'bg-slate-50 border-l-2 border-l-slate-600 pl-3.5'
                : 'border-l-2 border-l-transparent hover:bg-slate-50'
            }`}
            onClick={() => setSelectedFile(file)}
            onDoubleClick={() => handleDoubleClick(file)}
          >
            <span className="flex-1 flex items-center gap-2 truncate">
              <span className="text-xs shrink-0">{extIcon(file.ext)}</span>
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
                  ✓ 已索引
                </span>
              )}
              {file.status === 'pending' && (
                <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">
                  ⏳ 待处理
                </span>
              )}
              {file.status === 'error' && (
                <span className="text-[10px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded-full">
                  ✗ 失败
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
```

- [ ] **Step 2: 验证**

重启 dev server：
- 文件列表行高紧凑
- 单击选中行左边出现 slate-600 指示条
- 双击打开文件
- 状态列显示 pill badge
- 去掉了右侧详情面板

- [ ] **Step 3: 提交**

```bash
git add src/renderer/components/FileList.tsx
git commit -m "style: FileList 紧凑表格，去详情面板，slate 色系"
```

---

### Task 7: RuleEditor slate 色系

**Files:**
- Modify: `src/renderer/components/RuleEditor.tsx`

- [ ] **Step 1: 修改 RuleEditor 色系**

```tsx
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
    <div className="p-4 bg-white border border-slate-200 rounded-lg">
      <h3 className="font-medium mb-2 text-sm">编辑「{categoryName}」规则</h3>
      <p className="text-xs text-slate-400 mb-2">
        关键词用顿号（、）、逗号或空格分隔。命中任一关键词即触发分类。
      </p>
      <textarea
        className="w-full h-24 px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
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
```

- [ ] **Step 2: 验证**

重启 dev server，进入设置页，确认 RuleEditor 为 slate 色系。

- [ ] **Step 3: 提交**

```bash
git add src/renderer/components/RuleEditor.tsx
git commit -m "style: RuleEditor 迁移到 slate 色系"
```

---

### Task 8: SearchPage slate 色系

**Files:**
- Modify: `src/renderer/pages/SearchPage.tsx`

- [ ] **Step 1: 修改 SearchPage 色系**

```tsx
import React, { useState } from 'react';
import SearchBar from '../components/SearchBar';
import { useSearch } from '../hooks/useIPC';
import { SearchResult } from '../../shared/types';

function highlightHtml(text: string): string {
  return text.replace(/<mark>/g, '<mark class="bg-slate-200">');
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

const SearchPage: React.FC = () => {
  const { results, total, loading, doSearch } = useSearch();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SearchResult | null>(null);

  const handleSearch = (q: string) => {
    setQuery(q);
    setSelected(null);
    doSearch({ query: q, page: 1, pageSize: 20 });
  };

  const handleDoubleClick = async (r: SearchResult) => {
    const result: any = await window.docHub.openFile(r.path);
    if (!result.success) alert('无法打开文件: ' + result.error);
  };

  return (
    <div className="flex flex-col h-full">
      <SearchBar onSearch={handleSearch} />
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="text-slate-400 text-center py-8 text-sm">搜索中…</div>
        )}

        {!loading && total > 0 && (
          <>
            <div className="text-xs text-slate-400 mb-3">
              找到 {total.toLocaleString()} 个结果
            </div>
            {results.map((r: SearchResult) => (
              <div
                key={r.fileId}
                className={`mb-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selected?.fileId === r.fileId
                    ? 'bg-slate-50 border-slate-300 border-l-2 border-l-slate-600'
                    : 'bg-white border-slate-200 hover:bg-slate-50 border-l-2 border-l-transparent'
                }`}
                onClick={() => setSelected(r)}
                onDoubleClick={() => handleDoubleClick(r)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{r.name}</span>
                  {r.categoryName && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {r.categoryName}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400 truncate">{r.path}</span>
                </div>
                <div
                  className="text-xs text-slate-500"
                  dangerouslySetInnerHTML={{ __html: highlightHtml(r.snippet) }}
                />
              </div>
            ))}
          </>
        )}

        {!loading && query && total === 0 && (
          <div className="text-center text-slate-400 py-8 text-sm">
            未找到匹配「{query}」的文件
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
```

- [ ] **Step 2: 验证**

重启 dev server，进入全文搜索页，搜索一个关键词，确认结果卡片为 slate 色系，高亮为 slate-200。

- [ ] **Step 3: 提交**

```bash
git add src/renderer/pages/SearchPage.tsx
git commit -m "style: SearchPage 迁移到 slate 色系"
```

---

### Task 9: SettingsPage slate 色系

**Files:**
- Modify: `src/renderer/pages/SettingsPage.tsx`

将所有 blue-* → slate-*, gray-* → slate-*。

- [ ] **Step 1: 修改 SettingsPage 色系**

```tsx
import React, { useState, useRef } from 'react';
import { useCategories } from '../hooks/useIPC';
import RuleEditor from '../components/RuleEditor';
import { Category } from '../../shared/types';

const SettingsPage: React.FC = () => {
  const { categories, refresh } = useCategories();
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [watchDirs, setWatchDirs] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

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
```

- [ ] **Step 2: 验证**

重启 dev server，进入设置页：
- 监控目录拖拽区域为 slate 边框
- 按钮为 slate 色系
- 分类列表选中为 slate-100

- [ ] **Step 3: 提交**

```bash
git add src/renderer/pages/SettingsPage.tsx
git commit -m "style: SettingsPage 迁移到 slate 色系"
```

---

### Task 10: 清理 StatusBar

**Files:**
- Modify: `src/renderer/components/StatusBar.tsx` (删除内容，保留空导出或标记废弃)

由于状态信息已集成到 Layout 侧栏底部，StatusBar 组件不再使用。

- [ ] **Step 1: 从 App.tsx 移除 StatusBar 引用**

确认 App.tsx 不再 import StatusBar（已在 Task 4 处理）。

SearchPage.tsx 和 SettingsPage.tsx 也都不需要 StatusBar。

- [ ] **Step 2: 删除 StatusBar.tsx**

```bash
rm src/renderer/components/StatusBar.tsx
```

- [ ] **Step 3: 验证**

重启 dev server，确认所有页面无 StatusBar 引用错误。侧栏底部显示状态数据。

- [ ] **Step 4: 提交**

```bash
git rm src/renderer/components/StatusBar.tsx
git commit -m "refactor: 移除 StatusBar 组件，状态集成到 Layout 侧栏"
```

---

### Task 11: 最终验证与收尾

- [ ] **Step 1: 全面验证**

```bash
cd /c/Users/Administrator/Desktop/doc-hub && npm run dev
```

逐页检查：
1. **全局** — 背景 slate-50，无蓝色残留
2. **侧栏** — 深色背景，导航/分类/状态正常
3. **文件浏览** — 紧凑表格，选中指示条，双击打开
4. **全文搜索** — slate 色系结果卡片，高亮正常
5. **设置** — 拖拽区域、按钮、规则编辑器全 slate
6. **交互** — 分类切换、页面切换、文件选中均正常

- [ ] **Step 2: 搜索残留蓝色**

```bash
cd /c/Users/Administrator/Desktop/doc-hub && grep -r "blue-" src/renderer/ --include="*.tsx" --include="*.css" || echo "No blue found - clean!"
```

- [ ] **Step 3: 确认 TypeScript 编译无错误**

```bash
cd /c/Users/Administrator/Desktop/doc-hub && npx tsc -p tsconfig.renderer.json --noEmit 2>&1 | head -20
```

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "style: DocHub UI 全面改版 — 深色侧栏 + 紧凑表格 + slate 配色"
```

---

## 自检

- [x] **Spec 覆盖** — 11 个文件全部覆盖，配色方案的每种用途在对应组件中体现
- [x] **无 placeholder** — 所有代码完整可执行
- [x] **类型一致** — Props 接口在上下游组件中匹配（App → Layout → CategoryTree, App → BrowsePage）

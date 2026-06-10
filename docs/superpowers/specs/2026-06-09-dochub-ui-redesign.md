# DocHub UI 改版设计文档

**日期**: 2026-06-09
**版本**: 1.0
**状态**: 已确认

---

## 1. 设计目标

将 DocHub 从基础功能性界面升级为 **现代专业风** 桌面应用 UI，同时保持代码简洁、不引入额外依赖。

## 2. 设计决策

| 维度 | 决策 | 理由 |
|------|------|------|
| 风格 | 现代专业风 — 深色侧栏 + 浅色内容区 | 类似 VS Code / Notion，信息架构清晰 |
| 导航 | 侧栏一体式 | 导航、分类目录、状态信息统一在深色侧栏 |
| 文件视图 | 紧凑表格 | 用户文件量大（5000+），需要高信息密度 |
| 配色 | 石墨灰 (Slate) | 极致克制，让文件内容成为视觉焦点 |

## 3. 配色方案

| 用途 | Tailwind Class | 色值 |
|------|---------------|------|
| 侧栏背景 | `bg-slate-800` | #1e293b |
| 侧栏文字 | `text-slate-300` | #cbd5e1 |
| 侧栏选中 | `bg-slate-700` | #334155 |
| 内容区背景 | `bg-slate-50` | #f8fafc |
| 内容区卡片 | `bg-white` | #ffffff |
| 主按钮/选中 | `bg-slate-600` | #475569 |
| 主按钮悬停 | `bg-slate-700` | #334155 |
| 边框 | `border-slate-200` | #e2e8f0 |
| 次要文字 | `text-slate-400` | #94a3b8 |
| 分类标签 | `bg-slate-100 text-slate-600` | 浅灰底深灰字 |

不使用彩色系（蓝/绿/紫），所有交互元素统一 slate 色阶。

## 4. 布局结构

```
┌─────────────────────────────────────────────────┐
│ ┌──────────┐ ┌────────────────────────────────┐ │
│ │          │ │  搜索栏 (bg-white, sticky)      │ │
│ │  深色侧栏 │ ├────────────────────────────────┤ │
│ │  220px   │ │                                │ │
│ │          │ │  文件表格                        │ │
│ │ · Logo   │ │  (紧凑行高, 左侧选中指示条)       │ │
│ │ · 导航    │ │                                │ │
│ │ · 分类树  │ │  文件名 │ 大小 │ 日期 │ 分类标签  │ │
│ │ · 状态    │ │                                │ │
│ │          │ │                                │ │
│ └──────────┘ └────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

- 侧栏固定 220px 宽，flex-shrink: 0
- 内容区 flex-1，搜索栏 sticky top
- 表格行高紧凑（py-2），左侧 2px 指示条标记选中行
- 不再使用右侧详情面板（信息已在表格行和侧栏状态中充分展示）

## 5. 组件改造清单

### 5.1 Layout.tsx
- 去掉顶部导航栏
- 改为左侧深色侧栏 + 右侧内容区
- 侧栏包含：Logo、导航标签、分类目录、底部状态
- 侧栏导航项用 `bg-slate-700` 标记当前选中

### 5.2 CategoryTree.tsx
- 融入侧栏，去掉独立白色面板样式
- 分类项用 slate 色系，选中态用 `bg-slate-700`
- 显示每个分类的文件数量

### 5.3 FileList.tsx
- 去掉右侧详情面板
- 表格改为紧凑样式：小字号（12px）、窄行高
- 选中行左边 2px slate-600 指示条 + 浅灰背景
- 分类列用 pill badge（`bg-slate-100 text-slate-600 rounded-full text-[10px]`）
- 文件图标根据扩展名显示不同 emoji/图标

### 5.4 SearchBar.tsx
- 搜索按钮从 blue-600 改为 slate-600
- 输入框边框统一 slate-200
- focus ring 改为 slate-400

### 5.5 SearchPage.tsx
- 搜索结果列表用紧凑卡片，去掉蓝色高亮
- 选中态改为左边框 + 浅灰背景
- 搜索关键词高亮从 yellow-200 改为 slate-200

### 5.6 SettingsPage.tsx
- 按钮从 blue-600 改为 slate-600
- 拖拽区域选中态从 blue-50/blue-400 改为 slate-50/slate-400
- 分类列表选中从 blue-100 改为 slate-100

### 5.7 StatusBar.tsx
- 移除底部独立状态栏
- 状态信息移到侧栏底部（已索引/待处理数）

### 5.8 index.css
- 全局背景改为 `bg-slate-50`
- 保持字体栈不变

## 6. 不引入新依赖

- 继续使用 Tailwind CSS 内置色阶
- 不使用图标库（保持 emoji 图标）
- 不添加动画库

## 7. 不变更范围

- 不修改 Electron 主进程代码
- 不修改 IPC 通信层
- 不修改数据库/搜索/分类逻辑
- 不修改 shared/types.ts
- 不修改 hooks/useIPC.ts（数据层不变）
- 功能行为完全不变，仅视觉改造

## 8. 文件变更范围

```
修改:
  src/renderer/components/Layout.tsx      — 重构为侧栏布局
  src/renderer/components/CategoryTree.tsx — 融入侧栏样式
  src/renderer/components/FileList.tsx     — 紧凑表格，去详情面板
  src/renderer/components/SearchBar.tsx    — slate 色系
  src/renderer/components/StatusBar.tsx    — 移除（逻辑融入 Layout）
  src/renderer/components/RuleEditor.tsx   — slate 色系
  src/renderer/pages/BrowsePage.tsx        — 适配新布局
  src/renderer/pages/SearchPage.tsx        — slate 色系，紧凑结果
  src/renderer/pages/SettingsPage.tsx      — slate 色系
  src/renderer/App.tsx                     — 适配新布局结构
  src/renderer/index.css                   — 全局背景色

不变:
  src/main/*                               — 主进程不动
  src/shared/*                             — 共享类型不动
  src/renderer/hooks/*                     — 数据层不动
  tailwind.config.js                       — 不需要扩展
```

## 9. 自检

- [x] 无 placeholder / TODO
- [x] 各章节一致：配色方案与组件改造清单对齐
- [x] 范围可控：11 个文件，无架构变更
- [x] 无歧义：所有颜色值精确到 Tailwind class 名

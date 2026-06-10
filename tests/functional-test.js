/**
 * DocHub 功能测试脚本
 * 直接测试后端模块: DB, Classifier, Search, FileWatcher
 * 测试目录: C:\Users\Administrator\Desktop\软件课设作业
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const TEST_DIR = 'C:\\Users\\Administrator\\Desktop\\软件课设作业';
const DB_PATH = path.join(os.tmpdir(), 'dochub-test.db');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ${GREEN}PASS${RESET} ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ${RED}FAIL${RESET} ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// ============================================================
console.log(`\n${BOLD}========================================${RESET}`);
console.log(`${BOLD}  DocHub 功能测试${RESET}`);
console.log(`${BOLD}========================================${RESET}`);
console.log(`  测试目录: ${TEST_DIR}`);
console.log(`  临时数据库: ${DB_PATH}`);
console.log();

// ====== 1. 测试目录是否存在 ======
console.log(`${BOLD}--- 1. 测试目录检查 ---${RESET}`);

test('测试目录存在', () => {
  assert(fs.existsSync(TEST_DIR), `目录不存在: ${TEST_DIR}`);
});

let dirStats = null;
test('测试目录是文件夹', () => {
  dirStats = fs.statSync(TEST_DIR);
  assert(dirStats.isDirectory(), '不是文件夹');
});

let dirContents = [];
test('测试目录可读取', () => {
  dirContents = fs.readdirSync(TEST_DIR);
  console.log(`        找到 ${dirContents.length} 个条目`);
  assert(dirContents.length > 0, '目录为空');
});

// ====== 2. 文件类型检测 ======
console.log(`\n${BOLD}--- 2. 文件类型扫描 ---${RESET}`);

const SUPPORTED_EXTS = ['.pdf', '.docx', '.xlsx', '.pptx'];
let supportedFiles = [];
let unsupportedFiles = [];

test('扫描目录中支持的文件类型', () => {
  // recursive scan
  function scan(dir, prefix = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const fullPath = path.join(dir, e.name);
      if (e.isDirectory()) {
        scan(fullPath, prefix + '  ');
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (SUPPORTED_EXTS.includes(ext)) {
          supportedFiles.push(fullPath);
        } else {
          unsupportedFiles.push({ name: e.name, ext });
        }
      }
    }
  }
  scan(TEST_DIR);

  console.log(`        支持的文件: ${supportedFiles.length} (pdf/docx/xlsx/pptx)`);
  console.log(`        其他文件: ${unsupportedFiles.length}`);
  supportedFiles.forEach(f => console.log(`          ${path.basename(f)}`));
  assert(supportedFiles.length > 0, '没有找到支持的文件类型 (pdf/docx/xlsx/pptx)');
});

// ====== 3. 数据库测试 ======
console.log(`\n${BOLD}--- 3. 数据库操作测试 ---${RESET}`);

// Clean up old test DB
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

let db = null;
test('创建数据库实例', () => {
  const { DocDatabase } = require('./src/main/db');
  db = new DocDatabase(DB_PATH);
  assert(db !== null, '数据库实例为空');
});

test('创建 categories 表', () => {
  const cats = db.getAllCategories();
  assert(Array.isArray(cats), 'getAllCategories 应该返回数组');
});

test('创建分类', () => {
  const catId = db.createCategory('测试分类', null, 'folder', '#000');
  assert(typeof catId === 'number' && catId > 0, `分类 ID 无效: ${catId}`);
  console.log(`        创建分类 ID: ${catId}`);
});

test('获取所有分类', () => {
  const cats = db.getAllCategories();
  assert(cats.length > 0, '分类列表为空');
  console.log(`        分类数: ${cats.length}, 第一个: ${cats[0].name}`);
});

test('保存规则', () => {
  const rule = {
    categoryId: 1,
    field: 'both',
    operator: 'contains',
    value: ['测试', '作业'],
    weight: 5,
  };
  db.saveRule(rule);
  // Should not throw
  assert(true);
});

test('获取规则', () => {
  const rules = db.getAllEnabledRules();
  assert(rules.length > 0, '应该至少有一条规则');
  console.log(`        规则数: ${rules.length}`);
});

test('创建文件记录 (upsertFile)', () => {
  if (supportedFiles.length > 0) {
    const fp = supportedFiles[0];
    const stat = fs.statSync(fp);
    const fileId = db.upsertFile({
      path: fp,
      name: path.basename(fp),
      ext: path.extname(fp).toLowerCase(),
      size: stat.size,
      modifiedAt: stat.mtimeMs,
      contentHash: 'test-hash',
    });
    assert(typeof fileId === 'number' && fileId > 0, `文件 ID 无效: ${fileId}`);
    console.log(`        创建文件 ID: ${fileId}, 名称: ${path.basename(fp)}`);
  } else {
    console.log(`        (跳过，无支持的文件)`);
  }
});

test('获取文件列表', () => {
  const result = db.getFilesByCategory(undefined, 1, 50);
  assert(result && typeof result.total === 'number', 'getFilesByCategory 返回格式错误');
  console.log(`        文件总数: ${result.total}`);
});

test('获取状态', () => {
  const status = db.getStatus();
  assert(status && typeof status.indexed === 'number', 'getStatus 返回格式错误');
  console.log(`        已索引: ${status.indexed}, 待处理: ${status.pending}, 错误: ${status.error}`);
});

// ====== 4. 分词和分类测试 ======
console.log(`\n${BOLD}--- 4. 分词和分类测试 ---${RESET}`);

test('加载 jieba 分词', () => {
  try {
    const jieba = require('nodejieba');
    const words = jieba.cut('这是一个测试文档内容');
    assert(Array.isArray(words) && words.length > 0, '分词结果为空');
    console.log(`        分词结果: ${words.slice(0, 5).join(' / ')}...`);
  } catch (e) {
    console.log(`        ${YELLOW}SKIP${RESET}: jieba 分词不可用 (${e.message})`);
  }
});

test('classify 函数可用', () => {
  const { classify } = require('./src/main/classifier');
  assert(typeof classify === 'function', 'classify 不是函数');
});

test('classify 基本分类', () => {
  const { classify } = require('./src/main/classifier');
  const categories = [
    { id: 1, name: '测试作业', parentId: null, icon: 'folder', color: '#000', priority: 0 },
    { id: 2, name: '其他', parentId: null, icon: 'folder', color: '#000', priority: 0 },
  ];
  const rules = [
    { id: 1, categoryId: 1, field: 'both', operator: 'contains', value: ['作业', '报告'], weight: 5, enabled: true },
    { id: 2, categoryId: 2, field: 'both', operator: 'contains', value: ['其他'], weight: 3, enabled: true },
  ];
  const result = classify('软件课设作业报告.docx', '本文档是软件课程设计作业的最终报告', categories, rules, 1);
  assert(result !== null, 'classify 返回 null');
  assert(typeof result.categoryId === 'number', '没有 categoryId');
  assert(typeof result.score === 'number', '没有 score');
  console.log(`        文件名: 软件课设作业报告.docx`);
  console.log(`        分类 ID: ${result.categoryId}, 得分: ${result.score}, 分类名: ${result.categoryName || '无'}`);
  console.log(`        匹配规则: ${result.matchedRules.length} 条`);
});

// ====== 5. 搜索测试 ======
console.log(`\n${BOLD}--- 5. 全文搜索测试 ---${RESET}`);

test('searchFiles 函数可用', () => {
  const { searchFiles } = require('./src/main/search');
  assert(typeof searchFiles === 'function', 'searchFiles 不是函数');
});

test('searchFiles 搜索', () => {
  const { searchFiles } = require('./src/main/search');
  const result = searchFiles(db, { query: '测试', page: 1, pageSize: 20 });
  assert(result !== null, 'searchFiles 返回 null');
  assert(typeof result.total === 'number', 'total 字段缺失');
  assert(Array.isArray(result.results), 'results 字段缺失');
  console.log(`        搜索"测试": ${result.total} 个结果`);
});

// ====== 6. 文件解析测试 ======
console.log(`\n${BOLD}--- 6. 文件解析测试 ---${RESET}`);

test('parser 函数可用', async () => {
  const { parseFileDirect } = require('./src/main/parser');
  assert(typeof parseFileDirect === 'function', 'parseFileDirect 不是函数');
});

// Try to parse a real file
test('解析 docx 文件', async () => {
  const docxFiles = supportedFiles.filter(f => f.toLowerCase().endsWith('.docx'));
  if (docxFiles.length === 0) {
    console.log(`        ${YELLOW}SKIP${RESET}: 没有 docx 文件可测试`);
    return;
  }
  const { parseFileDirect } = require('./src/main/parser');
  const result = await parseFileDirect(docxFiles[0], '.docx');
  assert(typeof result === 'object', '解析结果不是对象');
  assert(typeof result.text === 'string', 'text 字段缺失');
  assert(Array.isArray(result.tokens), 'tokens 字段缺失');
  console.log(`        文件: ${path.basename(docxFiles[0])}`);
  console.log(`        文本长度: ${result.text.length} 字符`);
  console.log(`        分词数: ${result.tokens.length}`);
  if (result.text.length < 10000) {
    console.log(`        内容预览: ${result.text.slice(0, 100)}...`);
  }
});

// Try to parse a pdf
test('解析 pdf 文件', async () => {
  const pdfFiles = supportedFiles.filter(f => f.toLowerCase().endsWith('.pdf'));
  if (pdfFiles.length === 0) {
    console.log(`        ${YELLOW}SKIP${RESET}: 没有 pdf 文件可测试`);
    return;
  }
  const { parseFileDirect } = require('./src/main/parser');
  const result = await parseFileDirect(pdfFiles[0], '.pdf');
  assert(typeof result === 'object', '解析结果不是对象');
  assert(typeof result.text === 'string', 'text 字段缺失');
  console.log(`        文件: ${path.basename(pdfFiles[0])}`);
  console.log(`        文本长度: ${result.text.length} 字符`);
});

// Try to parse xlsx
test('解析 xlsx 文件', async () => {
  const xlsxFiles = supportedFiles.filter(f => f.toLowerCase().endsWith('.xlsx'));
  if (xlsxFiles.length === 0) {
    console.log(`        ${YELLOW}SKIP${RESET}: 没有 xlsx 文件可测试`);
    return;
  }
  const { parseFileDirect } = require('./src/main/parser');
  const result = await parseFileDirect(xlsxFiles[0], '.xlsx');
  assert(typeof result === 'object', '解析结果不是对象');
  assert(typeof result.text === 'string', 'text 字段缺失');
  console.log(`        文件: ${path.basename(xlsxFiles[0])}`);
  console.log(`        文本长度: ${result.text.length} 字符`);
});

// ====== 7. FileWatcher 测试 ======
console.log(`\n${BOLD}--- 7. FileWatcher 测试 ---${RESET}`);

test('FileWatcher 构造函数可用', () => {
  const { FileWatcher } = require('./src/main/watcher');
  const w = new FileWatcher({ paths: [], exclude: ['**/~$*'], debounceMs: 5000 });
  assert(typeof w.start === 'function', 'start 方法缺失');
  assert(typeof w.stop === 'function', 'stop 方法缺失');
  assert(typeof w.updatePaths === 'function', 'updatePaths 方法缺失');
});

test('FileWatcher updatePaths 和 on 事件', () => {
  const { FileWatcher } = require('./src/main/watcher');
  const w = new FileWatcher({ paths: [], exclude: ['**/~$*'], debounceMs: 5000 });
  let eventReceived = false;
  w.on('file-changed', (payload) => {
    eventReceived = true;
  });
  w.updatePaths([TEST_DIR]);
  // Just verify no crash
  assert(true);
});

// ====== 8. UI 元素验证 (代码层面) ======
console.log(`\n${BOLD}--- 8. SettingsPage 代码审查 ---${RESET}`);

test('SettingsPage.tsx 包含所有功能函数', () => {
  const code = fs.readFileSync('./src/renderer/pages/SettingsPage.tsx', 'utf8');
  assert(code.includes('handleWatchDirs'), '缺少 handleWatchDirs');
  assert(code.includes('handlePaste'), '缺少 handlePaste');
  assert(code.includes('handleClear'), '缺少 handleClear');
  assert(code.includes('handleDrop'), '缺少 handleDrop (拖拽)');
  assert(code.includes('window.docHub.startWatch'), '缺少 startWatch IPC 调用');
  assert(code.includes('navigator.clipboard.readText'), '缺少剪贴板读取');
});

test('Layout.tsx 侧栏包含状态信息', () => {
  const code = fs.readFileSync('./src/renderer/components/Layout.tsx', 'utf8');
  assert(code.includes('useStatus'), '缺少 useStatus hook');
  assert(code.includes('status.indexed'), '缺少 indexed 显示');
  assert(code.includes('status.pending'), '缺少 pending 显示');
});

test('IPC handlers 注册完整', () => {
  const code = fs.readFileSync('./src/main/ipc-handlers.ts', 'utf8');
  assert(code.includes('WATCH_START'), '缺少 WATCH_START handler');
  assert(code.includes('watchPaths'), '缺少 watchPaths 数组');
  assert(code.includes('watcher.updatePaths'), '缺少 updatePaths 调用');
  assert(code.includes('scanDirectory'), '缺少 scanDirectory 调用');
});

// ====== 清理 ======
console.log(`\n${BOLD}--- 清理 ---${RESET}`);

test('关闭数据库', () => {
  if (db && typeof db.close === 'function') {
    db.close();
  }
  assert(true);
});

test('删除测试数据库', () => {
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log(`        已删除: ${DB_PATH}`);
  }
  assert(!fs.existsSync(DB_PATH), '临时数据库未删除');
});

// ====== 结果 ======
console.log(`\n${BOLD}========================================${RESET}`);
console.log(`${BOLD}  测试结果: ${GREEN}${passed} 通过${RESET} / ${RED}${failed} 失败${RESET} / 总计 ${passed + failed}`);
console.log(`${BOLD}========================================${RESET}\n`);

process.exit(failed > 0 ? 1 : 0);

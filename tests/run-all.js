// Test runner for Electron
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS: ' + name);
  } catch (e) {
    failed++;
    failures.push(name + ': ' + e.message);
    console.log('  FAIL: ' + name);
    console.log('    ' + e.message);
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

console.log('=== DocHub Integration Tests ===\n');

// ---- Database Tests ----
console.log('1. Database Layer');
const dbPath = path.join(require('os').tmpdir(), 'dochub-test-' + Date.now() + '.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT UNIQUE, name TEXT, ext TEXT,
    size INTEGER, modified_at INTEGER, content_hash TEXT, category_id INTEGER,
    indexed_at INTEGER, status TEXT DEFAULT 'pending'
  );
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, parent_id INTEGER,
    icon TEXT, color TEXT, priority INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER REFERENCES categories(id),
    field TEXT, operator TEXT, value TEXT, weight INTEGER DEFAULT 1, enabled INTEGER DEFAULT 1
  );
  CREATE VIRTUAL TABLE IF NOT EXISTS fts_index USING fts5(file_id UNINDEXED, content, title, tokenize='unicode61');
`);

test('create tables', () => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
  assert(tables.includes('files'));
  assert(tables.includes('categories'));
  assert(tables.includes('rules'));
});

test('upsert file', () => {
  const r = db.prepare("INSERT INTO files (path,name,ext,size,modified_at,content_hash) VALUES (?,?,?,?,?,?)")
    .run('/test/a.pdf', 'a.pdf', '.pdf', 1024, Date.now(), 'hash1');
  assert(r.lastInsertRowid > 0);
});

// ---- Classifier Tests ----
console.log('\n2. Classifier');
function classify(filename, content, categories, rules, threshold = 1) {
  let bestScore = 0, bestCatId = null, bestName = null, bestPriority = 0;
  for (const cat of categories) {
    const catRules = rules.filter(r => r.category_id === cat.id && r.enabled);
    let score = 0;
    for (const rule of catRules) {
      const kws = JSON.parse(rule.value);
      const target = rule.field === 'filename' ? filename : rule.field === 'content' ? content : filename + ' ' + content;
      if (rule.operator === 'contains' && kws.some(kw => target.includes(kw))) score += rule.weight;
      else if (rule.operator === 'all_keywords' && kws.every(kw => target.includes(kw))) score += rule.weight;
    }
    if (score > bestScore || (score === bestScore && score > 0 && cat.priority > bestPriority)) {
      bestScore = score; bestCatId = cat.id; bestName = cat.name; bestPriority = cat.priority;
    }
  }
  return bestScore >= threshold ? { categoryId: bestCatId, categoryName: bestName, score: bestScore } : { categoryId: null, categoryName: null, score: 0 };
}

const cats = [
  { id: 1, name: '合同/协议', parent_id: null, icon: 'file', color: '#f00', priority: 10 },
  { id: 2, name: '报告/汇报', parent_id: null, icon: 'chart', color: '#00f', priority: 5 },
];
const rules = [
  { id: 1, category_id: 1, field: 'both', operator: 'contains', value: JSON.stringify(['合同','甲方','乙方']), weight: 5, enabled: 1 },
  { id: 2, category_id: 2, field: 'both', operator: 'contains', value: JSON.stringify(['报告','总结']), weight: 5, enabled: 1 },
];

test('classify by filename', () => {
  const r = classify('销售合同2024.pdf', '', cats, rules, 1);
  assert(r.categoryId === 1, 'Expected category 1, got ' + r.categoryId);
  assert(r.score >= 5, 'Expected score >= 5, got ' + r.score);
});

test('classify by content', () => {
  const r = classify('随便.pdf', '甲方公司 乙方公司 合同签订', cats, rules, 1);
  assert(r.categoryId === 1, 'Expected category 1');
});

test('no match returns null', () => {
  const r = classify('无关文件.pdf', '无关键词', cats, rules, 5);
  assert(r.categoryId === null);
});

// ---- Search Tests ----
console.log('\n3. FTS5 Search');
db.prepare('INSERT INTO fts_index (file_id, content, title) VALUES (?,?,?)').run(1, '销售 合同 甲方 乙方', '合同.pdf');

test('search keyword', () => {
  const c = db.prepare("SELECT COUNT(*) as c FROM fts_index WHERE fts_index MATCH ?").get('"合同"').c;
  assert(c >= 1, 'Search returned ' + c);
});

// ---- Cleanup ----
db.close();
fs.unlinkSync(dbPath);

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
if (failed > 0) {
  console.log('Failures:');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED');
}

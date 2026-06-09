/**
 * Verify classification and search results from the test database
 */
const Database = require('better-sqlite3');
const DB_PATH = 'C:/Users/Administrator/AppData/Roaming/doc-hub/index.db';

const db = new Database(DB_PATH, { readonly: true });

console.log('═══════════════════════════════════════════');
console.log('    DocHub 分类 & 搜索 功能测试报告');
console.log('═══════════════════════════════════════════\n');

// ── 1. Overview ──
const total = db.prepare('SELECT COUNT(*) as c FROM files').get().c;
const parsed = db.prepare("SELECT COUNT(*) as c FROM files WHERE status='parsed'").get().c;
const pending = db.prepare("SELECT COUNT(*) as c FROM files WHERE status='pending'").get().c;
const error = db.prepare("SELECT COUNT(*) as c FROM files WHERE status='error'").get().c;

console.log('【1. 文件统计】');
console.log(`  总文件数:    ${total.toLocaleString()}`);
console.log(`  已分类:      ${parsed.toLocaleString()}`);
console.log(`  待处理:      ${pending.toLocaleString()}`);
console.log(`  出错:        ${error.toLocaleString()}\n`);

// ── 2. Classification breakdown ──
console.log('【2. 分类结果分布】');
const cats = db.prepare(`
  SELECT c.name, COUNT(f.id) as cnt
  FROM categories c
  LEFT JOIN files f ON f.category_id = c.id
  GROUP BY c.id
  ORDER BY cnt DESC
`).all();

const uncategorized = db.prepare('SELECT COUNT(*) as c FROM files WHERE category_id IS NULL').get().c;
const classified = db.prepare('SELECT COUNT(*) as c FROM files WHERE category_id IS NOT NULL').get().c;

for (const cat of cats) {
  const bar = '█'.repeat(Math.round(cat.cnt / Math.max(...cats.map(c => c.cnt)) * 30));
  console.log(`  ${cat.name.padEnd(10)} ${String(cat.cnt).padStart(6)} ${bar}`);
}
console.log(`  ${'未分类'.padEnd(10)} ${String(uncategorized).padStart(6)}`);
console.log(`\n  分类覆盖率: ${(classified / total * 100).toFixed(1)}%\n`);

// ── 3. Sample files per category ──
console.log('【3. 各分类样本文件】');
for (const cat of cats) {
  const samples = db.prepare(
    'SELECT name, ext FROM files WHERE category_id = ? LIMIT 5'
  ).all(cat.id);
  console.log(`  ▶ ${cat.name}:`);
  for (const f of samples) {
    console.log(`    - ${f.name}`);
  }
}

// Show some uncategorized
const uncat = db.prepare(
  'SELECT name, ext FROM files WHERE category_id IS NULL LIMIT 5'
).all();
console.log(`  ▶ 未分类:`);
for (const f of uncat) {
  console.log(`    - ${f.name}`);
}
console.log();

// ── 4. Search tests ──
console.log('【4. 搜索功能测试】');
const searchTerms = ['合同', '安全阀', '报价', '压力表', '校验', '凯里', '贵阳'];

for (const term of searchTerms) {
  const likePat = `%${term}%`;
  const count = db.prepare(
    'SELECT COUNT(*) as c FROM fts_index WHERE content LIKE ? OR title LIKE ?'
  ).get(likePat, likePat);

  // Get top 3 matching file names
  const results = db.prepare(`
    SELECT f.name, c.name as cat
    FROM fts_index s
    JOIN files f ON f.id = s.file_id
    LEFT JOIN categories c ON c.id = f.category_id
    WHERE s.content LIKE ? OR s.title LIKE ?
    LIMIT 3
  `).all(likePat, likePat);

  console.log(`  "${term}": ${count.c} 条结果`);
  for (const r of results) {
    console.log(`    → ${r.name} [${r.cat || '未分类'}]`);
  }
}

// ── 5. File types ──
console.log('\n【5. 文件类型分布】');
const types = db.prepare(`
  SELECT ext, COUNT(*) as cnt FROM files GROUP BY ext ORDER BY cnt DESC
`).all();
for (const t of types) {
  console.log(`  ${t.ext.padEnd(8)} ${t.cnt.toLocaleString()}`);
}

// ── 6. Top keywords match ──
console.log('\n【6. 分类命中率最高的关键词】');
const rules = db.prepare('SELECT * FROM rules').all();
for (const rule of rules) {
  const kws = JSON.parse(rule.value);
  for (const kw of kws) {
    const likePat = `%${kw}%`;
    const count = db.prepare(
      'SELECT COUNT(*) as c FROM fts_index WHERE content LIKE ? OR title LIKE ?'
    ).get(likePat, likePat);
    if (count.c > 100) {
      console.log(`  "${kw}" → ${count.c.toLocaleString()} 个文件`);
    }
  }
}

console.log('\n═══════════════════════════════════════════');
console.log('           测试完成');
console.log('═══════════════════════════════════════════');

db.close();

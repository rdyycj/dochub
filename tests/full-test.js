/**
 * Full integration test — scans test directory, classifies, searches.
 * Run: node tests/full-test.js
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Use system Node (different better-sqlite3 compile than Electron)
const Database = require('better-sqlite3');

// ---- SETUP ----
const TEST_DIR = 'C:/Users/Administrator/Desktop/DocHub测试';
const DB_PATH = path.join(__dirname, 'full-test.db');
if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---- SCHEMA ----
db.exec(`
  CREATE TABLE files (
    id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT UNIQUE, name TEXT, ext TEXT,
    size INTEGER, modified_at INTEGER, content_hash TEXT, category_id INTEGER,
    indexed_at INTEGER, status TEXT DEFAULT 'pending'
  );
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, parent_id INTEGER,
    icon TEXT, color TEXT, priority INTEGER DEFAULT 0
  );
  CREATE TABLE rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER REFERENCES categories(id),
    field TEXT, operator TEXT, value TEXT, weight INTEGER DEFAULT 1, enabled INTEGER DEFAULT 1
  );
  CREATE VIRTUAL TABLE fts_index USING fts5(file_id UNINDEXED, content, title, tokenize='unicode61');
`);

// ---- DEFAULT CATEGORIES ----
const defaults = [
  { name: '合同/协议', keywords: ['合同', '协议', '甲方', '乙方', '签订', '合同编号', '条款', '违约责任'] },
  { name: '发票/票据', keywords: ['发票', 'invoice', '发票号码', '开票日期', '金额', '税率', '票据'] },
  { name: '报告/汇报', keywords: ['报告', '总结', '汇报', '月度', '季度', '年度', '分析', '统计'] },
  { name: '简历/人事', keywords: ['简历', 'CV', '工作经历', '教育背景', '求职', '面试'] },
  { name: '技术文档', keywords: ['技术方案', '需求文档', '接口文档', '设计说明', 'API', '架构', '开发'] },
  { name: '规章制度', keywords: ['制度', '规定', '管理办法', '通知', '公告', '条例', '规范'] },
];

const catMap = {};
for (const cat of defaults) {
  const r = db.prepare('INSERT INTO categories (name, icon, color, priority) VALUES (?,?,?,?)')
    .run(cat.name, 'folder', '#666', defaults.length);
  catMap[cat.name] = r.lastInsertRowid;
  for (const kw of cat.keywords) {
    db.prepare('INSERT INTO rules (category_id, field, operator, value, weight) VALUES (?,?,?,?,?)')
      .run(r.lastInsertRowid, 'both', 'contains', JSON.stringify([kw]), 1);
  }
}
console.log(`Seeded ${defaults.length} categories`);

// ---- CLASSIFIER (inlined) ----
function classify(filename, content, categories, rules, threshold = 5) {
  let bestScore = 0, bestCatId = null, bestName = null, bestPriority = 0, matched = [];
  for (const cat of categories) {
    const catRules = rules.filter(r => r.category_id === cat.id && r.enabled);
    let score = 0;
    const hits = [];
    for (const rule of catRules) {
      const kws = JSON.parse(rule.value);
      const target = rule.field === 'filename' ? filename : rule.field === 'content' ? content : filename + ' ' + content;
      if (rule.operator === 'contains' && kws.some(kw => target.includes(kw))) {
        score += rule.weight;
        hits.push({ ruleId: rule.id, weight: rule.weight });
      } else if (rule.operator === 'all_keywords' && kws.every(kw => target.includes(kw))) {
        score += rule.weight;
        hits.push({ ruleId: rule.id, weight: rule.weight });
      }
    }
    if (score > bestScore || (score === bestScore && score > 0 && cat.priority > bestPriority)) {
      bestScore = score; bestCatId = cat.id; bestName = cat.name; bestPriority = cat.priority; matched = hits;
    }
  }
  return { categoryId: bestCatId, categoryName: bestName, score: bestScore, matched };
}

// ---- PARSER STUBS ----
const mammoth = require('mammoth');
const XLSX = require('xlsx');

async function parseFile(filePath, ext) {
  const maxSize = 100 * 1024 * 1024;
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > maxSize) return { text: '', error: '过大' };
  } catch (e) { return { text: '', error: e.message }; }

  switch (ext) {
    case '.pdf': {
      try {
        const buf = fs.readFileSync(filePath);
        const data = await require('pdf-parse')(buf);
        return { text: data.text || '' };
      } catch (e) { return { text: '', error: e.message }; }
    }
    case '.doc':
      return { text: '', error: '旧版Word，仅文件名分类' };
    case '.docx': {
      try {
        const buf = fs.readFileSync(filePath);
        const r = await mammoth.extractRawText({ buffer: buf });
        return { text: r.value };
      } catch (e) { return { text: '', error: e.message }; }
    }
    case '.xls':
    case '.xlsx': {
      try {
        const wb = XLSX.readFile(filePath);
        const texts = wb.SheetNames.map(s => XLSX.utils.sheet_to_csv(wb.Sheets[s]));
        return { text: texts.join('\n') };
      } catch (e) { return { text: '', error: e.message }; }
    }
    case '.pptx': {
      try {
        const buf = fs.readFileSync(filePath);
        const r = await require('pptx-parser').parse(buf);
        const texts = [];
        for (const slide of (r.slides || []))
          for (const shape of (slide.shapes || []))
            if (shape.text) texts.push(shape.text);
        return { text: texts.join('\n') };
      } catch (e) { return { text: '', error: e.message }; }
    }
    default: return { text: '', error: '不支持' };
  }
}

// ---- TOKENIZER ----
let nodejieba;
function tokenize(text) {
  if (!text || !text.trim()) return [];
  try {
    if (!nodejieba) nodejieba = require('nodejieba');
    return nodejieba.cut(text);
  } catch { return text.split(/\s+/).filter(Boolean); }
}

// ---- MAIN TEST ----
(async () => {
  console.log('\n=== 1. Scanning test directory ===');
  const start = Date.now();

  const categories = db.prepare('SELECT * FROM categories ORDER BY priority DESC, id ASC').all();
  const rules = db.prepare('SELECT * FROM rules WHERE enabled = 1').all();

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { recursive: true, withFileTypes: true });
    const files = [];
    for (const e of entries) {
      if (!e.isFile()) continue;
      const ext = path.extname(e.name).toLowerCase();
      if (!['.pdf','.doc','.docx','.xls','.xlsx','.pptx'].includes(ext)) continue;
      const fp = path.join(e.parentPath || e.path || dir, e.name);
      files.push({ path: fp, name: e.name, ext });
    }
    return files;
  }

  const allFiles = scanDir(TEST_DIR);
  console.log(`Found ${allFiles.length} supported files`);

  // Take a sample for testing (50 random files from each type)
  const sample = [];
  const byExt = {};
  for (const f of allFiles) {
    if (!byExt[f.ext]) byExt[f.ext] = [];
    byExt[f.ext].push(f);
  }
  for (const [ext, files] of Object.entries(byExt)) {
    const subset = files.slice(0, 10); // first 10 of each type
    sample.push(...subset);
    console.log(`  ${ext}: ${files.length} files (testing ${subset.length})`);
  }

  console.log(`\n=== 2. Parsing & classifying ${sample.length} sample files ===`);
  let classified = 0, errors = 0;
  const results = {};

  for (const file of sample) {
    try {
      const stat = fs.statSync(file.path);
      const buf = fs.readFileSync(file.path).slice(0, 65536);
      const hash = crypto.createHash('md5').update(buf).digest('hex');

      const fid = db.prepare(
        'INSERT INTO files (path, name, ext, size, modified_at, content_hash, status) VALUES (?,?,?,?,?,?,?)'
      ).run(file.path, file.name, file.ext, stat.size, stat.mtimeMs, hash, 'pending').lastInsertRowid;

      const parsed = await parseFile(file.path, file.ext);
      const tokens = tokenize(parsed.text);
      const contentSample = parsed.text.slice(0, 50000);

      const cls = classify(file.name, contentSample, categories, rules, 5);

      db.prepare('UPDATE files SET category_id=?, status=?, indexed_at=? WHERE id=?')
        .run(cls.categoryId, cls.categoryName ? 'parsed' : 'parsed', Date.now(), fid);

      if (tokens.length > 0) {
        db.prepare('INSERT INTO fts_index (file_id, content, title) VALUES (?,?,?)')
          .run(fid, tokens.join(' '), file.name);
      }

      if (cls.categoryName) {
        classified++;
        if (!results[cls.categoryName]) results[cls.categoryName] = [];
        results[cls.categoryName].push(file.name);
      } else {
        errors++;
        if (!results['未分类']) results['未分类'] = [];
        results['未分类'].push({ name: file.name, error: parsed.error });
      }
    } catch (e) {
      errors++;
    }
  }

  console.log(`\n=== 3. Classification Results ===`);
  for (const [cat, files] of Object.entries(results)) {
    console.log(`\n${cat} (${files.length} files):`);
    for (const f of files.slice(0, 5)) {
      console.log(`  - ${typeof f === 'string' ? f : f.name}`);
    }
  }

  console.log(`\n=== 4. Search Test ===`);
  const searchTerms = ['合同', '安全阀', '报价', '报告', '检验'];
  for (const term of searchTerms) {
    const likePat = `%${term}%`;
    const count = db.prepare(
      'SELECT COUNT(*) as c FROM fts_index WHERE content LIKE ? OR title LIKE ?'
    ).get(likePat, likePat);
    console.log(`  "${term}": ${count.c} results`);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n=== Done in ${elapsed}s ===`);
  console.log(`Classified: ${classified}, Unclassified/Errors: ${errors}`);

  db.close();
  fs.unlinkSync(DB_PATH);
})();

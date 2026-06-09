const Database = require('better-sqlite3');
const db = new Database('C:/Users/Administrator/AppData/Roaming/doc-hub/index.db', { readonly: true });

console.log('══════════════ 规则检查 ══════════════');
const cats = db.prepare('SELECT * FROM categories ORDER BY id').all();
cats.forEach(c => {
  const rules = db.prepare('SELECT * FROM rules WHERE category_id=? AND enabled=1').all(c.id);
  console.log(`  ${c.name} (${rules.length} rules):`);
  rules.forEach(r => {
    const kws = JSON.parse(r.value);
    console.log(`    "${kws.join(',')}"  weight:${r.weight}  field:${r.field}`);
  });
});

console.log('\n══════════════ 文件分类结果 ══════════════');
const total = db.prepare('SELECT COUNT(*) as c FROM files').get().c;
const parsed = db.prepare("SELECT COUNT(*) as c FROM files WHERE status='parsed'").get().c;
const pending = db.prepare("SELECT COUNT(*) as c FROM files WHERE status='pending'").get().c;
const classified = db.prepare('SELECT COUNT(*) as c FROM files WHERE category_id IS NOT NULL').get().c;
console.log(`  总计:${total}  已解析:${parsed}  待处理:${pending}  已分类:${classified}`);

console.log('\n各分类文件数:');
const dist = db.prepare(`
  SELECT c.name, COUNT(f.id) as cnt
  FROM categories c LEFT JOIN files f ON f.category_id=c.id
  GROUP BY c.id ORDER BY cnt DESC
`).all();
dist.forEach(d => console.log(`  ${d.name}: ${d.cnt}`));
const uncat = db.prepare('SELECT COUNT(*) as c FROM files WHERE category_id IS NULL').get().c;
console.log(`  未分类: ${uncat}`);

console.log('\n══════════════ 抽样检查 ══════════════');
// Files that SHOULD be classified as 合同/协议
const sample1 = db.prepare("SELECT id,name,category_id,status FROM files WHERE name LIKE '%合同%' AND status='parsed' LIMIT 3").all();
console.log('含"合同"的文件:');
sample1.forEach(f => {
  const cat = f.category_id ? db.prepare('SELECT name FROM categories WHERE id=?').get(f.category_id) : null;
  console.log(`  [cat:${cat?cat.name:'未分类'}] ${f.name}`);
});

// Files with "甲方" in content
const sample2 = db.prepare("SELECT f.id,f.name,f.category_id FROM files f JOIN fts_index s ON s.file_id=f.id WHERE s.content LIKE '%甲方%' AND f.status='parsed' LIMIT 3").all();
console.log('\n含"甲方"的文件:');
sample2.forEach(f => {
  const cat = f.category_id ? db.prepare('SELECT name FROM categories WHERE id=?').get(f.category_id) : null;
  console.log(`  [cat:${cat?cat.name:'未分类'}] ${f.name}`);
});

// Search test
console.log('\n══════════════ 搜索测试 ══════════════');
['合同','安全阀','报价','甲方','校验'].forEach(t => {
  const p = '%'+t+'%';
  const c = db.prepare('SELECT COUNT(*) as c FROM fts_index WHERE content LIKE ? OR title LIKE ?').get(p,p).c;
  console.log(`  "${t}": ${c} 条`);
});

db.close();

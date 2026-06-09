const Database = require('better-sqlite3');
const db = new Database('C:/Users/Administrator/AppData/Roaming/doc-hub/index.db', { readonly: true });

console.log('=== DocHub Results ===');
console.log('Total:', db.prepare('SELECT COUNT(*) as c FROM files').get().c);
console.log('Parsed:', db.prepare("SELECT COUNT(*) as c FROM files WHERE status='parsed'").get().c);
console.log('Pending:', db.prepare("SELECT COUNT(*) as c FROM files WHERE status='pending'").get().c);

console.log('\n--- Categories ---');
const cats = db.prepare('SELECT c.name, COUNT(f.id) as cnt FROM categories c LEFT JOIN files f ON f.category_id=c.id GROUP BY c.id ORDER BY cnt DESC').all();
cats.forEach(c => console.log(c.name + ': ' + c.cnt));
console.log('Uncategorized:', db.prepare('SELECT COUNT(*) as c FROM files WHERE category_id IS NULL').get().c);

console.log('\n--- Search ---');
['合同','安全阀','报价','压力表'].forEach(t => {
  const p = '%' + t + '%';
  console.log('"' + t + '":', db.prepare('SELECT COUNT(*) as c FROM fts_index WHERE content LIKE ? OR title LIKE ?').get(p, p).c);
});
db.close();

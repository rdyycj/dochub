const Database = require('better-sqlite3');
const db = new Database('C:/Users/Administrator/AppData/Roaming/doc-hub/index.db', { readonly: true });

// Check first 10 parsed files
const files = db.prepare("SELECT id,name,category_id,status,ext FROM files WHERE status='parsed' LIMIT 10").all();
files.forEach(f => {
  const fts = db.prepare('SELECT content FROM fts_index WHERE file_id=?').get(f.id);
  console.log(`ID:${f.id} cat:${f.category_id} status:${f.status} ext:${f.ext} name:${f.name}`);
  if (fts) console.log(`  FTS: ${(fts.content||'').substring(0,80)}`);
});

// Check categories
console.log('\nCategories:');
db.prepare('SELECT * FROM categories').all().forEach(c => console.log(`  ${c.id}: ${c.name}`));

// Check rules weight
console.log('\nRules sample:');
db.prepare('SELECT * FROM rules LIMIT 3').all().forEach(r => {
  console.log(`  id:${r.id} cat:${r.category_id} field:${r.field} op:${r.operator} val:${r.value} weight:${r.weight}`);
});
db.close();

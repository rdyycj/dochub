const Database = require('better-sqlite3');
const db = new Database('C:/Users/Administrator/AppData/Roaming/doc-hub/index.db', { readonly: true });

console.log('--- Categories ---');
const cats = db.prepare('SELECT * FROM categories').all();
cats.forEach(c => console.log(JSON.stringify(c)));

console.log('\n--- Rules (first 10) ---');
const rules = db.prepare('SELECT * FROM rules').all();
rules.slice(0,10).forEach(r => {
  r.valueParsed = JSON.parse(r.value);
  console.log(JSON.stringify(r));
});
console.log('Total rules:', rules.length);

console.log('\n--- Test classify with sample file ---');
const sample = db.prepare("SELECT id, name FROM files LIMIT 3").all();
const ftsIndex = db.prepare('SELECT * FROM fts_index LIMIT 1').all();

sample.forEach(s => {
  console.log('File:', s.name);
  // Check which keywords match
  rules.forEach(r => {
    const kws = JSON.parse(r.value);
    kws.forEach(kw => {
      if (s.name.includes(kw)) {
        console.log(`  Rule ${r.id} keyword "${kw}" matches filename "${s.name}"`);
      }
    });
  });
});

console.log('\n--- FTS sample ---');
if (ftsIndex.length > 0) {
  const f = ftsIndex[0];
  console.log('Content sample (first 200 chars):', f.content ? f.content.substring(0, 200) : 'EMPTY');
  console.log('Title:', f.title);
}

db.close();

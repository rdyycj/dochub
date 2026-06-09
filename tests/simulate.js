const Database = require('better-sqlite3');

// --- Replicate exact classifier code from compiled JS ---
function classify(filename, content, categories, rules, threshold = 5) {
  let bestScore = 0, bestCatId = null, bestName = null, bestPriority = 0;
  const matchedRules = [];
  for (const cat of categories) {
    const catRules = rules.filter(r => r.category_id === cat.id && r.enabled);
    let score = 0;
    for (const rule of catRules) {
      const kws = JSON.parse(rule.value);
      const target = rule.field === 'filename' ? filename :
                     rule.field === 'content' ? content :
                     filename + ' ' + content;
      if (rule.operator === 'contains' && kws.some(kw => target.includes(kw))) {
        score += rule.weight;
      } else if (rule.operator === 'all_keywords' && kws.every(kw => target.includes(kw))) {
        score += rule.weight;
      }
    }
    if (score > bestScore || (score === bestScore && score > 0 && cat.priority > bestPriority)) {
      bestScore = score; bestCatId = cat.id; bestName = cat.name; bestPriority = cat.priority;
    }
  }
  return bestScore >= threshold ? { categoryId: bestCatId, categoryName: bestName, score: bestScore } : { categoryId: null, categoryName: null, score: 0 };
}

// --- Setup ---
const db = new Database('C:/Users/Administrator/AppData/Roaming/doc-hub/index.db', { readonly: true });
const categories = db.prepare('SELECT * FROM categories ORDER BY priority DESC, id ASC').all();
const rules = db.prepare('SELECT * FROM rules WHERE enabled=1').all();
const threshold = db.prepare('SELECT content_hash FROM files LIMIT 1').get() ? 1 : 5; // estimate
const configThreshold = 1;

console.log('Categories:', categories.length, 'Rules:', rules.length, 'Threshold:', configThreshold);

// --- Test with files that SHOULD classify ---
const testFiles = [
  { id: 1, name: '市一医.docx' },
  { id: null, name: '贵州瓮安玉山-安全阀校验合同.docx' },
];

// Get actual parsed files
const parsedFiles = db.prepare("SELECT id,name,ext FROM files WHERE status='parsed' LIMIT 5").all();
for (const f of parsedFiles) {
  testFiles.push(f);
}

for (const f of testFiles) {
  // Simulate what handleParseResult does
  const row = f.id ? db.prepare('SELECT * FROM files WHERE id=?').get(f.id) : null;
  const actualName = row ? row.name : f.name;

  // Get raw text - we can't get it from DB (only tokenized), so simulate with filename
  const ftsRow = f.id ? db.prepare('SELECT content FROM fts_index WHERE file_id=?').get(f.id) : null;
  const tokenizedContent = ftsRow ? ftsRow.content : '';

  // Use raw text simulation: For files with "合同" in name, their raw text likely has "合同" too
  const simulatedRaw = actualName; // simplified

  console.log(`\n--- ${actualName} ---`);
  console.log(`  FTS content sample: ${tokenizedContent.substring(0, 80)}`);

  // Try classify with just filename
  const result1 = classify(actualName, '', categories, rules, configThreshold);
  console.log(`  By filename only: ${result1.categoryName || 'UNC'} score=${result1.score}`);

  // Try classify with tokenized content
  const result2 = classify(actualName, tokenizedContent, categories, rules, configThreshold);
  console.log(`  By tokenized content: ${result2.categoryName || 'UNC'} score=${result2.score}`);

  // Check which keywords match
  const matchingKeywords = [];
  for (const r of rules) {
    const kws = JSON.parse(r.value);
    for (const kw of kws) {
      if (actualName.includes(kw)) matchingKeywords.push(`${kw}(w${r.weight} via filename)`);
      if (tokenizedContent.includes(kw)) matchingKeywords.push(`${kw}(w${r.weight} via content)`);
    }
  }
  console.log(`  Matching keywords: ${matchingKeywords.length > 0 ? matchingKeywords.join(', ') : 'NONE!'}`);

  if (row && row.category_id === null) {
    console.log(`  *** BUG: File has category_id=NULL despite matching keywords! ***`);
  }
}

db.close();

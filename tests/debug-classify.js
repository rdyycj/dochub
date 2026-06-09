const Database = require('better-sqlite3');
const db = new Database('C:/Users/Administrator/AppData/Roaming/doc-hub/index.db', { readonly: true });

// Simulate the classifier
function classify(filename, content, categories, rules, threshold) {
  let bestScore = 0, bestCatId = null, bestName = null, bestPriority = 0;
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

const categories = db.prepare('SELECT * FROM categories').all();
const rules = db.prepare('SELECT * FROM rules WHERE enabled=1').all();
const threshold = 1;

console.log('Categories:', categories.length, 'Rules:', rules.length);
console.log('Rule weights:', rules.map(r => r.weight));

// Test with a file that has "合同" in its name
const files = db.prepare("SELECT * FROM files WHERE name LIKE '%合同%' LIMIT 5").all();
console.log('\n--- Files with 合同 in name ---');
files.forEach(f => {
  const ftsContent = db.prepare('SELECT content FROM fts_index WHERE file_id=?').get(f.id);
  const rawContent = ftsContent ? ftsContent.content : '';
  const result = classify(f.name, rawContent, categories, rules, threshold);
  console.log(`File: ${f.name}`);
  console.log(`  FTS content (first 100): ${rawContent.substring(0, 100)}`);
  console.log(`  Classified as: ${result.categoryName || 'UNCategorized'}, score: ${result.score}`);
});

// Test with content that explicitly contains keywords
console.log('\n--- Test with explicit keywords ---');
const testCases = [
  { name: 'test.pdf', content: '甲方公司 乙方公司 签订合同 合同编号 GC-2024-001' },
  { name: 'test.pdf', content: '安全阀校验报告 压力表检测' },
];
testCases.forEach(tc => {
  const result = classify(tc.name, tc.content, categories, rules, threshold);
  console.log(`Content: "${tc.content.substring(0,50)}..."`);
  console.log(`  → ${result.categoryName || 'UNCategorized'}, score: ${result.score}`);
});

db.close();

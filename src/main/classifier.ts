import { Rule, Category, ClassificationResult } from '../shared/types';

export function classify(
  filename: string,
  content: string,
  categories: Category[],
  rules: Rule[],
  threshold: number = 5
): ClassificationResult {
  let bestScore = 0;
  let bestCategoryId: number | null = null;
  let bestCategoryName: string | null = null;
  let bestPriority = 0;
  let matchedRules: { ruleId: number; weight: number }[] = [];

  for (const category of categories) {
    const categoryRules = rules.filter((r) => r.categoryId === category.id && r.enabled);
    let categoryScore = 0;
    const categoryMatches: { ruleId: number; weight: number }[] = [];

    for (const rule of categoryRules) {
      const hit = evaluateRule(rule, filename, content);
      if (hit) {
        categoryScore += rule.weight;
        categoryMatches.push({ ruleId: rule.id, weight: rule.weight });
      }
    }

    if (categoryScore > bestScore ||
        (categoryScore === bestScore && categoryScore > 0 && category.priority > bestPriority)) {
      bestScore = categoryScore;
      bestCategoryId = category.id;
      bestCategoryName = category.name;
      bestPriority = category.priority;
      matchedRules = categoryMatches;
    }
  }

  if (bestScore < threshold) {
    return { categoryId: null, categoryName: null, score: 0, matchedRules: [] };
  }

  return {
    categoryId: bestCategoryId,
    categoryName: bestCategoryName,
    score: bestScore,
    matchedRules,
  };
}

function evaluateRule(rule: Rule, filename: string, content: string): boolean {
  const keywords = rule.value;

  let targetText = '';
  if (rule.field === 'filename') {
    targetText = filename;
  } else if (rule.field === 'content') {
    targetText = content;
  } else {
    targetText = filename + ' ' + content;
  }

  switch (rule.operator) {
    case 'contains':
      return keywords.some((kw) => targetText.includes(kw));
    case 'all_keywords':
      return keywords.every((kw) => targetText.includes(kw));
    case 'regex':
      return keywords.some((pattern) => {
        try {
          return new RegExp(pattern).test(targetText);
        } catch {
          return false;
        }
      });
    default:
      return false;
  }
}

export function computeScore(filename: string, content: string, rules: Rule[]): number {
  let score = 0;
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (evaluateRule(rule, filename, content)) {
      score += rule.weight;
    }
  }
  return score;
}

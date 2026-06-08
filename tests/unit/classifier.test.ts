import { describe, it, expect } from 'vitest';
import { classify } from '../../src/main/classifier';
import { Rule, Category } from '../../src/shared/types';

const categories: Category[] = [
  { id: 1, name: '合同/协议', parentId: null, icon: 'file', color: '#ff0000', priority: 10 },
  { id: 2, name: '发票/票据', parentId: null, icon: 'file', color: '#00ff00', priority: 5 },
];

const rules: Rule[] = [
  { id: 1, categoryId: 1, field: 'filename', operator: 'contains', value: ['合同', '协议'], weight: 10, enabled: true },
  { id: 2, categoryId: 1, field: 'content', operator: 'all_keywords', value: ['甲方', '乙方'], weight: 8, enabled: true },
  { id: 3, categoryId: 1, field: 'content', operator: 'contains', value: ['合同编号', '签订'], weight: 5, enabled: true },
  { id: 4, categoryId: 2, field: 'filename', operator: 'contains', value: ['发票', 'invoice'], weight: 10, enabled: true },
  { id: 5, categoryId: 2, field: 'content', operator: 'all_keywords', value: ['发票号码', '金额'], weight: 8, enabled: true },
];

describe('classifier', () => {
  it('should return null when no rules match', () => {
    const result = classify('随便文件.docx', '这是完全无关的内容', categories, rules, 5);
    expect(result.categoryId).toBeNull();
  });

  it('should classify by filename keywords', () => {
    const result = classify('销售合同-2024.pdf', '', categories, rules, 5);
    expect(result.categoryId).toBe(1);
    expect(result.categoryName).toBe('合同/协议');
  });

  it('should classify by content keywords', () => {
    const result = classify('文档.docx', '甲方公司 乙方公司 共同签订本协议', categories, rules, 5);
    expect(result.categoryId).toBe(1);
  });

  it('should use all_keywords: fail when not all keywords present', () => {
    const result = classify('文档.docx', '甲方公司签署协议条款', categories, rules, 5);
    expect(result.categoryId).toBeNull();
  });

  it('should respect threshold', () => {
    const lowRules: Rule[] = [
      { id: 1, categoryId: 1, field: 'content', operator: 'contains', value: ['测试'], weight: 2, enabled: true },
    ];
    const result = classify('测试文件.docx', '包含测试关键词', categories, lowRules, 5);
    expect(result.categoryId).toBeNull();
  });

  it('should break ties by category priority', () => {
    const tieRules: Rule[] = [
      { id: 1, categoryId: 1, field: 'content', operator: 'contains', value: ['关键词'], weight: 10, enabled: true },
      { id: 4, categoryId: 2, field: 'content', operator: 'contains', value: ['关键词'], weight: 10, enabled: true },
    ];
    const result = classify('文件.docx', '包含关键词', categories, tieRules, 5);
    expect(result.categoryId).toBe(1);
  });
});

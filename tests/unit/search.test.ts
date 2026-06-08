import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DocDatabase } from '../../src/main/db';
import { searchFiles } from '../../src/main/search';

let db!: DocDatabase;

describe('search', () => {
  beforeEach(() => {
    if (db) db.close();
    db = new DocDatabase(':memory:');
    // Create a category first for FK constraint
    const catId = db.createCategory('合同/协议');
    // Seed test data
    const id = db.upsertFile({
      path: '/test/销售合同.pdf', name: '销售合同.pdf', ext: '.pdf', size: 1024,
      modifiedAt: Date.now(), contentHash: 'h1',
    });
    db.upsertFts(id, '这是 一份 销售 合同 文档 包含 甲方 和 乙方', '销售合同.pdf');
    db.updateFileStatus(id, 'parsed');
    db.setFileCategory(id, catId);
  });

  afterAll(() => {
    db?.close();
  });

  it('should return results for keyword search', () => {
    const { results, total } = searchFiles(db, { query: '合同', page: 1, pageSize: 20 });
    expect(total).toBeGreaterThanOrEqual(1);
    expect(results[0].name).toBe('销售合同.pdf');
  });

  it('should return empty for non-matching keyword', () => {
    const { results, total } = searchFiles(db, { query: '不存在的内容xyz', page: 1, pageSize: 20 });
    expect(total).toBe(0);
  });

  it('should paginate results', () => {
    for (let i = 0; i < 10; i++) {
      const fid = db.upsertFile({
        path: `/test/文件${i}.pdf`, name: `文件${i}.pdf`, ext: '.pdf', size: 100,
        modifiedAt: Date.now(), contentHash: `h_${i}`,
      });
      db.upsertFts(fid, `测试 文档 编号${i}`, `文件${i}.pdf`);
    }
    const { results, total } = searchFiles(db, { query: '测试', page: 1, pageSize: 5 });
    expect(results.length).toBeLessThanOrEqual(5);
    expect(total).toBeGreaterThanOrEqual(10);
  });
});

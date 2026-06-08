import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DocDatabase } from '../../src/main/db';
let db!: DocDatabase;

describe('DocDatabase', () => {
  beforeEach(() => {
    if (db) db.close();
    db = new DocDatabase(':memory:');
  });

  afterAll(() => {
    db?.close();
  });

  it('should create tables on init', () => {
    const tables = db.getRawDb().prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    const names = tables.map((t: any) => t.name);
    expect(names).toContain('files');
    expect(names).toContain('categories');
    expect(names).toContain('rules');
  });

  it('should upsert a new file and return its id', () => {
    const id = db.upsertFile({
      path: '/test/file1.pdf',
      name: 'file1.pdf',
      ext: '.pdf',
      size: 1024,
      modifiedAt: Date.now(),
      contentHash: 'abc123',
    });
    expect(id).toBeGreaterThan(0);
    const file = db.getFileById(id);
    expect(file.name).toBe('file1.pdf');
    expect(file.status).toBe('pending');
  });

  it('should not re-index unchanged file (same hash)', () => {
    const id = db.upsertFile({
      path: '/test/file2.pdf',
      name: 'file2.pdf',
      ext: '.pdf',
      size: 1024,
      modifiedAt: Date.now(),
      contentHash: 'abc456',
    });
    db.updateFileStatus(id, 'parsed');
    const id2 = db.upsertFile({
      path: '/test/file2.pdf',
      name: 'file2.pdf',
      ext: '.pdf',
      size: 1024,
      modifiedAt: Date.now(),
      contentHash: 'abc456',
    });
    expect(id2).toBe(id);
    const file = db.getFileById(id);
    expect(file.status).toBe('parsed');
  });

  it('should re-index changed file (different hash)', () => {
    const id = db.upsertFile({
      path: '/test/file3.pdf',
      name: 'file3.pdf',
      ext: '.pdf',
      size: 1024,
      modifiedAt: Date.now(),
      contentHash: 'oldhash',
    });
    db.updateFileStatus(id, 'parsed');
    const id2 = db.upsertFile({
      path: '/test/file3.pdf',
      name: 'file3.pdf',
      ext: '.pdf',
      size: 2048,
      modifiedAt: Date.now(),
      contentHash: 'newhash',
    });
    expect(id2).toBe(id);
    const file = db.getFileById(id);
    expect(file.status).toBe('pending');
  });

  it('should manage categories and rules', () => {
    const catId = db.createCategory('Test Category');
    expect(catId).toBeGreaterThan(0);
    const cats = db.getAllCategories();
    expect(cats.length).toBe(1);

    db.replaceCategoryRules(catId, [
      { field: 'content', operator: 'contains', value: ['test', 'keyword'], weight: 5 },
    ]);
    const rules = db.getRulesByCategory(catId);
    expect(rules.length).toBe(1);
    expect(JSON.parse(rules[0].value)).toEqual(['test', 'keyword']);
  });

  it('should search via FTS5', () => {
    const fileId = db.upsertFile({
      path: '/test/search-test.pdf',
      name: 'search-test.pdf',
      ext: '.pdf',
      size: 512,
      modifiedAt: Date.now(),
      contentHash: 'fts-test',
    });
    db.upsertFts(fileId, 'this is a test document with keywords', 'search-test.pdf');
    const { results, total } = db.searchFts('test');
    expect(total).toBeGreaterThanOrEqual(1);
    expect(results[0].snippet_content).toContain('<mark>');
  });

  it('should return status counts', () => {
    db.upsertFile({ path: '/a.pdf', name: 'a.pdf', ext: '.pdf', size: 100, modifiedAt: Date.now(), contentHash: 'h1' });
    db.upsertFile({ path: '/b.pdf', name: 'b.pdf', ext: '.pdf', size: 200, modifiedAt: Date.now(), contentHash: 'h2' });
    const status = db.getStatus();
    expect(status.pending).toBeGreaterThanOrEqual(2);
  });
});

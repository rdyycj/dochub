import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

export class DocDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        ext TEXT NOT NULL,
        size INTEGER NOT NULL DEFAULT 0,
        modified_at INTEGER,
        content_hash TEXT,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        indexed_at INTEGER,
        status TEXT DEFAULT 'pending'
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
        icon TEXT DEFAULT 'folder',
        color TEXT DEFAULT '#666666',
        priority INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        field TEXT NOT NULL CHECK(field IN ('filename','content','both')),
        operator TEXT NOT NULL CHECK(operator IN ('contains','regex','all_keywords')),
        value TEXT NOT NULL,
        weight INTEGER DEFAULT 1,
        enabled INTEGER DEFAULT 1
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS fts_index USING fts5(
        file_id UNINDEXED,
        content,
        title,
        tokenize='unicode61'
      );
    `);
  }

  // ---- File CRUD ----

  upsertFile(file: {
    path: string;
    name: string;
    ext: string;
    size: number;
    modifiedAt: number;
    contentHash: string;
  }): number {
    const existing = this.db.prepare('SELECT id, content_hash FROM files WHERE path = ?').get(file.path) as any;
    if (existing) {
      if (existing.content_hash === file.contentHash) {
        return existing.id; // unchanged, skip parsing
      }
      // content changed, reset status
      this.db.prepare(`
        UPDATE files SET size=?, modified_at=?, content_hash=?, status='pending', indexed_at=NULL
        WHERE id=?
      `).run(file.size, file.modifiedAt, file.contentHash, existing.id);
      return existing.id;
    }
    const result = this.db.prepare(`
      INSERT INTO files (path, name, ext, size, modified_at, content_hash, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(file.path, file.name, file.ext, file.size, file.modifiedAt, file.contentHash);
    return Number(result.lastInsertRowid);
  }

  updateFileStatus(fileId: number, status: string): void {
    this.db.prepare('UPDATE files SET status=? WHERE id=?').run(status, fileId);
  }

  setFileCategory(fileId: number, categoryId: number | null): void {
    this.db.prepare('UPDATE files SET category_id=?, indexed_at=? WHERE id=?')
      .run(categoryId, Date.now(), fileId);
  }

  getFilesByCategory(categoryId: number | null | undefined, page: number = 1, pageSize: number = 50): { files: any[]; total: number } {
    const offset = (page - 1) * pageSize;
    let query = 'SELECT * FROM files';
    let countQuery = 'SELECT COUNT(*) as total FROM files';
    const params: any[] = [];
    const countParams: any[] = [];

    if (categoryId === undefined) {
      // all files — no filter
    } else if (categoryId === null) {
      // uncategorized
      query += ' WHERE category_id IS NULL';
      countQuery += ' WHERE category_id IS NULL';
    } else {
      query += ' WHERE category_id = ?';
      countQuery += ' WHERE category_id = ?';
      params.push(categoryId);
      countParams.push(categoryId);
    }

    query += ' ORDER BY modified_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const files = this.db.prepare(query).all(...params);
    const { total } = this.db.prepare(countQuery).get(...countParams) as any;
    return { files, total };
  }

  getFileById(fileId: number): any {
    return this.db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
  }

  getPendingFiles(limit: number = 100): any[] {
    return this.db.prepare("SELECT * FROM files WHERE status = 'pending' ORDER BY modified_at DESC LIMIT ?").all(limit);
  }

  // ---- Category CRUD ----

  getAllCategories(): any[] {
    return this.db.prepare('SELECT * FROM categories ORDER BY priority DESC, id ASC').all();
  }

  createCategory(name: string, parentId: number | null = null, icon = 'folder', color = '#666666'): number {
    const result = this.db.prepare(
      'INSERT INTO categories (name, parent_id, icon, color) VALUES (?, ?, ?, ?)'
    ).run(name, parentId, icon, color);
    return Number(result.lastInsertRowid);
  }

  updateCategory(id: number, fields: Record<string, any>): void {
    const keys = Object.keys(fields);
    const sets = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => fields[k]);
    this.db.prepare(`UPDATE categories SET ${sets} WHERE id = ?`).run(...values, id);
  }

  deleteCategory(id: number): void {
    this.db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  }

  // ---- Rule CRUD ----

  getRulesByCategory(categoryId: number): any[] {
    return this.db.prepare('SELECT * FROM rules WHERE category_id = ? AND enabled = 1').all(categoryId);
  }

  getAllEnabledRules(): any[] {
    return this.db.prepare('SELECT * FROM rules WHERE enabled = 1').all();
  }

  saveRule(rule: { categoryId: number; field: string; operator: string; value: string[]; weight: number }): number {
    const result = this.db.prepare(
      'INSERT INTO rules (category_id, field, operator, value, weight) VALUES (?, ?, ?, ?, ?)'
    ).run(rule.categoryId, rule.field, rule.operator, JSON.stringify(rule.value), rule.weight);
    return Number(result.lastInsertRowid);
  }

  updateRule(id: number, fields: Record<string, any>): void {
    const keys = Object.keys(fields);
    const sets = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => k === 'value' && Array.isArray(fields[k]) ? JSON.stringify(fields[k]) : fields[k]);
    this.db.prepare(`UPDATE rules SET ${sets} WHERE id = ?`).run(...values, id);
  }

  deleteRule(id: number): void {
    this.db.prepare('DELETE FROM rules WHERE id = ?').run(id);
  }

  replaceCategoryRules(categoryId: number, rules: { field: string; operator: string; value: string[]; weight: number }[]): void {
    const transaction = this.db.transaction(() => {
      this.db.prepare('DELETE FROM rules WHERE category_id = ?').run(categoryId);
      const insert = this.db.prepare(
        'INSERT INTO rules (category_id, field, operator, value, weight) VALUES (?, ?, ?, ?, ?)'
      );
      for (const r of rules) {
        insert.run(categoryId, r.field, r.operator, JSON.stringify(r.value), r.weight);
      }
    });
    transaction();
  }

  // ---- FTS ----

  upsertFts(fileId: number, content: string, title: string): void {
    // remove old entry
    this.db.prepare('DELETE FROM fts_index WHERE file_id = ?').run(fileId);
    this.db.prepare('INSERT INTO fts_index (file_id, content, title) VALUES (?, ?, ?)').run(fileId, content, title);
  }

  deleteFts(fileId: number): void {
    this.db.prepare('DELETE FROM fts_index WHERE file_id = ?').run(fileId);
  }

  searchFts(query: string, categoryId?: number, dateFrom?: number, dateTo?: number, page = 1, pageSize = 20): { results: any[]; total: number } {
    const offset = (page - 1) * pageSize;

    // Build the FTS5 query — escape double quotes
    const safeQuery = query.replace(/"/g, '""');
    const ftsQuery = `"${safeQuery}"`;

    let sql = `
      SELECT f.id as file_id, f.name, f.path, f.ext, f.size, f.modified_at,
             c.name as category_name,
             snippet(fts_index, 1, '<mark>', '</mark>', '...', 32) as snippet_content,
             snippet(fts_index, 2, '<mark>', '</mark>', '...', 32) as snippet_title
      FROM fts_index
      JOIN files f ON f.id = fts_index.file_id
      LEFT JOIN categories c ON c.id = f.category_id
      WHERE fts_index MATCH ?
    `;
    const params: any[] = [ftsQuery];

    if (categoryId !== undefined && categoryId !== null) {
      sql += ' AND f.category_id = ?';
      params.push(categoryId);
    }
    if (dateFrom) {
      sql += ' AND f.modified_at >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ' AND f.modified_at <= ?';
      params.push(dateTo);
    }

    // Count first
    const countSql = sql.replace(/SELECT.*?FROM/s, 'SELECT COUNT(*) as total FROM');
    const { total } = this.db.prepare(countSql).get(...params) as any;

    sql += ' ORDER BY rank LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const results = this.db.prepare(sql).all(...params) as any[];

    return { results, total };
  }

  // ---- Stats ----

  getStatus(): { indexed: number; pending: number; error: number } {
    const indexed = (this.db.prepare("SELECT COUNT(*) as c FROM files WHERE status = 'parsed'").get() as any).c;
    const pending = (this.db.prepare("SELECT COUNT(*) as c FROM files WHERE status = 'pending'").get() as any).c;
    const error = (this.db.prepare("SELECT COUNT(*) as c FROM files WHERE status = 'error'").get() as any).c;
    return { indexed, pending, error };
  }

  // ---- Lifecycle ----

  close(): void {
    this.db.close();
  }

  getRawDb(): Database.Database {
    return this.db;
  }
}

import { ipcMain, BrowserWindow } from 'electron';
import { DocDatabase } from './db';
import { classify } from './classifier';
import { searchFiles } from './search';
import { FileWatcher } from './watcher';
import { IPC } from '../shared/constants';

export function registerIpcHandlers(
  db: DocDatabase,
  watcher: FileWatcher,
  enqueue: { enqueue: (path: string, id: number, ext: string) => void },
  config: any,
  scanDirectory: (dir: string) => void
): void {
  // ---- Search ----
  ipcMain.handle(IPC.SEARCH_QUERY, (_event, query) => {
    return searchFiles(db, query);
  });

  // ---- Files list ----
  ipcMain.handle(IPC.FILES_LIST, (_event, { categoryId, page, pageSize }) => {
    const result = db.getFilesByCategory(categoryId, page, pageSize);
    return {
      files: result.files.map((r: any) => ({
        id: r.id,
        path: r.path,
        name: r.name,
        ext: r.ext,
        size: r.size,
        modifiedAt: r.modified_at,
        contentHash: r.content_hash,
        categoryId: r.category_id,
        indexedAt: r.indexed_at,
        status: r.status,
      })),
      total: result.total,
    };
  });

  // ---- Categories ----
  ipcMain.handle(IPC.CATEGORIES_LIST, () => {
    const rows = db.getAllCategories();
    // Map snake_case DB columns to camelCase for frontend
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      parentId: r.parent_id,
      icon: r.icon,
      color: r.color,
      priority: r.priority,
    }));
  });

  // ---- Rules ----
  ipcMain.handle(IPC.RULES_SAVE, (_event, { categoryId, rules }) => {
    db.replaceCategoryRules(categoryId, rules);
  });

  // ---- Watch start ----
  ipcMain.handle(IPC.WATCH_START, (_event, { directories }) => {
    watcher.updatePaths(directories);
    // Do initial scan of existing files
    for (const dir of directories) {
      scanDirectory(dir);
    }
  });

  // ---- File retry ----
  ipcMain.handle(IPC.FILE_RETRY, (_event, { fileId }) => {
    const file = db.getFileById(fileId);
    if (file) {
      db.updateFileStatus(fileId, 'pending');
      enqueue.enqueue(file.path, file.id, file.ext);
    }
  });
}

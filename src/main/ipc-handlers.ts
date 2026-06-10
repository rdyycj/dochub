import { ipcMain, BrowserWindow, shell, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
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
  scanDirectory: (dir: string) => void,
  watchedPaths: string[]
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

  ipcMain.handle(IPC.RULES_GET_BY_CATEGORY, (_event, { categoryId }) => {
    return db.getRulesByCategory(categoryId);
  });

  // ---- Watch start ----
  ipcMain.handle(IPC.WATCH_START, (_event, { directories }) => {
    // Merge with existing watched paths
    const newDirs = directories.filter((d: string) => !watchedPaths.includes(d));
    for (const d of directories) {
      if (!watchedPaths.includes(d)) watchedPaths.push(d);
    }
    // Update watcher with all paths
    watcher.updatePaths([...watchedPaths]);
    // Only scan NEW directories
    for (const dir of newDirs) {
      scanDirectory(dir);
    }
    return [...watchedPaths]; // Return full list to frontend
  });

  // ---- File retry ----
  ipcMain.handle(IPC.FILE_RETRY, (_event, { fileId }) => {
    const file = db.getFileById(fileId);
    if (file) {
      db.updateFileStatus(fileId, 'pending');
      enqueue.enqueue(file.path, file.id, file.ext);
    }
  });

  // ---- File open ----
  ipcMain.handle(IPC.FILE_OPEN, async (_event, { path: filePath }) => {
    const result = await shell.openPath(filePath);
    if (result) {
      console.error(`[DocHub] openPath failed: ${result} - ${filePath}`);
      return { success: false, error: result };
    }
    return { success: true };
  });

  // ---- File export ----
  ipcMain.handle(IPC.FILE_EXPORT, async (_event, { sourcePath }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: path.basename(sourcePath),
      filters: [{ name: 'All Files', extensions: ['*'] }],
    });
    if (canceled || !filePath) return { success: false, canceled: true };

    try {
      fs.copyFileSync(sourcePath, filePath);
      return { success: true, destPath: filePath };
    } catch (e: any) {
      console.error(`[DocHub] exportFile failed:`, e.message);
      return { success: false, error: e.message };
    }
  });
}

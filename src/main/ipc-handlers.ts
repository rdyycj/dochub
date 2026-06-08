import { ipcMain, BrowserWindow } from 'electron';
import { DocDatabase } from './db';
import { classify } from './classifier';
import { searchFiles } from './search';
import { FileWatcher } from './watcher';
import { Scheduler } from './scheduler';
import { IPC } from '../shared/constants';

export function registerIpcHandlers(
  db: DocDatabase,
  watcher: FileWatcher,
  scheduler: Scheduler,
  config: any
): void {
  // ---- Search ----
  ipcMain.handle(IPC.SEARCH_QUERY, (_event, query) => {
    return searchFiles(db, query);
  });

  // ---- Files list ----
  ipcMain.handle(IPC.FILES_LIST, (_event, { categoryId, page, pageSize }) => {
    return db.getFilesByCategory(categoryId, page, pageSize);
  });

  // ---- Categories ----
  ipcMain.handle(IPC.CATEGORIES_LIST, () => {
    return db.getAllCategories();
  });

  // ---- Rules ----
  ipcMain.handle(IPC.RULES_SAVE, (_event, { categoryId, rules }) => {
    db.replaceCategoryRules(categoryId, rules);
  });

  // ---- Watch start ----
  ipcMain.handle(IPC.WATCH_START, (_event, { directories }) => {
    watcher.updatePaths(directories);
  });

  // ---- File retry ----
  ipcMain.handle(IPC.FILE_RETRY, (_event, { fileId }) => {
    const file = db.getFileById(fileId);
    if (file) {
      db.updateFileStatus(fileId, 'pending');
      scheduler.enqueue({
        filePath: file.path,
        fileId: file.id,
        ext: file.ext,
      });
    }
  });
}

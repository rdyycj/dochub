import { contextBridge, ipcRenderer, webUtils } from 'electron';

// Inlined constants (no external imports — preload runs in sandbox)
const IPC = {
  SEARCH_QUERY: 'search:query',
  FILES_LIST: 'files:list',
  CATEGORIES_LIST: 'categories:list',
  RULES_SAVE: 'rules:save',
  RULES_GET_BY_CATEGORY: 'rules:get-by-category',
  RECLASSIFY_ALL: 'classify:reclassify-all',
  WATCH_START: 'watch:start',
  FILE_RETRY: 'file:retry',
  FILE_OPEN: 'file:open',
  FILE_EXPORT: 'file:export',
  STATUS_UPDATE: 'status:update',
  FILE_INDEXED: 'file:indexed',
} as const;

const api = {
  search: (query: any) => ipcRenderer.invoke(IPC.SEARCH_QUERY, query),
  listFiles: (params: any) => ipcRenderer.invoke(IPC.FILES_LIST, params),
  listCategories: () => ipcRenderer.invoke(IPC.CATEGORIES_LIST),
  saveRules: (categoryId: number, rules: any[]) =>
    ipcRenderer.invoke(IPC.RULES_SAVE, { categoryId, rules }),
  getCategoryRules: (categoryId: number) =>
    ipcRenderer.invoke(IPC.RULES_GET_BY_CATEGORY, { categoryId }),
  reclassifyAll: () =>
    ipcRenderer.invoke(IPC.RECLASSIFY_ALL),
  startWatch: (directories: string[]) =>
    ipcRenderer.invoke(IPC.WATCH_START, { directories }),
  retryFile: (fileId: number) =>
    ipcRenderer.invoke(IPC.FILE_RETRY, { fileId }),
  // Resolve File object path from drag-and-drop
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  openFile: (path: string) => ipcRenderer.invoke(IPC.FILE_OPEN, { path }),
  exportFile: (sourcePath: string) => ipcRenderer.invoke(IPC.FILE_EXPORT, { sourcePath }),

  onStatusUpdate: (callback: (status: any) => void) => {
    const handler = (_event: any, status: any) => callback(status);
    ipcRenderer.on(IPC.STATUS_UPDATE, handler);
    return () => { ipcRenderer.removeListener(IPC.STATUS_UPDATE, handler); };
  },
  onFileIndexed: (callback: (file: any) => void) => {
    const handler = (_event: any, file: any) => callback(file);
    ipcRenderer.on(IPC.FILE_INDEXED, handler);
    return () => { ipcRenderer.removeListener(IPC.FILE_INDEXED, handler); };
  },
};

contextBridge.exposeInMainWorld('docHub', api);

export type DocHubApi = typeof api;
